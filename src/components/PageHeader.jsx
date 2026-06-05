import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { db } from '../utils/db';
import { DEFAULT_CLINIC_INFO } from '../utils/defaults';

/* ── PageHeader — header לעמודי-תת (Booking / Shop / MyAppointments)
   ┌─────────────────────────────────────────────────────────────────┐
   │ [← חזרה]         שם הקליניקה / כותרת         [☰ תפריט]        │
   └─────────────────────────────────────────────────────────────────┘
   RTL: back בצד ימין (inlineStart), hamburger בצד שמאל (inlineEnd).
   z-index 102 — מעל ה-BubbleMenu הצף (101).                         */

export default function PageHeader({ onMenuOpen, onBack, title }) {
  const [name, setName] = useState('');

  useEffect(() => {
    db.settings.get('clinicInfo', DEFAULT_CLINIC_INFO).then(ci => {
      if (ci?.name) setName(ci.name);
    });
  }, []);

  const BTN = {
    width: 42, height: 42, borderRadius: 'var(--demo-radius-card)',
    backgroundColor: 'transparent', border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', flexShrink: 0,
    color: 'var(--demo-navbar-text, var(--color-primary))',
  };

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0,
      height: 60, zIndex: 102,
      backgroundColor: 'var(--demo-navbar-bg, rgba(242,232,220,0.96))',
      backgroundImage: 'var(--demo-navbar-mat-overlay, none)',
      backdropFilter: 'var(--demo-navbar-blur, blur(16px))',
      WebkitBackdropFilter: 'var(--demo-navbar-blur, blur(16px))',
      borderBottom: '1px solid rgba(0,0,0,0.08)',
      boxShadow: 'var(--demo-shadow-card)',
      display: 'flex', alignItems: 'center',
      padding: '0 6px',
      direction: 'rtl',
    }}>

      {/* חץ חזרה — inlineStart (ימין ב-RTL) */}
      {onBack ? (
        <motion.button onClick={onBack} whileTap={{ scale: 0.90 }} style={BTN}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </motion.button>
      ) : (
        <div style={{ width: 42, flexShrink: 0 }} />
      )}

      {/* כותרת — ממורכזת */}
      <span style={{
        flex: 1, textAlign: 'center',
        fontFamily: title ? 'var(--demo-body-font)' : 'var(--demo-body-font)',
        fontSize: title ? 17 : 19,
        fontWeight: title ? 700 : 300,
        letterSpacing: title ? '0.02em' : '0.12em',
        color: 'var(--demo-navbar-text, var(--color-primary))',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        padding: '0 4px',
      }}>
        {title || name}
      </span>

      {/* המבורגר — inlineEnd (שמאל ב-RTL) */}
      {onMenuOpen ? (
        <motion.button onClick={onMenuOpen} whileTap={{ scale: 0.90 }} style={BTN}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4.5 }}>
            {[0,1,2].map(i => (
              <span key={i} style={{
                display: 'block', width: 17, height: 1.5, borderRadius: 2,
                backgroundColor: 'var(--demo-navbar-text, var(--color-primary))',
              }} />
            ))}
          </div>
        </motion.button>
      ) : (
        <div style={{ width: 42, flexShrink: 0 }} />
      )}
    </nav>
  );
}
