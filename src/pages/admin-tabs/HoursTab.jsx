import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, Lock, Unlock, AlertTriangle, X, SlidersHorizontal, Check } from 'lucide-react';
import { db } from '../../utils/db';
import { fmtDuration } from '../../utils/format';
import { DEFAULT_WORKING_HOURS } from '../../utils/defaults';
import * as S from '../../utils/adminStyles';
import { notifyOwnerCancellation } from '../../utils/sms';

function timeToMin(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

const DAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const MONTH_HE = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יוני', 'יולי', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];

function getSunday(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}
function toDS(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function fmtRange(start) {
  const end = addDays(start, 6);
  const s = `${start.getDate()} ${MONTH_HE[start.getMonth()]}`;
  const e = `${end.getDate()} ${MONTH_HE[end.getMonth()]}`;
  return `${s} – ${e}`;
}

export default function HoursTab() {
  const [sub, setSub] = useState('hours');  // 'hours' | 'calendar'
  const [wh, setWh] = useState(null);
  const [weekStart, setWeekStart] = useState(() => getSunday(new Date()));
  const [weekDays, setWeekDays] = useState(null);
  const [showTemplate, setShowTemplate] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingLock, setSavingLock] = useState(false);
  const [conflicts, setConflicts] = useState(null);

  useEffect(() => {
    db.settings.get('workingHours', DEFAULT_WORKING_HOURS).then(setWh);
  }, []);

  const weekKey = useMemo(() => toDS(weekStart), [weekStart]);
  const isOverride = !!wh?.weeklyHours?.[weekKey];

  useEffect(() => {
    if (!wh) return;
    const source = wh.weeklyHours?.[weekKey] || wh.days || DEFAULT_WORKING_HOURS.days;
    const copy = {};
    for (let i = 0; i < 7; i++) copy[i] = { ...(source[i] || { active: false, start: '09:00', end: '17:00' }) };
    setWeekDays(copy);
  }, [wh, weekKey]);

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1800); };

  const updDay = (idx, k, v) => {
    setWeekDays(p => ({ ...p, [idx]: { ...p[idx], [k]: v } }));
  };

  const lockWeek = async () => {
    if (!wh || !weekDays) return;
    setSavingLock(true);

    // Conflict check — fetch confirmed appts for each day of the week, validate against new hours
    const dates = Array.from({ length: 7 }, (_, i) => toDS(addDays(weekStart, i)));
    const apptsArr = await Promise.all(dates.map(d => db.appointments.byDate(d)));
    const found = [];
    apptsArr.forEach((appts, i) => {
      const dayCfg = weekDays[i];
      appts.forEach(a => {
        if (a.status !== 'confirmed') return;
        const apptMin = timeToMin(a.time);
        const apptEnd = apptMin + (a.serviceDuration || 0);
        let bad = false;
        if (!dayCfg.active) bad = true;
        else if (apptMin < timeToMin(dayCfg.start) || apptEnd > timeToMin(dayCfg.end)) bad = true;
        if (bad) found.push({ ...a, dayName: DAYS_HE[i] });
      });
    });

    if (found.length > 0) {
      setConflicts(found);
      setSavingLock(false);
      return;
    }

    const next = { ...wh, weeklyHours: { ...(wh.weeklyHours || {}), [weekKey]: weekDays } };
    setWh(next);
    await db.settings.set('workingHours', next);
    setSavingLock(false);
    flash();
  };

  const unlockWeek = async () => {
    if (!wh) return;
    const map = { ...(wh.weeklyHours || {}) };
    delete map[weekKey];
    const next = { ...wh, weeklyHours: map };
    setWh(next);
    await db.settings.set('workingHours', next);
    flash();
  };

  const saveTemplate = async (next) => {
    // Conflict check: future confirmed appts on non-overridden weeks must fit new template
    const todayDS = toDS(new Date());
    const apts = await db.appointments.list();
    const overrides = next.weeklyHours || {};
    const found = [];
    apts.forEach(a => {
      if (a.status !== 'confirmed' || !a.date || a.date < todayDS) return;
      const aDate = new Date(a.date + 'T12:00:00');
      const weekKeyOf = toDS(getSunday(aDate));
      if (overrides[weekKeyOf]) return; // uses week-override, not template
      const dow = aDate.getDay();
      const dayCfg = (next.days || {})[dow] || { active: false };
      const apptMin = timeToMin(a.time);
      const apptEnd = apptMin + (a.serviceDuration || 0);
      let bad = false;
      if (!dayCfg.active) bad = true;
      else if (apptMin < timeToMin(dayCfg.start) || apptEnd > timeToMin(dayCfg.end)) bad = true;
      if (bad) found.push({ ...a, dayName: DAYS_HE[dow] });
    });
    if (found.length > 0) { setConflicts(found); return; }

    setWh(next);
    await db.settings.set('workingHours', next);
    flash();
  };

  const updGeneral = (k, v) => {
    const next = { ...wh, [k]: v };
    setWh(next);
    db.settings.set('workingHours', next);
    flash();
  };

  if (!wh || !weekDays) return <p style={{ ...S.emptyText, padding: '20px 0', textAlign: 'center' }}>טוענת...</p>;

  const isCurrentWeek = toDS(getSunday(new Date())) === weekKey;
  const isPast = weekStart < getSunday(new Date());

  return (
    <div>
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button style={S.subTab(sub === 'hours')} onClick={() => setSub('hours')}>שעות עבודה</button>
        <button style={S.subTab(sub === 'calendar')} onClick={() => setSub('calendar')}>לוח תורים</button>
      </div>

      {sub === 'calendar' && <WeekCalendar />}
      {sub === 'hours' && (
      <>
      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
          <button onClick={() => setWeekStart(addDays(weekStart, -7))} style={navBtn}><ChevronRight size={20} /></button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--color-text)', fontWeight: 600, lineHeight: 1.1 }}>{fmtRange(weekStart)}</p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
              {isCurrentWeek ? 'השבוע הנוכחי' : isPast ? 'שבוע שעבר' : 'שבוע עתידי'} · {isOverride ? '🔒 נעול' : '⚪ מתבנית'}
            </p>
          </div>
          <button onClick={() => setWeekStart(addDays(weekStart, 7))} style={navBtn}><ChevronLeft size={20} /></button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button onClick={() => setWeekStart(getSunday(new Date()))} style={{ ...S.secondaryBtn, flex: 1, padding: '8px 10px' }}>השבוע</button>
        </div>
      </div>

      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <p style={S.heading}>שעות לשבוע זה</p>
          <AnimatePresence>{saved && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ color: 'var(--color-success)', fontSize: 12 }}>✓ נשמר</motion.span>}</AnimatePresence>
        </div>
        {DAYS_HE.map((name, i) => {
          const d = weekDays[i] || { active: false, start: '09:00', end: '17:00' };
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < 6 ? '1px solid var(--color-border-soft)' : 'none' }}>
              <div style={{ width: 56, fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-text)', fontWeight: 500 }}>{name}</div>
              <button
                onClick={() => updDay(i, 'active', !d.active)}
                style={{ width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', position: 'relative', backgroundColor: d.active ? 'var(--color-primary)' : 'var(--color-border-dark)', touchAction: 'manipulation', flexShrink: 0 }}
              >
                <span style={{ position: 'absolute', top: 3, width: 16, height: 16, borderRadius: '50%', backgroundColor: 'var(--color-surface)', insetInlineStart: d.active ? 21 : 3, transition: 'inset-inline-start 0.2s' }} />
              </button>
              {d.active && (
                <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                  <input type="time" value={d.start || '09:00'} onChange={e => updDay(i, 'start', e.target.value)} style={{ ...S.input, marginBottom: 0, padding: '8px 6px', fontSize: 13 }} />
                  <input type="time" value={d.end || '17:00'} onChange={e => updDay(i, 'end', e.target.value)} style={{ ...S.input, marginBottom: 0, padding: '8px 6px', fontSize: 13 }} />
                </div>
              )}
            </div>
          );
        })}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <motion.button whileTap={{ scale: 0.97 }} onClick={lockWeek} disabled={savingLock} style={{ ...S.primaryBtn, flex: 1 }}>
            <Lock size={16} />{savingLock ? 'שומרת...' : 'נעלי שעות לשבוע זה'}
          </motion.button>
          {isOverride && (
            <motion.button whileTap={{ scale: 0.97 }} onClick={unlockWeek} style={{ ...S.secondaryBtn, padding: '14px 16px' }}>
              <Unlock size={16} />
            </motion.button>
          )}
        </div>
      </div>

      <div style={S.card}>
        <button onClick={() => setShowTemplate(s => !s)} style={{ width: '100%', background: 'transparent', border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: 0, touchAction: 'manipulation' }}>
          <p style={S.heading}>תבנית-בסיס (לשבועות לא-נעולים)</p>
          <span style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-muted)', fontSize: 18 }}>{showTemplate ? '−' : '+'}</span>
        </button>
        {showTemplate && (
          <div style={{ marginTop: 12 }}>
            <p style={S.subText}>שבועות שלא נעלת לוקחים שעות מכאן.</p>
            {DAYS_HE.map((name, i) => {
              const d = (wh.days || {})[i] || { active: false, start: '09:00', end: '17:00' };
              const updTpl = (k, v) => saveTemplate({ ...wh, days: { ...wh.days, [i]: { ...d, [k]: v } } });
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < 6 ? '1px solid var(--color-border-soft)' : 'none' }}>
                  <div style={{ width: 56, fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text)' }}>{name}</div>
                  <button onClick={() => updTpl('active', !d.active)} style={{ width: 36, height: 20, borderRadius: 'var(--demo-radius-card)', border: 'none', cursor: 'pointer', position: 'relative', backgroundColor: d.active ? 'var(--color-primary)' : 'var(--color-border-dark)', touchAction: 'manipulation', flexShrink: 0 }}>
                    <span style={{ position: 'absolute', top: 3, width: 14, height: 14, borderRadius: '50%', backgroundColor: 'var(--color-surface)', insetInlineStart: d.active ? 19 : 3 }} />
                  </button>
                  {d.active && (
                    <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                      <input type="time" value={d.start || '09:00'} onChange={e => updTpl('start', e.target.value)} style={{ ...S.input, marginBottom: 0, padding: '6px 5px', fontSize: 12 }} />
                      <input type="time" value={d.end || '17:00'} onChange={e => updTpl('end', e.target.value)} style={{ ...S.input, marginBottom: 0, padding: '6px 5px', fontSize: 12 }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {conflicts && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConflicts(null)} style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--color-overlay)', zIndex: 'var(--z-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div onClick={e => e.stopPropagation()} initial={{ scale: 0.9 }} animate={{ scale: 1 }} style={{ backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', padding: 20, maxWidth: 360, width: '100%', maxHeight: '80vh', overflowY: 'auto', direction: 'rtl' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(168,90,74,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle size={20} color="var(--color-accent)" />
                </div>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--color-text)', fontWeight: 600 }}>לא ניתן לשנות שעות</p>
              </div>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
                {conflicts.length === 1 ? 'יש תור קיים שייפגע מהשינוי:' : `יש ${conflicts.length} תורים קיימים שייפגעו מהשינוי:`}
              </p>
              {conflicts.map(c => (
                <div key={c.id} style={{ padding: '10px 12px', marginBottom: 8, backgroundColor: 'rgba(168,90,74,0.06)', borderRadius: 'var(--radius-md)' }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-text)', fontWeight: 600 }}>{c.userName}</p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-muted)', marginTop: 3 }}>
                    {c.dayName} · {c.date} {c.time} · {c.serviceName}
                  </p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-primary)', marginTop: 3, direction: 'ltr', textAlign: 'right' }}>📞 {c.phone}</p>
                </div>
              ))}
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-muted)', marginTop: 12, marginBottom: 14 }}>
                בטלי או הזיזי את התורים האלה לפני שתשני את השעות.
              </p>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => setConflicts(null)} style={S.primaryBtn}>הבנתי</motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={S.card}>
        <label style={S.label}>שבועות קדימה להזמנה</label>
        <input type="number" min="1" max="12" value={wh.weeksAhead || 4} onChange={e => updGeneral('weeksAhead', Number(e.target.value))} style={S.input} />
        <label style={S.label}>מרווח בין תורים (דק׳)</label>
        <input type="number" min="0" max="60" step="5" value={wh.gap || 0} onChange={e => updGeneral('gap', Number(e.target.value))} style={S.input} />
      </div>
      </>
      )}
    </div>
  );
}

// ── Weekly appointments calendar ─────────────────────────────────

// Google Calendar URL for a single appointment (same approach as client side)
function buildAdminCalendarUrl(apt) {
  const pad = n => String(n).padStart(2, '0');
  const d   = new Date(`${apt.date}T${apt.time}`);
  const fmt = dt => `${dt.getFullYear()}${pad(dt.getMonth()+1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
  const dur = apt.serviceDuration || 60;
  const end = new Date(d.getTime() + dur * 60000);
  const params = new URLSearchParams({
    action:  'TEMPLATE',
    text:    `${apt.serviceName} — ${apt.userName}`,
    dates:   `${fmt(d)}/${fmt(end)}`,
    details: `טלפון: ${apt.phone || ''}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// ── Now-line: anchored to appointment times, not working hours ──────
// Returns percentage (0–100) clamped to [firstAptStart, lastAptEnd], or null if not today / no apts
function getNowLineFromApts(dayApts, now, dateStr) {
  if (!dayApts.length) return null;
  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  if (dateStr !== todayStr) return null;

  const nowMin      = now.getHours() * 60 + now.getMinutes();
  const firstMin    = timeToMin(dayApts[0].time);
  const lastApt     = dayApts[dayApts.length - 1];
  const lastEndMin  = timeToMin(lastApt.time) + (lastApt.serviceDuration || 60);

  if (lastEndMin <= firstMin) return null;
  const clamped = Math.max(firstMin, Math.min(nowMin, lastEndMin));
  return ((clamped - firstMin) / (lastEndMin - firstMin)) * 100;
}

// Helper: get owner working hours for a specific date from workingHours settings
function getHoursForDate(date, wh) {
  if (!wh) return null;
  const weekKey = toDS(getSunday(date));
  const source = wh.weeklyHours?.[weekKey] || wh.days || DEFAULT_WORKING_HOURS.days;
  const dow = date.getDay();
  const cfg = source[dow];
  if (!cfg || !cfg.active) return null;
  return { start: cfg.start || '09:00', end: cfg.end || '17:00' };
}

// Helper: returns percentage (0–100) position for the now-line, or null if outside hours / not today
function getNowLinePercent(date, now, wh) {
  if (toDS(date) !== toDS(now)) return null;
  const h = getHoursForDate(date, wh);
  if (!h) return null;
  const startMin = timeToMin(h.start);
  const endMin   = timeToMin(h.end);
  if (startMin >= endMin) return null;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (nowMin < startMin || nowMin > endMin) return null;
  return ((nowMin - startMin) / (endMin - startMin)) * 100;
}

function WeekCalendar() {
  const [weekStart, setWeekStart]         = useState(() => getSunday(new Date()));
  const [aptsByDay, setAptsByDay]         = useState({});
  const [services, setServices]           = useState([]);
  const [filter, setFilter]               = useState('');
  const [payments, setPayments]           = useState({});
  const [pendingPays, setPendingPays]     = useState({});
  const [confirmations, setConfirmations] = useState({});
  const [showLegend, setShowLegend]       = useState(false);
  const [loading, setLoading]             = useState(false);
  // ── now-line ────────────────────────────────────────────────────
  const [now, setNow]                     = useState(() => new Date());
  const [calWh, setCalWh]                 = useState(null);
  // ── cancel confirm ──────────────────────────────────────────────
  const [cancelConfirm, setCancelConfirm] = useState(null);
  const [busyCancel, setBusyCancel]       = useState(false);
  // ── calendar export modal ────────────────────────────────────────
  const [calendarModal, setCalendarModal] = useState(null); // { ds, apts } | null
  // ── exclude-from-stats modal — אדמין מסמנת תורים שלא ייכנסו לדוחות ──
  const [excludeModal, setExcludeModal] = useState(null);   // { ds, apts } | null
  const [excludedFromStats, setExcludedFromStats] = useState({}); // { aptId: true }

  useEffect(() => {
    db.services.list().then(setServices);
    db.settings.get('appointmentPayments', {}).then(p => setPayments(p || {}));
    db.settings.get('pendingPayments', {}).then(p => setPendingPays(p || {}));
    db.settings.get('appointmentConfirmations', {}).then(c => setConfirmations(c || {}));
    db.settings.get('workingHours', DEFAULT_WORKING_HOURS).then(setCalWh);
    db.settings.get('excludedFromStats', {}).then(m => setExcludedFromStats(m && typeof m === 'object' ? m : {}));
  }, []);

  // Toggle exclude-from-stats for a single appointment — persists immediately to DB
  const toggleExclude = async (aptId) => {
    const next = { ...excludedFromStats };
    if (next[aptId]) delete next[aptId];
    else            next[aptId] = true;
    setExcludedFromStats(next);          // optimistic UI
    try { navigator.vibrate?.(15); } catch {}
    await db.settings.set('excludedFromStats', next);
  };

  // Real-time clock — tick every minute
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Load all 7 days when weekStart changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const dates = Array.from({ length: 7 }, (_, i) => toDS(addDays(weekStart, i)));
    Promise.all(dates.map(d => db.appointments.byDate(d).then(arr => ({ d, arr })))).then(results => {
      if (cancelled) return;
      const map = {};
      results.forEach(({ d, arr }) => { map[d] = arr; });
      setAptsByDay(map);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [weekStart]);

  const cyclePayment = async (aptId) => {
    const order = ['cash', 'bit', null];
    const cur = payments[aptId] || null;
    const idx = order.indexOf(cur);
    const next = order[(idx + 1) % order.length];
    const map = { ...payments };
    if (next == null) delete map[aptId];
    else map[aptId] = next;
    setPayments(map);
    await db.settings.set('appointmentPayments', map);
  };

  const payColor = (aptId) => {
    const m = payments[aptId];
    if (m === 'bit')                   return { bg: 'rgba(76,175,80,0.14)', dot: 'var(--color-success)', label: 'ביט ✓' };
    if (m === 'cash')                  return { bg: 'rgba(230,158,44,0.14)', dot: '#E69E2C', label: 'מזומן ✓' };
    if (pendingPays[aptId])            return { bg: 'rgba(230,158,44,0.10)', dot: '#E69E2C', label: '⏳ ממתין לאישור' };
    if (confirmations[aptId])          return { bg: 'rgba(124,92,191,0.12)', dot: '#7C5CBF', label: '✓ אישרה הגעה' };
    return                               { bg: 'var(--color-brown-10)', dot: 'var(--color-text-hint)', label: 'לא שולם' };
  };

  const todayStr = toDS(new Date());

  // ── Cancel handler ───────────────────────────────────────────────
  const handleAdminCancel = async (apt) => {
    if (busyCancel) return;
    setBusyCancel(true);
    try {
      await db.appointments.cancel(apt.id);
      setAptsByDay(prev => {
        const next = { ...prev };
        if (next[apt.date]) next[apt.date] = next[apt.date].filter(a => a.id !== apt.id);
        return next;
      });
      notifyOwnerCancellation({
        clientName:  apt.userName  || '',
        clientPhone: apt.phone     || '',
        service:     apt.serviceName || '',
        date:        apt.date      || '',
        time:        (apt.time || '').slice(0, 5),
      }).catch(() => {});
    } finally {
      setBusyCancel(false);
      setCancelConfirm(null);
    }
  };

  return (
    <div>
      {/* Week nav */}
      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <button onClick={() => setWeekStart(addDays(weekStart, -7))} style={navBtn}><ChevronRight size={20} /></button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--color-text)', fontWeight: 600, lineHeight: 1.1 }}>{fmtRange(weekStart)}</p>
          </div>
          <button onClick={() => setWeekStart(addDays(weekStart, 7))} style={navBtn}><ChevronLeft size={20} /></button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button onClick={() => setWeekStart(getSunday(new Date()))} style={{ ...S.secondaryBtn, flex: 1, padding: '8px 10px' }}>השבוע</button>
          <button onClick={() => setShowLegend(s => !s)} style={{ ...S.secondaryBtn, width: 40, padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="מקרא צבעים">
            <AlertTriangle size={14} />
          </button>
        </div>
        <AnimatePresence>
          {showLegend && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              style={{ overflow: 'hidden', marginTop: 10 }}>
              <div style={{ padding: 10, backgroundColor: 'var(--color-brown-07)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-primary)', lineHeight: 1.8 }}>
                <p><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', backgroundColor: 'var(--color-success)', marginInlineEnd: 6 }} />ירוק ✓ — שולם ואושר</p>
                <p><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', backgroundColor: '#E69E2C', marginInlineEnd: 6 }} />כתום ⏳ — ממתין לאישור / מזומן</p>
                <p><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', backgroundColor: '#7C5CBF', marginInlineEnd: 6 }} />סגול — אישרה הגעה</p>
                <p><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', backgroundColor: 'var(--color-text-hint)', marginInlineEnd: 6 }} />אפור — לא שולם</p>
                <p style={{ marginTop: 6, fontSize: 10, color: 'var(--color-text-muted)' }}>לחצי על העיגול לשינוי סטטוס ידני</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Service filter */}
      {services.length > 0 && (
        <div style={{ ...S.card, padding: '10px 12px' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => setFilter('')}
              style={{ padding: '5px 10px', borderRadius: 'var(--demo-radius-card)', border: filter === '' ? 'none' : '1px solid var(--color-border)', backgroundColor: filter === '' ? 'var(--color-primary)' : 'var(--color-surface)', color: filter === '' ? 'var(--color-surface)' : 'var(--color-text-muted)', fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              הכל
            </button>
            {services.map(s => (
              <button key={s.id} onClick={() => setFilter(s.id)}
                style={{ padding: '5px 10px', borderRadius: 'var(--demo-radius-card)', border: filter === s.id ? 'none' : '1px solid var(--color-border)', backgroundColor: filter === s.id ? 'var(--color-primary)' : 'var(--color-surface)', color: filter === s.id ? 'var(--color-surface)' : 'var(--color-text-muted)', fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ ...S.emptyText, padding: '20px 0', textAlign: 'center' }}>טוענת...</p>
      ) : (
        Array.from({ length: 7 }, (_, i) => {
          const date   = addDays(weekStart, i);
          const ds     = toDS(date);
          const allDayApts = (aptsByDay[ds] || [])
            .filter(a => a.status === 'confirmed')
            .sort((x, y) => (x.time || '').localeCompare(y.time || ''));
          const dayApts = allDayApts.filter(a => !filter || a.serviceId === filter);
          const isToday   = ds === todayStr;
          const nowPct    = getNowLineFromApts(dayApts, now, ds);
          const nowLabel  = `עכשיו ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

          return (
            <div key={ds} style={{ ...S.card, padding: '12px 14px', border: isToday ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: isToday ? 'var(--color-primary)' : 'var(--color-text)' }}>
                  {DAYS_HE[i]} · {date.getDate()}/{date.getMonth() + 1}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {/* כפתור אפשרויות: רשימת תורים של היום עם checkbox "לא להחשיב בדוחות" */}
                  {allDayApts.length > 0 && (
                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      onClick={() => setExcludeModal({ ds, apts: allDayApts })}
                      title="אפשרויות יום — סימון תורים שלא ייכנסו לדוחות"
                      style={{
                        width: 26, height: 26, borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-surface)',
                        color: 'var(--color-text-muted)',
                        cursor: 'pointer', touchAction: 'manipulation',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                      }}>
                      <SlidersHorizontal size={12} />
                    </motion.button>
                  )}
                  {allDayApts.length > 0 && (
                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      onClick={() => setCalendarModal({ ds, apts: allDayApts })}
                      title={`הוספת ${allDayApts.length} תורים ליומן Google`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '3px 8px', borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-surface)',
                        color: 'var(--color-primary)',
                        fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 600,
                        cursor: 'pointer', touchAction: 'manipulation',
                      }}>
                      📅 יומן
                    </motion.button>
                  )}
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-muted)' }}>{dayApts.length} תורים</span>
                </div>
              </div>

              {dayApts.length === 0 ? (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-hint)' }}>—</p>
              ) : (
                <div style={{ position: 'relative' }}>
                  {/* ── Now line ── */}
                  {nowPct !== null && (
                    <div style={{
                      position: 'absolute',
                      top: `${nowPct}%`,
                      insetInlineStart: 0,
                      insetInlineEnd: 0,
                      zIndex: 2,
                      pointerEvents: 'none',
                    }}>
                      <div style={{
                        borderTop: '1.5px dashed var(--color-accent)',
                        width: '100%',
                        position: 'relative',
                      }}>
                        <span style={{
                          position: 'absolute',
                          top: -9,
                          insetInlineEnd: 0,
                          fontFamily: 'var(--font-body)',
                          fontSize: 9,
                          color: 'var(--color-accent)',
                          backgroundColor: 'var(--color-surface)',
                          paddingInline: 3,
                          lineHeight: '18px',
                          borderRadius: 4,
                        }}>{nowLabel}</span>
                      </div>
                    </div>
                  )}

                  {/* ── Appointment rows ── */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {dayApts.map(a => {
                      const pay      = payColor(a.id);
                      const aptDT    = new Date(`${a.date}T${a.time || '00:00'}`);
                      const isFuture = aptDT > now;
                      return (
                        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', backgroundColor: pay.bg, borderRadius: 'var(--radius-sm)' }}>
                          <button onClick={() => cyclePayment(a.id)}
                            title={pay.label}
                            style={{ width: 12, height: 12, borderRadius: '50%', border: 'none', backgroundColor: pay.dot, cursor: 'pointer', padding: 0, flexShrink: 0 }} />
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, color: 'var(--color-text)', minWidth: 42 }}>{(a.time || '').slice(0, 5)}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.serviceName}</p>
                            <p style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--color-text-muted)' }}>{a.userName}</p>
                          </div>
                          <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--color-primary)' }}>₪{a.price}</span>
                          {/* Cancel button — only future appointments */}
                          {isFuture && (
                            <motion.button
                              whileTap={{ scale: 0.9 }}
                              onClick={() => setCancelConfirm(a)}
                              title="ביטול תור"
                              style={{ width: 22, height: 22, borderRadius: 'var(--radius-xs)', border: '1px solid rgba(168,90,74,0.3)', backgroundColor: 'rgba(168,90,74,0.08)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0 }}>
                              <X size={12} color="var(--color-accent)" />
                            </motion.button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}

      {/* ── Calendar export modal ── */}
      <AnimatePresence>
        {calendarModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setCalendarModal(null)}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--color-overlay)', zIndex: 'var(--z-overlay)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <motion.div
              onClick={e => e.stopPropagation()}
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              style={{ backgroundColor: 'var(--color-surface)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, maxHeight: '80vh', overflowY: 'auto', paddingBottom: 32, direction: 'rtl' }}>

              {/* Handle */}
              <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'var(--color-border-dark)' }} />
              </div>

              {/* Header */}
              <div style={{ padding: '8px 20px 14px', borderBottom: '1px solid var(--color-border)' }}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--color-text)' }}>
                  📅 הוספת תורים ליומן Google
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-muted)', marginTop: 3 }}>
                  {calendarModal.ds} · {calendarModal.apts.length} תורים — לחצי על כל תור להוספה
                </p>
              </div>

              {/* Appointment list */}
              <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {calendarModal.apts.map(a => {
                  const pay = payColor(a.id);
                  return (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', backgroundColor: pay.bg, borderRadius: 'var(--radius-md)' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: pay.dot, flexShrink: 0 }} title={pay.label} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
                        {(a.time || '').slice(0, 5)} · {a.serviceName} | {fmtDuration(a.serviceDuration)} | ₪{a.price}
                      </p>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                        {a.userName} · {pay.label}
                      </p>
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => window.open(buildAdminCalendarUrl(a), '_blank', 'noopener')}
                      style={{
                        flexShrink: 0,
                        padding: '6px 12px', borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-surface)',
                        color: 'var(--color-primary)',
                        fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600,
                        cursor: 'pointer', touchAction: 'manipulation',
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                      📅 הוסף
                    </motion.button>
                  </div>
                );})}
              </div>

              {/* Close */}
              <div style={{ padding: '4px 20px 0' }}>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setCalendarModal(null)}
                  style={{ width: '100%', height: 40, borderRadius: 'var(--radius-md)', border: 'none', backgroundColor: 'var(--color-brown-08)', color: 'var(--color-primary)', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  סגירה
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Cancel confirmation modal ── */}
      <AnimatePresence>
        {cancelConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => { if (!busyCancel) setCancelConfirm(null); }}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--color-overlay)', zIndex: 'var(--z-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div
              onClick={e => e.stopPropagation()}
              initial={{ scale: 0.9 }} animate={{ scale: 1 }}
              style={{ backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', padding: 20, maxWidth: 340, width: '100%', direction: 'rtl' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(168,90,74,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <X size={18} color="var(--color-accent)" />
                </div>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--color-text)', fontWeight: 600 }}>ביטול תור</p>
              </div>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-text)', marginBottom: 6 }}>
                לבטל את התור של <strong>{cancelConfirm.userName}</strong>?
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 18 }}>
                {cancelConfirm.date} · {(cancelConfirm.time || '').slice(0, 5)} · {cancelConfirm.serviceName}
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  disabled={busyCancel}
                  onClick={() => handleAdminCancel(cancelConfirm)}
                  style={{ ...S.primaryBtn, flex: 1, backgroundColor: 'var(--color-accent)', opacity: busyCancel ? 0.6 : 1 }}>
                  {busyCancel ? 'מבטלת...' : 'כן, בטלי'}
                </motion.button>
                <button
                  disabled={busyCancel}
                  onClick={() => setCancelConfirm(null)}
                  style={{ ...S.secondaryBtn, flex: 1 }}>
                  חזרה
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Exclude-from-stats modal — אדמין מסמנת תורים שלא ייכנסו לדוחות ── */}
      <AnimatePresence>
        {excludeModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setExcludeModal(null)}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--color-overlay)', zIndex: 'var(--z-overlay)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <motion.div
              onClick={e => e.stopPropagation()}
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              style={{ backgroundColor: 'var(--color-surface)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, maxHeight: '80vh', overflowY: 'auto', paddingBottom: 32, direction: 'rtl' }}>

              {/* Handle */}
              <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'var(--color-border-dark)' }} />
              </div>

              {/* Header */}
              <div style={{ padding: '8px 20px 14px', borderBottom: '1px solid var(--color-border)' }}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--color-text)' }}>
                  ⚙️ אפשרויות יום
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-muted)', marginTop: 3 }}>
                  {excludeModal.ds} · סמני תורים שלא ייכנסו לדוחות ולסטטיסטיקה
                </p>
              </div>

              {/* Appointment list with exclude checkbox */}
              <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {excludeModal.apts.map(a => {
                  const isExcluded = !!excludedFromStats[a.id];
                  return (
                    <div key={a.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px',
                      backgroundColor: isExcluded ? 'rgba(168,90,74,0.08)' : 'var(--color-brown-07)',
                      borderRadius: 'var(--radius-md)',
                      border: isExcluded ? '1px solid rgba(168,90,74,0.30)' : '1px solid transparent',
                      transition: 'background-color 0.2s, border-color 0.2s',
                    }}>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, color: 'var(--color-text)', minWidth: 42 }}>
                        {(a.time || '').slice(0, 5)}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: isExcluded ? 'line-through' : 'none' }}>
                          {a.serviceName}
                        </p>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-muted)' }}>
                          {a.userName} · ₪{a.price}
                        </p>
                      </div>
                      {/* Checkbox toggle */}
                      <motion.button
                        whileTap={{ scale: 0.92 }}
                        onClick={() => toggleExclude(a.id)}
                        title={isExcluded ? 'לחצי כדי להחזיר לדוחות' : 'לחצי כדי להוציא מדוחות'}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '7px 11px', borderRadius: 'var(--radius-sm)',
                          border: '1px solid ' + (isExcluded ? 'rgba(168,90,74,0.45)' : 'var(--color-border)'),
                          backgroundColor: isExcluded ? 'rgba(168,90,74,0.14)' : 'var(--color-surface)',
                          color: isExcluded ? 'var(--color-accent)' : 'var(--color-text-muted)',
                          fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600,
                          cursor: 'pointer', touchAction: 'manipulation', flexShrink: 0,
                        }}>
                        <div style={{
                          width: 14, height: 14, borderRadius: 3,
                          border: '1.5px solid ' + (isExcluded ? 'var(--color-accent)' : 'var(--color-border-dark)'),
                          backgroundColor: isExcluded ? 'var(--color-accent)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          transition: 'all 0.15s',
                        }}>
                          {isExcluded && <Check size={10} color="var(--color-surface)" strokeWidth={3} />}
                        </div>
                        לא להחשיב
                      </motion.button>
                    </div>
                  );
                })}
              </div>

              {/* Footer hint + close */}
              <div style={{ padding: '4px 20px 0' }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--color-text-muted)', textAlign: 'center', marginBottom: 10, lineHeight: 1.6 }}>
                  השינוי נשמר מיד. תורים מסומנים לא ייחשבו בהכנסות, ספירה, ולקוחות חוזרות בדוחות.
                </p>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setExcludeModal(null)}
                  style={{ width: '100%', height: 40, borderRadius: 'var(--radius-md)', border: 'none', backgroundColor: 'var(--color-brown-08)', color: 'var(--color-primary)', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  סגירה
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

const navBtn = {
  width: 40, height: 40, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
  backgroundColor: 'var(--color-surface)', color: 'var(--color-primary)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  touchAction: 'manipulation', flexShrink: 0,
};
