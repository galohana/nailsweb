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
  const methodLabel = method === 'bit' ? 'Bit' : method === 'credit' ? 'אשראי' : 'מזומן';
  const itemsHtml = (items || []).map(item => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f0e6d6;font-family:Arial,sans-serif;font-size:13px;color:#2d1a0e;direction:rtl;">${item.name || item.serviceName || ''}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f0e6d6;font-family:Arial,sans-serif;font-size:13px;font-weight:700;color:#5c3d2e;text-align:left;white-space:nowrap;">₪${Number(item.price || 0).toLocaleString('he-IL')}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body dir="rtl" style="margin:0;padding:0;background:#f8f4f0;direction:rtl;text-align:right;">
<table width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="background:#f8f4f0;padding:24px 0;direction:rtl;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(92,61,46,0.12);">

      <!-- Header -->
      <tr>
        <td style="background:#5c3d2e;padding:24px 20px;text-align:center;">
          ${logoUrl ? `<img src="${logoUrl}" alt="" style="height:48px;border-radius:50%;display:block;margin:0 auto 10px;">` : ''}
          <p style="margin:0;font-family:Georgia,serif;font-size:22px;font-weight:400;color:#fdfaf7;letter-spacing:0.04em;">${businessName || 'הסטודיו'}</p>
          ${businessAddress ? `<p style="margin:4px 0 0;font-family:Arial,sans-serif;font-size:11px;color:rgba(253,250,247,0.7);">${businessAddress}</p>` : ''}
        </td>
      </tr>

      <!-- Receipt meta -->
      <tr>
        <td style="background:#faf7f4;padding:8px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-family:Arial,sans-serif;font-size:11px;color:#a08060;direction:rtl;">קבלה #${receiptNumber}</td>
              <td style="font-family:Arial,sans-serif;font-size:11px;color:#a08060;text-align:left;">${date}</td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Client name -->
      <tr>
        <td style="padding:16px 20px 4px;direction:rtl;">
          <p style="margin:0;font-family:Arial,sans-serif;font-size:15px;font-weight:700;color:#2d1a0e;">${name}</p>
        </td>
      </tr>

      <!-- Items -->
      <tr>
        <td style="padding:4px 20px 0;direction:rtl;">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${itemsHtml}
          </table>
        </td>
      </tr>

      <!-- Total -->
      <tr>
        <td style="padding:12px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#5c3d2e;border-radius:10px;">
            <tr>
              <td style="padding:12px 16px;font-family:Arial,sans-serif;font-size:13px;font-weight:600;color:#fdfaf7;direction:rtl;">סה״כ שולם</td>
              <td style="padding:12px 16px;font-family:Georgia,serif;font-size:22px;font-weight:700;color:#fdfaf7;text-align:left;">₪${Number(total).toLocaleString('he-IL')}</td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Payment method -->
      <tr>
        <td style="padding:0 20px 20px;text-align:center;">
          <span style="display:inline-block;padding:4px 14px;background:rgba(92,61,46,0.08);border:1px solid rgba(92,61,46,0.18);border-radius:20px;font-family:Arial,sans-serif;font-size:11px;font-weight:600;color:#5c3d2e;">שולם ב-${methodLabel}</span>
          <p style="margin:12px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#a08060;">תודה שבחרת בנו 💕</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
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
      subject: `Receipt #${receiptNumber}`,
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
