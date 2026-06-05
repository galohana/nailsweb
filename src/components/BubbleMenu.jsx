import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User } from 'lucide-react';

const ITEMS = [
  { id: 'home',         label: 'דף הבית' },
  { id: 'booking',      label: 'קביעת תור' },
  { id: 'appointments', label: 'התורים שלי' },
  { id: 'gallery',      label: 'גלריה' },
  { id: 'reviews',      label: 'ביקורות' },
  { id: 'contact',      label: 'צרי קשר' },
];

/* hideButton=true: הכפתור הצף לא מוצג (PageHeader מטפל בניווט).
   open/onToggle: מצב controlled — מאפשר לפתוח מ-PageHeader.         */
export default function BubbleMenu({ onNavigate, showStore = false, user, onLogout, onProfile, hideButton, open: extOpen, onToggle }) {
  const [localOpen, setLocalOpen] = useState(false);

  const open  = extOpen !== undefined ? extOpen : localOpen;
  const toggle = () => { if (onToggle) onToggle(); else setLocalOpen(o => !o); };
  const close  = () => { if (onToggle) onToggle(false); else setLocalOpen(false); };

  const items = [...ITEMS, ...(showStore ? [{ id: 'shop', label: 'חנות' }] : [])];

  return (
    <>
      {/* Floating hamburger — מוסתר בעמודי-תת (PageHeader מחליף) */}
      {!hideButton && (
        <motion.button
          onClick={toggle}
          whileTap={{ scale: 0.92 }}
          style={{
            position: 'fixed', top: 'calc(8px + env(safe-area-inset-top))', right: 16, zIndex: 101,
            width: 44, height: 44, borderRadius: 'var(--demo-radius-card)',
            backgroundColor: 'rgba(253,250,247,0.15)',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(253,250,247,0.3)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 5,
            cursor: 'pointer',
          }}
        >
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              animate={open ? {
                rotate: i === 0 ? 45 : i === 2 ? -45 : 0,
                y: i === 0 ? 7 : i === 2 ? -7 : 0,
                opacity: i === 1 ? 0 : 1,
              } : { rotate: 0, y: 0, opacity: 1 }}
              style={{ width: 18, height: 1.5, backgroundColor: 'var(--color-surface)', borderRadius: 2 }}
            />
          ))}
        </motion.button>
      )}

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={close}
              style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 98 }}
            />
            <motion.div
              key="panel"
              initial={{ opacity: 0, scale: 0.5, x: 20, y: -20 }}
              animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, x: 20, y: -20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              style={{
                position: 'fixed', top: 'calc(60px + env(safe-area-inset-top))', right: 16,
                background: 'rgba(253,250,247,0.75)',
                backdropFilter: 'blur(24px) saturate(180%)',
                WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                border: '1px solid rgba(255,255,255,0.6)',
                borderRadius: 20, padding: 8,
                zIndex: 99, minWidth: 200,
                boxShadow: '0 2px 16px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04)',
                transformOrigin: 'top right',
              }}
            >
              {items.map(({ id, label }, i, arr) => (
                <React.Fragment key={id}>
                  <motion.button
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => { onNavigate(id); close(); }}
                    style={{
                      display: 'block', width: '100%', padding: '12px 16px',
                      backgroundColor: 'transparent', border: 'none', borderRadius: 'var(--demo-radius-card)',
                      fontFamily: 'var(--demo-heading-font)', fontSize: 17, fontWeight: 500,
                      color: 'var(--color-text)', textAlign: 'right', cursor: 'pointer',
                    }}
                  >
                    {label}
                  </motion.button>
                  {i < arr.length - 1 && (
                    <div style={{ height: 0.5, backgroundColor: 'rgba(92,61,46,0.15)', margin: '0 12px' }} />
                  )}
                </React.Fragment>
              ))}

              <div style={{ height: 0.5, backgroundColor: 'rgba(92,61,46,0.2)', margin: '4px 12px' }} />

              {user && (
                <>
                  <motion.button
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                    onClick={() => { onProfile?.(); close(); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px 16px', backgroundColor: 'transparent', border: 'none', borderRadius: 'var(--demo-radius-card)', fontFamily: 'var(--demo-heading-font)', fontSize: 16, color: 'var(--color-text)', textAlign: 'right', cursor: 'pointer' }}
                  >
                    <User size={15} color="#7D5A47" />
                    הפרופיל שלי
                  </motion.button>
                  <div style={{ height: 0.5, backgroundColor: 'rgba(92,61,46,0.12)', margin: '0 12px' }} />
                </>
              )}

              {user ? (
                <motion.button
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
                  onClick={() => { onLogout?.(); close(); }}
                  style={{ display: 'block', width: '100%', padding: '12px 16px', backgroundColor: 'transparent', border: 'none', borderRadius: 'var(--demo-radius-card)', fontFamily: 'var(--demo-heading-font)', fontSize: 16, color: 'var(--color-text-muted)', textAlign: 'right', cursor: 'pointer' }}
                >
                  יציאה מהחשבון
                </motion.button>
              ) : (
                <motion.button
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                  onClick={() => { onNavigate('register'); close(); }}
                  style={{ display: 'block', width: '100%', padding: '12px 16px', backgroundColor: 'transparent', border: 'none', borderRadius: 'var(--demo-radius-card)', fontFamily: 'var(--demo-heading-font)', fontSize: 16, color: 'var(--color-text-muted)', textAlign: 'right', cursor: 'pointer' }}
                >
                  הרשמה / כניסה
                </motion.button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
