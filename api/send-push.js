// Vercel Serverless Function (Node) — endpoint ציבורי לשליחת Web Push.
// נקרא מה-client (welcome push) ומצד-שרת. הליבה ב-api/_push.js.
//
// body: { user_type, user_identifier, title, body, url }  →  { sent, failed }
// ⚠️ VAPID_PRIVATE_KEY + SUPABASE_SERVICE_KEY חיים רק ב-env השרת.

import { sendPushToAudience } from './_push.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { user_type, user_identifier, title, body, url } = b;
    if (!user_type || !user_identifier || !title) {
      return res.status(400).json({ error: 'user_type, user_identifier, title required' });
    }
    const result = await sendPushToAudience({ user_type, user_identifier, title, body, url });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
