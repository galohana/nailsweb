import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function getNextReceiptNumber() {
  const key = 'receiptCounter';
  const { data } = await supabase.from('settings').select('value').eq('key', key).maybeSingle();
  const current = Number(data?.value) || 999;
  const next = current + 1;
  await supabase.from('settings').upsert({ key, value: next }, { onConflict: 'key' });
  return next;
}

async function getReceiptSettings() {
  const keys = ['clinicInfo', 'receiptSettings', 'ownerEmail'];
  const { data } = await supabase.from('settings').select('key, value').in('key', keys);
  const map = {};
  (data || []).forEach(r => { map[r.key] = r.value; });
  return {
    clinicInfo: map.clinicInfo || {},
    receiptSettings: map.receiptSettings || {},
    ownerEmailStandalone: typeof map.ownerEmail === 'string' ? map.ownerEmail : '',
  };
}

function buildReceiptHtml({ name, items, total, method, businessName, businessAddress, receiptNumber, date, logoUrl }) {
  const methodLabel = method === 'bit' ? 'Bit' : 'מזומן';
  const itemsRows = (items || []).map(item => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #F0E6D6;font-family:Arial,sans-serif;font-size:14px;color:#2C1810;text-align:right;">${item.name || item.serviceName || ''}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #F0E6D6;font-family:Arial,sans-serif;font-size:14px;color:#5C3D2E;text-align:left;white-space:nowrap;">₪${Number(item.price || 0).toLocaleString()}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F2E8DC;font-family:Arial,sans-serif;">
  <div style="max-width:520px;margin:32px auto;background:#FDFAF7;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(92,61,46,0.12);">

    <!-- Header -->
    <div style="background:#5C3D2E;padding:28px 32px;text-align:center;">
      ${logoUrl ? `<img src="${logoUrl}" alt="logo" style="height:52px;object-fit:contain;margin-bottom:12px;border-radius:50%;">` : ''}
      <h1 style="color:#FDFAF7;font-size:24px;margin:0 0 4px;font-weight:400;letter-spacing:0.04em;">${businessName || 'הסטודיו'}</h1>
      ${businessAddress ? `<p style="color:rgba(253,250,247,0.75);font-size:13px;margin:0;">${businessAddress}</p>` : ''}
    </div>

    <!-- Receipt badge -->
    <div style="background:#F2E8DC;padding:16px 32px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #E8DCC8;">
      <span style="font-size:13px;color:#7D5A47;">קבלה מספר <strong style="color:#2C1810;">${receiptNumber}</strong></span>
      <span style="font-size:13px;color:#7D5A47;">${date || new Date().toLocaleDateString('he-IL')}</span>
    </div>

    <!-- Customer -->
    <div style="padding:20px 32px 8px;">
      <p style="font-size:13px;color:#7D5A47;margin:0 0 4px;">לקוחה יקרה,</p>
      <p style="font-size:18px;color:#2C1810;margin:0;font-weight:600;">${name || ''}</p>
    </div>

    <!-- Items -->
    <div style="padding:8px 32px 0;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#F5EFE6;">
            <th style="padding:10px 14px;font-size:12px;color:#7D5A47;font-weight:600;text-align:right;border-bottom:2px solid #E8DCC8;">פירוט</th>
            <th style="padding:10px 14px;font-size:12px;color:#7D5A47;font-weight:600;text-align:left;border-bottom:2px solid #E8DCC8;">סכום</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows || `<tr><td colspan="2" style="padding:14px;font-size:14px;color:#7D5A47;text-align:center;">—</td></tr>`}
        </tbody>
      </table>
    </div>

    <!-- Total -->
    <div style="margin:0 32px;padding:16px 14px;background:#5C3D2E;border-radius:10px;display:flex;justify-content:space-between;align-items:center;">
      <span style="color:#FDFAF7;font-size:14px;font-weight:600;">סה״כ שולם</span>
      <span style="color:#FDFAF7;font-size:22px;font-weight:700;">₪${Number(total || 0).toLocaleString()}</span>
    </div>

    <!-- Method -->
    <div style="padding:12px 32px 0;text-align:center;">
      <span style="display:inline-block;padding:5px 16px;background:rgba(92,61,46,0.08);border:1px solid rgba(92,61,46,0.18);border-radius:20px;font-size:12px;color:#5C3D2E;font-weight:600;">
        שולם ב-${methodLabel}
      </span>
    </div>

    <!-- Footer -->
    <div style="padding:24px 32px;text-align:center;border-top:1px solid #F0E6D6;margin-top:20px;">
      <p style="font-size:13px;color:#7D5A47;margin:0 0 4px;">תודה שבחרת בנו 💕</p>
      <p style="font-size:11px;color:#A89580;margin:0;">קבלה זו מהווה אסמכתא לתשלום</p>
    </div>
  </div>
</body>
</html>`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) return res.status(500).json({ ok: false, error: 'RESEND_API_KEY not set' });

  try {
    const { name, items, total, method, aptId } = req.body;

    // Check if receipts are enabled
    const { receiptSettings, clinicInfo, ownerEmailStandalone } = await getReceiptSettings();
    if (receiptSettings.enabled === false) {
      return res.json({ ok: true, skipped: 'receipts_disabled' });
    }

    const ownerEmail = ownerEmailStandalone || receiptSettings.ownerEmail || clinicInfo.ownerEmail || '';
    if (!ownerEmail) return res.json({ ok: true, skipped: 'no_owner_email' });

    const receiptNumber = await getNextReceiptNumber();
    const businessName  = clinicInfo.name || 'הסטודיו';
    const businessAddr  = receiptSettings.address || clinicInfo.address || '';
    const logoUrl       = receiptSettings.logoUrl || clinicInfo.logoUrl || '';
    const date          = new Date().toLocaleDateString('he-IL');

    const html = buildReceiptHtml({
      name, items, total, method,
      businessName, businessAddress: businessAddr,
      receiptNumber, date, logoUrl,
    });

    const resend = new Resend(RESEND_KEY);
    const fromAddr = receiptSettings.fromEmail || 'onboarding@resend.dev';
    const fromLine = `Receipt <${fromAddr}>`;

    console.log('[send-receipt] sending receipt #', receiptNumber, 'to=', ownerEmail, 'aptId=', aptId);

    const { data: sendData, error: sendErr } = await resend.emails.send({
      from: fromLine,
      to: [ownerEmail],
      subject: `קבלה מספר ${receiptNumber} — ${businessName}`,
      html,
    });

    if (sendErr) {
      console.error('[send-receipt] Resend error:', sendErr);
      return res.status(500).json({ ok: false, error: sendErr.message || String(sendErr), resendError: sendErr });
    }

    // Lock: mark this appointment as "receipt sent" so it can't be re-sent
    if (aptId) {
      try {
        const { data: row } = await supabase.from('settings').select('value').eq('key', 'sentReceipts').maybeSingle();
        const cur = (row?.value && typeof row.value === 'object') ? row.value : {};
        cur[aptId] = { receiptNumber, sentAt: new Date().toISOString() };
        await supabase.from('settings').upsert(
          { key: 'sentReceipts', value: cur, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        );
      } catch (e) {
        console.warn('[send-receipt] sentReceipts lock failed (non-fatal):', e.message);
      }
    }

    console.log('[send-receipt] ✓ sent id=', sendData?.id);
    return res.json({ ok: true, receiptNumber, resendId: sendData?.id });
  } catch (e) {
    console.error('[send-receipt]', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
