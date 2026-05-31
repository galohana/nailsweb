// Vercel Serverless Function — generates and sends a 4-digit OTP via SMS.
// Stores the code inside the shared `otp_store` JSONB key (avoids RLS INSERT block for new phones).
// Code expires after 5 minutes. Rate-limited to 1 request per 60s per phone.

import twilio from 'twilio';
import { createClient } from '@supabase/supabase-js';

function toE164(phone) {
  if (!phone) return null;
  const p = String(phone).replace(/[\s\-().]/g, '');
  if (p.startsWith('+'))                        return p;
  if (p.startsWith('972'))                      return '+' + p;
  if (p.startsWith('05') || p.startsWith('07')) return '+972' + p.slice(1);
  return p;
}

function normalize(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

const DEFAULT_OTP_TEXT = 'קוד האימות שלך ל{business}: {code}\nתקף ל-5 דקות.';

async function loadBusinessName(supabase) {
  try {
    const { data } = await supabase.from('settings').select('value').eq('key', 'clinicInfo').maybeSingle();
    return data?.value?.name || '';
  } catch { return ''; }
}

async function loadOtpTemplate(supabase) {
  try {
    const { data } = await supabase.from('settings').select('value').eq('key', 'smsTemplates').maybeSingle();
    const tpl = data?.value?.client?.otp;
    if (tpl && tpl.enabled !== false && tpl.text) return tpl.text;
    return DEFAULT_OTP_TEXT;
  } catch { return DEFAULT_OTP_TEXT; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = parseBody(req);
  const digits = normalize(body.phone);
  if (!digits || digits.length < 9 || digits.length > 10) {
    return res.status(400).json({ ok: false, error: 'invalid_phone' });
  }

  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_KEY;
  if (!url || !key) {
    console.warn('[send-otp] supabase env missing');
    return res.status(500).json({ ok: false, error: 'server_misconfigured' });
  }
  const supabase = createClient(url, key);

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE) {
    console.warn('[send-otp] twilio env missing');
    return res.status(500).json({ ok: false, error: 'sms_unavailable' });
  }

  // Load shared otp_store object
  let store = {};
  try {
    const { data } = await supabase.from('settings').select('value').eq('key', 'otp_store').maybeSingle();
    if (data?.value && typeof data.value === 'object') store = data.value;
  } catch (e) { console.warn('[send-otp] otp_store read failed:', e.message); }

  // Rate limit: 1 request per 60s per phone
  const existing = store[digits];
  if (existing?.created) {
    const ageMs = Date.now() - existing.created;
    if (ageMs < 60_000) {
      return res.status(429).json({ ok: false, error: 'rate_limited', retryAfter: Math.ceil((60_000 - ageMs) / 1000) });
    }
  }

  // Generate 4-digit code (1000-9999)
  const code = String(Math.floor(1000 + Math.random() * 9000));
  const now = Date.now();
  const expires = now + 5 * 60_000;

  // Update store and persist
  store[digits] = { code, created: now, expires };
  try {
    await supabase.from('settings').upsert(
      { key: 'otp_store', value: store, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
  } catch (e) {
    console.error('[send-otp] store failed:', e.message);
    return res.status(500).json({ ok: false, error: 'store_failed' });
  }

  // Send SMS
  try {
    const business = await loadBusinessName(supabase);
    const tplText = await loadOtpTemplate(supabase);
    const text = tplText.replace(/\{(\w+)\}/g, (_, k) => {
      if (k === 'code')     return code;
      if (k === 'business') return business;
      return '';
    });
    const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    const to = toE164(digits);
    const msg = await twilioClient.messages.create({ body: text, from: TWILIO_PHONE, to });
    console.log('[send-otp] sent to', to, 'sid=', msg.sid);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[send-otp] twilio error:', err?.message || err);
    return res.status(200).json({ ok: false, error: 'sms_failed', detail: err?.message || String(err) });
  }
}
