import { useState, useEffect, useRef, memo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Save, CheckCircle, RotateCcw, ChevronDown, Info } from 'lucide-react';
import { db } from '../../utils/db';
import { DEFAULT_SMS_TEMPLATES } from '../../utils/defaults';
import * as S from '../../utils/adminStyles';

// ── Client SMS templates (welcome + OTP only) ─────────────────
const CLIENT_TPL = [
  { key: 'welcome', label: 'ברוכה הבאה — הרשמה חדשה', hint: '{name} {business}' },
  { key: 'otp',    label: 'קוד אימות בהרשמה',          hint: '{code}' },
];

const SMS_PLACEHOLDERS = [
  { tag: '{name}',     desc: 'שם הלקוח/ה' },
  { tag: '{business}', desc: 'שם העסק' },
  { tag: '{code}',     desc: 'קוד OTP' },
];

function mergeTpl(saved) {
  const out = { client: {} };
  for (const k of Object.keys(DEFAULT_SMS_TEMPLATES.client))
    out.client[k] = saved?.client?.[k] ?? DEFAULT_SMS_TEMPLATES.client[k];
  return out;
}

// ══ Push notifications settings ══════════════════════════════════
const OFFSET_OPTIONS = [
  ['30m', '30 דקות'], ['1h', 'שעה'], ['2h', 'שעתיים'], ['3h', '3 שעות'],
  ['12h', '12 שעות'], ['1d', 'יום'], ['2d', 'יומיים'],
];
const DAYS_HE   = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HOURS_ARR = Array.from({ length: 24 }, (_, i) => i);

const DEFAULT_PUSH = {
  admin: {
    new_booking:        { enabled: true,  text: 'תור חדש נקבע! 📅' },
    cancellation:       { enabled: true,  text: 'תור בוטל ❌' },
    new_client:         { enabled: true,  text: 'לקוחה חדשה הצטרפה 🌸' },
    waitlist_join:      { enabled: true,  text: 'לקוחה נכנסה לרשימת המתנה' },
    waitlist_promoted:  { enabled: true,  text: 'לקוחה עברה מהמתנה לתור ✅' },
    shop_order_pending: { enabled: true,  text: 'הזמנה ממתינה לאישורך 🛍️' },
    shop_purchase:      { enabled: true,  text: 'קנייה חדשה בחנות! 💰' },
    daily_summary:      { enabled: false, time: '08:00', text: 'בוקר טוב! הנה סיכום התורים שלך להיום ☀️' },
    weekly_reminder:    { enabled: false, day: 0, hour: 9, text: 'תזכורת: סדרי את לוח העבודה לשבוע הבא 📅' },
  },
  client: {
    reminder1:              { enabled: true,  offset: '1d', text: 'תזכורת: יש לך תור מחר 💅' },
    reminder2:              { enabled: true,  offset: '2h', text: 'תזכורת: התור שלך מתקרב ⏰' },
    appointment_confirmed:  { enabled: true,  text: 'התשלום אושר, התור שלך מאושר! ✅' },
    shop_payment_confirmed: { enabled: true,  text: 'הקנייה אושרה! 🛍️' },
    shop_order_confirmed:   { enabled: true,  text: 'ההזמנה שלך אושרה ✅' },
    welcome:                { enabled: true,  text: 'ברוכה הבאה! שמחים שהצטרפת 🌸' },
    waitlist_available:     { enabled: true,  text: 'התפנה מקום בתאריך שביקשת! מהרי לקבוע תור 🎉' },
  },
};

const ADMIN_EVENTS = [
  ['new_booking', 'תור חדש'], ['cancellation', 'ביטול תור'], ['new_client', 'לקוחה חדשה'],
  ['waitlist_join', 'כניסה להמתנה'], ['waitlist_promoted', 'מהמתנה לתור'],
  ['shop_order_pending', 'הזמנה ממתינה'], ['shop_purchase', 'קנייה בחנות'],
];
const CLIENT_EVENTS = [
  ['waitlist_available', 'התפנה מקום (רשימת המתנה)'],
  ['appointment_confirmed', 'תור אושר'], ['shop_payment_confirmed', 'תשלום קנייה אושר'],
  ['shop_order_confirmed', 'הזמנה אושרה'], ['welcome', 'ברוכה הבאה'],
];

function mergePush(saved) {
  const out = { admin: {}, client: {} };
  for (const aud of ['admin', 'client']) {
    for (const k of Object.keys(DEFAULT_PUSH[aud])) {
      out[aud][k] = { ...DEFAULT_PUSH[aud][k], ...(saved?.[aud]?.[k] || {}) };
    }
  }
  return out;
}

// ── Reusable toggle ───────────────────────────────────────────
const Toggle = ({ value, onChange }) => (
  <button onClick={() => onChange(!value)} style={{ width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', position: 'relative', backgroundColor: value ? 'var(--color-primary)' : 'var(--color-border-dark)', flexShrink: 0 }}>
    <span style={{ position: 'absolute', top: 3, width: 16, height: 16, borderRadius: 'var(--radius-full)', backgroundColor: '#fff', insetInlineStart: value ? 21 : 3, transition: 'inset-inline-start 0.2s' }} />
  </button>
);

const pushInput = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px',
  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
  fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text)',
  backgroundColor: 'var(--color-surface)', outline: 'none',
};

// שורת אירוע פשוטה: toggle + טקסט
function PushEventRow({ audience, k, label, cfg, onChange }) {
  const [text, setText] = useState(cfg.text || '');
  return (
    <div style={{ padding: '11px 0', borderBottom: '1px solid var(--color-border-soft)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--color-primary-ink)', flex: 1 }}>{label}</span>
        <Toggle value={cfg.enabled !== false} onChange={(v) => onChange(audience, k, { enabled: v })} />
      </div>
      <input type="text" dir="rtl" value={text} placeholder={DEFAULT_PUSH[audience][k].text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => { if (text !== cfg.text) onChange(audience, k, { text: text.trim() }); }}
        style={pushInput} />
    </div>
  );
}

// שורת תזכורת לקוחה: toggle + בורר זמן + טקסט
function ReminderRow({ k, num, cfg, onChange }) {
  const [text, setText] = useState(cfg.text || '');
  return (
    <div style={{ padding: '12px 0', borderBottom: '1px solid var(--color-border-soft)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, color: 'var(--color-primary-ink)', flex: 1 }}>
          ⏰ תזכורת {num}
        </span>
        <Toggle value={cfg.enabled !== false} onChange={(v) => onChange('client', k, { enabled: v })} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-muted)', flexShrink: 0 }}>כמה זמן לפני התור:</span>
        <select value={cfg.offset || '1d'} onChange={(e) => onChange('client', k, { offset: e.target.value })}
          style={{ ...pushInput, flex: 1, padding: '7px 9px', cursor: 'pointer' }}>
          {OFFSET_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <input type="text" dir="rtl" value={text} placeholder={DEFAULT_PUSH.client[k].text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => { if (text !== cfg.text) onChange('client', k, { text: text.trim() }); }}
        style={pushInput} />
    </div>
  );
}

// סיכום יומי לבעלת העסק: toggle + שעה + טקסט
function DailySummaryRow({ cfg, onChange }) {
  const [text, setText] = useState(cfg.text || '');
  return (
    <div style={{ padding: '12px 0', borderBottom: '1px solid var(--color-border-soft)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, color: 'var(--color-primary-ink)', flex: 1 }}>
          ☀️ סיכום יומי בבוקר
        </span>
        <Toggle value={cfg.enabled === true} onChange={(v) => onChange('admin', 'daily_summary', { enabled: v })} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-muted)', flexShrink: 0 }}>שעת שליחה:</span>
        <input type="time" dir="ltr" value={cfg.time || '08:00'} onChange={(e) => onChange('admin', 'daily_summary', { time: e.target.value })}
          style={{ ...pushInput, maxWidth: 130, textAlign: 'center' }} />
      </div>
      <input type="text" dir="rtl" value={text} placeholder={DEFAULT_PUSH.admin.daily_summary.text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => { if (text !== cfg.text) onChange('admin', 'daily_summary', { text: text.trim() }); }}
        style={pushInput} />
    </div>
  );
}

// תזכורת שבועית: toggle + יום + שעה + טקסט
function WeeklyReminderRow({ cfg, onChange }) {
  const [text, setText] = useState(cfg.text || '');
  return (
    <div style={{ padding: '12px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, color: 'var(--color-primary-ink)', flex: 1 }}>
          📅 תזכורת שבועית
        </span>
        <Toggle value={cfg.enabled === true} onChange={(v) => onChange('admin', 'weekly_reminder', { enabled: v })} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-muted)', flexShrink: 0 }}>יום בשבוע:</span>
        <select value={cfg.day ?? 0} onChange={(e) => onChange('admin', 'weekly_reminder', { day: Number(e.target.value) })}
          style={{ ...pushInput, flex: 1, padding: '7px 9px', cursor: 'pointer' }}>
          {DAYS_HE.map((d, i) => <option key={i} value={i}>{d}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-muted)', flexShrink: 0 }}>שעה:</span>
        <select value={cfg.hour ?? 9} onChange={(e) => onChange('admin', 'weekly_reminder', { hour: Number(e.target.value) })}
          style={{ ...pushInput, flex: 1, padding: '7px 9px', cursor: 'pointer' }}>
          {HOURS_ARR.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
        </select>
      </div>
      <input type="text" dir="rtl" value={text} placeholder="תזכורת: סדרי את לוח העבודה לשבוע הבא 📅"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => { if (text !== cfg.text) onChange('admin', 'weekly_reminder', { text: text.trim() }); }}
        style={pushInput} />
    </div>
  );
}

function PushSettingsSection() {
  const [settings, setSettings] = useState(null);
  useEffect(() => {
    db.settings.get('push_settings', DEFAULT_PUSH).then(v => setSettings(mergePush(v)));
  }, []);
  const onChange = (audience, k, patch) => {
    setSettings(prev => {
      const next = { ...prev, [audience]: { ...prev[audience], [k]: { ...prev[audience][k], ...patch } } };
      db.settings.set('push_settings', next);
      return next;
    });
  };
  if (!settings) return null;
  return (
    <>
      {/* ── חלונית 1: בעלת העסק ── */}
      <div style={{ ...S.card, border: '1.5px solid rgba(92,61,46,0.28)', backgroundColor: 'rgba(92,61,46,0.025)' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--color-primary)', margin: '0 0 2px' }}>
          🏪 התראות לבעלת העסק
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-muted)', margin: '0 0 10px', lineHeight: 1.5 }}>
          מה שאת מקבלת על הטלפון שלך
        </p>
        {ADMIN_EVENTS.map(([k, label]) => (
          <PushEventRow key={`a-${k}`} audience="admin" k={k} label={label} cfg={settings.admin[k]} onChange={onChange} />
        ))}
        <DailySummaryRow cfg={settings.admin.daily_summary} onChange={onChange} />
        <WeeklyReminderRow cfg={settings.admin.weekly_reminder} onChange={onChange} />
      </div>

      {/* ── חלונית 2: לקוחות ── */}
      <div style={{ ...S.card, marginTop: 14, border: '1.5px solid rgba(138,90,43,0.28)', backgroundColor: 'rgba(138,90,43,0.025)' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: '#8a5a2b', margin: '0 0 2px' }}>
          👤 התראות ללקוחות
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-muted)', margin: '0 0 10px', lineHeight: 1.5 }}>
          מה שהלקוחות מקבלות
        </p>
        <ReminderRow k="reminder1" num={1} cfg={settings.client.reminder1} onChange={onChange} />
        <ReminderRow k="reminder2" num={2} cfg={settings.client.reminder2} onChange={onChange} />
        {CLIENT_EVENTS.map(([k, label]) => (
          <PushEventRow key={`c-${k}`} audience="client" k={k} label={label} cfg={settings.client[k]} onChange={onChange} />
        ))}
      </div>
    </>
  );
}

// ── TemplateCard (SMS) ────────────────────────────────────────
export const TemplateCard = memo(function TemplateCard({ tplKey, side, label, hint, initialText, initialEnabled, defaultText, onSave }) {
  const [text, setText]       = useState(initialText);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [savedTick, setTick]  = useState(false);
  const lastInitTextRef = useRef(initialText);

  useEffect(() => {
    if (initialText !== lastInitTextRef.current) { setText(initialText); lastInitTextRef.current = initialText; }
  }, [initialText]);

  const persist = (nextText, nextEnabled) => {
    onSave(side, tplKey, { text: nextText, enabled: nextEnabled });
    setTick(true); setTimeout(() => setTick(false), 1200);
  };
  const handleSave   = () => persist(text, enabled);
  const handleToggle = (v) => { setEnabled(v); persist(text, v); };
  const handleReset  = () => { setText(defaultText); persist(defaultText, enabled); };

  return (
    <div style={{ padding: 12, backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', marginBottom: 10, boxShadow: '0 1px 3px rgba(92,61,46,0.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.2, flex: 1 }}>{label}</span>
        <Toggle value={enabled} onChange={handleToggle} />
      </div>
      <textarea rows={3} value={text} onChange={e => setText(e.target.value)}
        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text)', backgroundColor: 'var(--color-surface)', resize: 'vertical', marginBottom: 6, minHeight: 64 }}
      />
      <div style={{ display: 'flex', gap: 6 }}>
        <motion.button whileTap={{ scale: 0.97 }} onClick={handleSave}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 10px', backgroundColor: savedTick ? 'var(--color-success)' : 'var(--color-primary)', backgroundImage: savedTick ? 'none' : 'var(--demo-primary-mat-overlay, none)', border: savedTick ? 'none' : 'var(--demo-primary-mat-border, none)', borderRadius: 'var(--radius-sm)', color: 'var(--color-on-primary)', fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'background-color 0.2s' }}
        >
          {savedTick ? <CheckCircle size={12} /> : <Save size={12} />}
          {savedTick ? 'נשמר' : 'שמרי'}
        </motion.button>
        <motion.button whileTap={{ scale: 0.93 }} onClick={handleReset} title="איפוס לברירת מחדל"
          style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
        >
          <RotateCcw size={12} />
        </motion.button>
      </div>
    </div>
  );
});

// ── Placeholder Guide (SMS) ───────────────────────────────────
function PlaceholderGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: 14, border: '1.5px solid #C99B6C', borderRadius: 'var(--radius-lg)', overflow: 'hidden', backgroundColor: 'rgba(201,155,108,0.08)' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Info size={15} color="#C99B6C" /> מדריך משתנים — לחצי לפתיחה
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={16} color="var(--color-text-muted)" />
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '4px 14px 14px' }}>
              {SMS_PLACEHOLDERS.map(({ tag, desc }) => (
                <div key={tag} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid rgba(201,155,108,0.18)' }}>
                  <code style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--color-primary-ink)', backgroundColor: 'var(--color-surface)', padding: '2px 7px', borderRadius: 4, border: '1px solid var(--color-border)', flexShrink: 0, minWidth: 78, textAlign: 'center' }} dir="ltr">{tag}</code>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text)' }}>{desc}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Admin weekly reminder card (in-app Sunday banner) ─────────
function AdminWeeklyReminderCard() {
  const DEFAULT_TEXT = 'אל תשכחי לקבוע שעות עבודה ❤️';
  const DEFAULT_TIME = '09:00';
  const [enabled, setEnabled] = useState(true);
  const [text, setText]       = useState(DEFAULT_TEXT);
  const [time, setTime]       = useState(DEFAULT_TIME);
  const [saved, setSaved]     = useState(false);
  const [dirty, setDirty]     = useState(false);

  useEffect(() => {
    db.settings.get('adminReminder', { enabled: true, text: DEFAULT_TEXT, time: DEFAULT_TIME }).then(r => {
      setEnabled(r?.enabled !== false);
      setText(r?.text || DEFAULT_TEXT);
      setTime(r?.time || DEFAULT_TIME);
    });
  }, []);

  const save = (patch) => {
    const next = { enabled, text, time, ...patch };
    setEnabled(next.enabled); setText(next.text); setTime(next.time);
    db.settings.set('adminReminder', next);
    setDirty(false);
    setSaved(true); setTimeout(() => setSaved(false), 1400);
  };

  return (
    <div style={S.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <p style={S.heading}>תזכורת ראשון (באתר הניהול)</p>
        <AnimatePresence mode="wait">
          {saved ? (
            <motion.span key="saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ color: 'var(--color-success)', fontSize: 12, fontFamily: 'var(--font-body)' }}>✓ נשמר</motion.span>
          ) : dirty ? (
            <motion.button key="btn" whileTap={{ scale: 0.97 }} onClick={() => save({})}
              initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 6 }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 11px', borderRadius: 7, backgroundColor: 'var(--color-primary)', backgroundImage: 'var(--demo-primary-mat-overlay, none)', border: 'var(--demo-primary-mat-border, none)', color: 'var(--color-on-primary)', fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              שמורי 💾
            </motion.button>
          ) : null}
        </AnimatePresence>
      </div>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 10, lineHeight: 1.5 }}>
        הודעה שתופיע בעת כניסה לאתר הניהול ביום ראשון. ניתן לסגור — תוצג שוב בראשון הבא.
      </p>
      <div style={S.toggleRow}>
        <span style={S.toggleLabel}>הפעלת תזכורת</span>
        <button onClick={() => save({ enabled: !enabled })}
          style={{ width: 46, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', position: 'relative', backgroundColor: enabled ? 'var(--color-success)' : '#C8A882', transition: 'background-color 0.2s' }}>
          <span style={{ position: 'absolute', top: 3, insetInlineStart: enabled ? 23 : 3, width: 20, height: 20, borderRadius: 'var(--radius-full)', backgroundColor: 'var(--color-surface)', transition: 'inset-inline-start 0.2s' }} />
        </button>
      </div>
      <label style={{ ...S.label, marginTop: 14 }}>טקסט התזכורת</label>
      <input type="text" style={S.input} value={text}
        onChange={e => { setText(e.target.value); setDirty(true); }} placeholder={DEFAULT_TEXT} />
      <label style={{ ...S.label, marginTop: 10 }}>שעת הצגה ביום ראשון</label>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-hint)', marginBottom: 6 }}>התזכורת תופיע רק אחרי השעה הזו</p>
      <input type="time"
        style={{ ...S.input, direction: 'ltr', textAlign: 'center', marginBottom: 0, maxWidth: '160px', width: '100%', boxSizing: 'border-box' }}
        value={time} onChange={e => { setTime(e.target.value); setDirty(true); }} />
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function RemindersTab() {
  const [tpl, setTpl] = useState(null);

  useEffect(() => {
    db.settings.get('smsTemplates', DEFAULT_SMS_TEMPLATES).then(v => setTpl(mergeTpl(v)));
  }, []);

  const onTplSave = (side, key, patch) => {
    setTpl(prev => {
      const next = { ...prev, [side]: { ...prev[side], [key]: { ...prev[side][key], ...patch } } };
      db.settings.set('smsTemplates', next);
      return next;
    });
  };

  if (!tpl) return <p style={{ ...S.emptyText, padding: '20px 0', textAlign: 'center' }}>טוענת...</p>;

  return (
    <div>
      {/* ── Push notifications (2 חלוניות נפרדות) ─────────────────── */}
      <PushSettingsSection />

      {/* ── Admin weekly reminder (in-app) ─────────────────────── */}
      <AdminWeeklyReminderCard />

      {/* ── Client SMS templates ──────────────────────────────── */}
      <div style={S.card}>
        <p style={{ ...S.heading, marginBottom: 4 }}>הודעות SMS ללקוחות</p>
        <div style={{ margin: '8px 0 14px', padding: '11px 13px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(201,155,108,0.10)', border: '1px solid #C99B6C' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-primary-ink)', margin: 0, lineHeight: 1.6, fontWeight: 500 }}>
            📱 SMS נשלח רק למי שלא הפעיל התראות מהאפליקציה. להתראות מיידיות — מומלץ להפעיל התראות מאתר הניהול.
          </p>
        </div>
        <PlaceholderGuide />
        {CLIENT_TPL.map(({ key, label, hint }) => (
          <TemplateCard
            key={`client-${key}`}
            tplKey={key} side="client" label={label} hint={hint}
            initialText={tpl.client[key]?.text ?? DEFAULT_SMS_TEMPLATES.client[key]?.text ?? ''}
            initialEnabled={tpl.client[key]?.enabled ?? DEFAULT_SMS_TEMPLATES.client[key]?.enabled ?? true}
            defaultText={DEFAULT_SMS_TEMPLATES.client[key]?.text ?? ''}
            onSave={onTplSave}
          />
        ))}
      </div>
    </div>
  );
}
