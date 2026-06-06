import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { db } from '../../utils/db';
import { DEFAULT_ADMIN_SETTINGS, DEFAULT_TERMS } from '../../utils/defaults';
import * as S from '../../utils/adminStyles';

const DEFAULT_APPROVAL = { autoApprove: true, manualWithinHours: 0 };

export default function CancellationsTab() {
  const [s, setS] = useState(null);
  const [saved, setSaved] = useState(false);
  const [terms, setTerms] = useState(null);
  const [termsDirty, setTermsDirty] = useState(false);
  const [termsSaved, setTermsSaved] = useState(false);
  const termsTimer = useRef(null);
  // ── אישור תורים ──
  const [approval, setApproval] = useState(null);
  const [apprSaved, setApprSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      db.settings.get('adminSettings', DEFAULT_ADMIN_SETTINGS),
      db.settings.get('terms', DEFAULT_TERMS),
      db.settings.get('approvalSettings', DEFAULT_APPROVAL),
    ]).then(([adminS, t, appr]) => {
      setS(adminS);
      setTerms(typeof t === 'string' ? t : DEFAULT_TERMS);
      setApproval(appr && typeof appr === 'object' ? { ...DEFAULT_APPROVAL, ...appr } : DEFAULT_APPROVAL);
    });
  }, []);

  const updApproval = (patch) => {
    const n = { ...approval, ...patch };
    setApproval(n);
    db.settings.set('approvalSettings', n);
    setApprSaved(true);
    setTimeout(() => setApprSaved(false), 1600);
  };

  const saveTerms = () => {
    db.settings.set('terms', terms);
    setTermsDirty(false);
    setTermsSaved(true);
    clearTimeout(termsTimer.current);
    termsTimer.current = setTimeout(() => setTermsSaved(false), 1600);
  };

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1600); };
  const updCancel = (k, v) => { const n = { ...s, cancellation: { ...s.cancellation, [k]: v } }; setS(n); db.settings.set('adminSettings', n); flash(); };
  const updNS     = (k, v) => { const n = { ...s, noShow: { ...s.noShow, [k]: v } }; setS(n); db.settings.set('adminSettings', n); flash(); };

  if (!s || terms === null || !approval) return <p style={{ ...S.emptyText, padding: '20px 0', textAlign: 'center' }}>טוענת...</p>;

  const Toggle = ({ value, onChange }) => (
    <button onClick={() => onChange(!value)} style={{ width: 44, height: 24, borderRadius: 'var(--demo-radius-card)', border: 'none', cursor: 'pointer', position: 'relative', backgroundColor: value ? 'var(--color-primary)' : '#D4B896', touchAction: 'manipulation' }}>
      <span style={{ position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%', backgroundColor: '#fff', insetInlineStart: value ? 23 : 3, transition: 'inset-inline-start 0.2s' }} />
    </button>
  );

  return (
    <div>
      {/* ── אישור תורים ── */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <p style={S.heading}>אישור תורים</p>
          <AnimatePresence>{apprSaved && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ color: '#4CAF50', fontSize: 12 }}>✓ נשמר</motion.span>}</AnimatePresence>
        </div>
        <div style={S.toggleRow}>
          <span style={S.toggleLabel}>אישור אוטומטי</span>
          <Toggle value={approval.autoApprove} onChange={v => updApproval({ autoApprove: v })} />
        </div>
        <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 11, color: 'var(--color-section)', marginTop: 6, lineHeight: 1.6 }}>
          {approval.autoApprove
            ? 'כל תור מאושר מיד אוטומטית. את יכולה רק לבטל תור מלוח התורים.'
            : 'כל תור נכנס כ"ממתין לאישור" — צריך לאשר אותו ידנית מלוח התורים.'}
        </p>

        {!approval.autoApprove && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--color-border-soft)' }}>
            <div style={S.toggleRow}>
              <span style={S.toggleLabel}>אישור ידני רק לתורים קרובים</span>
              <Toggle
                value={(approval.manualWithinHours || 0) > 0}
                onChange={v => updApproval({ manualWithinHours: v ? 3 : 0 })}
              />
            </div>
            {(approval.manualWithinHours || 0) > 0 && (
              <>
                <label style={{ ...S.label, marginTop: 14 }}>דרוש אישור ידני רק לתורים בפחות מ-{approval.manualWithinHours} שעות מעכשיו</label>
                <input
                  type="range" min="1" max="48"
                  value={approval.manualWithinHours}
                  onChange={e => updApproval({ manualWithinHours: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--color-primary)' }}
                />
                <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 11, color: 'var(--color-section)', marginTop: 6, lineHeight: 1.6 }}>
                  תור שנקבע לעוד פחות מ-{approval.manualWithinHours} שעות דורש אישור ידני. תור רחוק יותר — מאושר אוטומטית.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <p style={S.heading}>הגדרות ביטולים</p>
          <AnimatePresence>{saved && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ color: '#4CAF50', fontSize: 12 }}>✓ נשמר</motion.span>}</AnimatePresence>
        </div>
        <div style={S.toggleRow}>
          <span style={S.toggleLabel}>אפשרי ביטולים ללקוחות</span>
          <Toggle value={s.cancellation.allowCancel} onChange={v => updCancel('allowCancel', v)} />
        </div>
        <label style={{ ...S.label, marginTop: 14 }}>חלון ביטול — שעות לפני התור: {s.cancellation.minHours}</label>
        <input type="range" min="1" max="48" value={s.cancellation.minHours} onChange={e => updCancel('minHours', Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--color-primary)' }} />
        <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 11, color: 'var(--color-section)', marginTop: 6 }}>
          לקוחות יוכלו לבטל תור כל עוד נשארו לפחות {s.cancellation.minHours} שעות עד התור.
        </p>
      </div>

      <div style={S.card}>
        <p style={S.heading}>הגדרות אי-הגעה</p>
        <label style={S.label}>אי הגעות לאזהרה: {s.noShow.warningCount}</label>
        <input type="range" min="1" max="5" value={s.noShow.warningCount} onChange={e => updNS('warningCount', Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--color-primary)', marginBottom: 14 }} />
        <label style={S.label}>אי הגעות לחסימה אוטומטית: {s.noShow.blockCount}</label>
        <input type="range" min="1" max="10" value={s.noShow.blockCount} onChange={e => updNS('blockCount', Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--color-primary)', marginBottom: 14 }} />
        <div style={S.toggleRow}>
          <span style={S.toggleLabel}>חסימה אוטומטית פעילה</span>
          <Toggle value={s.noShow.autoBlock} onChange={v => updNS('autoBlock', v)} />
        </div>
        <label style={{ ...S.label, marginTop: 14 }}>הודעת אזהרה ללקוחה</label>
        <textarea rows={3} style={{ ...S.input, resize: 'vertical' }} value={s.noShow.warningMessage} onChange={e => updNS('warningMessage', e.target.value)} />
        <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 11, color: 'var(--color-section)', marginTop: 6 }}>
          לסימון אי-הגעות וחסימת לקוחות — עברי לטאב "לקוחות".
        </p>
      </div>

      {/* ── תקנון ──────────────────────────────────────────────── */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <p style={S.heading}>תקנון האתר</p>
          <AnimatePresence mode="wait">
            {termsSaved ? (
              <motion.span key="saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ color: 'var(--color-success)', fontSize: 12, fontFamily: 'var(--font-body)' }}>✓ נשמר</motion.span>
            ) : termsDirty ? (
              <motion.button key="btn" whileTap={{ scale: 0.97 }} onClick={saveTerms}
                initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 6 }}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 11px', borderRadius: 'var(--radius-sm)', border: 'none', backgroundColor: 'var(--color-primary)', color: 'var(--color-on-primary)', fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                שמורי 💾
              </motion.button>
            ) : null}
          </AnimatePresence>
        </div>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-hint)', marginBottom: 10, lineHeight: 1.5 }}>
          מופיע בדף ההרשמה — הלקוחה חייבת לאשר לפני קביעת תור.
        </p>
        <textarea
          rows={8} dir="rtl"
          style={{ ...S.input, resize: 'vertical', lineHeight: 1.7, direction: 'rtl', unicodeBidi: 'plaintext' }}
          value={terms}
          onChange={e => { setTerms(e.target.value); setTermsDirty(true); }}
        />
      </div>
    </div>
  );
}
