import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../utils/db';
import { fmtDuration } from '../utils/format';
import { notifyOwnerCancellation } from '../utils/sms';
import { features } from '../config/features';
import PageHeader from '../components/PageHeader';
import PayButtons from '../components/PayButtons';

const C = {
  bg:      'var(--color-bg)',
  surface: 'var(--color-surface)',
  accent:  'var(--color-primary)',
  brown:   'var(--color-border-alt)',
  text:    'var(--color-text)',
  muted:   'var(--color-text-muted)',
  border:  'var(--color-border-dark)',
};

function fmtDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short' });
}

function normPhone(p) {
  let d = String(p || '').replace(/\D/g, '');
  if (d.startsWith('972') && d.length >= 12) d = '0' + d.slice(3);
  return d;
}

export default function MyAppointments({ user, onNavigate }) {
  const [apts, setApts]         = useState([]);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(true);
  const [cancelWindow, setCancelWindow]   = useState({ hours: 24, allow: true });
  const [confirmations, setConfirmations] = useState({});
  const [payments, setPayments]           = useState({});
  const [clinicName, setClinicName]       = useState('התור שלי');
  const [ownerPhone, setOwnerPhone]       = useState('');
  const [ownerName, setOwnerName]         = useState('בעלת העסק');
  const [staffList, setStaffList]         = useState([]);
  const [bitAccount, setBitAccount]       = useState('');
  const [payVisible, setPayVisible]       = useState({ bit: true });

  useEffect(() => { if (user) load(); else setLoading(false); }, [user]);

  useEffect(() => {
    db.settings.get('adminSettings').then(s => {
      setCancelWindow({
        hours: s?.cancellation?.minHours ?? 24,
        allow: s?.cancellation?.allowCancel ?? true,
      });
    });
    db.settings.get('appointmentConfirmations', {}).then(c => setConfirmations(c || {}));
    db.settings.get('appointmentPayments', {}).then(p => setPayments(p || {}));
    db.settings.get('clinicInfo').then(ci => {
      if (ci?.name) setClinicName(ci.name);
      if (ci?.ownerName) setOwnerName(ci.ownerName);
      const p = ci?.ownerPhone || ci?.ownerWhatsapp || ci?.phone || ci?.whatsapp || '';
      setOwnerPhone(normPhone(String(p)));
    });
    if (features.staff) db.staff.list().then(setStaffList);
    // string חופשי — יכול להיות טלפון או URL. PayButtons מזהה ומטפל.
    db.settings.get('bitAccount', '').then(v => setBitAccount(String(v || '').trim()));
    db.settings.get('paymentVisibility', { bit: true }).then(pv => setPayVisible({ bit: pv?.bit !== false }));
  }, []);

  const confirmAttendance = async (aptId) => {
    const updated = { ...confirmations, [aptId]: true };
    setConfirmations(updated);
    await db.settings.set('appointmentConfirmations', updated);
  };

  const load = async () => {
    setLoading(true);
    const data = await db.appointments.byPhone(user.phone);
    setApts(data.sort((a, b) => new Date(`${b.date}T${b.time}`) - new Date(`${a.date}T${a.time}`)));
    setLoading(false);
  };

  const cancel = async (apt) => {
    setError('');
    if (!cancelWindow.allow) { setError('ביטולים אינם מורשים.'); return; }
    const diff = (new Date(`${apt.date}T${apt.time}`) - new Date()) / 3600000;
    if (diff < cancelWindow.hours) {
      setError(`לא ניתן לבטל — פחות מ-${cancelWindow.hours} שעות לתור.`);
      return;
    }
    await db.appointments.cancel(apt.id);
    notifyOwnerCancellation({ clientName: apt.userName, clientPhone: apt.phone, service: apt.serviceName, date: apt.date, time: apt.time });
    load();
  };

  const isUpcoming = (apt) => new Date(`${apt.date}T${apt.time}`) > new Date();

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: C.bg, backgroundImage: 'var(--demo-bg-mat-surface)', backgroundRepeat: 'repeat', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <PageHeader />
        <div style={{ fontSize: 56, marginBottom: 16 }}>📅</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 8 }}>התורים שלי</h2>
        <p style={{ color: C.muted, fontSize: 14, marginBottom: 24 }}>כדי לראות תורים, קבעי תור תחילה</p>
        <button onClick={() => onNavigate('booking')}
          style={{ backgroundColor: C.accent, color: 'var(--color-surface)', borderRadius: 'var(--demo-radius-card)', height: 48, padding: '0 32px', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', boxShadow: '0 4px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)' }}>
          קביעת תור ←
        </button>
      </div>
    );
  }

  const upcoming = apts.filter(a => a.status === 'confirmed' && isUpcoming(a));
  const past     = apts.filter(a => !isUpcoming(a) || a.status === 'cancelled');

  return (
    <div style={{ minHeight: '100vh', backgroundColor: C.bg, backgroundImage: 'var(--demo-bg-mat-surface)', backgroundRepeat: 'repeat' }}>
      <PageHeader />
      <div style={{ padding: '80px 16px 8px' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text }}>התורים שלי</h1>
        <p style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{user.name || user.firstName}</p>
      </div>

      {error && (
        <div style={{ margin: '0 16px 12px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(229,115,115,0.06)', border: '1px solid rgba(229,115,115,0.2)', borderRadius: 'var(--demo-radius-card)' }}>
          <span style={{ fontSize: 13, color: '#E57373' }}>{error}</span>
          <button onClick={() => setError('')} style={{ color: '#E57373', fontSize: 16, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      <div style={{ padding: '0 16px 80px' }}>
        {loading ? (
          <p style={{ textAlign: 'center', color: C.muted, padding: '40px 0' }}>טוענת...</p>
        ) : apts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: 52, marginBottom: 16, opacity: 0.4 }}>📅</div>
            <p style={{ color: C.muted, fontSize: 15, marginBottom: 20 }}>אין תורים קבועים</p>
            <button onClick={() => onNavigate('booking')}
              style={{ backgroundColor: C.accent, color: 'var(--color-surface)', borderRadius: 'var(--demo-radius-card)', height: 48, padding: '0 28px', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', boxShadow: '0 4px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)' }}>
              קביעת תור ראשון ←
            </button>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <p style={{ color: C.accent, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 10 }}>תורים קרובים</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {upcoming.map(apt => (
                    <AptCard
                      key={apt.id} apt={apt} isUpcoming
                      onCancel={() => cancel(apt)}
                      cancelWindow={cancelWindow}
                      confirmed={!!confirmations[apt.id]}
                      onConfirm={() => confirmAttendance(apt.id)}
                      clinicName={clinicName}
                      isPaid={!!payments[apt.id]}
                      ownerPhone={ownerPhone}
                      bitAccount={features.reports && payVisible.bit ? bitAccount : ''}
                      onNavigate={onNavigate}
                      staffName={features.staff && apt.staffId ? (staffList.find(s => s.id === apt.staffId)?.name || '') : ownerName}
                    />
                  ))}
                </div>
              </div>
            )}

            {past.length > 0 && (
              <div>
                <p style={{ color: C.muted, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 10 }}>היסטוריה</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {past.map(apt => (
                    <AptCard key={apt.id} apt={apt} isUpcoming={false} isPaid={!!payments[apt.id]}
                      staffName={features.staff && apt.staffId ? (staffList.find(s => s.id === apt.staffId)?.name || '') : ownerName} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function AptCard({ apt, isUpcoming, onCancel, cancelWindow, confirmed, onConfirm, clinicName, isPaid, ownerPhone, bitAccount, onNavigate, staffName }) {
  const [payOpen, setPayOpen] = useState(false);

  const cancelled     = apt.status === 'cancelled';
  const hoursLeft     = (new Date(`${apt.date}T${apt.time}`) - new Date()) / 3600000;
  const windowH       = cancelWindow?.hours ?? 24;
  const cancelAllowed = cancelWindow?.allow !== false && hoursLeft >= windowH;

  const stripColor  = cancelled ? 'var(--color-border-dark)' : isUpcoming ? 'var(--color-primary)' : 'var(--color-border-dark)';
  const statusLabel = cancelled ? 'בוטל' : isUpcoming ? 'מאושר ✓' : 'הסתיים';
  const statusColor = cancelled ? 'var(--color-text-muted)' : isUpcoming ? '#4CAF50' : 'var(--color-text-muted)';
  const statusBg    = cancelled ? 'var(--color-brown-08)' : isUpcoming ? 'var(--color-success-10)' : 'var(--color-brown-08)';

  const buildCalendarUrl = () => {
    const pad = n => String(n).padStart(2, '0');
    const d = new Date(`${apt.date}T${apt.time}`);
    const fmt = dt => `${dt.getFullYear()}${pad(dt.getMonth()+1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
    const end = new Date(d.getTime() + (apt.serviceDuration || 60) * 60000);
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `${apt.serviceName} — ${clinicName || 'התור שלי'}`,
      dates: `${fmt(d)}/${fmt(end)}`,
      details: `תור ב${clinicName || ''}`,
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  return (
    <>
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        backgroundColor: 'var(--color-surface)', borderRadius: 'var(--demo-radius-card)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-card)',
        opacity: cancelled ? 0.55 : 1,
        overflow: 'hidden',
      }}>
      {/* Top strip */}
      <div style={{ height: 4, backgroundColor: stripColor }} />

      <div style={{ padding: '16px 16px 14px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 19, fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.1 }}>
              ✂️ {apt.serviceName}
            </p>
            {apt.serviceDuration > 0 && (
              <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 11, color: 'var(--color-text-hint)', marginTop: 2 }}>
                {fmtDuration(apt.serviceDuration)}
              </p>
            )}
            <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 12, color: 'var(--color-text-muted)', marginTop: 5, lineHeight: 1.6 }}>
              {fmtDate(apt.date)}<br />{(apt.time || '').slice(0, 5)}
            </p>
            {staffName && (
              <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 11, color: 'var(--color-text-hint)', marginTop: 4 }}>
                עם {staffName}
              </p>
            )}
          </div>
          <div style={{ textAlign: 'end', flexShrink: 0 }}>
            <p style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 22, fontWeight: 700, color: 'var(--color-primary-ink)' }}>₪{apt.price}</p>
            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 10, padding: '3px 10px', borderRadius: 20, fontWeight: 700,
                backgroundColor: statusBg, color: statusColor, fontFamily: 'var(--demo-body-font)',
              }}>
                {statusLabel}
              </span>
              {isPaid && (
                <span style={{
                  fontSize: 10, padding: '3px 10px', borderRadius: 20, fontWeight: 700,
                  backgroundColor: 'rgba(76,175,80,0.12)', color: '#388E3C', fontFamily: 'var(--demo-body-font)',
                }}>
                  ✓ שולם
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action section — upcoming confirmed only */}
        {apt.status === 'confirmed' && isUpcoming && (
          <div style={{ marginTop: 10 }}>
            {(() => {
              const showPayment = !!bitAccount;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

                  {/* Row 1: [payment | confirm] or [confirm full-width] */}
                  <div style={{ display: 'grid', gridTemplateColumns: showPayment ? '1fr 1fr' : '1fr', gap: 8 }}>
                    {showPayment && (isPaid ? (
                      <div style={{ height: 40, borderRadius: 'var(--demo-radius-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(76,175,80,0.10)', border: '1px solid rgba(76,175,80,0.2)' }}>
                        <span style={{ fontFamily: 'var(--demo-body-font)', fontSize: 11, fontWeight: 700, color: '#388E3C' }}>✓ שולם</span>
                      </div>
                    ) : (
                      <motion.button whileTap={{ scale: 0.97 }} onClick={() => setPayOpen(true)}
                        style={{
                          height: 40, borderRadius: 'var(--demo-radius-card)',
                          border: '1.5px solid var(--color-brown-28)',
                          backgroundColor: 'var(--color-brown-04)',
                          color: 'var(--color-primary-ink)',
                          fontFamily: 'var(--demo-body-font)', fontSize: 12, fontWeight: 700,
                          cursor: 'pointer', touchAction: 'manipulation',
                        }}>
                        תשלום ↑
                      </motion.button>
                    ))}

                    {onConfirm && (confirmed ? (
                      <div style={{ height: 40, borderRadius: 'var(--demo-radius-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(76,175,80,0.08)', border: '1px solid rgba(76,175,80,0.2)' }}>
                        <span style={{ fontFamily: 'var(--demo-body-font)', fontSize: 11, fontWeight: 700, color: '#4CAF50' }}>✓ אישרתי</span>
                      </div>
                    ) : (
                      <motion.button whileTap={{ scale: 0.97 }} onClick={onConfirm}
                        style={{
                          height: 40, borderRadius: 'var(--demo-radius-card)',
                          border: '1.5px solid rgba(76,175,80,0.4)',
                          backgroundColor: 'rgba(76,175,80,0.07)',
                          color: '#388E3C', fontFamily: 'var(--demo-body-font)', fontSize: 12, fontWeight: 700,
                          cursor: 'pointer', touchAction: 'manipulation',
                        }}>
                        ✓ אישרתי הגעה
                      </motion.button>
                    ))}
                  </div>

                  {/* Row 2: [calendar | cancel] */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <motion.button whileTap={{ scale: 0.97 }}
                      onClick={() => window.open(buildCalendarUrl(), '_blank', 'noopener')}
                      style={{
                        height: 40, borderRadius: 'var(--demo-radius-card)',
                        border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)',
                        color: 'var(--color-primary-ink)', fontFamily: 'var(--demo-body-font)', fontSize: 12, fontWeight: 500,
                        cursor: 'pointer', touchAction: 'manipulation',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                      }}>
                      📅 יומן Google
                    </motion.button>

                    {cancelWindow?.allow === false ? (
                      <div style={{ height: 40, borderRadius: 'var(--demo-radius-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: '1px solid var(--color-border)' }}>
                        <span style={{ fontFamily: 'var(--demo-body-font)', fontSize: 10, color: 'var(--color-border-dark)', textAlign: 'center' }}>ביטול לא מורשה</span>
                      </div>
                    ) : (
                      <motion.button whileTap={cancelAllowed ? { scale: 0.97 } : {}}
                        onClick={cancelAllowed ? onCancel : undefined}
                        disabled={!cancelAllowed}
                        style={{
                          height: 40, borderRadius: 'var(--demo-radius-card)',
                          border: `1px solid ${cancelAllowed ? 'rgba(229,115,115,0.35)' : '#E8DCC8'}`,
                          backgroundColor: cancelAllowed ? 'rgba(229,115,115,0.05)' : 'transparent',
                          color: cancelAllowed ? '#C62828' : '#C8A882',
                          fontFamily: 'var(--demo-body-font)', fontSize: 12, fontWeight: 500,
                          cursor: cancelAllowed ? 'pointer' : 'not-allowed',
                          touchAction: 'manipulation',
                        }}>
                        ביטול תור
                      </motion.button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Cancellation policy */}
            {cancelWindow?.allow !== false && (
              <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 11, color: cancelAllowed ? '#A89580' : '#A85A4A', textAlign: 'center', marginTop: 6 }}>
                {cancelAllowed
                  ? `ניתן לבטל עד ${windowH} שעות לפני התור`
                  : `לא ניתן לבטל — פחות מ-${windowH} שעות לתור`}
              </p>
            )}
          </div>
        )}
      </div>
    </motion.div>

    {/* Fixed payment bottom sheet */}
    <AnimatePresence>
      {payOpen && !isPaid && !!bitAccount && (
        <>
          <motion.div
            key={`pay-backdrop-${apt.id}`}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ position: 'fixed', inset: 0, zIndex: 90, backgroundColor: 'rgba(44,27,16,0.32)' }}
            onClick={() => setPayOpen(false)}
          />
          <motion.div
            key={`pay-sheet-${apt.id}`}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0,
              backgroundColor: 'var(--color-surface)',
              borderRadius: '20px 20px 0 0',
              zIndex: 91,
              boxShadow: '0 -4px 24px rgba(0,0,0,0.08)',
              paddingBottom: 40,
              direction: 'rtl',
            }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'var(--color-border-dark)' }} />
            </div>
            <div style={{ padding: '8px 20px 14px', borderBottom: '1px solid var(--color-border)' }}>
              <p style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 17, fontWeight: 600, color: 'var(--color-text)' }}>{apt.serviceName}</p>
              <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 22, fontWeight: 700, color: 'var(--color-primary-ink)', marginTop: 2 }}>₪{apt.price}</p>
            </div>
            <div style={{ padding: '16px 20px 12px' }}>
              <PayButtons
                ownerPhone={ownerPhone}
                bitAccount={bitAccount}
                amount={apt.price}
                onPaid={() => setPayOpen(false)}
              />
            </div>
            <div style={{ padding: '0 20px' }}>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => setPayOpen(false)}
                style={{ width: '100%', height: 40, borderRadius: 'var(--demo-radius-card)', border: '1px solid var(--color-border)', backgroundColor: 'transparent', color: 'var(--color-text-muted)', fontFamily: 'var(--demo-body-font)', fontSize: 13, cursor: 'pointer' }}>
                סגירה
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </>
  );
}
