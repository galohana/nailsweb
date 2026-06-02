import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import { db } from '../../utils/db';
import { DEFAULT_WORKING_HOURS, DEFAULT_ADMIN_SETTINGS } from '../../utils/defaults';
import * as S from '../../utils/adminStyles';

// DateInput — wrapper שעובד ב-iOS: input[type=date] שקוף מתחת לspan נראה
const DateInput = ({ value, onChange, min, placeholder = 'בחרי תאריך', borderColor, style }) => (
  <div style={{
    position: 'relative', display: 'flex', alignItems: 'center',
    minHeight: 44, border: `1px solid ${borderColor || 'var(--color-border-dark)'}`,
    borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-surface)',
    padding: '0 12px', boxSizing: 'border-box', ...style,
  }}>
    <span style={{
      fontFamily: 'var(--font-body)', fontSize: 13,
      color: value ? 'var(--color-text)' : 'var(--color-text-hint)',
      userSelect: 'none', pointerEvents: 'none', direction: 'ltr',
    }}>
      {value
        ? new Date(value + 'T00:00:00').toLocaleDateString('he-IL')
        : `📅 ${placeholder}`}
    </span>
    <input
      type="date" value={value} min={min} onChange={onChange}
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        opacity: 0, cursor: 'pointer', zIndex: 1, WebkitAppearance: 'none',
      }}
    />
  </div>
);

export default function BreaksTab() {
  const [wh, setWh] = useState(null);
  const [mode, setMode] = useState('single'); // 'single' | 'range'
  const [date, setDate] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [note, setNote] = useState('');
  const [type, setType] = useState('closed');
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('14:00');
  const [conflictList, setConflictList] = useState([]);  // appointments that conflict with the new exception
  const [checking, setChecking] = useState(false);

  // Announcement (moved here from RemindersTab)
  const [admin, setAdmin] = useState(null);
  const [savedAnn, setSavedAnn] = useState(false);

  useEffect(() => {
    db.settings.get('workingHours', DEFAULT_WORKING_HOURS).then(setWh);
    db.settings.get('adminSettings', DEFAULT_ADMIN_SETTINGS).then(setAdmin);
  }, []);

  const [annDirty, setAnnDirty] = useState(false);

  const saveAdmin = (n) => {
    setAdmin(n);
    db.settings.set('adminSettings', n);
    setAnnDirty(false);
    setSavedAnn(true);
    setTimeout(() => setSavedAnn(false), 1600);
  };
  // Used by toggle (immediate save) — keeps passing through saveAdmin
  const updA = (k, v) => saveAdmin({ ...admin, announcement: { ...admin.announcement, [k]: v } });

  const Toggle = ({ value, onChange }) => (
    <button onClick={() => onChange(!value)} style={{ width: 44, height: 24, borderRadius: 'var(--demo-radius-card)', border: 'none', cursor: 'pointer', position: 'relative', backgroundColor: value ? 'var(--color-primary)' : 'var(--color-border-dark)' }}>
      <span style={{ position: 'absolute', top: 3, width: 18, height: 18, borderRadius: 'var(--radius-full)', backgroundColor: '#fff', insetInlineStart: value ? 23 : 3, transition: 'inset-inline-start 0.2s' }} />
    </button>
  );

  const upd = (next) => { setWh(next); db.settings.set('workingHours', next); };

  const doSave = () => {
    const exceptions = wh.exceptions || [];
    if (mode === 'range') {
      const entry = { dateFrom: date, dateTo, note, type, ...(type === 'partial' ? { start, end } : {}) };
      upd({ ...wh, exceptions: [...exceptions, entry] });
    } else {
      const entry = { date, note, type, ...(type === 'partial' ? { start, end } : {}) };
      upd({ ...wh, exceptions: [...exceptions.filter(e => e.date !== date), entry] });
    }
    setDate(''); setDateTo(''); setNote('');
    setConflictList([]);
  };

  const add = async () => {
    if (!date) return;
    if (mode === 'range' && (!dateTo || dateTo < date)) return;

    // Build list of dates to check
    setChecking(true);
    const datesToCheck = [];
    if (mode === 'single') {
      datesToCheck.push(date);
    } else {
      const cur = new Date(date + 'T00:00:00');
      const last = new Date(dateTo + 'T00:00:00');
      while (cur <= last && datesToCheck.length <= 90) {
        datesToCheck.push(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
      }
    }

    try {
      const allApts = (await Promise.all(datesToCheck.map(ds => db.appointments.byDate(ds)))).flat();
      const conflicts = allApts.filter(a => a.status !== 'cancelled');
      setChecking(false);
      if (conflicts.length > 0) {
        setConflictList(conflicts);
        return; // wait for admin to confirm
      }
    } catch {
      setChecking(false);
    }

    doSave();
  };
  const remove = (key) => upd({ ...wh, exceptions: (wh.exceptions || []).filter(e => (e.date || e.dateFrom) !== key) });

  if (!wh) return <p style={{ ...S.emptyText, padding: '20px 0', textAlign: 'center' }}>טוענת...</p>;
  const list = (wh.exceptions || []).slice().sort((a, b) =>
    (a.date || a.dateFrom || '').localeCompare(b.date || b.dateFrom || ''));

  return (
    <div>
      <div style={S.card}>
        <p style={S.heading}>הוספת תאריך חריג</p>

        {/* Mode selector */}
        <label style={S.label}>סוג חסימה</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button style={{ ...S.subTab(mode === 'single'), flex: 1 }} onClick={() => setMode('single')}>יום בודד</button>
          <button style={{ ...S.subTab(mode === 'range'),  flex: 1 }} onClick={() => setMode('range')}>טווח תאריכים</button>
        </div>

        {mode === 'single' ? (
          <>
            <label style={S.label}>תאריך</label>
            <DateInput value={date} onChange={e => setDate(e.target.value)} style={{ width: '100%', marginBottom: 12 }} />
          </>
        ) : (
          <div style={{ display: 'flex', gap: 8, width: '100%', marginBottom: 12 }}>
            <div style={{ flex: '1 1 0', minWidth: 0 }}>
              <label style={S.label}>מתאריך</label>
              <DateInput value={date} onChange={e => setDate(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div style={{ flex: '1 1 0', minWidth: 0 }}>
              <label style={S.label}>עד תאריך</label>
              <DateInput value={dateTo} min={date || undefined} onChange={e => setDateTo(e.target.value)}
                borderColor={dateTo && dateTo < date ? '#E57373' : undefined} style={{ width: '100%' }} />
            </div>
          </div>
        )}

        <label style={{ ...S.label, marginTop: 10 }}>סיבה (לתצוגה)</label>
        <input style={S.input} placeholder="חופשה, טיפול אישי..." value={note} onChange={e => setNote(e.target.value)} />

        <label style={S.label}>סוג</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button style={{ ...S.subTab(type === 'closed'), flex: 1 }} onClick={() => setType('closed')}>סגורה לגמרי</button>
          <button style={{ ...S.subTab(type === 'partial'), flex: 1 }} onClick={() => setType('partial')}>שעות חלקיות</button>
        </div>
        {type === 'partial' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={S.label}>מ־</label><input type="time" style={S.input} value={start} onChange={e => setStart(e.target.value)} /></div>
            <div><label style={S.label}>עד</label><input type="time" style={S.input} value={end} onChange={e => setEnd(e.target.value)} /></div>
          </div>
        )}
        {/* Conflict warning — shown when existing appointments overlap */}
        <AnimatePresence>
          {conflictList.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              style={{ padding: 12, backgroundColor: 'var(--color-error-07)', border: '1px solid var(--color-error-28)', borderRadius: 'var(--radius-md)', marginBottom: 10 }}
            >
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, color: 'var(--color-accent-dark)', marginBottom: 8 }}>
                ⚠️ יש {conflictList.length} תורים בתאריכים אלה:
              </p>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                {conflictList.map((a, i) => (
                  <li key={i} style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-primary-ink)' }}>
                    {a.date} · {a.time?.slice(0, 5)} — {a.userName || a.clientName || a.phone}
                  </li>
                ))}
              </ul>
              <div style={{ display: 'flex', gap: 8 }}>
                <motion.button whileTap={{ scale: 0.97 }} onClick={doSave}
                  style={{ flex: 1, padding: '9px 0', borderRadius: 'var(--radius-sm)', border: 'none', backgroundColor: 'var(--color-accent-dark)', color: 'var(--color-surface)', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  שמרי בכל זאת
                </motion.button>
                <button onClick={() => setConflictList([])}
                  style={{ padding: '9px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-dark)', backgroundColor: 'transparent', color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)', fontSize: 13, cursor: 'pointer' }}>
                  ביטול
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button whileTap={{ scale: 0.97 }} onClick={add} disabled={checking} style={{ ...S.primaryBtn, opacity: checking ? 0.7 : 1 }}>
          <Plus size={18} />{checking ? 'בודקת...' : 'הוסיפי'}
        </motion.button>
      </div>

      {list.length > 0 ? (
        <div style={S.card}>
          <p style={S.heading}>תאריכים חריגים ({list.length})</p>
          {list.map(e => {
            const isRange = !!e.dateFrom;
            const key = e.date || e.dateFrom;
            const dateLabel = isRange ? `${e.dateFrom} — ${e.dateTo}` : e.date;
            return (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--color-border-soft)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {isRange && <span style={{ fontFamily: 'var(--font-body)', fontSize: 9, fontWeight: 700, color: 'var(--color-primary-ink)', backgroundColor: 'var(--color-brown-08)', border: '1px solid var(--color-brown-18)', borderRadius: 4, padding: '1px 5px' }}>טווח</span>}
                    <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text)', fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }} dir="ltr">{dateLabel}</p>
                  </div>
                  <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-muted)', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {e.type === 'closed' ? 'סגורה לגמרי' : `${e.start}–${e.end}`}{e.note ? ` · ${e.note}` : ''}
                  </p>
                </div>
                <button onClick={() => remove(key)} style={{ ...S.deleteBtn, flexShrink: 0 }}><Trash2 size={14} /></button>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={S.emptyState}><p style={S.emptyEmoji}>📅</p><p style={S.emptyText}>אין תאריכים חריגים</p></div>
      )}

      {/* ── Announcement on home page ────────────────────────────── */}
      {admin && (
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <p style={S.heading}>הודעה בדף הבית</p>
            <AnimatePresence mode="wait">
              {savedAnn ? (
                <motion.span key="saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ color: 'var(--color-success)', fontSize: 12, fontFamily: 'var(--font-body)' }}>✓ נשמר</motion.span>
              ) : annDirty ? (
                <motion.button key="btn" whileTap={{ scale: 0.97 }} onClick={() => saveAdmin(admin)}
                  initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 6 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 11px', borderRadius: 'var(--radius-sm)', border: 'none', backgroundColor: 'var(--color-primary)', color: 'var(--color-on-primary)', fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  שמורי 💾
                </motion.button>
              ) : null}
            </AnimatePresence>
          </div>
          <div style={S.toggleRow}>
            <span style={S.toggleLabel}>הצגי הודעה ללקוחות</span>
            <Toggle value={admin.announcement?.show || false} onChange={v => updA('show', v)} />
          </div>
          <label style={{ ...S.label, marginTop: 14 }}>טקסט ההודעה</label>
          <textarea rows={3} style={{ ...S.input, resize: 'vertical' }}
            value={admin.announcement?.text || ''}
            onChange={e => {
              setAdmin(p => ({ ...p, announcement: { ...p.announcement, text: e.target.value } }));
              setAnnDirty(true);
            }}
            placeholder="כתבי הודעה ללקוחות..." />
        </div>
      )}
    </div>
  );
}
