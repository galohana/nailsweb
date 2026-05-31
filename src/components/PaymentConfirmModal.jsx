import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X } from 'lucide-react';

const C = {
  bg:      'rgba(45,27,30,0.55)',
  surface: 'var(--color-surface)',
  accent:  '#6B4F3A',
  text:    'var(--color-text)',
  muted:   '#8B6E52',
  border:  '#D4B896',
  success: '#4CAF50',
  danger:  '#A85A4A',
};

// open: boolean
// amount: number (₪)
// method: 'bit'  (אחרי הסרת PayBox — תמיד 'bit'. ה-prop נשאר כדי לא לשבור קוראים.)
// onConfirm: () => void   — user clicked "I paid" (async, receipt sent by admin later)
// onCancel: () => void    — user clicked "cancel"
export default function PaymentConfirmModal({ open, amount, method, onConfirm, onCancel }) {
  const [phase, setPhase] = useState('ask'); // 'ask' | 'success'

  const handleConfirm = () => {
    setPhase('success');
    try { navigator.vibrate?.([30, 20, 30]); } catch {}
    setTimeout(() => {
      onConfirm?.();
      setPhase('ask');
    }, 1600);
  };

  const handleCancel = () => {
    setPhase('ask');
    onCancel?.();
  };

  // Bit only (PayBox removed)
  const methodLabel = 'Bit';
  const methodGradient = 'linear-gradient(135deg, #0099FF 0%, #0066CC 100%)';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            backgroundColor: C.bg,
            backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
            direction: 'rtl',
          }}
        >
          <motion.div
            initial={{ scale: 0.85, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.85, y: 30, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 22 }}
            style={{
              backgroundColor: C.surface,
              borderRadius: 24,
              padding: '32px 24px 24px',
              width: '100%', maxWidth: 360,
              boxShadow: '0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
              border: `1px solid ${C.border}`,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Subtle gradient accent at top */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 4,
              background: methodGradient,
            }} />

            <AnimatePresence mode="wait">
              {phase === 'ask' ? (
                <motion.div
                  key="ask"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                >
                  <div style={{ textAlign: 'center', marginBottom: 20 }}>
                    <div style={{
                      display: 'inline-block', padding: '8px 16px',
                      background: methodGradient,
                      color: 'var(--color-surface)', borderRadius: 24,
                      fontFamily: 'var(--demo-heading-font)',
                      fontSize: 18, fontWeight: 700, letterSpacing: '0.04em',
                      boxShadow: '0 4px 14px rgba(0,153,255,0.30)',
                    }}>
                      {methodLabel}
                    </div>
                  </div>

                  <p style={{
                    fontFamily: 'var(--demo-heading-font)',
                    fontSize: 24, fontWeight: 600,
                    color: C.text, textAlign: 'center', marginBottom: 6, lineHeight: 1.2,
                  }}>
                    האם השלמת את התשלום?
                  </p>
                  <p style={{
                    fontFamily: 'var(--demo-body-font)',
                    fontSize: 13, color: C.muted, textAlign: 'center', marginBottom: 20, lineHeight: 1.6,
                  }}>
                    סכום: <span style={{ color: C.accent, fontWeight: 700, fontSize: 16 }}>₪{amount}</span>
                    <br />
                    יש לאשר רק לאחר ביצוע התשלום באפליקציה
                  </p>

                  <motion.button
                    whileTap={{ scale: 0.97 }} whileHover={{ scale: 1.02 }}
                    onClick={handleConfirm}
                    style={{
                      width: '100%', height: 52, borderRadius: 'var(--demo-radius-card)', border: 'none',
                      backgroundColor: C.success, color: '#FFFFFF',
                      fontFamily: 'var(--demo-body-font)', fontSize: 15, fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      boxShadow: '0 6px 18px rgba(76,175,80,0.35)',
                      marginBottom: 10,
                    }}
                  >
                    <Check size={18} strokeWidth={2.5} />
                    אישרתי שהתשלום התבצע
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleCancel}
                    style={{
                      width: '100%', height: 46, borderRadius: 'var(--demo-radius-card)',
                      border: `1.5px solid ${C.danger}`,
                      backgroundColor: 'transparent', color: C.danger,
                      fontFamily: 'var(--demo-body-font)', fontSize: 14, fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    <X size={16} />
                    ביטול / לא שילמתי
                  </motion.button>
                </motion.div>
              ) : (
                <motion.div
                  key="success"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ textAlign: 'center', padding: '12px 0' }}
                >
                  <motion.div
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 14 }}
                    style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}
                  >
                    <svg viewBox="0 0 80 80" width="100" height="100">
                      <motion.circle
                        cx="40" cy="40" r="36" fill="none" stroke={C.success} strokeWidth="3"
                        strokeDasharray="226"
                        initial={{ strokeDashoffset: 226 }} animate={{ strokeDashoffset: 0 }}
                        transition={{ duration: 0.55, ease: 'easeOut' }}
                      />
                      <motion.path
                        d="M24 40l12 12 20-22" fill="none" stroke={C.success}
                        strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
                        strokeDasharray="50"
                        initial={{ strokeDashoffset: 50 }} animate={{ strokeDashoffset: 0 }}
                        transition={{ duration: 0.4, delay: 0.4, ease: 'easeOut' }}
                      />
                    </svg>
                  </motion.div>
                  <motion.p
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7, duration: 0.4 }}
                    style={{
                      fontFamily: 'var(--demo-heading-font)',
                      fontSize: 26, fontWeight: 600, color: C.text, marginBottom: 6,
                    }}
                  >
                    תודה! הקבלה תגיע בקרוב ✨
                  </motion.p>
                  <motion.p
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: 0.9 }}
                    style={{ fontFamily: 'var(--demo-body-font)', fontSize: 13, color: C.muted }}
                  >
                    קיבלנו את אישורך לתשלום דרך {methodLabel} 💕
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
