import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, BellRing, X, Check } from 'lucide-react';
import { isPushSupported, isPushGranted, subscribeToPush } from '../utils/pushNotification';

const LS_CLIENT_DISMISSED = 'rise_push_client_dismissed';

function isIphone() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent || '');
}

/* ── PushPrompt — כרטיס הפעלת התראות ──
   mode="client" → כרטיס עדין אחרי קביעת תור (user_identifier = טלפון)
   mode="admin"  → כרטיס בולט בראש האדמין (user_identifier = 'admin') */
export default function PushPrompt({ mode, userIdentifier, welcomeText }) {
  const [phase, setPhase] = useState('hidden'); // hidden | offer | granted | denied | working
  const ios = isIphone();

  useEffect(() => {
    if (typeof window === 'undefined' || !isPushSupported()) { setPhase('hidden'); return; }
    let cancelled = false;
    (async () => {
      let hasSub = false;
      try { const r = await navigator.serviceWorker.ready; hasSub = !!(await r.pushManager.getSubscription()); } catch {}
      if (cancelled) return;
      if (hasSub && isPushGranted()) { setPhase(mode === 'admin' ? 'granted' : 'hidden'); return; }
      if (mode === 'client' && localStorage.getItem(LS_CLIENT_DISMISSED) === '1') { setPhase('hidden'); return; }
      setPhase('offer');
    })();
    return () => { cancelled = true; };
  }, [mode]);

  const enable = async () => {
    setPhase('working');
    const res = await subscribeToPush(mode, userIdentifier);
    if (res.ok) {
      setPhase('granted');
      if (mode === 'client') {
        fetch('/api/notify', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'welcome', clientPhone: userIdentifier }),
        }).catch(() => {});
      }
      if (mode === 'client') { try { localStorage.setItem(LS_CLIENT_DISMISSED, '1'); } catch {} }
    } else if (res.reason === 'denied') {
      setPhase('denied');
    } else {
      setPhase('denied');
    }
  };

  const dismiss = () => {
    setPhase('hidden');
    if (mode === 'client') { try { localStorage.setItem(LS_CLIENT_DISMISSED, '1'); } catch {} }
  };

  if (phase === 'hidden') return null;

  if (phase === 'granted') {
    if (mode === 'client') return null;
    return (
      <div style={{ ...cardBase, display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
        <Check size={18} color="var(--color-success, #4CAF50)" />
        <span style={{ fontFamily: 'var(--demo-body-font)', fontSize: 14, fontWeight: 600, color: 'var(--color-on-card-tint, var(--color-text))' }}>
          התראות פעילות ✅
        </span>
      </div>
    );
  }

  const isAdmin = mode === 'admin';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        style={{ ...cardBase, ...(isAdmin ? cardAdmin : {}) }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{
            flexShrink: 0, width: 40, height: 40, borderRadius: 'var(--radius-full, 999px)',
            backgroundColor: 'var(--color-primary)', backgroundImage: 'var(--demo-primary-mat-overlay, none)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {phase === 'denied'
              ? <BellRing size={20} color="var(--color-on-primary, #fff)" />
              : <Bell size={20} color="var(--color-on-primary, #fff)" />}
          </div>

          <div style={{ flex: 1 }}>
            <h4 style={{ fontFamily: 'var(--demo-heading-font)', fontSize: isAdmin ? 17 : 16, fontWeight: 700, color: 'var(--color-on-card-tint, var(--color-text))', margin: '0 0 4px' }}>
              {phase === 'denied'
                ? 'איך מפעילים התראות'
                : isAdmin ? '📲 קבלי התראות על העסק שלך' : 'רוצה תזכורת לפני התור? 🔔'}
            </h4>

            <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-muted, #7D5A47)', margin: 0 }}>
              {phase === 'denied'
                ? (ios
                    ? 'פתחי את האתר מהאייקון במסך הבית, ואז אפשרי התראות מההגדרות.'
                    : 'אפשרי התראות מהגדרות הדפדפן (🔒 ליד הכתובת ← Notifications ← Allow).')
                : isAdmin
                  ? (ios
                      ? 'פתחי את כפתור השיתוף ← "הוסף למסך הבית". פתחי מהאייקון ← אפשרי התראות.'
                      : 'חשוב: פתחי דף זה ב-Chrome (לא Samsung Internet). תפריט ← "הוסף למסך הבית", פתחי מהאייקון ← אשרי התראות.')
                  : 'הורידי את האתר למסך הבית וקבלי התראה לפני התור'}
            </p>

            {phase !== 'denied' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <motion.button whileTap={{ scale: 0.97 }} onClick={enable} disabled={phase === 'working'}
                  style={btnPrimary}>
                  {phase === 'working' ? 'מפעיל…' : isAdmin ? 'אפשרי התראות' : 'כן, אני רוצה'}
                </motion.button>
                {!isAdmin && (
                  <motion.button whileTap={{ scale: 0.97 }} onClick={dismiss} style={btnGhost}>
                    לא תודה
                  </motion.button>
                )}
              </div>
            )}
          </div>

          {!isAdmin && phase !== 'denied' && (
            <button onClick={dismiss} aria-label="סגור" style={closeBtn}><X size={16} /></button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

const cardBase = {
  position: 'relative',
  backgroundColor: 'var(--color-card-tint, var(--color-surface))',
  backgroundImage: 'var(--color-tint-mat-overlay, none)',
  border: '1px solid rgba(var(--color-card-tint-rgb, 253,250,247), 0.6)',
  borderRadius: 'var(--demo-radius-card, 16px)',
  boxShadow: 'var(--demo-shadow-card)',
  padding: 16,
  marginTop: 16,
};
const cardAdmin = {
  border: '1.5px solid var(--color-primary)',
  boxShadow: 'var(--demo-shadow-deep, 0 8px 28px rgba(0,0,0,0.18))',
  marginBottom: 16,
};
const btnPrimary = {
  flex: 1, height: 44, border: 'none', cursor: 'pointer',
  borderRadius: 'var(--demo-radius-card)',
  backgroundColor: 'var(--color-primary)', backgroundImage: 'var(--demo-primary-mat-overlay, none)',
  color: 'var(--color-on-primary, #FDFAF7)',
  fontFamily: 'var(--demo-body-font)', fontSize: 14, fontWeight: 700,
  boxShadow: 'var(--demo-shadow-card)',
};
const btnGhost = {
  height: 44, padding: '0 16px', cursor: 'pointer',
  borderRadius: 'var(--demo-radius-card)',
  backgroundColor: 'transparent', border: '1px solid var(--color-border, #E8DCC8)',
  color: 'var(--color-text-muted, #7D5A47)',
  fontFamily: 'var(--demo-body-font)', fontSize: 13, fontWeight: 500,
};
const closeBtn = {
  flexShrink: 0, width: 26, height: 26, borderRadius: '50%', border: 'none',
  background: 'transparent', color: 'var(--color-text-muted, #7D5A47)',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
};
