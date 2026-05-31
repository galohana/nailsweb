// Vercel Serverless Function — verifies a 4-digit OTP.
// Reads the code from the shared `otp_store` JSONB key in Supabase settings.
// Deletes the phone entry on success or expiry.

import { createClient } from '@supabase/supabase-js';

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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = parseBody(req);
  const digits = normalize(body.phone);
  const code   = String(body.code || '').trim();

  if (!digits || !code || code.length !== 4) {
    return res.status(400).json({ ok: false, error: 'invalid_input' });
  }

  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_KEY;
  if (!url || !key) return res.status(500).json({ ok: false, error: 'server_misconfigured' });
  const supabase = createClient(url, key);

  try {
    const { data } = await supabase.from('settings').select('value').eq('key', 'otp_store').maybeSingle();
    const store = (data?.value && typeof data.value === 'object') ? data.value : {};
    const stored = store[digits];

    if (!stored?.code) {
      return res.status(200).json({ ok: false, error: 'not_found' });
    }

    if (Date.now() > Number(stored.expires || 0)) {
      // Cleanup expired entry
      const { [digits]: _, ...rest } = store;
      await supabase.from('settings').upsert(
        { key: 'otp_store', value: rest, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
      return res.status(200).json({ ok: false, error: 'expired' });
    }

    if (String(stored.code) !== code) {
      return res.status(200).json({ ok: false, error: 'mismatch' });
    }

    // Success — consume the code
    const { [digits]: _consumed, ...remaining } = store;
    await supabase.from('settings').upsert(
      { key: 'otp_store', value: remaining, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[verify-otp] error:', e?.message || e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
}
