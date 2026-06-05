import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { db } from '../utils/db';
import { DEFAULT_CLINIC_INFO } from '../utils/defaults';

/* ── PageHeader — header מאוחד לעמודי-תת (Booking / Shop / MyAppointments)
   ┌──────────────────────────────────────────────────────────┐
   │                   כותרת העמוד                  [→ חזרה]   │
   └──────────────────────────────────────────────────────────┘
   • כפתור חזרה במיקום inlineEnd (שמאל ב-RTL) — במקום ההמבורגר.
   • paddingTop: env(safe-area-inset-top) → הבר יושב מתחת ל-notch/Dynamic Island.
   • z-index 102.                                                       */

export default function PageHeader({ onBack, title }) {
  const [name, setName] = useState('');

  useEffect(() => {
    db.settings.get('clinicInfo', DEFAULT_CLINIC_INFO).then(ci => {
      if (ci?.name) setName(ci.name);
    });
  }, []);

  const ICON_BTN = {
    width: 40, height: 40, borderRadius: 'var(--demo-radius-card, 12px)',
    backgroundColor: 'rgba(255,255,255,0.14)',
    border: '1px solid rgba(255,255,255,0.28)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', flexShrink: 0, color: 'var(--color-surface)',
    WebkitTapHighlightColor: 'transparent',
  };

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 102,
      paddingTop: 'env(safe-area-inset-top)',
      backgroundColor: 'var(--color-primary)',
      backgroundImage: 'var(--demo-navbar-mat-overlay, none)',
      boxShadow: 'var(--shadow-sm)',
      direction: 'rtl',
    }}>
      <div style={{ height: 56, display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px' }}>
        {/* spacer inlineStart (ימין ב-RTL) — לאיזון מרכוז הכותרת */}
        <div style={{ width: 40, flexShrink: 0 }} />

        {/* כותרת ממורכזת */}
        <span style={{
          flex: 1, textAlign: 'center',
          fontFamily: 'var(--font-display)',
          fontSize: 20, fontWeight: 500, letterSpacing: '0.06em',
          color: 'var(--color-surface)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {title || name}
        </span>

        {/* כפתור חזרה — inlineEnd (שמאל ב-RTL), במקום ההמבורגר */}
        {onBack ? (
          <motion.button onClick={onBack} whileTap={{ scale: 0.9 }} style={ICON_BTN} aria-label="חזרה">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
          </motion.button>
        ) : <div style={{ width: 40, flexShrink: 0 }} />}
      </div>
    </nav>
  );
}
