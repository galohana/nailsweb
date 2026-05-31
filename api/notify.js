// Vercel Serverless Function — runs on Node.js, NOT in the browser.
//
// Routing:
//   owner-side types  → Telegram (via TELEGRAM_BOT_TOKEN + telegramChatId from Supabase)
//   client 'welcome'  → SMS via Twilio (the only remaining client SMS)
//   all other client  → skipped (client sees status on website only)
//
// If Telegram is not configured (missing token or chatId), owner notifications
// are silently skipped with a console.warn (non-fatal).
//
// Placeholders in templates ({name}, {phone}, {service}, {date}, {time}, {total},
// {items}, {business}) are replaced with values from the request body.
// SMS messages are truncated to 70 chars (UCS-2, Hebrew encoding).
// Telegram messages have no length limit and support HTML formatting.

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

// ── SMS default (client welcome only) ────────────────────────────────────────
const SMS_DEFAULTS = {
  welcome: { enabled: true, text: 'היי {name}! ברוכה הבאה ✨ נשמח לראותך 💕' },
};

// ── Telegram defaults (owner notifications) ────────────────────────────────
// No 70-char limit. HTML supported (<b>, <i>, <code>).
const TELEGRAM_DEFAULTS = {
  newBooking:     '📅 <b>תור חדש!</b>\n👤 {name} | 📞 {phone}\n💅 {service}\n📆 {date} ⏰ {time}',
  cancellation:   '❌ <b>ביטול תור</b>\n👤 {name} | 📞 {phone}\n💅 {service}\n📆 {date} ⏰ {time}',
  newClient:      '🎉 <b>לקוחה חדשה!</b>\n👤 {name}\n📞 {phone}',
  waitlistJoin:   '⏳ <b>הצטרפות להמתנה</b>\n👤 {name} | 📞 {phone}\n📆 {date}',
  waitlistFilled: '✨ <b>מהמתנה לתור!</b>\n👤 {name} | 📞 {phone}\n📆 {date} ⏰ {time}',
  orderPending:   '🛍️ <b>הזמנה חדשה!</b>\n👤 {name} | 📞 {phone}\n{items}\nסה"כ: ₪{total}',
  orderPurchase:  '💳 <b>קנייה בחנות!</b>\n👤 {name} | 📞 {phone}\n{items}\nסה"כ: ₪{total}',
  appointmentPaid:'💳 <b>תשלום לתור התקבל</b>\n👤 {name} | 📞 {phone}\n💅 {service}\n💰 ₪{amount} · {method}',
};

// type → [side, key]
const TYPE_MAP = {
  new_appointment:  ['owner', 'newBooking'],
  cancellation:     ['owner', 'cancellation'],
  new_client:       ['owner', 'newClient'],
  waitlist_join:    ['owner', 'waitlistJoin'],
  waitlist_filled:  ['owner', 'waitlistFilled'],
  order_new:        ['owner', 'orderPending'],
  order_purchase:   ['owner', 'orderPurchase'],
  appointment_paid: ['owner', 'appointmentPaid'],
  welcome:          ['client', 'welcome'],
  // waitlist_notify / order_approved / reminder → removed (client sees website only)
};

// SMS: fill + truncate to 70 UCS-2 chars (Hebrew encoding = 70 chars/segment)
function fillSms(text, ctx) {
  const filled = String(text).replace(/\{(\w+)\}/g, (_, k) => (ctx[k] != null ? String(ctx[k]) : ''));
  return filled.slice(0, 70);
}

// Telegram: fill without truncation, HTML allowed
function fillTg(text, ctx) {
  return String(text).replace(/\{(\w+)\}/g, (_, k) => (ctx[k] != null ? String(ctx[k]) : ''));
}

// Inline keyboard buttons for Telegram based on notification type
function buildButtons(type, body) {
  if (type === 'new_appointment' && body.aptId) {
    return [[{ text: '❌ בטל תור', callback_data: `cancel_apt:${body.aptId}` }]];
  }
  if (type === 'order_new' && body.paymentId) {
    // Bit shop flow — approve/reject
    return [[
      { text: '✅ אישרתי קבלת תשלום', callback_data: `approve_order:${body.paymentId}` },
      { text: '❌ דחה',                callback_data: `reject_order:${body.paymentId}`  },
    ]];
  }
  if (type === 'order_new' && body.orderId) {
    // Cash/pickup shop flow — confirm the order
    return [[{ text: '✅ אשר הזמנה', callback_data: `confirm_order:${body.orderId}` }]];
  }
  if (type === 'order_purchase' && body.orderId) {
    return [[{ text: '✅ אישרתי קבלת תשלום', callback_data: `approve_order:${body.orderId}` }]];
  }
  if (type === 'appointment_paid' && body.paymentId) {
    return [[{ text: '✅ אישרתי קבלת תשלום', callback_data: `confirm_payment:${body.paymentId}` }]];
  }
  return null;
}

async function loadSettings() {
  const result = {
    smsTemplates:      null,
    telegramTemplates: null,
    telegramChatId:    null,
    business:          '',
  };
  try {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_KEY;
    if (!url || !key) {
      console.warn('[notify] Supabase env vars missing — using defaults');
      return result;
    }
    const supabase = createClient(url, key);
    const [tplRow, tgTplRow, tgChatRow, ciRow] = await Promise.all([
      supabase.from('settings').select('value').eq('key', 'smsTemplates').maybeSingle(),
      supabase.from('settings').select('value').eq('key', 'telegramTemplates').maybeSingle(),
      supabase.from('settings').select('value').eq('key', 'telegramChatId').maybeSingle(),
      supabase.from('settings').select('value').eq('key', 'clinicInfo').maybeSingle(),
    ]);
    result.smsTemplates      = tplRow.data?.value    || null;
    result.telegramTemplates = tgTplRow.data?.value  || null;
    result.telegramChatId    = tgChatRow.data?.value || null;
    result.business          = ciRow.data?.value?.name || '';
    return result;
  } catch (e) {
    console.warn('[notify] failed to load settings:', e.message);
    return result;
  }
}

async function sendTelegram({ token, chatId, message, buttons }) {
  const payload = { chat_id: chatId, text: message, parse_mode: 'HTML' };
  if (Array.isArray(buttons) && buttons.length) {
    payload.reply_markup = { inline_keyboard: buttons };
  }
  const resp = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
  );
  return resp.json();
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return req.body;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = parseBody(req);
  const { type } = body;
  console.log('[notify] type=', type, 'keys=', Object.keys(body));

  const mapping = TYPE_MAP[type];
  if (!mapping) {
    console.warn('[notify] unknown or removed type:', type);
    return res.status(200).json({ ok: true, skipped: `type ${type} not handled` });
  }
  const [side, key] = mapping;

  const { smsTemplates, telegramTemplates, telegramChatId, business } =
    await loadSettings();

  // Build placeholder context (used for both Telegram and SMS)
  const itemsStr = Array.isArray(body.items)
    ? body.items.map(i => `${i.name} ×${i.quantity}`).join(', ')
    : (body.items || '');

  const ctx = {
    name:     body.clientName || '',
    phone:    body.clientPhone || '',
    service:  body.service || body.serviceName || '',
    date:     body.date || '',
    time:     body.time || '',
    total:    body.total != null ? body.total : '',
    amount:   body.amount != null ? body.amount : '',
    method:   body.method || '',
    items:    itemsStr,
    business,
  };

  // ── OWNER → Telegram ─────────────────────────────────────────────────────
  if (side === 'owner') {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      console.warn('[notify] TELEGRAM_BOT_TOKEN missing — owner notification skipped');
      return res.status(200).json({ ok: true, skipped: 'no telegram token' });
    }
    if (!telegramChatId) {
      console.warn('[notify] telegramChatId not configured — owner notification skipped');
      return res.status(200).json({ ok: true, skipped: 'no telegram chatId' });
    }

    // Resolve template: custom → default
    const savedTpl = telegramTemplates?.[key];
    const enabled  = savedTpl?.enabled !== false;
    if (!enabled) {
      return res.status(200).json({ ok: true, skipped: 'telegram template disabled' });
    }
    const tplText = (savedTpl?.text && String(savedTpl.text).trim()) || TELEGRAM_DEFAULTS[key] || '';
    if (!tplText) {
      console.warn('[notify] no Telegram template for key:', key);
      return res.status(200).json({ ok: true, skipped: 'no template' });
    }

    const message = fillTg(tplText, ctx);
    const buttons = buildButtons(type, body);

    console.log('[notify] → Telegram chatId=', telegramChatId, 'len=', message.length);
    try {
      const tgRes = await sendTelegram({ token, chatId: telegramChatId, message, buttons });
      if (!tgRes.ok) {
        console.error('[notify] Telegram API error:', tgRes);
        return res.status(200).json({ ok: false, error: tgRes.description });
      }
      console.log('[notify] ✓ Telegram sent message_id=', tgRes.result?.message_id);
      return res.status(200).json({ ok: true, messageId: tgRes.result?.message_id });
    } catch (e) {
      console.error('[notify] Telegram network error:', e.message);
      return res.status(200).json({ ok: false, error: e.message });
    }
  }

  // ── CLIENT → SMS (welcome only) ──────────────────────────────────────────
  if (key !== 'welcome') {
    // waitlist_notify, order_approved, reminder — removed per spec
    return res.status(200).json({ ok: true, skipped: 'client SMS removed — website only' });
  }

  // welcome SMS
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE) {
    console.warn('[notify] Twilio not configured — welcome SMS skipped');
    return res.status(200).json({ ok: true, skipped: 'no twilio' });
  }

  const savedWelcome = smsTemplates?.client?.welcome;
  const welcomeTplText = (savedWelcome?.text && String(savedWelcome.text).trim()) || SMS_DEFAULTS.welcome.text;
  const welcomeEnabled = savedWelcome?.enabled !== false;
  if (!welcomeEnabled) {
    return res.status(200).json({ ok: true, skipped: 'welcome SMS disabled' });
  }

  const smsBody = fillSms(welcomeTplText, ctx);
  const to = toE164(body.clientPhone);
  if (!to) {
    console.warn('[notify] missing clientPhone for welcome SMS');
    return res.status(200).json({ ok: false, error: 'missing clientPhone' });
  }

  try {
    const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    console.log('[notify] → SMS welcome to', to, 'len=', smsBody.length);
    const msg = await twilioClient.messages.create({ body: smsBody, from: TWILIO_PHONE, to });
    console.log('[notify] ✓ SMS sent sid=', msg.sid);
    return res.status(200).json({ ok: true, sid: msg.sid });
  } catch (err) {
    console.error('[notify] Twilio error:', { code: err?.code, message: err?.message });
    return res.status(200).json({ ok: false, error: err?.message, code: err?.code });
  }
}
