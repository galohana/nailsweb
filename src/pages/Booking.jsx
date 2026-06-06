import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../utils/db';
import { fmtDuration } from '../utils/format';
import { notifyOwnerNewAppointment, notifyOwnerPendingAppointment, notifyOwnerCancellation, notifyOwnerNewClient, notifyClientWelcome, notifyOwnerWaitlistJoin, notifyOwnerWaitlistFilled, notifyOwnerAppointmentPaid } from '../utils/sms';
import PageHeader from '../components/PageHeader';
import PayButtons from '../components/PayButtons';
import PaymentConfirmModal from '../components/PaymentConfirmModal';
import { features } from '../config/features';

const FEAT_WAITLIST = import.meta.env.VITE_FEATURE_WAITLIST !== 'false';

const DAY_NAMES = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
const MONTH_HE  = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const COL_HE    = ['א','ב','ג','ד','ה','ו','ש'];
const SHADOW    = 'var(--demo-shadow-card)';

const C = {
  bg:      'var(--color-bg)',
  surface: 'var(--color-surface)',
  accent:  '#6B4F3A',
  text:    'var(--color-text)',
  muted:   '#8B6E52',
  border:  '#D4B896',
};

const S = {
  card:       { backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 'var(--demo-radius-card)', boxShadow: '0 4px 20px rgba(107,79,58,0.08)' },
  cardActive: { backgroundColor: C.surface, border: `2px solid ${C.accent}`, borderRadius: 'var(--demo-radius-card)', boxShadow: `0 0 0 4px rgba(107,79,58,0.10)` },
  input:      { backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 'var(--demo-radius-card)', color: C.text, padding: '11px 14px', fontSize: 14, width: '100%', outline: 'none', fontFamily: 'var(--demo-body-font)' },
  btn:        { backgroundColor: C.accent, backgroundImage: 'var(--demo-primary-mat-surface)', backgroundRepeat: 'repeat', color: 'var(--color-surface)', borderRadius: 'var(--demo-radius-card)', height: 50, fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', boxShadow: SHADOW, fontFamily: 'var(--demo-body-font)' },
};

function vibrate(pattern) { try { navigator.vibrate?.(pattern); } catch {} }

function genSlots(start, end, dur, gap = 0) {
  const slots = [];
  const toM = t => { const [h,m] = t.split(':').map(Number); return h*60+m; };
  let c = toM(start); const f = toM(end);
  while (c + dur <= f) {
    slots.push(`${String(Math.floor(c/60)).padStart(2,'0')}:${String(c%60).padStart(2,'0')}`);
    c += dur + gap;
  }
  return slots;
}

function toDS(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function fmtDateShort(d) {
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()}/${d.getMonth()+1}`;
}

function fmtDateLong(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
}

function buildCalendarUrl(apt, clinicName) {
  const pad = n => String(n).padStart(2, '0');
  const d   = new Date(`${apt.date}T${apt.time}`);
  const fmt = dt => `${dt.getFullYear()}${pad(dt.getMonth()+1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
  const end = new Date(d.getTime() + (apt.serviceDuration || 60) * 60000);
  const params = new URLSearchParams({
    action:  'TEMPLATE',
    text:    `${apt.serviceName}${clinicName ? ` — ${clinicName}` : ''}`,
    dates:   `${fmt(d)}/${fmt(end)}`,
    details: clinicName ? `תור ב${clinicName}` : 'תור',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

const SERVICE_IMGS = [
  'https://images.unsplash.com/photo-1487412912498-0447578fcca8?w=400&q=80',
  'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&q=80',
  'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=400&q=80',
  'https://images.unsplash.com/photo-1583001931096-959e9a1a6223?w=400&q=80',
];

function SuccessCheck() {
  return (
    <motion.div
      initial={{ scale: 0.3, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 14 }}
      style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}
    >
      <svg viewBox="0 0 56 56" width="90" height="90">
        <motion.circle cx="28" cy="28" r="26" fill="none" stroke={C.accent} strokeWidth="2" strokeDasharray="163"
          initial={{ strokeDashoffset: 163 }} animate={{ strokeDashoffset: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }} />
        <motion.path d="M17 28l8 8 14-14" fill="none" stroke={C.accent} strokeWidth="3"
          strokeLinecap="round" strokeLinejoin="round" strokeDasharray="34"
          initial={{ strokeDashoffset: 34 }} animate={{ strokeDashoffset: 0 }}
          transition={{ duration: 0.4, delay: 0.45, ease: 'easeOut' }} />
      </svg>
    </motion.div>
  );
}

export default function Booking({ user, onUserSave, onNavigate, onMenuOpen }) {
  const [step, setStep]               = useState(user ? 1 : 0);
  const [login, setLogin]             = useState({ name: '', phone: '' });
  const [service, setService]         = useState(null);
  const [date, setDate]               = useState(null);
  const [time, setTime]               = useState(null);
  const [staffId, setStaffId]         = useState(null);
  const [services, setServices]       = useState([]);
  const [wh, setWh]                   = useState(null);
  const [apts, setApts]               = useState([]);
  const [staff, setStaff]             = useState([]);
  const [confirmed, setConfirmed]     = useState(null);
  const [error, setError]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [waitlistDone, setWaitlistDone] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [monthStart, setMonthStart]   = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d;
  });
  const [userAptDates, setUserAptDates] = useState(new Set());
  const [ownerPhone, setOwnerPhone]       = useState('');
  const [bitAccount, setBitAccount]       = useState('');
  const [payConfirm, setPayConfirm]       = useState(null);  // { method } | null
  const [paidMethod, setPaidMethod]       = useState(null);  // 'bit' | null
  const [payOpen, setPayOpen]             = useState(false);
  const [aptConfirmed, setAptConfirmed]   = useState(false);
  const [payVisible, setPayVisible]       = useState({ bit: true });
  const [paySettingsLoaded, setPaySettingsLoaded] = useState(false);
  const [showStaffPicker, setShowStaffPicker] = useState(false);
  const [pendingService, setPendingService]   = useState(null);
  const [selectedAddons, setSelectedAddons]   = useState([]);   // [{id,name,price,duration}]
  const [showAddonPicker, setShowAddonPicker] = useState(false);
  const [pendingBaseService, setPendingBaseService] = useState(null);
  const [owner, setOwner]                     = useState({ id: null, name: 'בעלת העסק', imageUrl: '', mediaType: 'image' });
  const [staffHours, setStaffHours]           = useState({});  // { staffId: hoursObject }
  const [postTimePicker, setPostTimePicker]   = useState(null);  // { time, candidates: [{id, name, imageUrl}] }
  const [isPending, setIsPending]             = useState(false);
  const [approval, setApproval]               = useState({ autoApprove: true, manualWithinHours: 0 });

  useEffect(() => {
    db.services.list().then(setServices);
    db.settings.get('workingHours').then(setWh);
    db.settings.get('clinicInfo').then(ci => {
      const p = ci?.ownerPhone || ci?.ownerWhatsapp || ci?.phone || ci?.whatsapp || '';
      setOwnerPhone(String(p).replace(/\D/g, ''));
      if (ci?.ownerName) setOwner(prev => ({ ...prev, name: ci.ownerName }));
    });
    db.settings.get('about').then(a => {
      setOwner(prev => ({
        ...prev,
        imageUrl: a?.imageUrl || '',
        mediaType: a?.mediaType || 'image',
      }));
    });
    Promise.all([
      // string חופשי — יכול להיות טלפון או URL. PayButtons מזהה ומטפל.
      db.settings.get('bitAccount', '').then(v => setBitAccount(String(v || '').trim())),
      db.settings.get('paymentVisibility', { bit: true }).then(pv => setPayVisible({ bit: pv?.bit !== false })),
    ]).then(() => setPaySettingsLoaded(true)).catch(() => setPaySettingsLoaded(true));
    if (features.staff) db.staff.list().then(setStaff);
    db.settings.get('approvalSettings', { autoApprove: true, manualWithinHours: 0 })
      .then(a => { if (a && typeof a === 'object') setApproval(a); }).catch(() => {});
  }, []);

  // Load per-staff hours
  useEffect(() => {
    if (!features.staff || !staff.length) return;
    Promise.all(staff.map(s =>
      db.settings.get(`staff_hours_${s.id}`, null).then(h => [s.id, h])
    )).then(pairs => {
      const map = {};
      pairs.forEach(([id, h]) => { if (h) map[id] = h; });
      setStaffHours(map);
    });
  }, [staff]);

  useEffect(() => { if (user) setStep(1); }, [user]);

  useEffect(() => {
    if (date) {
      db.settings.get('workingHours').then(setWh);
      // Load ALL apts for the date — filter per staff in helpers
      db.appointments.byDate(toDS(date)).then(setApts);
    }
  }, [date]);

  // Load all of this user's appointment dates (past + future) for calendar dots
  useEffect(() => {
    if (!user?.phone) return;
    db.appointments.byPhone(user.phone)
      .then(apts => setUserAptDates(new Set(apts.map(a => a.date))))
      .catch(() => {});
  }, [user?.phone]);

  // ── Derived: total duration and price including selected addons ──
  const effectiveDuration = (service?.duration || 0) + selectedAddons.reduce((s, a) => s + (a.duration || 0), 0);
  const effectivePrice    = (service?.price    || 0) + selectedAddons.reduce((s, a) => s + (a.price    || 0), 0);
  const baseServices      = services.filter(s => !s.parentId);
  const addonsOf          = (parentId) => services.filter(s => s.parentId === parentId);

  const isVacationDay = (d) => {
    if (!wh) return false;
    const dateStr = toDS(d);
    const exc = (wh.exceptions || []).find(e =>
      e.date ? e.date === dateStr :
      (e.dateFrom && e.dateTo) ? (dateStr >= e.dateFrom && dateStr <= e.dateTo) : false
    );
    return !!(exc && exc.type === 'closed');
  };

  // Hours config for owner (uses global workingHours)
  const getOwnerHoursForDate = (d) => {
    if (!wh) return null;
    const sunday = new Date(d); sunday.setDate(d.getDate() - d.getDay()); sunday.setHours(0,0,0,0);
    const weekKey = toDS(sunday);
    const dayIdx  = d.getDay();
    if (wh.weeklyHours?.[weekKey]?.[dayIdx] !== undefined) return wh.weeklyHours[weekKey][dayIdx];
    const dateStr = toDS(d);
    const exc = (wh.exceptions || []).find(e =>
      e.date ? e.date === dateStr :
      (e.dateFrom && e.dateTo) ? (dateStr >= e.dateFrom && dateStr <= e.dateTo) : false
    );
    if (exc) return exc.type === 'closed' ? { active: false } : { active: true, start: exc.start, end: exc.end };
    return wh.days?.[dayIdx] || {};
  };

  // Hours config per-staff. sid === null → owner. Specific id → staff (fallback to owner hours if none set)
  const getHoursForStaffDate = (d, sid) => {
    if (sid === null || sid === undefined) return getOwnerHoursForDate(d);
    const h = staffHours[sid];
    if (!h) return getOwnerHoursForDate(d);  // fallback: no per-staff hours
    const dateStr = toDS(d);
    const exc = (h.exceptions || []).find(e =>
      e.date ? e.date === dateStr :
      (e.dateFrom && e.dateTo) ? (dateStr >= e.dateFrom && dateStr <= e.dateTo) : false
    );
    if (exc) return exc.type === 'closed' ? { active: false } : { active: true, start: exc.start, end: exc.end };
    return h.days?.[d.getDay()] || {};
  };

  // Kept for backward compat (existing isVacationDay legend, etc.) — uses owner's hours
  const getHoursForDate = (d) => getOwnerHoursForDate(d);

  const toMin = (t) => { const [h,m] = t.split(':').map(Number); return h*60+m; };

  // Is this staff free at slot? (no overlapping apt) — assumes slot is already within their hours
  const isStaffFreeAtSlot = (sid, slot) => {
    if (!service) return false;
    const sStart = toMin(slot); const sEnd = sStart + effectiveDuration;
    const targetSid = sid === null ? null : sid;
    return !apts.some(b => {
      if ((b.staffId || null) !== targetSid) return false;
      const bStart = toMin(b.time);
      const bDur = (b.serviceDuration || services.find(s => s.id === b.serviceId)?.duration || 30) + (wh?.gap || 0);
      return sStart < bStart + bDur && sEnd > bStart;
    });
  };

  // Is staff available at slot? In their hours AND not occupied
  const isStaffAvailableAtSlot = (sid, slot) => {
    if (!date) return false;
    const cfg = getHoursForStaffDate(date, sid);
    if (!cfg?.active) return false;
    const sStart = toMin(slot); const sEnd = sStart + effectiveDuration;
    if (sStart < toMin(cfg.start) || sEnd > toMin(cfg.end)) return false;
    return isStaffFreeAtSlot(sid, slot);
  };

  // Candidate list for "any" mode: owner + all staff
  const anyCandidates = () => [
    { id: null, name: owner.name, imageUrl: owner.imageUrl, mediaType: owner.mediaType },
    ...staff,
  ];

  // Which candidates are available for a given slot
  const availableStaffForSlot = (slot) => anyCandidates().filter(c => isStaffAvailableAtSlot(c.id, slot));

  const allSlots = () => {
    if (!date || !wh || !service) return [];
    if (staffId === 'any') {
      // Union of active-hour slots from all candidates
      const allTimes = new Set();
      anyCandidates().forEach(c => {
        const cfg = getHoursForStaffDate(date, c.id);
        if (!cfg?.active) return;
        genSlots(cfg.start, cfg.end, effectiveDuration, wh.gap || 0).forEach(s => allTimes.add(s));
      });
      return [...allTimes].sort();
    }
    const cfg = getHoursForStaffDate(date, staffId);
    if (!cfg?.active) return [];
    return genSlots(cfg.start, cfg.end, effectiveDuration, wh.gap || 0);
  };

  const isOccupied = (slot) => {
    // Block past time-slots when booking for today
    if (date && toDS(date) === toDS(new Date())) {
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const [h, m] = slot.split(':').map(Number);
      if (h * 60 + m <= nowMin) return true;
    }
    if (staffId === 'any') return availableStaffForSlot(slot).length === 0;
    return !isStaffAvailableAtSlot(staffId, slot);
  };

  const freeSlots = () => {
    const now = new Date();
    const todayStr = toDS(now);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    return allSlots().filter(s => {
      if (isOccupied(s)) return false;
      if (date && toDS(date) === todayStr) {
        const [h, m] = s.split(':').map(Number);
        if (h * 60 + m <= nowMin) return false;
      }
      return true;
    });
  };
  const isFull    = () => date && allSlots().length > 0 && freeSlots().length === 0;

  const doLogin = async () => {
    if (!login.name.trim() || !login.phone.trim()) { setError('נא למלאי שם ומספר טלפון'); return; }
    setLoading(true);
    const [blocked, prevApts] = await Promise.all([
      db.clients.isBlocked(login.phone.trim()),
      db.appointments.byPhone(login.phone.trim()),
    ]);
    setLoading(false);
    if (blocked) { setError('מספר זה חסום.'); return; }
    if (prevApts.length === 0) {
      notifyOwnerNewClient({ clientName: login.name.trim(), clientPhone: login.phone.trim() });
      notifyClientWelcome({ clientName: login.name.trim(), clientPhone: login.phone.trim() });
    }
    onUserSave({ name: login.name.trim(), firstName: login.name.trim(), phone: login.phone.trim() });
    setStep(1); setError('');
  };

  const doBook = async () => {
    if (!service || !date || !time) return;
    setLoading(true);
    // Approval logic
    let aptStatus = 'confirmed';
    if (!approval.autoApprove) {
      const within = Number(approval.manualWithinHours) || 0;
      if (within > 0) {
        const hoursUntil = (new Date(`${toDS(date)}T${time}`) - new Date()) / 3600000;
        aptStatus = hoursUntil < within ? 'pending' : 'confirmed';
      } else {
        aptStatus = 'pending';
      }
    }
    const fullName = service.name + (selectedAddons.length ? ' + ' + selectedAddons.map(a => a.name).join(' + ') : '');
    const apt = await db.appointments.create({
      phone: user.phone, userName: user.name || user.firstName,
      serviceId: service.id, serviceName: fullName,
      serviceDuration: effectiveDuration,
      date: toDS(date), time, price: effectivePrice, staffId,
      addons: selectedAddons,
      status: aptStatus,
    });
    setLoading(false);
    if (apt) {
      setIsPending(aptStatus === 'pending');
      vibrate([30, 20, 30]);
      setConfirmed(apt);
      setStep(4);
      if (aptStatus === 'pending') {
        notifyOwnerPendingAppointment({ clientName: user.name || user.firstName, clientPhone: user.phone, service: service.name, date: toDS(date), time, aptId: apt.id });
      } else {
        notifyOwnerNewAppointment({ clientName: user.name || user.firstName, clientPhone: user.phone, service: service.name, date: toDS(date), time, aptId: apt.id });
      }
      // If user was on waitlist for this date → notify owner + remove from waitlist
      if (FEAT_WAITLIST) {
        try {
          const waiters = await db.waitlist.byDate(toDS(date));
          const match = waiters.find(w => w.phone === user.phone);
          if (match) {
            notifyOwnerWaitlistFilled({ clientName: user.name || user.firstName, clientPhone: user.phone, date: toDS(date), time });
            if (db.waitlist.remove) await db.waitlist.remove(match.id);
          }
        } catch (e) { console.warn('[waitlistFilled] check failed:', e.message); }
      }
    }
  };

  const confirmAttendance = async () => {
    if (!confirmed?.id || aptConfirmed) return;
    setAptConfirmed(true);
    const existing = await db.settings.get('appointmentConfirmations', {});
    await db.settings.set('appointmentConfirmations', { ...existing, [confirmed.id]: true });
  };

  const doCancel = async () => {
    if (!confirmed) return;
    const settings = await db.settings.get('adminSettings');
    const minH = settings?.cancellation?.minHours ?? 24;
    if (!(settings?.cancellation?.allowCancel ?? true)) { setError('ביטולים אינם מורשים.'); return; }
    const diff = (new Date(`${confirmed.date}T${confirmed.time}`) - new Date()) / 3600000;
    if (diff < minH) { setError(`לא ניתן לבטל פחות מ-${minH} שעות לפני התור.`); return; }
    await db.appointments.cancel(confirmed.id);
    notifyOwnerCancellation({ clientName: user.name || user.firstName, clientPhone: user.phone, service: confirmed.serviceName, date: confirmed.date, time: confirmed.time });
    // Waitlist SMS notifications removed — waitlist members see availability on the website
    setConfirmed(null); setStep(1); setService(null); setDate(null); setTime(null); setError('');
  };

  const doJoinWaitlist = async () => {
    if (!user || !date) return;
    setLoading(true);
    await db.waitlist.add({ date: toDS(date), phone: user.phone, userName: user.name || user.firstName, serviceId: service?.id });
    setLoading(false);
    setWaitlistDone(true);
    notifyOwnerWaitlistJoin({ clientName: user.name || user.firstName, clientPhone: user.phone, date: toDS(date) });
  };

  const back = () => {
    if (showAddonPicker) { setShowAddonPicker(false); setPendingBaseService(null); return; }
    if (selectedDay) { setSelectedDay(null); return; }
    if (step === 3) { setStep(2); setTime(null); return; }
    if (step > 1) { setStep(step - 1); return; }
    if (!user && step === 1) { setStep(0); return; }
    onNavigate?.('home');
  };

  // Calendar values
  const calYear        = monthStart.getFullYear();
  const calMonth       = monthStart.getMonth();
  const calFirstDow    = new Date(calYear, calMonth, 1).getDay();
  const calDaysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const calToday       = new Date(); calToday.setHours(0,0,0,0);
  const calMaxDate     = wh ? new Date(calToday.getTime() + (wh.weeksAhead||4)*7*86400000) : null;
  const calCells       = [...Array(calFirstDow).fill(null), ...Array.from({length: calDaysInMonth}, (_, i) => i+1)];
  while (calCells.length % 7 !== 0) calCells.push(null);
  const canGoPrev = true; // free navigation — past months show historical appointment dots
  const canGoNext = true; // free forward navigation — isFar still disables individual cells from being booked

  const stepLabels = ['', 'בחירת שירות', 'בחירת תאריך', 'אישור תור'];

  // ── Gate: must be registered to book ─────────────────────────
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: C.bg, backgroundImage: 'var(--demo-bg-mat-surface)', backgroundRepeat: 'repeat' }}>
        <PageHeader title="קביעת תור" onBack={() => onNavigate('home')} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px 24px', textAlign: 'center' }}>
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 18 }}
            style={{ width: 72, height: 72, borderRadius: '50%', backgroundColor: C.surface, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, boxShadow: SHADOW }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </motion.div>
          <h2 style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 26, color: C.text, fontWeight: 600, marginBottom: 10 }}>
            כדי לקבוע תור יש להירשם תחילה
          </h2>
          <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 14, color: C.muted, lineHeight: 1.6, marginBottom: 32, maxWidth: 280 }}>
            ההרשמה מהירה ומאפשרת לנו לשלוח לך תזכורות ולהתאים את החוויה אישית 💕
          </p>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => onNavigate('register')}
            style={{ ...S.btn, marginBottom: 12 }}
          >
            הירשמי עכשיו ✨
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => onNavigate('home')}
            style={{ width: '100%', maxWidth: 320, height: 46, borderRadius: 'var(--demo-radius-card)', border: `1px solid ${C.border}`, backgroundColor: 'transparent', color: C.muted, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'var(--demo-body-font)' }}
          >
            חזרה לדף הבית
          </motion.button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: C.bg, backgroundImage: 'var(--demo-bg-mat-surface)', backgroundRepeat: 'repeat' }}>
      <PageHeader
        title="קביעת תור"
        onBack={step > 0 && step < 4 ? back : () => onNavigate('home')}
      />

      {/* תת-כותרת שלב (הכותרת הראשית עברה ל-PageHeader) */}
      {step > 0 && step < 4 && (
        <div style={{ padding: 'calc(64px + env(safe-area-inset-top)) 16px 4px' }}>
          <p style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>{stepLabels[step]}</p>
        </div>
      )}
      {(step === 0 || step >= 4) && <div style={{ height: 'calc(64px + env(safe-area-inset-top))' }} />}

      {/* Progress bar */}
      {step > 0 && step < 4 && (
        <div style={{ padding: '0 16px 16px', display: 'flex', gap: 6 }}>
          {[1,2,3].map(s => (
            <motion.div key={s} initial={false}
              animate={{ backgroundColor: s <= step ? C.accent : C.border }}
              transition={{ duration: 0.3 }}
              style={{ height: 4, flex: 1, borderRadius: 4 }} />
          ))}
        </div>
      )}

      <div style={{ flex: 1, padding: '0 16px 96px', overflowY: 'auto' }}>

        {/* Step 0 — Login */}
        {step === 0 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ color: C.muted, fontSize: 14 }}>הכניסי פרטים לקביעת תור מהירה</p>
            <div>
              <label style={{ color: C.muted, fontSize: 12, display: 'block', marginBottom: 5 }}>שם מלא</label>
              <input type="text" value={login.name} onChange={e => setLogin(p => ({...p, name: e.target.value}))}
                placeholder="שם מלא" style={S.input}
                onFocus={e => e.target.style.borderColor = C.accent}
                onBlur={e => e.target.style.borderColor = C.border} />
            </div>
            <div>
              <label style={{ color: C.muted, fontSize: 12, display: 'block', marginBottom: 5 }}>מספר טלפון</label>
              <input type="tel" dir="ltr" value={login.phone} onChange={e => setLogin(p => ({...p, phone: e.target.value}))}
                placeholder="050-0000000" style={S.input}
                onFocus={e => e.target.style.borderColor = C.accent}
                onBlur={e => e.target.style.borderColor = C.border} />
            </div>
            {error && <p style={{ color: '#E57373', fontSize: 13 }}>{error}</p>}
            <motion.button onClick={doLogin} disabled={loading} whileTap={{ scale: 0.97 }}
              style={{ ...S.btn, opacity: loading ? 0.7 : 1 }}>
              {loading ? 'בודקת...' : 'המשכי ←'}
            </motion.button>
            <motion.button onClick={() => onNavigate('register')} whileTap={{ scale: 0.97 }}
              style={{ width: '100%', height: 46, borderRadius: 'var(--demo-radius-card)', border: `1.5px solid ${C.accent}`, backgroundColor: 'transparent', color: C.accent, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'var(--demo-body-font)', boxShadow: SHADOW }}>
              הרשמה מלאה
            </motion.button>
          </motion.div>
        )}

        {/* Step 1 — Service */}
        {step === 1 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            {services.length === 0 && <p style={{ color: C.muted, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>טוענת שירותים...</p>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {baseServices.map((svc, i) => {
                const isSelected = service?.id === svc.id;
                const svcAddons  = addonsOf(svc.id);
                return (
                  <motion.button key={svc.id}
                    onClick={() => {
                      vibrate(15);
                      if (svcAddons.length > 0) {
                        // Show addon picker first
                        setPendingBaseService(svc);
                        setSelectedAddons([]);
                        setShowAddonPicker(true);
                      } else if (features.staff && staff.length >= 1) {
                        setPendingService(svc);
                        setShowStaffPicker(true);
                      } else {
                        setStaffId(null);
                        setService(svc);
                        setStep(2);
                      }
                    }}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08, duration: 0.35, ease: 'easeOut' }}
                    whileTap={{ scale: 0.97 }}
                    style={{
                      position: 'relative', height: 160, borderRadius: 'var(--demo-radius-card)', overflow: 'hidden',
                      border: isSelected ? `2.5px solid ${C.accent}` : '2px solid transparent',
                      boxShadow: isSelected ? `0 0 0 2px ${C.accent}, ${SHADOW}` : SHADOW,
                      cursor: 'pointer', padding: 0, background: '#8B6E52',
                      transform: isSelected ? 'scale(1.03)' : 'scale(1)',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                    }}>
                    <img src={svc.imageUrl || SERVICE_IMGS[i % SERVICE_IMGS.length]} alt={svc.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      onError={e => { e.target.src = SERVICE_IMGS[i % SERVICE_IMGS.length]; }} />
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      background: 'linear-gradient(transparent, rgba(20,10,5,0.72))',
                      padding: '24px 10px 10px',
                      textAlign: 'start',
                    }}>
                      <p style={{ color: 'var(--color-surface)', fontFamily: 'var(--demo-body-font)', fontWeight: 700, fontSize: 13, lineHeight: 1.2 }}>{svc.name}</p>
                      <p style={{ color: 'rgba(253,250,247,0.80)', fontFamily: 'var(--demo-body-font)', fontSize: 11, marginTop: 2 }}>
                        {fmtDuration(svc.duration)} · <span style={{ fontWeight: 700 }}>₪{svc.price}</span>
                      </p>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Step 2 — Calendar */}
        {step === 2 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>

            {/* Month nav */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <motion.button
                onClick={() => canGoPrev && setMonthStart(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                whileTap={canGoPrev ? { scale: 0.88 } : {}}
                style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: canGoPrev ? C.surface : 'transparent', border: `1px solid ${canGoPrev ? C.border : 'transparent'}`, cursor: canGoPrev ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, boxShadow: canGoPrev ? SHADOW : 'none' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
              </motion.button>

              <p style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 19, fontWeight: 500, color: C.text, letterSpacing: '0.05em' }}>
                {MONTH_HE[calMonth]} {calYear}
              </p>

              <motion.button
                onClick={() => canGoNext && setMonthStart(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                whileTap={canGoNext ? { scale: 0.88 } : {}}
                style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: canGoNext ? C.surface : 'transparent', border: `1px solid ${canGoNext ? C.border : 'transparent'}`, cursor: canGoNext ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, boxShadow: canGoNext ? SHADOW : 'none' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
              </motion.button>
            </div>

            {/* Column headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 4 }}>
              {COL_HE.map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: C.muted, paddingBlock: 4 }}>{d}</div>
              ))}
            </div>

            {/* Day grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
              {calCells.map((day, i) => {
                if (day === null) return <div key={`e-${i}`} />;
                const cellDate  = new Date(calYear, calMonth, day);
                const ds        = toDS(cellDate);
                const isPast    = cellDate < calToday;
                const isFar     = calMaxDate && cellDate > calMaxDate;
                // For "any" — day is active if at least one candidate is working that day
                const isWorking = staffId === 'any'
                  ? anyCandidates().some(c => getHoursForStaffDate(cellDate, c.id)?.active)
                  : !!(getHoursForStaffDate(cellDate, staffId)?.active);
                const isToday   = ds === toDS(calToday);
                const hasUserApt = userAptDates.has(ds);
                const isSelected = date && toDS(date) === ds;
                const disabled  = isPast || isFar || !isWorking;
                const isVacation = !isPast && !isFar && isVacationDay(cellDate);

                return (
                  <motion.button
                    key={ds}
                    onClick={() => {
                      if (disabled) return;
                      vibrate(15);
                      setDate(cellDate);
                      setTime(null);
                      setSelectedDay(ds);
                    }}
                    whileTap={disabled ? {} : { scale: 0.84 }}
                    style={{
                      position: 'relative',
                      aspectRatio: '1',
                      borderRadius: 9,
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      cursor: disabled ? 'default' : 'pointer',
                      backgroundColor: isSelected ? C.accent
                        : isVacation ? 'rgba(168,90,74,0.07)'
                        : disabled ? 'transparent'
                        : isToday ? 'rgba(107,79,58,0.10)' : C.surface,
                      border: isSelected ? 'none'
                        : isVacation ? '1px dashed rgba(168,90,74,0.28)'
                        : isToday ? `1.5px solid ${C.accent}`
                        : disabled ? 'none' : `1px solid ${C.border}`,
                      boxShadow: disabled ? 'none' : isSelected ? 'none' : SHADOW,
                      opacity: isVacation ? 0.6 : (disabled && hasUserApt) ? 0.75 : disabled ? 0.22 : 1,
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: isSelected || isToday ? 700 : 400, color: isSelected ? 'var(--color-surface)' : C.text, lineHeight: 1 }}>
                      {day}
                    </span>
                    {isVacation && (
                      <span style={{ fontSize: 7, lineHeight: 1, marginTop: 1 }}>🌴</span>
                    )}
                    {hasUserApt && (
                      <span style={{ width: 3, height: 3, borderRadius: '50%', backgroundColor: isSelected ? 'rgba(253,250,247,0.7)' : C.accent, marginTop: 2 }} />
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 14, marginTop: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: C.accent, display: 'inline-block' }} />
                <span style={{ fontSize: 10, color: C.muted }}>התורים שלי</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 10 }}>🌴</span>
                <span style={{ fontSize: 10, color: C.muted }}>חופשה</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', border: `1.5px solid ${C.accent}`, display: 'inline-block' }} />
                <span style={{ fontSize: 10, color: C.muted }}>היום</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 3 — Summary */}
        {step === 3 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <div style={{ ...S.card, padding: 16, marginBottom: 16 }}>
              <p style={{ color: C.muted, fontSize: 12, marginBottom: 10 }}>סיכום התור</p>
              {[
                ['שירות', service?.name],
                ...(selectedAddons.map(a => [`+ ${a.name}`, `+${fmtDuration(a.duration)} · +₪${a.price}`])),
                ['סה"כ זמן', fmtDuration(effectiveDuration)],
                ['תאריך', date ? fmtDateShort(date) : ''],
                ['שעה',   time],
              ].map(([k,v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ color: k.startsWith('+') ? C.accent : C.muted, fontSize: 13 }}>{k}</span>
                  <span style={{ color: C.text, fontSize: 13, fontWeight: 500 }}>{v}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 2px' }}>
                <span style={{ color: C.muted, fontSize: 13, fontWeight: 700 }}>סה"כ לתשלום</span>
                <span style={{ color: C.accent, fontSize: 20, fontWeight: 800 }}>₪{effectivePrice}</span>
              </div>
            </div>
            {error && <p style={{ color: '#E57373', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <motion.button onClick={doBook} disabled={loading} whileTap={{ scale: 0.97 }}
              style={{ ...S.btn, opacity: loading ? 0.7 : 1 }}>
              {loading ? 'שומרת...' : 'אשרי תור ✓'}
            </motion.button>
          </motion.div>
        )}

        {/* Step 4 — Confirmed */}
        {step === 4 && confirmed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ paddingTop: 24 }}>
            <div style={{ textAlign: 'center', paddingBottom: 24 }}>
              <SuccessCheck />
              <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
                style={{ fontSize: 24, fontWeight: 700, color: C.text, marginBottom: 4 }}>
                {isPending ? 'הבקשה התקבלה ✓' : 'התור אושר! 🎉'}
              </motion.h2>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}
                style={{ fontSize: 13, color: C.muted }}>
                {isPending ? 'הבקשה בהמתנה לאישור בעלת העסק' : 'נשלח לך SMS עם הפרטים'}
              </motion.p>
              <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.05 }}
                style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 26, fontWeight: 600, color: C.accent, marginTop: 14, letterSpacing: '0.01em' }}>
                {confirmed.serviceName}
              </motion.p>
            </div>

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} style={S.card}>
              {(() => {
                const staffName = features.staff && confirmed.staffId
                  ? (staff.find(s => s.id === confirmed.staffId)?.name || '')
                  : owner.name;
                const rows = [
                  ['שירות', confirmed.serviceName],
                  ['תאריך', fmtDateLong(confirmed.date)],
                  ['שעה', confirmed.time],
                ];
                if (confirmed.serviceDuration > 0) rows.push(['משך', fmtDuration(confirmed.serviceDuration)]);
                if (staffName) rows.push(['מטפלת', staffName]);
                return rows;
              })().map(([k,v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ color: C.muted, fontSize: 13 }}>{k}</span>
                  <span style={{ color: C.text, fontSize: 13, fontWeight: 500 }}>{v}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px' }}>
                <span style={{ color: C.muted, fontSize: 13 }}>מחיר</span>
                <span style={{ color: C.accent, fontSize: 22, fontWeight: 700 }}>₪{confirmed.price}</span>
              </div>
            </motion.div>

            {error && (
              <p style={{ color: '#E57373', fontSize: 13, padding: '10px 14px', backgroundColor: 'rgba(229,115,115,0.06)', borderRadius: 'var(--demo-radius-card)', border: '1px solid rgba(229,115,115,0.2)', marginTop: 12 }}>
                {error}
              </p>
            )}

            {/* ── Action grid + inline payment accordion ── */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85 }}
              style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>

              {(() => {
                const showPayment = features.reports && payVisible.bit;
                return (
                  <>
                    {/* Row 1 — Payment + Confirm (or Confirm full-width) */}
                    <div style={{ display: 'grid', gridTemplateColumns: showPayment ? '1fr 1fr' : '1fr', gap: 8 }}>
                      {showPayment && (paidMethod ? (
                        <div style={{ padding: '10px 8px', backgroundColor: 'rgba(76,175,80,0.10)', border: '1px solid rgba(76,175,80,0.30)', borderRadius: 'var(--demo-radius-card)', textAlign: 'center' }}>
                          <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 12, fontWeight: 700, color: '#2C7D31' }}>
                            ✓ שולם ב{paidMethod === 'bit' ? 'ביט' : 'פייבוקס'}
                          </p>
                        </div>
                      ) : (
                        <motion.button whileTap={{ scale: 0.97 }} onClick={() => setPayOpen(true)}
                          style={{
                            height: 44, borderRadius: 'var(--demo-radius-card)',
                            border: `1.5px solid ${C.border}`,
                            backgroundColor: C.surface,
                            color: C.accent,
                            fontFamily: 'var(--demo-body-font)', fontSize: 12, fontWeight: 700,
                            cursor: 'pointer', touchAction: 'manipulation',
                          }}>
                          תשלום ↑
                        </motion.button>
                      ))}

                      {/* Confirm attendance */}
                      {aptConfirmed ? (
                        <div style={{ height: 44, borderRadius: 'var(--demo-radius-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(76,175,80,0.10)', border: '1px solid rgba(76,175,80,0.30)' }}>
                          <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 12, fontWeight: 700, color: '#2C7D31' }}>✓ אישרתי!</p>
                        </div>
                      ) : (
                        <motion.button whileTap={{ scale: 0.97 }} onClick={confirmAttendance}
                          style={{
                            height: 44, borderRadius: 'var(--demo-radius-card)',
                            border: '1.5px solid rgba(76,175,80,0.4)',
                            backgroundColor: 'rgba(76,175,80,0.07)',
                            color: '#388E3C', fontFamily: 'var(--demo-body-font)', fontSize: 12, fontWeight: 700,
                            cursor: 'pointer', touchAction: 'manipulation',
                          }}>
                          ✓ אישרתי הגעה
                        </motion.button>
                      )}
                    </div>

                    {/* Row 2 — Google Calendar */}
                    <motion.button whileTap={{ scale: 0.97 }}
                      onClick={() => window.open(buildCalendarUrl(confirmed, owner.name), '_blank', 'noopener')}
                      style={{
                        height: 44, borderRadius: 'var(--demo-radius-card)',
                        border: `1px solid ${C.border}`,
                        backgroundColor: C.surface,
                        color: C.accent,
                        fontFamily: 'var(--demo-body-font)', fontSize: 13, fontWeight: 500,
                        cursor: 'pointer', touchAction: 'manipulation',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}>
                      📅 הוסף ליומן Google
                    </motion.button>

                    {/* Row 3 — Home + Cancel */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <motion.button onClick={() => onNavigate('home')} whileTap={{ scale: 0.97 }}
                        style={{ ...S.btn, height: 44, fontSize: 13 }}>
                        חזרה לבית
                      </motion.button>
                      <motion.button onClick={doCancel} whileTap={{ scale: 0.97 }}
                        style={{ height: 44, borderRadius: 'var(--demo-radius-card)', border: `1px solid ${C.border}`, backgroundColor: 'transparent', color: C.muted, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--demo-body-font)', boxShadow: SHADOW }}>
                        ביטול תור
                      </motion.button>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </div>

      {/* Time overlay — slides up from bottom when day is selected */}
      <AnimatePresence>
        {selectedDay && step === 2 && (
          <>
            <motion.div
              key="time-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ position: 'fixed', inset: 0, zIndex: 60, backgroundColor: 'rgba(44,27,16,0.32)' }}
              onClick={() => setSelectedDay(null)}
            />
            <motion.div
              key="time-panel"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              style={{
                position: 'fixed', bottom: 0, left: 0, right: 0,
                maxWidth: 390, margin: '0 auto',
                zIndex: 70,
                backgroundColor: C.surface,
                borderRadius: '20px 20px 0 0',
                maxHeight: '72vh',
                overflowY: 'auto',
                boxShadow: '0 -4px 24px rgba(0,0,0,0.08)',
              }}
            >
              {/* Drag handle */}
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 2 }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.border }} />
              </div>

              <div style={{ padding: '10px 16px 48px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0 }}>
                      {date ? fmtDateShort(date) : ''}
                    </h3>
                    <p style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{service?.name}{selectedAddons.length > 0 ? ' + ' + selectedAddons.map(a => a.name).join(' + ') : ''} · {fmtDuration(effectiveDuration)}</p>
                  </div>
                  <button onClick={() => setSelectedDay(null)}
                    style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.muted, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    ✕
                  </button>
                </div>

                {allSlots().length === 0 ? (
                  <p style={{ color: C.muted, fontSize: 14, textAlign: 'center', padding: '20px 0' }}>טוענת שעות...</p>
                ) : isFull() ? (
                  <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    <div style={{ fontSize: 38, marginBottom: 10 }}>😔</div>
                    <p style={{ color: C.text, fontWeight: 600, fontSize: 16, marginBottom: 4 }}>היום מלא</p>
                    <p style={{ color: C.muted, fontSize: 13, marginBottom: 20 }}>כל השעות תפוסות</p>
                    {FEAT_WAITLIST && !waitlistDone && user && (
                      <motion.button onClick={doJoinWaitlist} disabled={loading} whileTap={{ scale: 0.97 }}
                        style={{ ...S.btn, maxWidth: 260, margin: '0 auto 12px', opacity: loading ? 0.7 : 1 }}>
                        {loading ? 'שומרת...' : '🔔 הצטרפי לרשימת המתנה'}
                      </motion.button>
                    )}
                    {waitlistDone && <p style={{ color: C.accent, fontWeight: 600, fontSize: 14 }}>נרשמת! נשלח SMS כשיתפנה מקום 💕</p>}
                    <button onClick={() => setSelectedDay(null)}
                      style={{ marginTop: 10, color: C.muted, fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--demo-body-font)' }}>
                      ← בחרי תאריך אחר
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {allSlots().map(s => {
                      const occupied = isOccupied(s);
                      return (
                        <motion.button key={s}
                          onClick={() => {
                            if (occupied) return;
                            vibrate(15);
                            if (staffId === 'any') {
                              const candidates = availableStaffForSlot(s);
                              if (candidates.length === 1) {
                                setStaffId(candidates[0].id);
                                setTime(s);
                                setSelectedDay(null);
                                setStep(3);
                              } else if (candidates.length > 1) {
                                setPostTimePicker({ time: s, candidates });
                              }
                              return;
                            }
                            setTime(s);
                            setSelectedDay(null);
                            setStep(3);
                          }}
                          whileTap={occupied ? {} : { scale: 0.92 }}
                          style={{
                            padding: '12px 4px', textAlign: 'center', borderRadius: 11,
                            fontSize: 13, fontWeight: 600, fontFamily: 'var(--demo-body-font)',
                            cursor: occupied ? 'not-allowed' : 'pointer',
                            backgroundColor: occupied ? 'transparent' : C.bg,
                            border: occupied ? `1px solid rgba(107,79,58,0.10)` : `1px solid ${C.border}`,
                            color: occupied ? 'rgba(158,126,130,0.35)' : C.text,
                            boxShadow: occupied ? 'none' : SHADOW,
                            textDecoration: occupied ? 'line-through' : 'none',
                            opacity: occupied ? 0.5 : 1,
                          }}
                        >
                          {s}
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {/* Payment bottom sheet */}
      <AnimatePresence>
        {features.reports && payOpen && !paidMethod && payVisible.bit && confirmed && (
          <>
            <motion.div
              key="pay-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ position: 'fixed', inset: 0, zIndex: 90, backgroundColor: 'rgba(44,27,16,0.32)' }}
              onClick={() => setPayOpen(false)}
            />
            <motion.div
              key="pay-sheet"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              className="demo-tinted"
              style={{
                position: 'fixed', bottom: 0, left: 0, right: 0,
                borderRadius: '20px 20px 0 0',
                zIndex: 91,
                boxShadow: '0 -4px 24px rgba(0,0,0,0.08)',
                paddingBottom: 40,
                direction: 'rtl',
              }}>
              <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.border }} />
              </div>
              <div style={{ padding: '8px 20px 14px', borderBottom: `1px solid ${C.border}` }}>
                <p style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 17, fontWeight: 600, color: C.text }}>{confirmed.serviceName}</p>
                <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 22, fontWeight: 700, color: C.accent, marginTop: 2 }}>₪{confirmed.price}</p>
              </div>
              <div style={{ padding: '16px 20px 12px' }}>
                {!paySettingsLoaded ? (
                  <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 13, color: C.muted, textAlign: 'center', padding: '12px 0' }}>
                    טוענת אפשרויות תשלום...
                  </p>
                ) : (payVisible.bit && bitAccount) ? (
                  <PayButtons
                    ownerPhone={ownerPhone}
                    bitAccount={payVisible.bit ? bitAccount : ''}
                    amount={confirmed.price}
                    subject={`${confirmed.serviceName} ${user?.firstName || user?.name || ''}`.trim()}
                    onPaid={(method) => { setPayOpen(false); setPayConfirm({ method }); }}
                  />
                ) : (
                  <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 13, color: C.muted, textAlign: 'center', padding: '12px 0' }}>
                    אפשרויות תשלום לא הוגדרו עדיין
                  </p>
                )}
              </div>
              <div style={{ padding: '0 20px' }}>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setPayOpen(false)}
                  style={{ width: '100%', height: 40, borderRadius: 'var(--demo-radius-card)', border: `1px solid ${C.border}`, backgroundColor: 'transparent', color: C.muted, fontFamily: 'var(--demo-body-font)', fontSize: 13, cursor: 'pointer' }}>
                  סגירה
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <PaymentConfirmModal
        open={!!payConfirm}
        amount={confirmed?.price || 0}
        method={payConfirm?.method}
        onConfirm={async () => {
          const method = payConfirm?.method;
          if (confirmed?.id && method) {
            try {
              const cur = await db.settings.get('pendingPayments', {});
              await db.settings.set('pendingPayments', {
                ...(cur || {}),
                [confirmed.id]: {
                  type: 'appointment',
                  method,
                  clientName: confirmed.userName || '',
                  clientPhone: confirmed.phone || '',
                  amount: confirmed.price || 0,
                  serviceName: confirmed.serviceName || '',
                  aptDate: confirmed.date || '',
                  aptTime: confirmed.time || '',
                  createdAt: new Date().toISOString(),
                },
              });
            } catch (e) { console.error('[booking] pending payment:', e); }
            // Notify owner via Telegram with "אישרתי קבלת תשלום" button
            try {
              await notifyOwnerAppointmentPaid({
                clientName: confirmed.userName || '',
                clientPhone: confirmed.phone || '',
                serviceName: confirmed.serviceName || '',
                amount: confirmed.price || 0,
                method: method === 'bit' ? 'ביט' : method,
                paymentId: confirmed.id,
              });
            } catch (e) { console.error('[booking] notify paid:', e); }
            setPaidMethod(method);
          }
          setPayConfirm(null);
        }}
        onCancel={() => setPayConfirm(null)}
      />

      {/* ── Post-time staff picker — when "any" slot has multiple available staff ── */}
      <AnimatePresence>
        {features.staff && postTimePicker && (
          <>
            <motion.div
              key="ptp-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setPostTimePicker(null)}
              style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(44,24,16,0.55)', zIndex: 220 }}
            />
            <motion.div
              key="ptp-sheet"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 32 }}
              className="demo-tinted"
              style={{
                position: 'fixed', bottom: 0, left: 0, right: 0,
                borderRadius: '20px 20px 0 0',
                padding: '20px 20px 40px',
                zIndex: 221,
                maxWidth: 480, margin: '0 auto',
                direction: 'rtl',
              }}
            >
              <div style={{ width: 36, height: 4, backgroundColor: '#D4B896', borderRadius: 2, margin: '0 auto 18px' }} />
              <p style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 20, fontWeight: 600, color: C.text, marginBottom: 4, textAlign: 'center' }}>
                {postTimePicker.time} · מי תטפל בך?
              </p>
              <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 12, color: C.muted, textAlign: 'center', marginBottom: 18 }}>
                {postTimePicker.candidates.length} מטפלות פנויות
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(postTimePicker.candidates.length, 3)}, 1fr)`, gap: 10 }}>
                {postTimePicker.candidates.map(c => (
                  <motion.button key={c.id ?? 'owner'} whileTap={{ scale: 0.96 }}
                    onClick={() => {
                      vibrate(15);
                      setStaffId(c.id);
                      setTime(postTimePicker.time);
                      setSelectedDay(null);
                      setStep(3);
                      setPostTimePicker(null);
                    }}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                      padding: '14px 8px', borderRadius: 'var(--demo-radius-card)', border: '1.5px solid #E8DCC8',
                      backgroundColor: 'var(--color-surface)', cursor: 'pointer',
                    }}>
                    {c.imageUrl && c.mediaType !== 'video' ? (
                      <img src={c.imageUrl} alt={c.name}
                        style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 20, fontWeight: 600, color: 'var(--color-surface)' }}>
                          {(c.name || '?').charAt(0)}
                        </span>
                      </div>
                    )}
                    <span style={{ fontFamily: 'var(--demo-body-font)', fontSize: 12, fontWeight: 500, color: C.text, textAlign: 'center', lineHeight: 1.3 }}>{c.name}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Addon picker bottom sheet ──────────────────────────── */}
      <AnimatePresence>
        {showAddonPicker && pendingBaseService && (
          <>
            <motion.div key="addon-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ position: 'fixed', inset: 0, zIndex: 60, backgroundColor: 'rgba(44,27,16,0.38)' }}
              onClick={() => setShowAddonPicker(false)}
            />
            <motion.div key="addon-panel"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              style={{
                position: 'fixed', bottom: 0, left: 0, right: 0,
                maxWidth: 390, margin: '0 auto', zIndex: 70,
                backgroundColor: C.surface, borderRadius: '20px 20px 0 0',
                maxHeight: '80vh', overflowY: 'auto',
                boxShadow: '0 -4px 24px rgba(0,0,0,0.10)',
              }}>
              {/* Handle */}
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 2 }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.border }} />
              </div>
              <div style={{ padding: '12px 16px 48px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0 }}>תוספות</h3>
                    <p style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{pendingBaseService.name} · {fmtDuration(pendingBaseService.duration)} · ₪{pendingBaseService.price}</p>
                  </div>
                  <button onClick={() => setShowAddonPicker(false)}
                    style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.muted, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                </div>
                <p style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>בחרי תוספות (אופציונלי)</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                  {addonsOf(pendingBaseService.id).map(addon => {
                    const checked = selectedAddons.some(a => a.id === addon.id);
                    return (
                      <motion.button key={addon.id} whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          vibrate(10);
                          setSelectedAddons(prev =>
                            checked ? prev.filter(a => a.id !== addon.id) : [...prev, { id: addon.id, name: addon.name, price: addon.price, duration: addon.duration }]
                          );
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '12px 14px', borderRadius: 'var(--demo-radius-card)',
                          border: `${checked ? '2px' : '1px'} solid ${checked ? C.accent : C.border}`,
                          backgroundColor: checked ? `rgba(107,79,58,0.06)` : C.surface,
                          boxShadow: checked ? `0 0 0 2px rgba(107,79,58,0.12)` : SHADOW,
                          cursor: 'pointer', textAlign: 'start',
                        }}>
                        <div>
                          <p style={{ color: C.text, fontFamily: 'var(--demo-body-font)', fontWeight: 600, fontSize: 14 }}>✨ {addon.name}</p>
                          <p style={{ color: C.muted, fontFamily: 'var(--demo-body-font)', fontSize: 12, marginTop: 2 }}>+{fmtDuration(addon.duration)} · +₪{addon.price}</p>
                        </div>
                        <div style={{
                          width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                          backgroundColor: checked ? C.accent : 'transparent',
                          border: `2px solid ${checked ? C.accent : C.border}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {checked && <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2.5 7L5.5 10L11.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
                {/* Total preview */}
                {selectedAddons.length > 0 && (
                  <div style={{ padding: '10px 14px', marginBottom: 12, backgroundColor: `rgba(107,79,58,0.06)`, borderRadius: 'var(--demo-radius-card)', border: `1px solid ${C.border}` }}>
                    <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 13, color: C.text }}>
                      סה"כ: <strong>{fmtDuration(pendingBaseService.duration + selectedAddons.reduce((s,a) => s+a.duration, 0))}</strong> · <strong style={{ color: C.accent }}>₪{pendingBaseService.price + selectedAddons.reduce((s,a) => s+a.price, 0)}</strong>
                    </p>
                  </div>
                )}
                <motion.button whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    vibrate(15);
                    setService(pendingBaseService);
                    setShowAddonPicker(false);
                    if (features.staff && staff.length >= 1) {
                      setPendingService(pendingBaseService);
                      setShowStaffPicker(true);
                    } else {
                      setStaffId(null);
                      setStep(2);
                    }
                  }}
                  style={{ ...S.btn }}>
                  המשיכי {selectedAddons.length > 0 ? `עם ${selectedAddons.length} תוספות` : 'ללא תוספות'} ←
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Staff picker popup ─────────────────────────────────── */}
      <AnimatePresence>
        {features.staff && showStaffPicker && pendingService && (
          <>
            {/* Backdrop */}
            <motion.div
              key="staff-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowStaffPicker(false)}
              style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(44,24,16,0.5)', zIndex: 200 }}
            />
            {/* Sheet */}
            <motion.div
              key="staff-sheet"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 32 }}
              className="demo-tinted"
              style={{
                position: 'fixed', bottom: 0, left: 0, right: 0,
                borderRadius: '20px 20px 0 0',
                padding: '20px 20px 40px',
                zIndex: 201,
                maxWidth: 480, margin: '0 auto',
                direction: 'rtl',
              }}
            >
              {/* Handle */}
              <div style={{ width: 36, height: 4, backgroundColor: '#D4B896', borderRadius: 2, margin: '0 auto 18px' }} />
              <p style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 20, fontWeight: 600, color: C.text, marginBottom: 6, textAlign: 'center' }}>
                {pendingService.name}
              </p>
              <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 12, color: C.muted, textAlign: 'center', marginBottom: 20 }}>
                בחרי מטפלת
              </p>

              {/* Staff cards — owner first, staff, "any" last */}
              {(() => {
                const totalCards = 1 + staff.length + 1;  // owner + staff + "any"
                const cols = Math.min(totalCards, 3);
                const pickAndGo = (sid) => {
                  vibrate(15);
                  setStaffId(sid);
                  setService(pendingService);
                  setStep(2);
                  setShowStaffPicker(false);
                  setPendingService(null);
                };
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 10 }}>
                    {/* Owner — first */}
                    <motion.button key="owner" whileTap={{ scale: 0.96 }}
                      onClick={() => pickAndGo(null)}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                        padding: '14px 8px', borderRadius: 'var(--demo-radius-card)', border: '1.5px solid #E8DCC8',
                        backgroundColor: 'var(--color-surface)', cursor: 'pointer',
                      }}>
                      {owner.imageUrl && owner.mediaType !== 'video' ? (
                        <img src={owner.imageUrl} alt={owner.name}
                          style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 20, fontWeight: 600, color: 'var(--color-surface)' }}>
                            {(owner.name || '?').charAt(0)}
                          </span>
                        </div>
                      )}
                      <span style={{ fontFamily: 'var(--demo-body-font)', fontSize: 12, fontWeight: 500, color: C.text, textAlign: 'center', lineHeight: 1.3 }}>{owner.name}</span>
                    </motion.button>

                    {/* Staff members */}
                    {staff.map(s => (
                      <motion.button key={s.id} whileTap={{ scale: 0.96 }}
                        onClick={() => pickAndGo(s.id)}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                          padding: '14px 8px', borderRadius: 'var(--demo-radius-card)', border: '1.5px solid #E8DCC8',
                          backgroundColor: 'var(--color-surface)', cursor: 'pointer',
                        }}>
                        {s.imageUrl ? (
                          <img src={s.imageUrl} alt={s.name}
                            style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 20, fontWeight: 600, color: 'var(--color-surface)' }}>
                              {(s.name || '?').charAt(0)}
                            </span>
                          </div>
                        )}
                        <span style={{ fontFamily: 'var(--demo-body-font)', fontSize: 12, fontWeight: 500, color: C.text, textAlign: 'center', lineHeight: 1.3 }}>{s.name}</span>
                      </motion.button>
                    ))}

                    {/* "Any" — last */}
                    <motion.button key="any" whileTap={{ scale: 0.96 }}
                      onClick={() => pickAndGo('any')}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                        padding: '14px 8px', borderRadius: 'var(--demo-radius-card)', border: '1.5px solid #E8DCC8',
                        backgroundColor: 'var(--color-surface)', cursor: 'pointer',
                      }}>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: '#F0E6D6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>✨</div>
                      <span style={{ fontFamily: 'var(--demo-body-font)', fontSize: 12, fontWeight: 500, color: C.muted, textAlign: 'center', lineHeight: 1.3 }}>כל אחת</span>
                    </motion.button>
                  </div>
                );
              })()}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
