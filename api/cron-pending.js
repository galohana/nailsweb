// api/cron-pending.js — called every hour by cron-job.org
// Notifies owner + client about pending appointments that haven't been approved in 24h.
// Repeats every 24h until the appointment is approved or cancelled.

import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';
import { sendPushToAudience } from './_push.js';

const ONE_H = 60 * 60 * 1000;
const TWENTY_FOUR_H = 24 * 60 * 60 * 1000;

function toE164(phone) {
  if (!phone) return null;
  const p = String(phone).replace(/[\s\-().]/g, '');
  if (p.startsWith('+'))                        return p;
  if (p.startsWith('972'))                      return '+' + p;
  if (p.startsWith('05') || p.startsWith('07')) return '+972' + p.slice(1);
  return p;
}

function sb() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_KEY;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function sendSms(body, to) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE) return;
  const dest = toE164(to);
  if (!dest) return;
  try { await twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN).messages.create({ body, from: TWILIO_PHONE, to: dest }); } catch {}
}

export default async function handler(req, res) {
  const supabase = sb();
  try {
    // 1. Skip if auto-approve is on — no pending appointments expected
    const { data: approvalRow } = await supabase.from('settings').select('value').eq('key', 'approvalSettings').maybeSingle();
    const approval = approvalRow?.value;
    if (!approval || approval.autoApprove !== false) {
      return res.status(200).json({ ok: true, skipped: 'auto-approve-on' });
    }

    // 2. Business name for push title
    const { data: infoRow } = await supabase.from('settings').select('value').eq('key', 'clinicInfo').maybeSingle();
    const business = infoRow?.value?.name || '';

    // 3. All pending appointments
    const { data: pending } = await supabase.from('appointments').select('*').eq('status', 'pending');
    if (!pending || pending.length === 0) return res.status(200).json({ ok: true, pending: 0 });

    // 4. Load notification log { [aptId]: lastSentMs }
    const { data: logRow } = await supabase.from('settings').select('value').eq('key', 'pending_notif_log').maybeSingle();
    const log = (logRow?.value && typeof logRow.value === 'object') ? { ...logRow.value } : {};

    const now = Date.now();
    const logUpdated = { ...log };
    let notified = 0;

    for (const apt of pending) {
      const createdAt = apt.created_at ? new Date(apt.created_at).getTime() : 0;
      if (now - createdAt < ONE_H) continue;                   // too fresh — wait at least 1h
      if (log[apt.id] && now - log[apt.id] < TWENTY_FOUR_H) continue;  // notified recently

      const name = apt.user_name || '';
      const time = (apt.time || '').slice(0, 5);
      const date = apt.date || '';
      const ownerMsg = `שים לב, עדיין לא אישרת את התור של ${name} בשעה ${time} בתאריך ${date}. יש לאשר או לבטל בהקדם.`;
      const clientMsg = 'שים לב, התור שלך עדיין לא אושר. יש לדבר עם בעל העסק או לקבוע תור חדש.';
      const title = business || 'הודעה';

      // Push → owner
      const ownerPush = await sendPushToAudience({ user_type: 'admin', user_identifier: 'admin', title, body: ownerMsg, url: '/manage-x7k2' });
      if (ownerPush.sent === 0) await sendSms(ownerMsg, process.env.OWNER_PHONE);

      // Push → client (SMS fallback)
      const clientPhone = toE164(apt.phone);
      if (clientPhone) {
        const clientPush = await sendPushToAudience({ user_type: 'client', user_identifier: clientPhone, title, body: clientMsg, url: '/' });
        if (clientPush.sent === 0) await sendSms(clientMsg, clientPhone);
      }

      logUpdated[apt.id] = now;
      notified++;
    }

    // 5. Persist updated log
    if (notified > 0) {
      await supabase.from('settings').upsert({ key: 'pending_notif_log', value: logUpdated });
    }

    return res.status(200).json({ ok: true, pending: pending.length, notified });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
