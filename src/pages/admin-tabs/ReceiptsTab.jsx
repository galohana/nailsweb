import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ToggleLeft, ToggleRight, Eye } from 'lucide-react';
import { db } from '../../utils/db';
import * as S from '../../utils/adminStyles';
import ImageUploader from '../../components/ImageUploader';
import ReceiptSender from '../../components/ReceiptSender';

const DEFAULT_RECEIPT_SETTINGS = {
  enabled: false,
  ownerEmail: '',
  fromEmail: 'onboarding@resend.dev',
  address: '',
  startFrom: 1000,
  logoUrl: '',
};

export default function ReceiptsTab() {
  const [sub, setSub]                         = useState('receipts'); // 'receipts' | 'settings'
  const [receiptSettings, setReceiptSettings] = useState(null);
  const [clinicInfo, setClinicInfo]           = useState({});
  const [receiptCounter, setReceiptCounter]   = useState(null);
  const [receiptSaved, setReceiptSaved]       = useState(false);
  const [receiptPreview, setReceiptPreview]   = useState(false);

  useEffect(() => {
    Promise.all([
      db.settings.get('receiptSettings', DEFAULT_RECEIPT_SETTINGS),
      db.settings.get('clinicInfo', {}),
      db.settings.get('receiptCounter', null),
    ]).then(([rs, ci, cnt]) => {
      setReceiptSettings({ ...DEFAULT_RECEIPT_SETTINGS, ...rs });
      setClinicInfo(ci || {});
      setReceiptCounter(cnt);
    });
  }, []);

  if (!receiptSettings) return (
    <p style={{ ...S.emptyText, padding: '20px 0', textAlign: 'center' }}>טוענת...</p>
  );

  return (
    <div>
      {/* Sub-tab toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <button
          onClick={() => setSub('receipts')}
          style={{ ...S.subTab(sub === 'receipts'), flex: 1, padding: '9px 10px', fontSize: 13, touchAction: 'manipulation' }}
        >
          🧾 קבלות
        </button>
        <button
          onClick={() => setSub('settings')}
          style={{ ...S.subTab(sub === 'settings'), flex: 1, padding: '9px 10px', fontSize: 13, touchAction: 'manipulation' }}
        >
          ⚙️ הגדרות
        </button>
      </div>

      {/* ══ קבלות ══ */}
      {sub === 'receipts' && (
        <div style={S.card}>
          <ReceiptSender />
        </div>
      )}

      {/* ══ הגדרות ══ */}
      {sub === 'settings' && (
        <ReceiptsSettings
          settings={receiptSettings}
          clinicInfo={clinicInfo}
          counter={receiptCounter}
          saved={receiptSaved}
          preview={receiptPreview}
          onPreviewToggle={() => setReceiptPreview(p => !p)}
          onUpdate={async (next) => {
            setReceiptSettings(next);
            await db.settings.set('receiptSettings', next);
            setReceiptSaved(true);
            setTimeout(() => setReceiptSaved(false), 1600);
          }}
        />
      )}
    </div>
  );
}

// ── Shared card primitives ───────────────────────────────────────

function GlassCard({ children, style }) {
  return (
    <div style={{
      backgroundColor: 'rgba(253,250,247,0.82)',
      backdropFilter: 'blur(18px) saturate(170%)',
      WebkitBackdropFilter: 'blur(18px) saturate(170%)',
      border: '1px solid rgba(212,184,150,0.35)',
      borderRadius: 'var(--radius-xl)',
      padding: 16,
      boxShadow: '0 2px 12px rgba(92,61,46,0.07)',
      marginBottom: 10,
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionHeader({ title }) {
  return (
    <div style={{ marginTop: 20, marginBottom: 12, paddingInline: 2 }}>
      <h3 style={{
        fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600,
        color: 'var(--color-primary-ink)', letterSpacing: '0.03em', lineHeight: 1, margin: 0,
      }}>
        {title}
      </h3>
      <div style={{
        height: 2,
        background: 'linear-gradient(90deg, rgba(92,61,46,0.8) 0%, rgba(92,61,46,0.15) 60%, transparent 100%)',
        borderRadius: 1, marginTop: 8,
      }} />
    </div>
  );
}

// ── Settings panel ───────────────────────────────────────────────

function ReceiptsSettings({ settings, clinicInfo, counter, saved, preview, onPreviewToggle, onUpdate }) {
  const update = (k, v) => onUpdate({ ...settings, [k]: v });

  const previewData = {
    name: 'לקוחה לדוגמה',
    items: [{ name: clinicInfo.name ? `טיפול ב${clinicInfo.name}` : 'טיפול גבות', price: 280 }],
    total: 280,
    method: 'bit',
    businessName: clinicInfo.name || 'הסטודיו',
    businessAddress: settings.address || clinicInfo.address || '',
    receiptNumber: (counter || settings.startFrom || 1000) + 1,
    date: new Date().toLocaleDateString('he-IL'),
    logoUrl: settings.logoUrl || '',
  };

  return (
    <div>
      <SectionHeader title="🧾 קבלות" />

      {/* Enable toggle */}
      <GlassCard>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
              שליחת קבלות אוטומטית
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-muted)', marginTop: 3 }}>
              אחרי כל תשלום מאושר
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => update('enabled', !settings.enabled)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            {settings.enabled
              ? <ToggleRight size={36} color="var(--color-success)" />
              : <ToggleLeft size={36} color="var(--color-border-dark)" />}
          </motion.button>
        </div>
      </GlassCard>

      {/* Details */}
      <GlassCard>
        <p style={{ ...S.heading, marginBottom: 12 }}>פרטי הקבלה</p>

        <label style={S.label}>אימייל לקבלת עותק (בעלת העסק)</label>
        <input
          type="email"
          style={{ ...S.input, marginBottom: 10 }}
          value={settings.ownerEmail || ''}
          onChange={e => onUpdate({ ...settings, ownerEmail: e.target.value })}
          onBlur={e => update('ownerEmail', e.target.value)}
          placeholder="you@gmail.com"
        />

        <label style={S.label}>כתובת העסק בקבלה</label>
        <input
          type="text"
          style={{ ...S.input, marginBottom: 10 }}
          value={settings.address || ''}
          onChange={e => onUpdate({ ...settings, address: e.target.value })}
          onBlur={e => update('address', e.target.value)}
          placeholder="רחוב הפרחים 5, תל אביב"
        />

        <label style={S.label}>כתובת שולח (From)</label>
        <input
          type="email"
          style={{ ...S.input, marginBottom: 10 }}
          value={settings.fromEmail || ''}
          onChange={e => onUpdate({ ...settings, fromEmail: e.target.value })}
          onBlur={e => update('fromEmail', e.target.value)}
          placeholder="receipts@yourdomain.com"
        />

        <label style={S.label}>מספר קבלה התחלתי</label>
        <input
          type="number"
          style={{ ...S.input, marginBottom: 10 }}
          value={settings.startFrom || 1000}
          onChange={e => onUpdate({ ...settings, startFrom: Number(e.target.value) || 1000 })}
          onBlur={e => update('startFrom', Number(e.target.value) || 1000)}
        />

        {counter !== null && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 10 }}>
            קבלה אחרונה: #{counter}
          </p>
        )}

        <ImageUploader
          currentUrl={settings.logoUrl || ''}
          onUploaded={url => update('logoUrl', url)}
          label="לוגו לקבלה (אופציונלי)"
        />

        <AnimatePresence>
          {saved && (
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ color: 'var(--color-success)', fontFamily: 'var(--font-body)', fontSize: 12, textAlign: 'center', marginTop: 6 }}
            >
              ✓ נשמר
            </motion.p>
          )}
        </AnimatePresence>
      </GlassCard>

      {/* Preview */}
      <GlassCard>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <p style={{ ...S.heading, margin: 0 }}>תצוגה מקדימה</p>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onPreviewToggle}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 12px',
              backgroundColor: 'var(--color-primary)', color: 'var(--color-on-primary)',
              backgroundImage: 'var(--demo-primary-mat-overlay, none)',
              border: 'var(--demo-primary-mat-border, none)', borderRadius: 9,
              fontFamily: 'var(--font-body)', fontSize: 12, cursor: 'pointer',
            }}
          >
            <Eye size={13} />{preview ? 'הסתר' : 'הצג'}
          </motion.button>
        </div>
        <AnimatePresence>
          {preview && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: 'hidden' }}
            >
              <ReceiptPreview {...previewData} />
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>

      {/* How it works */}
      <GlassCard style={{ backgroundColor: 'rgba(76,175,80,0.05)', border: '1px solid var(--color-success-18)' }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: 'var(--color-text)', marginBottom: 6 }}>
          ✅ איך זה עובד
        </p>
        <ul style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-primary-ink)', lineHeight: 2, paddingInlineStart: 16, margin: 0 }}>
          <li>תור + ביט/פייבוקס — קבלה נשלחת לאחר אישורך</li>
          <li>הזמנת חנות + מזומן — קבלה לאחר אישור</li>
          <li>הקבלה מגיעה לאימייל שהוגדר בשדה "אימייל לקבלת עותק"</li>
        </ul>
      </GlassCard>
    </div>
  );
}

// ── Receipt preview card ─────────────────────────────────────────

function ReceiptPreview({ name, items, total, method, businessName, businessAddress, receiptNumber, date, logoUrl }) {
  const methodLabel = method === 'bit' ? 'Bit' : 'מזומן';
  return (
    <div style={{ backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-md)', padding: 12 }}>
      <div style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        boxShadow: '0 2px 10px rgba(92,61,46,0.10)',
      }}>
        <div style={{ backgroundColor: 'var(--color-primary)', backgroundImage: 'var(--demo-primary-mat-overlay, none)', border: 'var(--demo-primary-mat-border, none)', padding: '16px 20px', textAlign: 'center' }}>
          {logoUrl && (
            <img src={logoUrl} alt="" style={{ height: 36, borderRadius: 'var(--radius-full)', display: 'block', margin: '0 auto 8px' }} />
          )}
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 400, color: 'var(--color-surface)', margin: 0 }}>
            {businessName}
          </p>
          {businessAddress && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'rgba(253,250,247,0.7)', marginTop: 2 }}>
              {businessAddress}
            </p>
          )}
        </div>

        <div style={{ backgroundColor: 'var(--color-bg)', padding: '8px 16px', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-muted)' }}>קבלה #{receiptNumber}</span>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-muted)' }}>{date}</span>
        </div>

        <div style={{ padding: '12px 16px 0' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
            {name}
          </p>
        </div>

        <div style={{ padding: '6px 16px 0' }}>
          {(items || []).map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-border-soft)' }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text)' }}>{item.name}</span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-primary-ink)', fontWeight: 700 }}>
                ₪{Number(item.price).toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        <div style={{
          margin: '10px 16px',
          padding: '10px 14px',
          backgroundColor: 'var(--color-primary)',
          backgroundImage: 'var(--demo-primary-mat-overlay, none)',
          border: 'var(--demo-primary-mat-border, none)',
          borderRadius: 'var(--radius-sm)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, color: 'var(--color-surface)' }}>סה״כ שולם</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--color-surface)' }}>
            ₪{Number(total).toLocaleString()}
          </span>
        </div>

        <div style={{ padding: '8px 16px 12px', textAlign: 'center' }}>
          <span style={{
            display: 'inline-block', padding: '3px 12px',
            backgroundColor: 'rgba(92,61,46,0.08)', border: '1px solid rgba(92,61,46,0.18)',
            borderRadius: 'var(--radius-xl)',
            fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 600, color: 'var(--color-primary-ink)',
          }}>
            שולם ב-{methodLabel}
          </span>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8, marginBottom: 0 }}>
            תודה שבחרת בנו 💕
          </p>
        </div>
      </div>
    </div>
  );
}
