import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { db } from '../../utils/db';
import { DEFAULT_CLINIC_INFO, DEFAULT_ABOUT } from '../../utils/defaults';
import * as S from '../../utils/adminStyles';
import MediaUploader from '../../components/MediaUploader';
import LogoUploader from '../../components/LogoUploader';

const FIELDS = [
  ['name',          'שם הקליניקה',                'הכותרת שמופיעה למעלה בכל האתר',                'text'],
  ['phone',         'טלפון ליצירת קשר',           'יוצג בדף "צרי קשר" ככפתור חיוג',               'tel'],
  ['address',       'כתובת מלאה לניווט',          'משמש לפתיחת ניווט ב-Waze (אם אין לינק ידני)',   'text'],
  ['wazeLink',      'לינק Waze ידני (אופציונלי)', 'אם תרצי לינק ספציפי במקום ניווט אוטומטי לפי כתובת', 'url'],
  ['whatsapp',      'WhatsApp לקביעת תור',        'הכפתור הגדול שלקוחות לוחצות עליו בדף הבית',     'tel'],
  ['ownerWhatsapp', 'WhatsApp האישי שלך',         'בכרטיס "קצת עליי" — לפניות אישיות',             'tel'],
  ['instagram',     'Instagram',                  'שם משתמש בלי @ — יקושר אוטומטית',              'text'],
];

const DEFAULT_STATS = [
  { label: 'שנות ניסיון',   value: 5,   enabled: true },
  { label: 'לקוחות מרוצות', value: 500, enabled: true },
  { label: 'תורים בשבוע',   value: 30,  enabled: true },
];

// שלושת הלוגואים — יושבים באותו מקום, מחליקים ביניהם.
// סדר: ראשי → מסך הבית (PWA) → אדמין למסך הבית.
const LOGOS = [
  { key: 'logoUrl',   label: 'לוגו ראשי',          hint: 'בעיגול בדף הבית ובראש הקבלות' },
  { key: 'pwaLogo',   label: 'לוגו למסך הבית',     hint: 'האייקון כשמוסיפים את האתר הראשי למסך הבית. ריק → לוגו אוטומטי מהאותיות והצבעים' },
  { key: 'adminLogo', label: 'לוגו אדמין למסך הבית', hint: 'האייקון כשמוסיפים את אתר הניהול למסך הבית, ומוצג גם בראש פאנל הניהול' },
];

/* התנהגות קרוסלה RTL (מימין לשמאל — כמו דפדוף בעברית):
   החלקה ימינה = הבא, שמאלה = הקודם.
   הפריט הבא נכנס משמאל (x<0→-60) ונע ימינה למרכז, הישן יוצא ימינה (x>0→+60).
   נקודות הניווט ב-RTL → נעות שמאלה כשהאינדקס עולה — אחיד עם כיוון התוכן. */
const logoSlide = {
  enter:  (d) => ({ x: d > 0 ? -60 : 60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:   (d) => ({ x: d > 0 ? 60 : -60, opacity: 0 }),
};
const LOGO_SPRING = { type: 'spring', stiffness: 440, damping: 36, mass: 0.8 };

// ── Inline save button — appears in card header, only when dirty ──
function InlineSaveBtn({ dirty, saved, onSave }) {
  return (
    <AnimatePresence mode="wait">
      {saved ? (
        <motion.span key="saved"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ color: 'var(--color-success)', fontSize: 12, fontFamily: 'var(--font-body)' }}>
          ✓ נשמר
        </motion.span>
      ) : dirty ? (
        <motion.button key="btn"
          whileTap={{ scale: 0.97 }} onClick={onSave}
          initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 6 }}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 11px', borderRadius: 'var(--radius-sm)',
            border: 'none', backgroundColor: 'var(--color-primary)',
            color: 'var(--color-surface)', fontFamily: 'var(--font-body)',
            fontSize: 11, fontWeight: 700, cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}>
          שמורי 💾
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}

// ── Main ──────────────────────────────────────────────────────────
export default function ContactTab() {
  const [info, setInfo]             = useState(null);
  const [about, setAbout]           = useState(null);
  const [stats, setStats]           = useState(null);
  const [ownerEmail, setOwnerEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // Per-section dirty flags
  const [infoDirty, setInfoDirty]       = useState(false);
  const [statsDirty, setStatsDirty]     = useState(false);
  const [aboutDirty, setAboutDirty]     = useState(false);
  const [passwordDirty, setPasswordDirty] = useState(false);

  // ── Logo carousel ── (0=ראשי, 1=מסך הבית, 2=אדמין) — מתחיל בראשי
  const [logoIdx, setLogoIdx] = useState(0);
  const [logoDir, setLogoDir] = useState(0);

  // החלפה אוטומטית ימינה לבא כל 5 שניות; כל שינוי (ידני/אוטומטי) מאפס את הטיימר
  useEffect(() => {
    const t = setTimeout(() => { setLogoDir(1); setLogoIdx(i => (i + 1) % 3); }, 5000);
    return () => clearTimeout(t);
  }, [logoIdx]);

  // Flash indicator — which section just saved
  const [flashSection, setFlashSection] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    Promise.all([
      db.settings.get('clinicInfo', DEFAULT_CLINIC_INFO),
      db.settings.get('about', DEFAULT_ABOUT),
      db.settings.get('heroStats', DEFAULT_STATS),
      db.settings.get('ownerEmail', ''),
      db.settings.get('adminPassword', ''),
    ]).then(([ci, ab, st, oe, ap]) => {
      setInfo(ci);
      setAbout(ab);
      setStats(Array.isArray(st) && st.length === 3 ? st : DEFAULT_STATS);
      setOwnerEmail(typeof oe === 'string' ? oe : '');
      setAdminPassword(typeof ap === 'string' ? ap : '');
    });
  }, []);

  const flashFor = (section) => {
    setFlashSection(section);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setFlashSection(null), 1600);
  };

  // ── Logo carousel navigation + save ───────────────────────────
  const goLogoTo = (i) => { setLogoDir(i > logoIdx ? 1 : -1); setLogoIdx(((i % 3) + 3) % 3); };
  const goLogo   = (delta) => goLogoTo(logoIdx + delta);
  const saveLogo = (key, url) => {
    const next = { ...info, [key]: url };
    setInfo(next);
    db.settings.set('clinicInfo', next);
    if (key === 'logoUrl') db.settings.set('businessLogo', url); // תאימות עם דף הבית
    flashFor('logo');
  };

  // ── Clinic info + email ───────────────────────────────────────
  const handleSaveInfo = () => {
    db.settings.set('clinicInfo', info);
    db.settings.set('ownerEmail', ownerEmail.trim());
    setInfoDirty(false);
    flashFor('info');
  };

  // ── Hero stats ────────────────────────────────────────────────
  // persistStats: writes to DB (used by button save AND by toggle for immediate save)
  const persistStats = (next) => {
    setStats(next);
    db.settings.set('heroStats', next);
    setStatsDirty(false);
    flashFor('stats');
  };

  // label/value changes → local state only, mark dirty
  const updateStatLocal = (idx, k, v) => {
    setStats(prev => prev.map((s, i) => i === idx ? { ...s, [k]: v } : s));
    setStatsDirty(true);
  };

  // ── About ─────────────────────────────────────────────────────
  const handleSaveAbout = () => {
    db.settings.set('about', about);
    setAboutDirty(false);
    flashFor('about');
  };

  // ── Admin password ────────────────────────────────────────────
  const handleSavePassword = () => {
    const trimmed = (adminPassword || '').trim();
    if (!trimmed) return; // refuse to save empty — would lock everyone out
    db.settings.set('adminPassword', trimmed);
    setAdminPassword(trimmed);
    setPasswordDirty(false);
    flashFor('password');
    // Invalidate any active admin sessions — next page load must re-auth
    // with the new password. Current tab keeps its in-memory unlock state,
    // so the user finishes what they were doing without being kicked out.
    sessionStorage.removeItem('admin_unlocked');
  };

  if (!info || !about || !stats) return <p style={{ ...S.emptyText, padding: '20px 0', textAlign: 'center' }}>טוענת...</p>;

  return (
    <div>
      {/* ── Logos carousel — 3 לוגואים באותו מקום, מחליקים ביניהם ── */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <p style={S.heading}>{LOGOS[logoIdx].label}</p>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--color-text-hint)' }}>
              {logoIdx + 1}/3
            </span>
          </div>
          <AnimatePresence>
            {flashSection === 'logo' && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ color: 'var(--color-success)', fontSize: 12 }}>✓ נשמר</motion.span>
            )}
          </AnimatePresence>
        </div>

        <div style={{ position: 'relative', minHeight: 18, marginBottom: 14 }}>
          <AnimatePresence mode="wait" custom={logoDir} initial={false}>
            <motion.p
              key={LOGOS[logoIdx].key + '-hint'}
              custom={logoDir} variants={logoSlide} initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.2 }}
              style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-hint)', lineHeight: 1.5, margin: 0 }}
            >
              {LOGOS[logoIdx].hint}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* אזור ההחלקה — גרירה ימינה/שמאלה מחליפה לוגו */}
        <div style={{ position: 'relative', overflow: 'hidden', touchAction: 'pan-y' }}>
          <AnimatePresence mode="wait" custom={logoDir} initial={false}>
            <motion.div
              key={LOGOS[logoIdx].key}
              custom={logoDir} variants={logoSlide} initial="enter" animate="center" exit="exit"
              transition={LOGO_SPRING}
              drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.14}
              onDragEnd={(e, i) => {
                // RTL: החלקה ימינה → הבא, שמאלה → הקודם
                if (i.offset.x > 45 || i.velocity.x > 300) goLogo(1);
                else if (i.offset.x < -45 || i.velocity.x < -300) goLogo(-1);
              }}
            >
              <LogoUploader
                currentUrl={info[LOGOS[logoIdx].key] || ''}
                onUploaded={(url) => saveLogo(LOGOS[logoIdx].key, url)}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* נקודות ניווט */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16, direction: 'rtl' }}>
          {LOGOS.map((l, i) => (
            <button
              key={l.key}
              onClick={() => goLogoTo(i)}
              aria-label={l.label}
              style={{
                width: i === logoIdx ? 22 : 8, height: 8, borderRadius: 999,
                border: 'none', cursor: 'pointer', padding: 0,
                backgroundColor: i === logoIdx ? 'var(--color-primary)' : 'var(--color-border-dark)',
                transition: 'width 0.25s ease, background-color 0.25s ease',
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Clinic info ───────────────────────────────────────── */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <p style={S.heading}>פרטי הקליניקה</p>
          <InlineSaveBtn dirty={infoDirty} saved={flashSection === 'info'} onSave={handleSaveInfo} />
        </div>
        {/* ── שם פרטי + שם מלא — זה לצד זה ── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={{ ...S.label, marginBottom: 4 }}>שם פרטי</label>
            <input
              type="text" dir="rtl" style={S.input}
              value={info.ownerName || ''}
              onChange={e => { setInfo(p => ({ ...p, ownerName: e.target.value })); setInfoDirty(true); }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ ...S.label, marginBottom: 4 }}>שם משפחה</label>
            <input
              type="text" dir="rtl" style={S.input}
              value={info.ownerFullName || ''}
              onChange={e => { setInfo(p => ({ ...p, ownerFullName: e.target.value })); setInfoDirty(true); }}
            />
          </div>
        </div>

        {FIELDS.map(([k, l, hint, t]) => (
          <div key={k} style={{ marginBottom: 8 }}>
            <label style={{ ...S.label, marginBottom: 4 }}>{l}</label>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-hint)', marginBottom: 6, lineHeight: 1.4 }}>{hint}</p>
            <input
              type={t === 'url' ? 'text' : t}
              dir={t === 'tel' ? 'ltr' : t === 'url' ? 'auto' : 'rtl'}
              style={S.input}
              value={info[k] || ''}
              onChange={e => { setInfo(p => ({ ...p, [k]: e.target.value })); setInfoDirty(true); }}
            />
          </div>
        ))}

        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--color-border-soft)' }}>
          <label style={{ ...S.label, marginBottom: 4 }}>אימייל בעלת העסק</label>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-hint)', marginBottom: 6, lineHeight: 1.4 }}>
            לכאן יישלחו עותקים של כל הקבלות אוטומטית
          </p>
          <input
            type="email" dir="ltr" style={S.input}
            value={ownerEmail}
            onChange={e => { setOwnerEmail(e.target.value); setInfoDirty(true); }}
            placeholder="you@gmail.com"
          />
        </div>

      </div>

      {/* ── Admin password ────────────────────────────────────── */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <p style={S.heading}>סיסמת כניסה לניהול</p>
          <InlineSaveBtn dirty={passwordDirty} saved={flashSection === 'password'} onSave={handleSavePassword} />
        </div>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-hint)', marginBottom: 10, lineHeight: 1.5 }}>
          הסיסמה שמשמשת לכניסה למסך הניהול. שמרי במקום בטוח — אם תשכחי אותה, תצטרכי לפנות לתמיכה.
        </p>
        <input
          type="text" dir="rtl" style={S.input}
          value={adminPassword}
          onChange={e => { setAdminPassword(e.target.value); setPasswordDirty(true); }}
          placeholder="סיסמה חדשה"
          autoComplete="new-password"
        />
      </div>

      {/* ── Hero stats ────────────────────────────────────────── */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <p style={S.heading}>תגי סטטיסטיקה בדף הבית</p>
          <InlineSaveBtn dirty={statsDirty} saved={flashSection === 'stats'} onSave={() => persistStats(stats)} />
        </div>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-hint)', marginBottom: 14, lineHeight: 1.5 }}>
          עד 3 מספרים שיופיעו מתחת לכפתורים, סופרים מ-0 בכניסה לדף.
        </p>
        {stats.map((s, idx) => (
          <div key={idx} style={{ padding: 12, backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>תג #{idx + 1}</span>
              {/* Toggle saves immediately — it's an explicit boolean action */}
              <button
                onClick={() => persistStats(stats.map((st, i) => i === idx ? { ...st, enabled: !st.enabled } : st))}
                style={{ width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', position: 'relative', backgroundColor: s.enabled ? 'var(--color-primary)' : 'var(--color-border-dark)' }}>
                <span style={{ position: 'absolute', top: 3, width: 16, height: 16, borderRadius: 'var(--radius-full)', backgroundColor: '#fff', insetInlineStart: s.enabled ? 21 : 3, transition: 'inset-inline-start 0.2s' }} />
              </button>
            </div>
            <label style={{ ...S.label, marginBottom: 4 }}>טקסט</label>
            <input type="text" dir="rtl" style={{ ...S.input, marginBottom: 8 }} value={s.label}
              onChange={e => updateStatLocal(idx, 'label', e.target.value)}
              placeholder="שנות ניסיון / לקוחות מרוצות / ..." />
            <label style={{ ...S.label, marginBottom: 4 }}>מספר</label>
            <input type="number" dir="ltr" style={S.input} value={s.value}
              onChange={e => updateStatLocal(idx, 'value', Number(e.target.value) || 0)} />
          </div>
        ))}
      </div>

      {/* ── About ─────────────────────────────────────────────── */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <p style={S.heading}>קצת עליי</p>
          <InlineSaveBtn dirty={aboutDirty} saved={flashSection === 'about'} onSave={handleSaveAbout} />
        </div>
        <MediaUploader
          currentUrl={about.mediaType === 'video' ? (about.videoUrl || '') : (about.imageUrl || '')}
          currentType={about.mediaType || 'image'}
          onUploaded={(url, type) => {
            const next = { ...about, imageUrl: type === 'image' ? url : (about.imageUrl || ''), videoUrl: type === 'video' ? url : '', mediaType: url ? type : 'image' };
            setAbout(next);
            db.settings.set('about', next);
            flashFor('about');
          }}
          label="תמונה / סרטון אישי"
        />
        <label style={S.label}>טקסט אישי</label>
        <textarea rows={6} dir="rtl" style={{ ...S.input, resize: 'vertical', lineHeight: 1.6 }}
          value={about.text || ''}
          onChange={e => { setAbout(p => ({ ...p, text: e.target.value })); setAboutDirty(true); }} />
      </div>
    </div>
  );
}
