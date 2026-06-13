import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

/* ── Keyframes injected once ────────────────────────── */
const SHIMMER_CSS = `
@keyframes bnShimmer {
  0%   { transform: translateX(150%) skewX(-22deg); opacity: 0; }
  5%   { opacity: 0.9; }
  95%  { opacity: 0.9; }
  100% { transform: translateX(-150%) skewX(-22deg); opacity: 0; }
}
@keyframes bnPulse {
  0%, 100% { box-shadow: 0 6px 24px rgba(var(--color-menu-rgb, 92,61,46), 0.28), 0 2px 8px rgba(0,0,0,0.10); }
  50%       { box-shadow: 0 8px 32px rgba(var(--color-menu-rgb, 92,61,46), 0.38), 0 3px 12px rgba(0,0,0,0.14); }
}
`;

/* ── Variants ──────────────────────────────────────── */
const navVariants = {
  hidden: { y: 90, opacity: 0 },
  visible: {
    y: 0, opacity: 1,
    transition: {
      type: 'spring', stiffness: 320, damping: 30,
    },
  },
  exit: { y: 90, opacity: 0, transition: { duration: 0.2 } },
};

/* stagger lives on the inner card wrapper */
const cardVariants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.08 },
  },
};

const tabVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 28 } },
};

/* ── Single nav tab ─────────────────────────────────── */
function NavTab({ label, icon, active, onClick }) {
  const rm = useReducedMotion();
  const activeColor   = 'var(--color-menu)';
  const inactiveColor = 'rgba(var(--color-menu-rgb, 92,61,46), 0.35)';

  return (
    <motion.button
      variants={tabVariants}
      onClick={() => {
        try { navigator.vibrate?.(10); } catch {}
        onClick();
      }}
      whileTap={rm ? {} : { scale: 0.82, y: 2 }}
      style={{
        flex: 1,
        minWidth: 0,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        gap: 3,
        paddingTop: 8,
        paddingBottom: 8,
        overflow: 'visible',
        WebkitTapHighlightColor: 'transparent',
        outline: 'none',
      }}
    >
      {/* Sliding pill background */}
      {active && (
        rm ? (
          <div style={{
            position: 'absolute', inset: '4px 2px',
            borderRadius: 10,
            backgroundColor: 'rgba(var(--color-menu-rgb, 92,61,46), 0.13)',
          }} />
        ) : (
          <motion.div
            layoutId="tab-pill"
            style={{
              position: 'absolute', inset: '4px 2px',
              borderRadius: 10,
              backgroundColor: 'rgba(var(--color-menu-rgb, 92,61,46), 0.13)',
            }}
            transition={{ type: 'spring', stiffness: 500, damping: 38 }}
          />
        )
      )}

      {/* Icon */}
      <span style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: active ? activeColor : inactiveColor,
        transition: rm ? 'none' : 'color 0.18s',
        lineHeight: 0,
      }}>
        {icon}
      </span>

      {/* Label */}
      <span style={{
        position: 'relative',
        fontFamily: 'var(--demo-body-font, inherit)',
        fontSize: active ? 10.5 : 10,
        fontWeight: active ? 700 : 500,
        color: active ? activeColor : inactiveColor,
        letterSpacing: '0.02em',
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: '95%',
        transition: rm ? 'none' : 'color 0.18s, font-size 0.18s',
      }}>
        {label}
      </span>
    </motion.button>
  );
}

/* ── Center CTA — absolutely positioned, floats above card ── */
function CenterTab({ onClick }) {
  const rm = useReducedMotion();

  return (
    /* Wrapper: absolute, centered horizontally, floats above the card */
    <div style={{
      position: 'absolute',
      left: '50%',
      bottom: 9,
      transform: 'translateX(-50%)',
      zIndex: 10,
      pointerEvents: 'none',
    }}>
      <motion.button
        variants={tabVariants}
        onClick={() => {
          try { navigator.vibrate?.([15, 10, 15]); } catch {}
          onClick();
        }}
        whileHover={rm ? {} : { y: -3, boxShadow: '0 10px 28px rgba(var(--color-menu-rgb, 92,61,46), 0.36), 0 3px 10px rgba(0,0,0,0.14)' }}
        whileTap={rm   ? {} : { scale: 0.91, y: 2 }}
        transition={{ type: 'spring', stiffness: 400, damping: 22 }}
        style={{
          overflow: 'visible',
          position: 'relative',

          /* Size */
          height: 46,
          minWidth: 104,
          paddingInline: 14,
          paddingBlock: 0,

          /* Shape */
          borderRadius: 100,
          border: 'none',

          /* Color */
          backgroundColor: 'var(--color-menu)',
          backgroundImage: 'var(--demo-menu-mat-overlay, none)',
          color: 'var(--color-on-menu)',

          /* Typography */
          fontFamily: 'var(--demo-heading-font, var(--demo-body-font, inherit))',
          fontSize: 13.5,
          fontWeight: 600,
          letterSpacing: '0.055em',
          whiteSpace: 'nowrap',
          lineHeight: 1,

          /* Layout */
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',

          /* Shadow */
          boxShadow: '0 6px 24px rgba(var(--color-menu-rgb, 92,61,46), 0.28), 0 2px 8px rgba(0,0,0,0.10)',
          animation: rm ? 'none' : 'bnPulse 3s ease-in-out 2.5s infinite',

          cursor: 'pointer',
          pointerEvents: 'auto',
          WebkitTapHighlightColor: 'transparent',
          outline: 'none',
        }}
      >
        <span style={{ position: 'relative', zIndex: 1 }}>קביעת תור</span>

        {/* Shimmer clipped inside its own wrapper */}
        {!rm && (
          <span aria-hidden="true" style={{
            position: 'absolute', inset: 0, borderRadius: 100,
            overflow: 'hidden', pointerEvents: 'none', zIndex: 0,
          }}>
            <span style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(108deg, transparent 15%, rgba(255,255,255,0.32) 46%, transparent 82%)',
              animation: 'bnShimmer 4.5s ease-in-out 3s infinite',
            }} />
          </span>
        )}
      </motion.button>
    </div>
  );
}

/* ── SVG Icons ───────────────────────────────────────── */
const IcoHome = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z"/>
    <polyline points="9,22 9,12 15,12 15,22"/>
  </svg>
);
const IcoCalendar = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const IcoShop = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <path d="M16 10a4 4 0 0 1-8 0"/>
  </svg>
);
const IcoPerson = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

/* ── Main export ─────────────────────────────────────── */
export default function BottomNav({ page, onNavigate, showStore, user, onProfile }) {
  const [entered, setEntered] = useState(false);
  const [shown,   setShown]   = useState(true);
  const lastScrollY = useRef(0);
  const rm = useReducedMotion();

  /* entrance delay */
  useEffect(() => {
    const t = setTimeout(() => setEntered(true), rm ? 0 : 380);
    return () => clearTimeout(t);
  }, []);

  /* VisualViewport — hide when keyboard opens */
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => setShown(vv.height / window.innerHeight > 0.75);
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  /* scroll-based show/hide */
  useEffect(() => {
    const onScroll = () => {
      const y     = window.scrollY;
      const delta = y - lastScrollY.current;
      if (Math.abs(delta) > 6) setShown(delta < 0 || y < 80);
      lastScrollY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleProfile = () => {
    if (user) onProfile?.();
    else onNavigate('register');
  };

  return (
    <>
      <style>{SHIMMER_CSS}</style>

      <AnimatePresence>
        {entered && (
          <motion.nav
            key="bottom-nav"
            role="navigation"
            aria-label="ניווט ראשי"
            variants={navVariants}
            initial="hidden"
            animate={rm ? 'visible' : (shown ? 'visible' : { y: 100, opacity: 0 })}
            exit="exit"
            transition={shown ? undefined : { type: 'spring', stiffness: 340, damping: 32 }}
            style={{
              position: 'fixed',
              bottom: 'max(12px, calc(env(safe-area-inset-bottom) + 8px))',
              left: 12,
              right: 12,
              zIndex: 100,
              height: 64,
              /* transparent — visual background is on inner card */
              backgroundColor: 'transparent',
              /* overflow visible so center button can float above */
              overflow: 'visible',
              direction: 'rtl',
            }}
          >
            {/*
              ── Inner card: handles background + clips tab pills ──
              RTL order (right → left):
              דף הבית | התורים שלי | [center 110px placeholder] | חנות | כניסה
            */}
            <motion.div
              variants={cardVariants}
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 24,
                overflow: 'hidden',          /* clips tab-pill to rounded corners */
                backgroundColor: 'rgba(255,252,249,0.93)',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                boxShadow: '0 4px 28px rgba(92,61,46,0.14), 0 1px 6px rgba(0,0,0,0.06)',
                display: 'flex',
                flexDirection: 'row',
                direction: 'rtl',
                alignItems: 'stretch',
              }}
            >
              {/* rightmost → leftmost */}
              <NavTab label="דף הבית"    icon={IcoHome}     active={page === 'home'}         onClick={() => onNavigate('home')} />
              <NavTab label="התורים שלי" icon={IcoCalendar}  active={page === 'appointments'} onClick={() => onNavigate('appointments')} />

              {/* Placeholder — keeps space for the absolute center button */}
              <div style={{ flex: '0 0 auto', width: 110 }} />

              {showStore && (
                <NavTab label="חנות" icon={IcoShop} active={page === 'shop'} onClick={() => onNavigate('shop')} />
              )}

              <NavTab
                label={user ? 'הפרופיל שלי' : 'כניסה'}
                icon={IcoPerson}
                active={page === 'register'}
                onClick={handleProfile}
              />
            </motion.div>

            {/* Center CTA — outside the clipped card, floats above */}
            <CenterTab onClick={() => onNavigate('booking')} />
          </motion.nav>
        )}
      </AnimatePresence>
    </>
  );
}
