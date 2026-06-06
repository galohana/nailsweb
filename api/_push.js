// Shared Web Push core (Node) — מיובא ע"י send-push / notify / cron.
// קידומת "_" → Vercel לא מנתב את הקובץ כ-endpoint.
//
// קריאת push_subscriptions דורשת service_role (RLS: SELECT ל-service בלבד).
// ⚠️ SUPABASE_SERVICE_KEY חייב להיות מוגדר ב-Vercel env, אחרת הקריאה נחסמת ב-RLS.

import webpush from 'web-push';
import twilio from 'twilio';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_TEXTS = {
  admin: {
    new_booking: 'תור חדש נקבע! 📅', pending_booking: 'בקשת תור חדשה ממתינה לאישורך ⏳',
    cancellation: 'תור בוטל ❌', new_client: 'לקוחה חדשה הצטרפה 🌸',
    waitlist_join: 'לקוחה נכנסה לרשימת המתנה', waitlist_promoted: 'לקוחה עברה מהמתנה לתור ✅',
    shop_order_pending: 'הזמנה ממתינה לאישורך 🛍️', shop_purchase: 'קנייה חדשה בחנות! 💰',
  },
  client: {
    reminder1: 'תזכורת: יש לך תור מחר 💅', reminder2: 'תזכורת: התור שלך מתקרב ⏰',
    appointment_confirmed: 'התשלום אושר, התור שלך מאושר! ✅',
    appointment_approved: 'התור שלך אושר! ✅',
    shop_payment_confirmed: 'הקנייה אושרה! 🛍️', shop_order_confirmed: 'ההזמנה שלך אושרה ✅',
    welcome: 'ברוכה הבאה! שמחים שהצטרפת 🌸',
    waitlist_available: 'התפנה מקום בתאריך שביקשת! מהרי לקבוע תור 🎉',
  },
};

function toE164(phone) {
  if (!phone) return null;
  const p = String(phone).replace(/[\s\-().]/g, '');
  if (p.startsWith('+'))                        return p;
  if (p.startsWith('972'))                      return '+' + p;
  if (p.startsWith('05') || p.startsWith('07')) return '+972' + p.slice(1);
  return p;
}

const SUPABASE_URL  = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_KEY;
const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:boltagent8@gmail.com';

let _vapidReady = false;
function ensureVapid() {
  if (_vapidReady) return true;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return false;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  _vapidReady = true;
  return true;
}

function sb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

export async function hasActiveSubscription(user_type, user_identifier) {
  if (!SUPABASE_URL || !SERVICE_KEY) return false;
  try {
    const { data } = await sb()
      .from('push_subscriptions')
      .select('id')
      .eq('active', true)
      .eq('user_type', user_type)
      .eq('user_identifier', String(user_identifier))
      .limit(1);
    return Array.isArray(data) && data.length > 0;
  } catch { return false; }
}

export async function sendPushToAudience({ user_type, user_identifier, title, body, url }) {
  if (!ensureVapid())                              return { sent: 0, failed: 0, skipped: 'no-vapid' };
  if (!user_type || !user_identifier || !title)    return { sent: 0, failed: 0, skipped: 'missing-args' };
  if (!SUPABASE_URL || !SERVICE_KEY)               return { sent: 0, failed: 0, skipped: 'no-supabase' };

  const supabase = sb();
  const { data: rows, error } = await supabase
    .from('push_subscriptions')
    .select('id, subscription')
    .eq('active', true)
    .eq('user_type', user_type)
    .eq('user_identifier', String(user_identifier));
  if (error || !rows || !rows.length) return { sent: 0, failed: 0 };

  const payload = JSON.stringify({ title, body: body || '', url: url || '/' });
  let sent = 0, failed = 0;
  await Promise.all(rows.map(async (row) => {
    try { await webpush.sendNotification(row.subscription, payload); sent++; }
    catch (err) {
      failed++;
      const code = err?.statusCode;
      if (code === 404 || code === 410) {
        try { await supabase.from('push_subscriptions').update({ active: false }).eq('id', row.id); } catch {}
      }
    }
  }));
  return { sent, failed };
}

let _settings = undefined;
async function loadPushSettings() {
  if (_settings !== undefined) return _settings;
  try {
    const { data } = await sb().from('settings').select('value').eq('key', 'push_settings').maybeSingle();
    _settings = data?.value || null;
  } catch { _settings = null; }
  return _settings;
}

export async function firePushEvent({ audience, key, user_identifier, url, business }) {
  const settings = await loadPushSettings();
  const cfg = settings?.[audience]?.[key];
  if (cfg && cfg.enabled === false) return { skipped: 'disabled' };
  const body = (cfg?.text && String(cfg.text).trim()) || DEFAULT_TEXTS[audience]?.[key] || '';
  if (!body) return { skipped: 'no-text' };
  return sendPushToAudience({
    user_type: audience,
    user_identifier: user_identifier || audience,
    title: business || 'RISE',
    body,
    url: url || (audience === 'admin' ? '/manage-x7k2' : '/'),
  });
}

export async function firePushOrSms({ key, user_identifier, business, url, extra }) {
  if (!user_identifier) return { skipped: 'no-id' };
  const settings = await loadPushSettings();
  const cfg = settings?.client?.[key];
  if (cfg && cfg.enabled === false) return { skipped: 'disabled' };
  const text = (cfg?.text && String(cfg.text).trim()) || DEFAULT_TEXTS.client?.[key] || '';
  if (!text) return { skipped: 'no-text' };

  if (await hasActiveSubscription('client', user_identifier)) {
    const r = await sendPushToAudience({ user_type: 'client', user_identifier, title: business || 'RISE', body: text, url: url || '/' });
    return { channel: 'push', ...r };
  }

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE) return { skipped: 'no-twilio' };
  const to = toE164(user_identifier);
  if (!to) return { skipped: 'no-phone' };
  const body = extra ? `${text} ${extra}` : text;
  try {
    await twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN).messages.create({ body, from: TWILIO_PHONE, to });
    return { channel: 'sms' };
  } catch (e) { return { error: e.message }; }
}
