// One-time setup endpoint — registers the Telegram webhook URL.
// Call after every domain change: GET https://eyebrowsweb-app.vercel.app/api/register-telegram-webhook
// Returns current webhook info too (Telegram getWebhookInfo) for verification.

export default async function handler(req, res) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return res.status(200).json({ ok: false, error: 'TELEGRAM_BOT_TOKEN missing' });
  }

  const host       = req.headers.host || 'eyebrowsweb-app.vercel.app';
  const webhookUrl = `https://${host}/api/telegram-webhook`;

  try {
    const resp = await fetch(
      `https://api.telegram.org/bot${token}/setWebhook`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          url:             webhookUrl,
          allowed_updates: ['callback_query'],
          drop_pending_updates: true,
        }),
      },
    );
    const data = await resp.json();
    console.log('[register-webhook] Telegram response:', data);

    // Also fetch current webhook info for verification
    let info = null;
    try {
      const infoResp = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
      info = await infoResp.json();
    } catch {}

    return res.status(200).json({ ok: data.ok, webhookUrl, telegram: data, currentInfo: info });
  } catch (e) {
    console.error('[register-webhook] error:', e.message);
    return res.status(200).json({ ok: false, error: e.message });
  }
}
