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
function NavTab({ label, active, onClick }) {
  const rm = useReducedMotion();

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
        gap: 5,
        paddingTop: 8,
        paddingBottom: 8,
        overflow: 'visible',   /* card's overflow:hidden clips corners properly */
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
            backgroundColor: 'rgba(var(--color-menu-rgb, 92,61,46), 0.07)',
          }} />
        ) : (
          <motion.div
            layoutId="tab-pill"
            style={{
              position: 'absolute', inset: '4px 2px',
              borderRadius: 10,
              backgroundColor: 'rgba(var(--color-menu-rgb, 92,61,46), 0.07)',
            }}
            transition={{ type: 'spring', stiffness: 500, damping: 38 }}
          />
        )
      )}

      {/* Label */}
      <span style={{
        position: 'relative',
        fontFamily: 'var(--demo-body-font, inherit)',
        fontSize: active ? 11.5 : 11,
        fontWeight: active ? 700 : 400,
        color: active ? 'var(--color-menu)' : 'rgba(var(--color-menu-rgb, 92,61,46), 0.38)',
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

      {/* Active dot */}
      <div style={{ width: 4, height: 4, flexShrink: 0, position: 'relative' }}>
        {active && (
          rm ? (
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              backgroundColor: 'var(--color-menu)',
            }} />
          ) : (
            <motion.div
              layoutId="tab-dot"
              style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                backgroundColor: 'var(--color-menu)',
              }}
              transition={{ type: 'spring', stiffness: 500, damping: 38 }}
            />
          )
        )}
      </div>
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
              <NavTab label="דף הבית"     active={page === 'home'}         onClick={() => onNavigate('home')} />
              <NavTab label="התורים שלי"  active={page === 'appointments'} onClick={() => onNavigate('appointments')} />

              {/* Placeholder — keeps space for the absolute center button */}
              <div style={{ flex: '0 0 auto', width: 110 }} />

              {showStore && (
                <NavTab label="חנות" active={page === 'shop'} onClick={() => onNavigate('shop')} />
              )}

              <NavTab
                label={user ? 'הפרופיל שלי' : 'כניסה'}
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
