// Serverless endpoint called every 15 minutes by cron-job.org (external free cron).
// Logic:
//   1. If reminders are disabled in settings → skip (return 200).
//   2. Calculate the target datetime = now + hoursBefore hours (Israel timezone).
//   3. Find confirmed appointments on that date whose time is within ±8 minutes
//      of the target time, and whose reminder_sent = false.
//   4. Send SMS via Twilio, mark reminder_sent = true.
//
// Credentials used (server-side only, no VITE_ exposure risk):
//   VITE_SUPABASE_URL, VITE_SUPABASE_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE

import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';

// Normalize Israeli phone numbers to E.164 (+972...)
function toE164(phone) {
  if (!phone) return null;
  const p = String(phone).replace(/[\s\-().]/g, '');
  if (p.startsWith('+'))                        return p;
  if (p.startsWith('972'))                      return '+' + p;
  if (p.startsWith('05') || p.startsWith('07')) return '+972' + p.slice(1);
  return p;
}

export default async function handler(req, res) {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_KEY,
  );

  try {
    // ── 1. Load reminder settings + template from Supabase ────────
    const [adminRow, tplRow] = await Promise.all([
      supabase.from('settings').select('value').eq('key', 'adminSettings').maybeSingle(),
      supabase.from('settings').select('value').eq('key', 'smsTemplates').maybeSingle(),
    ]);

    const reminders = adminRow.data?.value?.reminders;

    if (!reminders?.send) {
      return res.status(200).json({ ok: true, skipped: 'reminders disabled' });
    }

    const hoursBefore = Number(reminders.hoursBefore) || 24;

    // Template for client reminder; if missing or disabled → skip / use default
    const DEFAULT_REMINDER = 'היי {name} 💕\nתזכורת לתורך!\nשירות: {service}\nתאריך: {date}\nשעה: {time}\nמחכות לך! ✨';
    const tpl = tplRow.data?.value?.client?.reminder;
    if (tpl && tpl.enabled === false) {
      return res.status(200).json({ ok: true, skipped: 'reminder template disabled' });
    }
    const tplText = tpl?.text || DEFAULT_REMINDER;

    // ── 2. Target datetime = now + hoursBefore (Israel timezone) ──
    // Runs every 15 min → use ±8 min window to guarantee each slot is caught exactly once.
    const targetUTC = new Date(Date.now() + hoursBefore * 3600 * 1000);

    // en-CA → 'YYYY-MM-DD'   |   en-GB hour12:false → 'HH:MM'
    const dateStr = targetUTC.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
    const timeStr = targetUTC
      .toLocaleTimeString('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hour12: false })
      .substring(0, 5);

    const [th, tm] = timeStr.split(':').map(Number);
    const targetMin = th * 60 + tm;

    // ── 3. Query appointments for the target date ─────────────────
    const { data: apts } = await supabase
      .from('appointments')
      .select('*')
      .eq('date', dateStr)
      .eq('status', 'confirmed')
      .eq('reminder_sent', false);

    if (!apts || apts.length === 0) {
      return res.status(200).json({ ok: true, sent: 0, date: dateStr, time: timeStr });
    }

    // ── 4. Keep only appointments within ±8 minutes of target time ─
    const toSend = apts.filter(a => {
      const t = (a.time || '').substring(0, 5); // 'HH:MM'
      const [ah, am] = t.split(':').map(Number);
      if (isNaN(ah) || isNaN(am)) return false;
      const diff = Math.abs(ah * 60 + am - targetMin);
      return diff <= 8;
    });

    if (toSend.length === 0) {
      return res.status(200).json({ ok: true, sent: 0, date: dateStr, time: timeStr });
    }

    // ── 5. Check Twilio credentials ───────────────────────────────
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE } = process.env;
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      return res.status(200).json({ ok: true, skipped: 'no twilio', would_send: toSend.length });
    }

    const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

    // ── 6. Send SMS + mark reminder_sent = true ───────────────────
    const results = await Promise.allSettled(
      toSend.map(async (apt) => {
        // Prefer phone from clients table; fallback to phone stored in appointment
        const { data: clientRow } = await supabase
          .from('clients')
          .select('phone')
          .eq('phone', apt.phone)
          .maybeSingle();

        const phone = toE164(clientRow?.phone || apt.phone);
        if (!phone) throw new Error(`Missing phone for appointment ${apt.id}`);

        const time = (apt.time || '').substring(0, 5);
        const body = tplText.replace(/\{(\w+)\}/g, (_, k) => {
          if (k === 'name')    return apt.user_name || '';
          if (k === 'service') return apt.service_name || '';
          if (k === 'date')    return apt.date || '';
          if (k === 'time')    return time || '';
          return '';
        });

        await twilioClient.messages.create({ body, from: TWILIO_PHONE, to: phone });

        // Mark as sent — prevents double-send on the next cron run
        await supabase
          .from('appointments')
          .update({ reminder_sent: true })
          .eq('id', apt.id);
      })
    );

    const sent   = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`[cron-reminders] date=${dateStr} time=${timeStr} sent=${sent} failed=${failed}`);
    res.status(200).json({ ok: true, sent, failed, total: toSend.length, date: dateStr, time: timeStr });

  } catch (err) {
    console.error('[cron-reminders] fatal:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
}
