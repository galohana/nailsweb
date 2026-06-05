// Serverless endpoint נקרא כל 15 דקות (cron-job.org).
// push-first, SMS fallback לפי push_settings:
//   • client.reminder1 / reminder2 — תזכורות לפני תור, offset לבחירה.
//   • admin.daily_summary — push יומי לבעלת העסק עם סיכום תורי היום.
//   • admin.weekly_reminder — push שבועי לבעלת העסק לסידור לוח עבודה.

import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';
import { hasActiveSubscription, firePushEvent, sendPushToAudience } from './_push.js';

const OFFSET_MIN = { '30m': 30, '1h': 60, '2h': 120, '3h': 180, '12h': 720, '1d': 1440, '2d': 2880 };
const WINDOW = 8;

function toE164(phone) {
  if (!phone) return null;
  const p = String(phone).replace(/[\s\-().]/g, '');
  if (p.startsWith('+'))                        return p;
  if (p.startsWith('972'))                      return '+' + p;
  if (p.startsWith('05') || p.startsWith('07')) return '+972' + p.slice(1);
  return p;
}

const ilDate = (ms) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
const ilTime = (ms) => new Date(ms).toLocaleTimeString('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hour12: false }).slice(0, 5);
const toMin  = (hhmm) => { const [h, m] = String(hhmm || '').split(':').map(Number); return (h || 0) * 60 + (m || 0); };

export default async function handler(req, res) {
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_KEY);

  try {
    const [psRow, ciRow, srRow] = await Promise.all([
      supabase.from('settings').select('value').eq('key', 'push_settings').maybeSingle(),
      supabase.from('settings').select('value').eq('key', 'clinicInfo').maybeSingle(),
      supabase.from('settings').select('value').eq('key', 'sentReminders').maybeSingle(),
    ]);

    const push     = psRow.data?.value || {};
    const business = ciRow.data?.value?.name || '';
    const sent     = srRow.data?.value || {};
    const clientCfg = push.client || {};

    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE } = process.env;
    const twilioClient = (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) : null;

    const now = Date.now();
    let pushed = 0, smsed = 0, summary = 0, weekly = 0;

    // ── תזכורות ללקוחות (reminder1 + reminder2) ──────────────────
    for (const rkey of ['reminder1', 'reminder2']) {
      const rcfg = clientCfg[rkey];
      if (!rcfg || rcfg.enabled === false) continue;

      const offMin    = OFFSET_MIN[rcfg.offset] || 1440;
      const targetMs  = now + offMin * 60000;
      const dateStr   = ilDate(targetMs);
      const targetMin = toMin(ilTime(targetMs));

      const { data: apts } = await supabase
        .from('appointments').select('*')
        .eq('date', dateStr).eq('status', 'confirmed');

      for (const a of (apts || [])) {
        const t = (a.time || '').slice(0, 5);
        if (Math.abs(toMin(t) - targetMin) > WINDOW) continue;
        if (sent[a.id]?.[rkey]) continue;

        const phone  = a.phone;
        const hasSub = phone ? await hasActiveSubscription('client', phone) : false;

        if (hasSub) {
          await firePushEvent({ audience: 'client', key: rkey, user_identifier: phone, business, url: '/' });
          pushed++;
        } else if (twilioClient && phone) {
          const body = `${(rcfg.text || 'תזכורת לתור').trim()} 📅 ${a.date} ${t}`;
          const to = toE164(phone);
          if (to) { try { await twilioClient.messages.create({ body, from: TWILIO_PHONE, to }); smsed++; } catch (e) { console.error('[cron] sms:', e.message); } }
        }
        sent[a.id] = { ...(sent[a.id] || {}), [rkey]: true };
      }
    }

    // ── סיכום יומי לבעלת העסק (push) ─────────────────────────────
    const ds = push.admin?.daily_summary;
    if (ds?.enabled) {
      const today   = ilDate(now);
      const curMin  = toMin(ilTime(now));
      if (Math.abs(curMin - toMin(ds.time || '08:00')) <= WINDOW && sent._dailySummary !== today) {
        const { data: todayApts } = await supabase
          .from('appointments').select('id').eq('date', today).eq('status', 'confirmed');
        const count = (todayApts || []).length;
        const body = count > 0
          ? `${(ds.text || 'סיכום היום').trim()} — ${count} תורים היום`
          : `${(ds.text || 'סיכום היום').trim()} — אין תורים היום`;
        await sendPushToAudience({ user_type: 'admin', user_identifier: 'admin', title: business || 'RISE', body, url: '/manage-x7k2' });
        sent._dailySummary = today;
        summary = 1;
      }
    }

    // ── תזכורת שבועית לבעלת העסק (push) ─────────────────────────
    const wr = push.admin?.weekly_reminder;
    if (wr?.enabled) {
      const targetDay  = typeof wr.day  === 'number' ? wr.day  : 0;
      const targetHour = typeof wr.hour === 'number' ? wr.hour : 9;
      const targetMinW = targetHour * 60;

      const DOW_MAP = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      const ilDayStr = new Date(now).toLocaleDateString('en-US', { timeZone: 'Asia/Jerusalem', weekday: 'short' });
      const curDay   = DOW_MAP[ilDayStr] ?? -1;

      if (curDay === targetDay && Math.abs(toMin(ilTime(now)) - targetMinW) <= WINDOW) {
        const weekKey = (() => {
          const d = new Date(now);
          const thu = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 4 - (d.getUTCDay() || 7)));
          const ys  = new Date(Date.UTC(thu.getUTCFullYear(), 0, 1));
          const wn  = Math.ceil((((thu - ys) / 86400000) + 1) / 7);
          return `${thu.getUTCFullYear()}-${String(wn).padStart(2, '0')}`;
        })();

        if (sent._weeklyReminder !== weekKey) {
          const wrText = (wr.text && String(wr.text).trim()) || 'תזכורת: סדרי את לוח העבודה לשבוע הבא 📅';
          await sendPushToAudience({ user_type: 'admin', user_identifier: 'admin', title: business || 'RISE', body: wrText, url: '/manage-x7k2' });
          sent._weeklyReminder = weekKey;
          weekly = 1;
        }
      }
    }

    // ── ניקוי: מסירים רשומות sent של תורים שכבר עברו ──────────────
    const today = ilDate(now);
    const aptIds = Object.keys(sent).filter(k => !k.startsWith('_'));
    if (aptIds.length > 200) {
      const { data: future } = await supabase
        .from('appointments').select('id').gte('date', today);
      const keep = new Set((future || []).map(a => String(a.id)));
      for (const id of aptIds) if (!keep.has(String(id))) delete sent[id];
    }

    await supabase.from('settings').upsert(
      { key: 'sentReminders', value: sent, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );

    return res.status(200).json({ ok: true, pushed, smsed, summary, weekly });
  } catch (err) {
    console.error('[cron-reminders] fatal:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
