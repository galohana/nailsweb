import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../utils/db';
import { digitsOnly } from '../utils/format';
import { DAYS_HE, MONTH_HE_FULL } from '../utils/constants';

function fmtAptDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `יום ${DAYS_HE[d.getDay()]}, ${d.getDate()} ${MONTH_HE_FULL[d.getMonth()]}`;
}

export default function ExistingModal({ open, onClose }) {
  const [phone, setPhone]     = useState('');
  const [view, setView]       = useState('lookup'); // lookup | found | notFound | confirm | cancelled
  const [apt, setApt]         = useState(null);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg]   = useState('');

  useEffect(() => {
    if (open) { setPhone(''); setView('lookup'); setApt(null); setErrMsg(''); }
  }, [open]);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const valid = digitsOnly(phone).length >= 9;

  const handleLookup = async () => {
    if (!valid || loading) return;
    setLoading(true);
    setErrMsg('');
    try {
      const all    = await db.appointments.byPhoneDigits(phone);
      const today  = new Date().toISOString().slice(0, 10);
      const upcoming = all
        .filter(a => (a.status === 'confirmed' || a.status === 'pending') && a.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
      if (upcoming.length === 0) {
        setView('notFound');
      } else {
        setApt(upcoming[0]);
        setView('found');
      }
    } catch {
      setErrMsg('שגיאה בחיפוש — נסי שוב.');
    }
    setLoading(false);
  };

  const handleCancelRequest = async () => {
    if (!apt) return;
    setLoading(true);
    setErrMsg('');
    try {
      const settings = await db.settings.get('adminSettings');
      const allowCancel = settings?.cancellation?.allowCancel ?? true;
      const minH        = settings?.cancellation?.minHours ?? 24;
      if (!allowCancel) {
        setErrMsg('ביטולים אינם מורשים.');
        setLoading(false);
        return;
      }
      const diff = (new Date(`${apt.date}T${apt.time}`) - new Date()) / 3_600_000;
      if (diff < minH) {
        setErrMsg(`לא ניתן לבטל פחות מ-${minH} שעות לפני התור.`);
        setLoading(false);
        return;
      }
      setView('confirm');
    } catch {
      setErrMsg('שגיאה — נסי שוב.');
    }
    setLoading(false);
  };

  const handleConfirmCancel = async () => {
    if (!apt) return;
    setLoading(true);
    try {
      await db.appointments.cancel(apt.id);
      setView('cancelled');
    } catch {
      setErrMsg('שגיאת ביטול — נסי שוב.');
    }
    setLoading(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0, zIndex: 8000,
              background: 'rgba(44,24,16,0.55)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
            }}
          />

          {/* Sheet */}
          <motion.div
            key="sheet"
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 60 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 8001,
              background: 'var(--color-bg)',
              borderRadius: '24px 24px 0 0',
              padding: '0 0 env(safe-area-inset-bottom,16px)',
              maxHeight: '90dvh',
              display: 'flex', flexDirection: 'column',
              fontFamily: 'var(--demo-body-font)',
              direction: 'rtl',
            }}
          >
            {/* Drag handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(107,79,58,0.2)' }} />
            </div>

            {/* Header */}
            <div style={{ textAlign: 'center', padding: '16px 24px 8px', position: 'relative' }}>
              <button
                onClick={onClose}
                style={{
                  position: 'absolute', left: 16, top: 16,
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'rgba(107,79,58,0.08)', border: 'none', cursor: 'pointer',
                  display: 'grid', placeItems: 'center',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--color-text)" strokeWidth="2" strokeLinecap="round">
                  <path d="M1 1l12 12M13 1L1 13"/>
                </svg>
              </button>
              <h2 style={{
                fontFamily: 'var(--demo-heading-font)', fontWeight: 500,
                fontSize: 26, color: 'var(--color-text)', letterSpacing: '0.04em', margin: 0,
              }}>
                ניהול תור קיים
              </h2>
            </div>

            {/* Scrollable content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 24px 16px' }}>
              <AnimatePresence mode="wait">

                {/* ── Phone input ── */}
                {view === 'lookup' && (
                  <motion.div key="lookup"
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                  >
                    <p style={{ fontSize: 14, color: 'rgba(107,79,58,0.7)', textAlign: 'center', marginBottom: 24, lineHeight: 1.8 }}>
                      הזיני את מספר הטלפון שאיתו קבעת<br />ואמצא את התור הקרוב שלך.
                    </p>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>
                      מספר טלפון
                    </label>
                    <input
                      type="tel" inputMode="numeric" dir="ltr"
                      value={phone} onChange={e => setPhone(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && valid && handleLookup()}
                      placeholder="050-000-0000"
                      style={{
                        width: '100%', padding: '15px 16px', borderRadius: 'var(--demo-radius-card)',
                        border: '1.5px solid var(--color-primary, #6B4F3A)',
                        background: 'var(--color-surface)', color: 'var(--color-text)',
                        fontSize: 18, textAlign: 'center', letterSpacing: '0.06em',
                        outline: 'none', fontFamily: 'var(--demo-body-font)',
                        boxSizing: 'border-box',
                      }}
                    />
                    {errMsg && <p style={{ color: '#c0392b', fontSize: 13, textAlign: 'center', marginTop: 10 }}>{errMsg}</p>}
                  </motion.div>
                )}

                {/* ── Found ── */}
                {view === 'found' && apt && (
                  <motion.div key="found"
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                  >
                    <p style={{ fontSize: 14, color: 'rgba(107,79,58,0.7)', textAlign: 'center', marginBottom: 16, lineHeight: 1.8 }}>
                      מצאתי את התור הקרוב שלך:
                    </p>
                    <AptCard apt={apt} />
                    {errMsg && <p style={{ color: '#c0392b', fontSize: 13, textAlign: 'center', marginTop: 10 }}>{errMsg}</p>}
                  </motion.div>
                )}

                {/* ── Not found ── */}
                {view === 'notFound' && (
                  <motion.div key="notFound"
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                    style={{ textAlign: 'center', paddingTop: 16 }}
                  >
                    <div style={{
                      width: 72, height: 72, borderRadius: '50%',
                      background: 'var(--color-surface)', border: '1px solid rgba(107,79,58,0.2)',
                      display: 'grid', placeItems: 'center', margin: '0 auto 20px',
                    }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(107,79,58,0.5)" strokeWidth="2" strokeLinecap="round">
                        <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                      </svg>
                    </div>
                    <p style={{ fontSize: 15, color: 'var(--color-text)', lineHeight: 1.8 }}>
                      לא נמצאו תורים קרובים<br />למספר זה.
                    </p>
                  </motion.div>
                )}

                {/* ── Confirm ── */}
                {view === 'confirm' && apt && (
                  <motion.div key="confirm"
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                  >
                    <p style={{ fontSize: 15, color: 'var(--color-text)', textAlign: 'center', marginBottom: 16, lineHeight: 1.7 }}>
                      בטוחה שברצונך לבטל את התור?
                    </p>
                    <AptCard apt={apt} />
                    {errMsg && <p style={{ color: '#c0392b', fontSize: 13, textAlign: 'center', marginTop: 10 }}>{errMsg}</p>}
                  </motion.div>
                )}

                {/* ── Cancelled ── */}
                {view === 'cancelled' && (
                  <motion.div key="cancelled"
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                    style={{ textAlign: 'center', paddingTop: 16 }}
                  >
                    <div style={{
                      width: 72, height: 72, borderRadius: '50%',
                      background: 'var(--color-surface)', border: '1px solid rgba(107,79,58,0.2)',
                      display: 'grid', placeItems: 'center', margin: '0 auto 20px',
                    }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(107,79,58,0.5)" strokeWidth="2" strokeLinecap="round">
                        <path d="M18 6L6 18M6 6l12 12"/>
                      </svg>
                    </div>
                    <p style={{ fontSize: 15, color: 'var(--color-text)', lineHeight: 1.8 }}>
                      התור בוטל.<br />מקווה לראות אותך בקרוב —<br />תמיד אפשר לקבוע מחדש.
                    </p>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>

            {/* Footer actions */}
            <div style={{ padding: '12px 24px', borderTop: '1px solid rgba(107,79,58,0.1)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {view === 'lookup' && (
                <PrimaryBtn disabled={!valid || loading} onClick={handleLookup}>
                  {loading ? 'מחפשת...' : 'בדיקת תור'}
                </PrimaryBtn>
              )}
              {view === 'found' && (
                <>
                  <SecondaryBtn disabled={loading} onClick={handleCancelRequest}>
                    {loading ? 'בודקת...' : 'ביטול התור'}
                  </SecondaryBtn>
                  <PrimaryBtn onClick={onClose}>סגירה</PrimaryBtn>
                </>
              )}
              {view === 'notFound' && <PrimaryBtn onClick={onClose}>סגירה</PrimaryBtn>}
              {view === 'confirm' && (
                <>
                  <SecondaryBtn disabled={loading} onClick={handleConfirmCancel}>
                    {loading ? 'מבטלת...' : 'כן, בטלי את התור'}
                  </SecondaryBtn>
                  <PrimaryBtn onClick={() => { setErrMsg(''); setView('found'); }}>חזרה</PrimaryBtn>
                </>
              )}
              {view === 'cancelled' && <PrimaryBtn onClick={onClose}>סגירה</PrimaryBtn>}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function AptCard({ apt }) {
  const rows = [
    ['שירות', apt.serviceName || '—'],
    ['תאריך', fmtAptDate(apt.date)],
    ['שעה',   apt.time],
    ['מחיר',  apt.price ? `₪${apt.price}` : '—'],
  ];
  return (
    <div style={{
      background: 'var(--color-surface)',
      borderRadius: 'var(--demo-radius-card)',
      border: '1px solid rgba(107,79,58,0.15)',
      boxShadow: 'var(--demo-shadow-card)',
      overflow: 'hidden',
    }}>
      {rows.map(([k, v], i) => (
        <div key={k} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 18px',
          borderTop: i === 0 ? 'none' : '1px solid rgba(107,79,58,0.08)',
        }}>
          <span style={{ fontSize: 14, color: 'rgba(107,79,58,0.6)', fontFamily: 'var(--demo-body-font)' }}>{k}</span>
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)', fontFamily: 'var(--demo-heading-font)', letterSpacing: '0.02em' }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

function PrimaryBtn({ children, onClick, disabled }) {
  return (
    <motion.button
      onClick={onClick} disabled={disabled}
      whileTap={disabled ? {} : { scale: 0.975 }}
      style={{
        width: '100%', height: 50, borderRadius: 'var(--demo-radius-card)',
        background: 'var(--color-primary, #6B4F3A)',
        backgroundImage: 'var(--demo-primary-mat-surface)',
        backgroundRepeat: 'repeat',
        color: 'var(--color-surface)', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'var(--demo-body-font)', fontWeight: 700, fontSize: 15,
        opacity: disabled ? 0.4 : 1, transition: 'opacity 200ms',
        boxShadow: 'var(--demo-shadow-card)',
      }}
    >{children}</motion.button>
  );
}

function SecondaryBtn({ children, onClick, disabled }) {
  return (
    <motion.button
      onClick={onClick} disabled={disabled}
      whileTap={disabled ? {} : { scale: 0.975 }}
      style={{
        width: '100%', height: 50, borderRadius: 'var(--demo-radius-card)',
        background: 'transparent',
        color: 'var(--color-text)', border: '1.5px solid rgba(107,79,58,0.35)', cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'var(--demo-body-font)', fontWeight: 600, fontSize: 15,
        opacity: disabled ? 0.4 : 1, transition: 'opacity 200ms',
      }}
    >{children}</motion.button>
  );
}
