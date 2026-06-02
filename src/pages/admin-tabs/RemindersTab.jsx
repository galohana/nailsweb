import { useState, useEffect, useRef, memo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Save, CheckCircle, RotateCcw, ChevronDown, Info } from 'lucide-react';
import { db } from '../../utils/db';
import { DEFAULT_SMS_TEMPLATES, DEFAULT_TELEGRAM_TEMPLATES } from '../../utils/defaults';
import * as S from '../../utils/adminStyles';

// ── Client SMS templates (welcome + OTP only) ─────────────────
const CLIENT_TPL = [
  { key: 'welcome', label: 'ברוכה הבאה — הרשמה חדשה', hint: '{name} {business}' },
  { key: 'otp',    label: 'קוד אימות בהרשמה',          hint: '{code}' },
];

// ── Telegram templates (owner notifications) ──────────────────
const TELEGRAM_TPL = [
  { key: 'newBooking',     label: 'תור חדש נקבע',          hint: '{name} {phone} {service} {date} {time}' },
  { key: 'cancellation',   label: 'ביטול תור',              hint: '{name} {phone} {service} {date} {time}' },
  { key: 'newClient',      label: 'הרשמה כלקוחה חדשה',     hint: '{name} {phone}' },
  { key: 'waitlistJoin',   label: 'כניסה לרשימת המתנה',    hint: '{name} {phone} {date}' },
  { key: 'waitlistFilled', label: 'מעבר מהמתנה לתור פנוי', hint: '{name} {phone} {date} {time}' },
  { key: 'orderPending',   label: 'הזמנה ממתינה לאישור',   hint: '{name} {phone} {items} {total}' },
  { key: 'orderPurchase',  label: 'קנייה בחנות אושרה',      hint: '{name} {phone} {items} {total}' },
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

function mergeTgTpl(saved) {
  const out = {};
  for (const k of Object.keys(DEFAULT_TELEGRAM_TEMPLATES))
    out[k] = saved?.[k] ?? DEFAULT_TELEGRAM_TEMPLATES[k];
  return out;
}

// ── Reusable toggle ───────────────────────────────────────────
const Toggle = ({ value, onChange }) => (
  <button onClick={() => onChange(!value)} style={{ width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', position: 'relative', backgroundColor: value ? 'var(--color-primary)' : 'var(--color-border-dark)', flexShrink: 0 }}>
    <span style={{ position: 'absolute', top: 3, width: 16, height: 16, borderRadius: 'var(--radius-full)', backgroundColor: '#fff', insetInlineStart: value ? 21 : 3, transition: 'inset-inline-start 0.2s' }} />
  </button>
);

// ── TemplateCard (SMS) ────────────────────────────────────────
export const TemplateCard = memo(function TemplateCard({ tplKey, side, label, hint, initialText, initialEnabled, defaultText, onSave }) {
  const [text, setText]       = useState(initialText);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [savedTick, setTick]  = useState(false);
  const lastInitTextRef = useRef(initialText);

  useEffect(() => {
    if (initialText !== lastInitTextRef.current) {
      setText(initialText);
      lastInitTextRef.current = initialText;
    }
  }, [initialText]);

  const persist = (nextText, nextEnabled) => {
    onSave(side, tplKey, { text: nextText, enabled: nextEnabled });
    setTick(true); setTimeout(() => setTick(false), 1200);
  };
  const handleSave   = () => persist(text, enabled);
  const handleToggle = (v) => { setEnabled(v); persist(text, v); };
  const handleReset  = () => { setText(defaultText); persist(defaultText, enabled); };
  const handleBlur   = () => { if (text !== initialText) persist(text, enabled); };

  return (
    <div style={{ padding: 12, backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', marginBottom: 10, boxShadow: '0 1px 3px rgba(92,61,46,0.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.2, flex: 1 }}>{label}</span>
        <Toggle value={enabled} onChange={handleToggle} />
      </div>
      <textarea
        rows={3} value={text}
        onChange={e => setText(e.target.value)}
        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text)', backgroundColor: 'var(--color-surface)', resize: 'vertical', marginBottom: 6, minHeight: 64 }}
      />
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 8, lineHeight: 1.5 }}>
        זמין: <span dir="ltr" style={{ fontFamily: 'monospace', color: 'var(--color-primary-ink)' }}>{hint}</span>
      </p>
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

// ── TelegramTemplateCard ──────────────────────────────────────
// Outside main component — contains <textarea> (Iron Rule).
const TelegramTemplateCard = memo(function TelegramTemplateCard({ tplKey, label, hint, initialText, initialEnabled, defaultText, onSave }) {
  const [text, setText]       = useState(initialText);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [savedTick, setTick]  = useState(false);
  const lastRef = useRef(initialText);

  useEffect(() => {
    if (initialText !== lastRef.current) { setText(initialText); lastRef.current = initialText; }
  }, [initialText]);

  const persist = (t, e) => { onSave(tplKey, { text: t, enabled: e }); setTick(true); setTimeout(() => setTick(false), 1200); };
  const handleSave   = () => persist(text, enabled);
  const handleToggle = (v) => { setEnabled(v); persist(text, v); };
  const handleReset  = () => { setText(defaultText); persist(defaultText, enabled); };
  const handleBlur   = () => { if (text !== lastRef.current) { lastRef.current = text; persist(text, enabled); } };

  return (
    <div style={{ padding: 12, backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', marginBottom: 10, boxShadow: '0 1px 3px rgba(92,61,46,0.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: 'var(--color-text)', flex: 1 }}>{label}</span>
        <Toggle value={enabled} onChange={handleToggle} />
      </div>
      <textarea
        rows={4} value={text}
        onChange={e => setText(e.target.value)}
        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text)', backgroundColor: 'var(--color-surface)', resize: 'vertical', marginBottom: 6, minHeight: 80 }}
      />
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 8, lineHeight: 1.5 }}>
        זמין: <span dir="ltr" style={{ fontFamily: 'monospace', color: 'var(--color-primary-ink)' }}>{hint}</span>
        <br />
        <span style={{ color: 'var(--color-text-hint)' }}>HTML מותר: &lt;b&gt;, &lt;i&gt;, &lt;code&gt; | שורה חדשה: \n</span>
      </p>
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

// ── TelegramChatIdInput ───────────────────────────────────────
// Outside main component — contains <input> (Iron Rule).
function TelegramChatIdInput({ initial, onSave }) {
  const [val, setVal]   = useState(initial || '');
  const [tick, setTick] = useState(false);

  useEffect(() => { setVal(initial || ''); }, [initial]);

  const save = (v) => {
    db.settings.set('telegramChatId', v.trim());
    setTick(true); setTimeout(() => setTick(false), 1600);
  };

  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ ...S.label, marginBottom: 4 }}>Chat ID</label>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-hint)', marginBottom: 6, lineHeight: 1.5 }}>
        מספר זה מתקבל מהבוט שלך — שלחי /start לבוט ← העתיקי את המספר שמופיע.
      </p>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="text" dir="ltr"
          style={{ ...S.input, flex: 1, marginBottom: 0, fontFamily: 'monospace' }}
          value={val}
          onChange={e => setVal(e.target.value)}
          placeholder="1234567890"
        />
        <motion.button whileTap={{ scale: 0.97 }}
          onClick={() => { save(val); onSave?.(val.trim()); }}
          style={{
            padding: '8px 14px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
            backgroundColor: tick ? 'var(--color-success)' : 'var(--color-primary)',
            backgroundImage: tick ? 'none' : 'var(--demo-primary-mat-overlay, none)',
            border: tick ? 'none' : 'var(--demo-primary-mat-border, none)',
            color: 'var(--color-surface)',
            fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700,
            transition: 'background-color 0.2s', flexShrink: 0, alignSelf: 'flex-start',
          }}>
          {tick ? '✓ נשמר' : 'שמורי'}
        </motion.button>
      </div>
    </div>
  );
}

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

// ── Admin weekly reminder card ────────────────────────────────
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
        <p style={S.heading}>תזכורת ראשון (אדמין)</p>
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
        הודעה שתופיע בעת כניסה לאדמין ביום ראשון. ניתן לסגור — תוצג שוב בראשון הבא.
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
        onChange={e => { setText(e.target.value); setDirty(true); }}
        placeholder={DEFAULT_TEXT} />
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
  const [tpl, setTpl]           = useState(null);
  const [tgTpl, setTgTpl]       = useState(null);
  const [tgChatId, setTgChatId] = useState('');

  useEffect(() => {
    db.settings.get('telegramChatId', '').then(v => setTgChatId(v || ''));
    db.settings.get('telegramTemplates', DEFAULT_TELEGRAM_TEMPLATES).then(v => setTgTpl(mergeTgTpl(v)));
    db.settings.get('smsTemplates', DEFAULT_SMS_TEMPLATES).then(v => {
      const merged = mergeTpl(v);
      setTpl(merged);
      // Migration: disable client.reminder so cron-reminders.js skips it.
      if (v?.client?.reminder?.enabled !== false) {
        db.settings.set('smsTemplates', {
          ...merged,
          client: { ...merged.client, reminder: { ...merged.client.reminder, enabled: false } },
        });
      }
    });
  }, []);

  const onTplSave = (side, key, patch) => {
    setTpl(prev => {
      const next = { ...prev, [side]: { ...prev[side], [key]: { ...prev[side][key], ...patch } } };
      db.settings.set('smsTemplates', next);
      return next;
    });
  };

  const onTgTplSave = (key, patch) => {
    setTgTpl(prev => {
      const next = { ...prev, [key]: { ...prev[key], ...patch } };
      db.settings.set('telegramTemplates', next);
      return next;
    });
  };

  if (!tpl || !tgTpl) return <p style={{ ...S.emptyText, padding: '20px 0', textAlign: 'center' }}>טוענת...</p>;

  return (
    <div>
      {/* ── Admin weekly reminder ──────────────────────────────── */}
      <AdminWeeklyReminderCard />

      {/* ── Client SMS templates ──────────────────────────────── */}
      <div style={S.card}>
        <p style={{ ...S.heading, marginBottom: 4 }}>הודעות SMS ללקוחות</p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
          שתי הודעות SMS שנשלחות ללקוחות. שאר ההתראות ללקוחות הוצאו מ-SMS.
        </p>
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

      {/* ── Telegram owner notifications ──────────────────────── */}
      <div style={{ ...S.card, border: '1px solid rgba(0,136,204,0.28)', backgroundColor: 'rgba(0,136,204,0.03)' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#005f8a', marginBottom: 4 }}>
          📱 התראות טלגרם — לבעלת העסק
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#005f8a', marginBottom: 16, lineHeight: 1.6 }}>
          תור חדש, ביטול, לקוחה חדשה, הזמנות ועוד — נשלחות דרך טלגרם עם כפתורי פעולה.
          כפתורים (בטל תור / אישרתי / דחה) מתווספים אוטומטית — אין צורך לציין בתבנית.
        </p>
        <TelegramChatIdInput initial={tgChatId} onSave={setTgChatId} />
      </div>

      <div style={S.card}>
        <p style={{ ...S.heading, marginBottom: 4 }}>תבניות הודעות טלגרם</p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
          כל הודעה ניתנת לעריכה והפעלה/כיבוי. HTML מותר: <code style={{ fontFamily: 'monospace', fontSize: 11 }}>&lt;b&gt;</code>, <code style={{ fontFamily: 'monospace', fontSize: 11 }}>&lt;i&gt;</code>.
        </p>
        {TELEGRAM_TPL.map(({ key, label, hint }) => (
          <TelegramTemplateCard
            key={key} tplKey={key} label={label} hint={hint}
            initialText={tgTpl[key]?.text ?? DEFAULT_TELEGRAM_TEMPLATES[key]?.text ?? ''}
            initialEnabled={tgTpl[key]?.enabled ?? true}
            defaultText={DEFAULT_TELEGRAM_TEMPLATES[key]?.text ?? ''}
            onSave={onTgTplSave}
          />
        ))}
      </div>
    </div>
  );
}
