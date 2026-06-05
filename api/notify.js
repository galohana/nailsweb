// Vercel Serverless (Node) — push-only notification router.
// Telegram הוסר לחלוטין. כל אירוע → Web Push (אדמין/לקוחה) לפי push_settings.
// SMS ללקוחות נשאר רק כ-fallback בתזכורות (api/cron-reminders.js), לא כאן.
//
// body: { type, clientPhone?, ... }  →  { ok, sent?, failed?, skipped? }

import { createClient } from '@supabase/supabase-js';
import { firePushEvent, firePushOrSms } from './_push.js';

// notify type → { audience, key } ב-push_settings
const PUSH_MAP = {
  // ── אדמין (בעלת העסק) ──
  new_appointment:        { audience: 'admin', key: 'new_booking' },
  cancellation:           { audience: 'admin', key: 'cancellation' },
  new_client:             { audience: 'admin', key: 'new_client' },
  waitlist_join:          { audience: 'admin', key: 'waitlist_join' },
  waitlist_filled:        { audience: 'admin', key: 'waitlist_promoted' },
  order_new:              { audience: 'admin', key: 'shop_order_pending' },
  order_purchase:         { audience: 'admin', key: 'shop_purchase' },
  appointment_paid:       { audience: 'admin', key: 'new_booking' }, // mapped to generic admin push
  // ── לקוחה (אישורים מתוך לוח הניהול) ──
  appointment_confirmed:  { audience: 'client', key: 'appointment_confirmed' },
  shop_payment_confirmed: { audience: 'client', key: 'shop_payment_confirmed' },
  shop_order_confirmed:   { audience: 'client', key: 'shop_order_confirmed' },
  welcome:                { audience: 'client', key: 'welcome' },
};

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return req.body;
}

async function loadBusiness() {
  try {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_KEY;
    if (!url || !key) return '';
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data } = await supabase.from('settings').select('value').eq('key', 'clinicInfo').maybeSingle();
    return data?.value?.name || '';
  } catch { return ''; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = parseBody(req);
  const { type } = body;

  // ── waitlist_available — התראה מיידית ללקוחה: push, ואם אין subscription → SMS ──
  if (type === 'waitlist_available') {
    if (!body.clientPhone) return res.status(200).json({ ok: true, skipped: 'no client phone' });
    const business = await loadBusiness();
    try {
      const r = await firePushOrSms({
        key: 'waitlist_available', user_identifier: body.clientPhone, business,
        url: '/booking', extra: body.date ? `📅 ${body.date}` : '',
      });
      return res.status(200).json({ ok: true, ...r });
    } catch (e) { return res.status(200).json({ ok: false, error: e.message }); }
  }

  const map = PUSH_MAP[type];
  if (!map) {
    return res.status(200).json({ ok: true, skipped: `type ${type} not handled` });
  }

  const business = await loadBusiness();
  const user_identifier = map.audience === 'admin' ? 'admin' : (body.clientPhone || '');
  if (map.audience === 'client' && !user_identifier) {
    return res.status(200).json({ ok: true, skipped: 'no client phone' });
  }

  try {
    const result = await firePushEvent({ audience: map.audience, key: map.key, user_identifier, business });
    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    console.error('[notify] push failed:', e.message);
    return res.status(200).json({ ok: false, error: e.message });
  }
}
