import { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2 } from 'lucide-react';
import { db } from '../utils/db';
import * as S from '../utils/adminStyles';

const DAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const DEFAULT_HOURS = {
  days: {
    0: { active: false, start: '09:00', end: '17:00' },
    1: { active: true,  start: '09:00', end: '17:00' },
    2: { active: true,  start: '09:00', end: '17:00' },
    3: { active: true,  start: '09:00', end: '17:00' },
    4: { active: true,  start: '09:00', end: '17:00' },
    5: { active: false, start: '09:00', end: '14:00' },
    6: { active: false, start: '09:00', end: '17:00' },
  },
  exceptions: [],
};

// ── Day row (outside main component, memoized) ──────────────────
const DayRow = memo(function DayRow({ name, day, onToggle, onChangeStart, onChangeEnd, isLast }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: isLast ? 'none' : '1px solid #F0E6D6' }}>
      <div style={{ width: 56, fontFamily: 'var(--demo-body-font)', fontSize: 14, color: 'var(--color-text)', fontWeight: 500 }}>{name}</div>
      <button
        onClick={onToggle}
        style={{ width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', position: 'relative', backgroundColor: day.active ? 'var(--color-primary)' : '#D4B896', touchAction: 'manipulation', flexShrink: 0 }}
      >
        <span style={{ position: 'absolute', top: 3, width: 16, height: 16, borderRadius: '50%', backgroundColor: '#fff', insetInlineStart: day.active ? 21 : 3, transition: 'inset-inline-start 0.2s' }} />
      </button>
      {day.active && (
        <div style={{ display: 'flex', gap: 6, flex: 1 }}>
          <input type="time" value={day.start || '09:00'} onChange={onChangeStart} style={{ ...S.input, marginBottom: 0, padding: '8px 6px', fontSize: 13 }} />
          <input type="time" value={day.end || '17:00'} onChange={onChangeEnd} style={{ ...S.input, marginBottom: 0, padding: '8px 6px', fontSize: 13 }} />
        </div>
      )}
    </div>
  );
});

// ── Exception row (outside main component, memoized) ────────────
const ExceptionRow = memo(function ExceptionRow({ exc, onRemove }) {
  const isRange = !!exc.dateFrom;
  const dateLabel = isRange ? `${exc.dateFrom} — ${exc.dateTo}` : exc.date;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #F0E6D6' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isRange && <span style={{ fontFamily: 'var(--demo-body-font)', fontSize: 9, fontWeight: 700, color: 'var(--color-primary-ink)', backgroundColor: 'rgba(92,61,46,0.08)', border: '1px solid rgba(92,61,46,0.18)', borderRadius: 4, padding: '1px 5px' }}>טווח</span>}
          <p style={{ fontFamily: 'var(--demo-body-font)', color: 'var(--color-text)', fontSize: 13, fontWeight: 500 }} dir="ltr">{dateLabel}</p>
        </div>
        <p style={{ fontFamily: 'var(--demo-body-font)', color: 'var(--color-section)', fontSize: 12 }}>
          {exc.type === 'closed' ? 'סגורה לגמרי' : `${exc.start}–${exc.end}`}{exc.note ? ` · ${exc.note}` : ''}
        </p>
      </div>
      <button onClick={onRemove} style={{ ...S.deleteBtn, flexShrink: 0 }}><Trash2 size={14} /></button>
    </div>
  );
});

export default function StaffHoursEditor({ staffId, staffName, onClose }) {
  const [hours, setHours] = useState(null);
  const [saved, setSaved] = useState(false);

  // Exception form state
  const [excMode, setExcMode] = useState('single');  // 'single' | 'range'
  const [excDate, setExcDate] = useState('');
  const [excDateTo, setExcDateTo] = useState('');
  const [excNote, setExcNote] = useState('');
  const [excType, setExcType] = useState('closed');
  const [excStart, setExcStart] = useState('10:00');
  const [excEnd, setExcEnd] = useState('14:00');

  const settingsKey = `staff_hours_${staffId}`;

  useEffect(() => {
    db.settings.get(settingsKey, DEFAULT_HOURS).then(h => {
      // Ensure structure
      const safe = {
        days: { ...DEFAULT_HOURS.days, ...(h?.days || {}) },
        exceptions: Array.isArray(h?.exceptions) ? h.exceptions : [],
      };
      setHours(safe);
    });
  }, [settingsKey]);

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1500); };

  const persist = async (next) => {
    setHours(next);
    await db.settings.set(settingsKey, next);
    flash();
  };

  const updDay = (idx, k, v) => {
    if (!hours) return;
    persist({ ...hours, days: { ...hours.days, [idx]: { ...hours.days[idx], [k]: v } } });
  };

  const addException = () => {
    if (!hours || !excDate) return;
    if (excMode === 'range' && (!excDateTo || excDateTo < excDate)) return;
    const entry = excMode === 'range'
      ? { dateFrom: excDate, dateTo: excDateTo, note: excNote, type: excType, ...(excType === 'partial' ? { start: excStart, end: excEnd } : {}) }
      : { date: excDate, note: excNote, type: excType, ...(excType === 'partial' ? { start: excStart, end: excEnd } : {}) };
    persist({ ...hours, exceptions: [...(hours.exceptions || []), entry] });
    setExcDate(''); setExcDateTo(''); setExcNote('');
  };

  const removeException = (key) => {
    if (!hours) return;
    persist({ ...hours, exceptions: (hours.exceptions || []).filter(e => (e.date || e.dateFrom) !== key) });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(45,27,30,0.55)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <motion.div
        onClick={e => e.stopPropagation()}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 280, damping: 30 }}
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: '24px 24px 0 0',
          padding: '12px 18px 36px',
          width: '100%', maxWidth: 480,
          maxHeight: '90vh', overflowY: 'auto',
          direction: 'rtl',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.08)',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <div style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: '#D4B896' }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <p style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 22, fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.1 }}>שעות וחופשות</p>
            <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 12, color: 'var(--color-section)', marginTop: 3 }}>{staffName}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <AnimatePresence>
              {saved && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ color: '#4CAF50', fontSize: 12 }}>✓ נשמר</motion.span>}
            </AnimatePresence>
            <motion.button whileTap={{ scale: 0.9 }} onClick={onClose}
              style={{ width: 34, height: 34, borderRadius: 'var(--demo-radius-card)', border: '1px solid #E8DCC8', backgroundColor: 'var(--color-surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={16} color="#7D5A47" />
            </motion.button>
          </div>
        </div>

        {!hours ? (
          <p style={{ ...S.emptyText, padding: '20px 0', textAlign: 'center' }}>טוענת...</p>
        ) : (
          <>
            {/* Weekly schedule */}
            <div style={S.card}>
              <p style={S.heading}>שעות עבודה שבועיות</p>
              {DAYS_HE.map((name, i) => (
                <DayRow
                  key={i}
                  name={name}
                  day={hours.days[i] || { active: false, start: '09:00', end: '17:00' }}
                  onToggle={() => updDay(i, 'active', !hours.days[i]?.active)}
                  onChangeStart={e => updDay(i, 'start', e.target.value)}
                  onChangeEnd={e => updDay(i, 'end', e.target.value)}
                  isLast={i === 6}
                />
              ))}
            </div>

            {/* Add exception */}
            <div style={S.card}>
              <p style={S.heading}>הוספת חופשה / חריג</p>

              <label style={S.label}>סוג חסימה</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <button style={{ ...S.subTab(excMode === 'single'), flex: 1 }} onClick={() => setExcMode('single')}>יום בודד</button>
                <button style={{ ...S.subTab(excMode === 'range'),  flex: 1 }} onClick={() => setExcMode('range')}>טווח תאריכים</button>
              </div>

              {excMode === 'single' ? (
                <>
                  <label style={S.label}>תאריך</label>
                  <input type="date" style={S.input} value={excDate} onChange={e => setExcDate(e.target.value)} />
                </>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={S.label}>מתאריך</label>
                    <input type="date" style={S.input} value={excDate} onChange={e => setExcDate(e.target.value)} />
                  </div>
                  <div>
                    <label style={S.label}>עד תאריך</label>
                    <input type="date" style={{ ...S.input, borderColor: excDateTo && excDateTo < excDate ? '#E57373' : undefined }}
                      value={excDateTo} min={excDate || undefined} onChange={e => setExcDateTo(e.target.value)} />
                  </div>
                </div>
              )}

              <label style={{ ...S.label, marginTop: 10 }}>סיבה</label>
              <input style={S.input} placeholder="חופשה, יום מחלה..." value={excNote} onChange={e => setExcNote(e.target.value)} />

              <label style={S.label}>סוג</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button style={{ ...S.subTab(excType === 'closed'), flex: 1 }} onClick={() => setExcType('closed')}>סגורה לגמרי</button>
                <button style={{ ...S.subTab(excType === 'partial'), flex: 1 }} onClick={() => setExcType('partial')}>שעות חלקיות</button>
              </div>
              {excType === 'partial' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div><label style={S.label}>מ־</label><input type="time" style={S.input} value={excStart} onChange={e => setExcStart(e.target.value)} /></div>
                  <div><label style={S.label}>עד</label><input type="time" style={S.input} value={excEnd} onChange={e => setExcEnd(e.target.value)} /></div>
                </div>
              )}
              <motion.button whileTap={{ scale: 0.97 }} onClick={addException} style={S.primaryBtn}>
                <Plus size={18} />הוסיפי
              </motion.button>
            </div>

            {/* Existing exceptions */}
            {hours.exceptions && hours.exceptions.length > 0 && (
              <div style={S.card}>
                <p style={S.heading}>חופשות וחריגים ({hours.exceptions.length})</p>
                {hours.exceptions
                  .slice()
                  .sort((a, b) => (a.date || a.dateFrom || '').localeCompare(b.date || b.dateFrom || ''))
                  .map(e => (
                    <ExceptionRow
                      key={e.date || e.dateFrom}
                      exc={e}
                      onRemove={() => removeException(e.date || e.dateFrom)}
                    />
                  ))}
              </div>
            )}
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
