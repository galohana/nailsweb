import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../utils/db';

const DAY_HE = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];

function fmtDate(d) {
  const dt = new Date(d + 'T00:00:00');
  return `${DAY_HE[dt.getDay()]}, ${dt.getDate()}/${dt.getMonth()+1}`;
}

export default function UrgentBooking({ open, onOpen, onClose, onBook }) {
  const [slots, setSlots]       = useState([]);
  const [wh, setWh]             = useState(null);
  const [services, setServices] = useState([]);

  useEffect(() => {
    Promise.all([
      db.settings.get('workingHours'),
      db.services.list(),
    ]).then(([w, svcs]) => {
      setWh(w);
      setServices(svcs);
    });
  }, []);

  useEffect(() => {
    if (!open || !wh || !services.length) return;
    buildSlots();
  }, [open, wh, services]);

  async function buildSlots() {
    const now = new Date();
    const today = new Date(now); today.setHours(0,0,0,0);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const maxDate = new Date(today); maxDate.setDate(today.getDate() + (wh.weeksAhead || 4) * 7);
    const result = [];
    for (let d = new Date(today); d <= maxDate && result.length < 7; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      const cfg = wh.days[dow];
      if (!cfg?.active) continue;
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const booked = await db.appointments.byDate(ds);
      const toMin = t => { const [h,m] = t.split(':').map(Number); return h*60+m; };
      const dur = 30;
      let cur = toMin(cfg.start);
      // today — skip slots that started less than 30 min from now
      if (ds === todayStr) cur = Math.max(cur, nowMin + 30);
      const end = toMin(cfg.end);
      while (cur + dur <= end && result.length < 7) {
        const slot = `${String(Math.floor(cur/60)).padStart(2,'0')}:${String(cur%60).padStart(2,'0')}`;
        const free = !booked.some(b => {
          const bStart = toMin(b.time);
          const bDur   = b.serviceDuration || dur;
          return cur < bStart + bDur && cur + dur > bStart;
        });
        if (free) result.push({ date: ds, time: slot });
        cur += dur;
      }
    }
    setSlots(result);
  }

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            key="bubble"
            layoutId="urgent-bubble"
            onClick={onOpen}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{
              position: 'fixed', bottom: 24, left: 24,
              width: 56, height: 56, borderRadius: '50%',
              backgroundColor: 'var(--color-section)',
              backgroundImage: 'var(--demo-section-mat-overlay-sm, none)',
              border: 'var(--demo-section-mat-border, 3px solid rgba(255,255,255,0.55))',
              boxShadow: '0 4px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 24, zIndex: 50,
            }}
          >
            ⏰
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ position: 'fixed', inset: 0, zIndex: 60, backgroundColor: 'rgba(45,27,30,0.35)' }}
              onClick={onClose}
            />
            <motion.div
              key="panel"
              layoutId="urgent-bubble"
              initial={{ borderRadius: '50%' }}
              animate={{ borderRadius: '16px' }}
              exit={{ borderRadius: '50%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              style={{
                position: 'fixed', bottom: 24, left: 16, right: 16,
                height: '50vh',
                backgroundColor: 'var(--color-section)',
                backgroundImage: 'var(--demo-section-mat-overlay-sm, none)',
                border: 'var(--demo-section-mat-border, none)',
                zIndex: 100,
                overflowY: 'auto',
                maxWidth: 390, margin: '0 auto',
              }}
            >
              <div style={{ padding: '20px 20px 24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-surface)', margin: 0 }}>⏰ תור דחוף</h3>
                    <p style={{ fontSize: 13, color: 'rgba(253,250,247,0.75)', marginTop: 4 }}>אחותי, צריכה תור דחוףףף 🔥</p>
                  </div>
                  <button
                    onClick={onClose}
                    style={{ background: 'none', border: 'none', color: 'rgba(253,250,247,0.8)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}
                  >✕</button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {slots.length === 0 ? (
                    <p style={{ color: 'rgba(253,250,247,0.7)', fontSize: 14, textAlign: 'center', paddingTop: 24 }}>מחשבת תורים פנויים...</p>
                  ) : (
                    <>
                      <p style={{ color: 'rgba(253,250,247,0.65)', fontSize: 12, marginBottom: 10 }}>7 התורים הקרובים הפנויים:</p>
                      {slots.map((s, i) => (
                        <button
                          key={i}
                          onClick={onBook}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 12px', borderRadius: 'var(--demo-radius-card)', marginBottom: 8,
                            backgroundColor: 'rgba(253,250,247,0.12)',
                            border: '1px solid rgba(253,250,247,0.25)',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ color: 'var(--color-surface)', fontWeight: 600, fontSize: 14, margin: 0 }}>{fmtDate(s.date)}</p>
                            <p style={{ color: 'rgba(253,250,247,0.7)', fontSize: 12, marginTop: 2 }}>{s.time}</p>
                          </div>
                          <span style={{ backgroundColor: 'rgba(253,250,247,0.9)', color: 'var(--color-section)', borderRadius: 7, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>
                            קביעה ←
                          </span>
                        </button>
                      ))}
                    </>
                  )}
                </div>

                <button
                  onClick={onBook}
                  style={{
                    width: '100%', height: 44, borderRadius: 'var(--demo-radius-card)', marginTop: 12,
                    backgroundColor: 'rgba(253,250,247,0.9)', color: 'var(--color-section)',
                    border: 'none', fontWeight: 700, fontSize: 15, cursor: 'pointer',
                  }}
                >
                  לכל התורים הפנויים ←
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
