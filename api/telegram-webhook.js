// Vercel Serverless — receives Telegram callback_query events (inline button presses).
//
// Supported callback_data values:
//   cancel_apt:{aptId}       → cancel appointment in DB + confirm to owner
//   approve_order:{id}       → remove from pendingPayments + confirm to owner
//   reject_order:{id}        → remove from pendingPayments + confirm to owner
//   confirm_order:{orderId}  → mark orders row status='confirmed' + confirm to owner
//   confirm_payment:{paymentId} → remove appointment from pendingPayments + confirm
//
// The client is NOT notified (as per spec) — she sees the updated status on the website.
// Register this webhook once via /api/register-telegram-webhook.

import { createClient } from '@supabase/supabase-js';

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return req.body;
}

async function tgPost(token, method, payload) {
  const resp = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return resp.json();
}

async function sendMsg(token, chatId, text) {
  return tgPost(token, 'sendMessage', { chat_id: chatId, text, parse_mode: 'HTML' });
}

export default async function handler(req, res) {
  // Telegram sends POST for all updates; return 200 immediately so it doesn't retry
  res.status(200).json({ ok: true });

  if (req.method !== 'POST') return;

  const body    = parseBody(req);
  const cb      = body?.callback_query;
  if (!cb) return; // not a button press — ignore

  const token   = process.env.TELEGRAM_BOT_TOKEN;
  const data    = cb.data || '';
  const chatId  = cb.message?.chat?.id;
  const msgId   = cb.message?.message_id;

  console.log('[telegram-webhook] callback_data=', data, 'chatId=', chatId);

  if (!token || !chatId) {
    console.warn('[telegram-webhook] missing token or chatId');
    return;
  }

  // Always answer the callback to dismiss the loading spinner on the button
  await tgPost(token, 'answerCallbackQuery', { callback_query_id: cb.id });

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_KEY,
  );

  // ── cancel_apt:{aptId} ────────────────────────────────────────
  if (data.startsWith('cancel_apt:')) {
    const aptId = data.replace('cancel_apt:', '');
    try {
      await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', aptId);

      // Remove inline keyboard from original message
      await tgPost(token, 'editMessageReplyMarkup', {
        chat_id: chatId, message_id: msgId, reply_markup: { inline_keyboard: [] },
      });

      await sendMsg(token, chatId, '❌ <b>תור בוטל בהצלחה.</b>\nהלקוחה תראה את הסטטוס המעודכן באתר.');
    } catch (e) {
      console.error('[telegram-webhook] cancel_apt error:', e.message);
      await sendMsg(token, chatId, `⚠️ שגיאה בביטול התור: ${e.message}`);
    }
    return;
  }

  // ── approve_order:{id} ────────────────────────────────────────
  if (data.startsWith('approve_order:')) {
    const id = data.replace('approve_order:', '');
    try {
      const { data: row } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'pendingPayments')
        .maybeSingle();

      const pp = { ...(row?.value || {}) };
      const payment = pp[id];
      delete pp[id];
      await supabase.from('settings').upsert(
        { key: 'pendingPayments', value: pp, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );

      await tgPost(token, 'editMessageReplyMarkup', {
        chat_id: chatId, message_id: msgId, reply_markup: { inline_keyboard: [] },
      });

      const clientName = payment?.clientName || '';
      await sendMsg(token, chatId, `✅ <b>תשלום אושר!</b>\nהזמנת ${clientName} סומנה כשולם.\nשלחי קבלה ללקוחה מתוך לוח הניהול.`);
    } catch (e) {
      console.error('[telegram-webhook] approve_order error:', e.message);
      await sendMsg(token, chatId, `⚠️ שגיאה באישור הזמנה: ${e.message}`);
    }
    return;
  }

  // ── reject_order:{id} ─────────────────────────────────────────
  if (data.startsWith('reject_order:')) {
    const id = data.replace('reject_order:', '');
    try {
      const { data: row } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'pendingPayments')
        .maybeSingle();

      const pp = { ...(row?.value || {}) };
      const payment = pp[id];
      delete pp[id];
      await supabase.from('settings').upsert(
        { key: 'pendingPayments', value: pp, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );

      await tgPost(token, 'editMessageReplyMarkup', {
        chat_id: chatId, message_id: msgId, reply_markup: { inline_keyboard: [] },
      });

      const clientName = payment?.clientName || '';
      await sendMsg(token, chatId, `❌ <b>הזמנה נדחתה.</b>\nהזמנת ${clientName} הוסרה.\nהלקוחה תראה את הסטטוס המעודכן באתר.`);
    } catch (e) {
      console.error('[telegram-webhook] reject_order error:', e.message);
      await sendMsg(token, chatId, `⚠️ שגיאה בדחיית הזמנה: ${e.message}`);
    }
    return;
  }

  // ── confirm_order:{orderId} ───────────────────────────────────
  // Cash/pickup shop flow — mark the orders row as confirmed
  if (data.startsWith('confirm_order:')) {
    const orderId = data.replace('confirm_order:', '');
    try {
      const { error: updErr } = await supabase
        .from('orders')
        .update({ status: 'confirmed' })
        .eq('id', orderId);

      if (updErr) {
        console.error('[telegram-webhook] confirm_order update error:', updErr.message);
        await sendMsg(token, chatId, `⚠️ שגיאה באישור הזמנה: ${updErr.message}`);
        return;
      }

      await tgPost(token, 'editMessageReplyMarkup', {
        chat_id: chatId, message_id: msgId, reply_markup: { inline_keyboard: [] },
      });

      await sendMsg(token, chatId, `✅ <b>הזמנה אושרה!</b>\nההזמנה סומנה כמאושרת.`);
    } catch (e) {
      console.error('[telegram-webhook] confirm_order exception:', e.message);
      await sendMsg(token, chatId, `⚠️ שגיאה באישור הזמנה: ${e.message}`);
    }
    return;
  }

  // ── confirm_payment:{paymentId} ───────────────────────────────
  // Appointment paid online (bit) — remove from pendingPayments
  if (data.startsWith('confirm_payment:')) {
    const id = data.replace('confirm_payment:', '');
    try {
      const { data: row } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'pendingPayments')
        .maybeSingle();

      const pp = { ...(row?.value || {}) };
      const payment = pp[id];
      delete pp[id];
      await supabase.from('settings').upsert(
        { key: 'pendingPayments', value: pp, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );

      await tgPost(token, 'editMessageReplyMarkup', {
        chat_id: chatId, message_id: msgId, reply_markup: { inline_keyboard: [] },
      });

      const clientName = payment?.clientName || '';
      const serviceName = payment?.serviceName || '';
      await sendMsg(token, chatId, `✅ <b>תשלום לתור התקבל!</b>\n${clientName} · ${serviceName}\nשלחי קבלה ללקוחה מתוך לוח הניהול.`);
    } catch (e) {
      console.error('[telegram-webhook] confirm_payment error:', e.message);
      await sendMsg(token, chatId, `⚠️ שגיאה באישור תשלום: ${e.message}`);
    }
    return;
  }

  // Unknown callback — ignore silently
  console.warn('[telegram-webhook] unknown callback_data:', data);
}
