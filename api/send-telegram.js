// Vercel Serverless — sends a Telegram message to the business owner.
// Called internally from notify.js (owner notifications) and optionally from
// client code when a direct send is needed.
//
// Body: { chatId?, message, buttons? }
//   chatId  — optional; if omitted, loaded from Supabase settings.telegramChatId
//   message — plain text or HTML (parse_mode: HTML)
//   buttons — array of inline_keyboard rows, e.g.
//             [[{text:'❌ דחה', callback_data:'reject_order:123'}]]
//
// Env vars required: TELEGRAM_BOT_TOKEN, VITE_SUPABASE_URL, VITE_SUPABASE_KEY

import { createClient } from '@supabase/supabase-js';

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return req.body;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { chatId: explicitChatId, message, buttons } = parseBody(req);
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    console.warn('[send-telegram] TELEGRAM_BOT_TOKEN missing');
    return res.status(200).json({ ok: false, error: 'no token' });
  }

  if (!message) {
    return res.status(200).json({ ok: false, error: 'message is required' });
  }

  // Load chatId from Supabase if not supplied directly
  let chatId = explicitChatId;
  if (!chatId) {
    try {
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL,
        process.env.VITE_SUPABASE_KEY,
      );
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'telegramChatId')
        .maybeSingle();
      chatId = data?.value || null;
    } catch (e) {
      console.warn('[send-telegram] failed to load chatId:', e.message);
    }
  }

  if (!chatId) {
    console.warn('[send-telegram] telegramChatId not configured — message skipped');
    return res.status(200).json({ ok: false, error: 'no chatId' });
  }

  const payload = {
    chat_id: chatId,
    text: message,
    parse_mode: 'HTML',
  };
  if (Array.isArray(buttons) && buttons.length) {
    payload.reply_markup = { inline_keyboard: buttons };
  }

  try {
    const resp = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
    );
    const data = await resp.json();
    if (!data.ok) {
      console.error('[send-telegram] Telegram API error:', data);
      return res.status(200).json({ ok: false, error: data.description });
    }
    console.log('[send-telegram] ✓ sent message_id=', data.result?.message_id);
    return res.status(200).json({ ok: true, messageId: data.result?.message_id });
  } catch (e) {
    console.error('[send-telegram] network error:', e.message);
    return res.status(200).json({ ok: false, error: e.message });
  }
}
