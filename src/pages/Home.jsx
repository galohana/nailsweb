import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { db } from '../utils/db';
import { digitsOnly } from '../utils/format';
import { DEFAULT_ABOUT, DEFAULT_HERO, DEFAULT_CLINIC_INFO, DEFAULT_REVIEWS, DEFAULT_GALLERY } from '../utils/defaults';

const C = {
  bg:      'var(--color-bg)',
  surface: 'var(--color-surface)',
  accent:  'var(--color-primary)',
  brown:   'var(--color-primary)',
  text:    'var(--color-primary)',
  muted:   '#8B6E52',
  border:  '#C8A882',
  sec:     'var(--color-bg)',
};

const FEAT_REVIEWS = import.meta.env.VITE_FEATURE_REVIEWS !== 'false';
const FEAT_GALLERY = import.meta.env.VITE_FEATURE_GALLERY !== 'false';

function btnPrimary(extra) {
  return {
    backgroundColor: 'var(--color-surface)', color: 'var(--color-primary-ink)',
    border: '1.5px solid #5C3D2E', borderRadius: 'var(--demo-radius-card)', fontWeight: 600,
    fontSize: 15, cursor: 'pointer',
    boxShadow: 'var(--demo-shadow-card)',
    fontFamily: 'var(--demo-body-font)',
    ...extra,
  };
}
function btnOutline(extra) {
  return {
    backgroundColor: 'var(--color-surface)', color: 'var(--color-primary-ink)',
    border: '1.5px solid #5C3D2E',
    borderRadius: 'var(--demo-radius-card)', fontWeight: 600,
    fontSize: 14, cursor: 'pointer',
    fontFamily: 'var(--demo-body-font)',
    ...extra,
  };
}

// ── Fade-in section wrapper ───────────────────────────────────
function FadeSection({ children, style, leopard }) {
  const reduced = useReducedMotion();
  return (
    <motion.section
      className={leopard ? 'leopard-section' : ''}
      initial={reduced ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, ease: 'easeOut' }}
      style={{ padding: '96px 20px', ...style }}
    >
      {children}
    </motion.section>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 style={{
      fontSize: 22, fontWeight: 300, color: C.accent,
      textAlign: 'center', marginBottom: 28, letterSpacing: '0.05em',
      fontFamily: 'var(--demo-heading-font)',
    }}>
      {children}
    </h2>
  );
}

function Stars({ rating }) {
  return (
    <span>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ color: i <= rating ? '#C49A3C' : C.border, fontSize: 15 }}>★</span>
      ))}
    </span>
  );
}

// ── Hero section — arch design + RAF parallax ────────────────
function Hero({ user, hero, onNavigate, visible, businessLogo }) {
  const bgRef  = useRef(null);
  const rafRef = useRef(null);
  const scrollRef = useRef(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const onScroll = () => { scrollRef.current = window.scrollY; };
    window.addEventListener('scroll', onScroll, { passive: true });

    const tick = () => {
      if (bgRef.current) {
        bgRef.current.style.transform = `scale(1.15) translateY(${scrollRef.current * 0.25}px)`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [reduced]);

  const IMG_H = '60vh';

  return (
    <div style={{ position: 'relative', height: '100vh', overflow: 'hidden', backgroundColor: C.bg }}>

      {/* Photo — top 60% */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: IMG_H, overflow: 'hidden',
      }}>
        <div
          ref={bgRef}
          style={{
            position: 'absolute', inset: -20,
            backgroundImage: `url('${hero?.imageUrl || DEFAULT_HERO.imageUrl}')`,
            backgroundSize: 'cover', backgroundPosition: 'center',
            willChange: 'transform',
          }}
        />
        {/* Light overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(44,24,16,0.08) 0%, rgba(44,24,16,0.22) 100%)',
        }} />
      </div>

      {/* Dark brown arch at bottom of image */}
      <div style={{
        position: 'absolute',
        top: `calc(${IMG_H} - 64px)`,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '150%',
        height: 128,
        backgroundColor: C.accent,
        borderRadius: '55% 55% 0 0',
        boxShadow: '0 -16px 40px rgba(253,250,247,0.70)',
        zIndex: 2,
      }}>
        {/* Round logo on arch boundary */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: visible ? 1 : 0, opacity: visible ? 1 : 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 18, delay: 0.3 }}
          style={{
            position: 'absolute', top: -38,
            left: '50%', transform: 'translateX(-50%)',
            width: 80, height: 80, borderRadius: '50%',
            backgroundColor: 'var(--color-bg)',
            border: '1px solid #8B6E52',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--demo-shadow-card)',
            zIndex: 4,
          }}
        >
          {businessLogo ? (
            <img
              src={businessLogo}
              alt="לוגו"
              style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'contain' }}
            />
          ) : (
            <span style={{
              fontFamily: 'var(--demo-heading-font)',
              fontSize: 15, fontWeight: 400, letterSpacing: '0.06em',
              color: 'var(--color-primary-ink)', whiteSpace: 'nowrap',
            }}>RISE ⚡</span>
          )}
        </motion.div>
      </div>

      {/* Content area — below arch */}
      <div style={{
        position: 'absolute',
        top: `calc(${IMG_H} + 52px)`,
        left: 0, right: 0, bottom: 0,
        backgroundColor: C.bg,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '0 28px 24px',
        zIndex: 1,
      }}>
        {/* Clinic name */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 12 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          style={{
            fontSize: 46, fontWeight: 300, letterSpacing: '0.16em',
            color: C.text, marginBottom: 6, textAlign: 'center',
            fontFamily: 'var(--demo-heading-font)',
          }}
        >
          Eyebrows
        </motion.h1>

        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: visible ? 1 : 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          style={{ width: 44, height: 1.5, backgroundColor: C.border, marginBottom: 16, borderRadius: 2 }}
        />

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: visible ? 1 : 0 }}
          transition={{ duration: 0.6, delay: 0.85 }}
          style={{ color: C.muted, fontSize: 14, textAlign: 'center', marginBottom: 28, lineHeight: 1.6 }}
        >
          {user
            ? `שלום ${user.firstName || user.name}, כיף שחזרת 💕`
            : 'ברוכה הבאה ✨'}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 14 }}
          transition={{ duration: 0.6, delay: 1.0 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}
        >
          <motion.button
            onClick={() => onNavigate('booking')}
            whileTap={{ scale: 0.98 }}
            style={{ ...btnPrimary({ height: 52, width: '100%', fontSize: 16 }) }}
          >
            קביעי תור עכשיו ←
          </motion.button>

          {user ? (
            <motion.button
              onClick={() => onNavigate('appointments')}
              whileTap={{ scale: 0.98 }}
              style={{
                height: 44, width: '100%', borderRadius: 'var(--demo-radius-card)',
                border: '1.5px solid #5C3D2E', backgroundColor: 'var(--color-surface)',
                color: 'var(--color-primary-ink)', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--demo-body-font)',
              }}
            >
              התורים שלי
            </motion.button>
          ) : (
            <motion.button
              onClick={() => onNavigate('register')}
              whileTap={{ scale: 0.98 }}
              style={{
                height: 44, width: '100%', borderRadius: 'var(--demo-radius-card)',
                border: '1.5px solid #5C3D2E', backgroundColor: 'var(--color-surface)',
                color: 'var(--color-primary-ink)', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--demo-body-font)',
              }}
            >
              הרשמה / כניסה
            </motion.button>
          )}
        </motion.div>
      </div>

      {/* Scroll indicator — on photo */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: visible ? 0.75 : 0 }}
        transition={{ delay: 1.4, duration: 0.6 }}
        style={{
          position: 'absolute', bottom: '41%', left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          zIndex: 3,
        }}
      >
        <p style={{ color: 'rgba(253,250,247,0.85)', fontSize: 10, letterSpacing: '0.1em' }}>גללי</p>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
          style={{ width: 1.5, height: 24, backgroundColor: 'rgba(253,250,247,0.6)', borderRadius: 2 }}
        />
      </motion.div>
    </div>
  );
}

// ── Gallery — Infinite Carousel ───────────────────────────────
function GallerySection({ images }) {
  const n = images.length;
  if (!n) return null;

  const all = [...images, ...images, ...images]; // triple-clone
  const containerRef = useRef(null);
  const trackRef     = useRef(null);
  const posRef       = useRef(n);
  const startXRef    = useRef(null);
  const animRef      = useRef(null);
  const GAP          = 12;
  const PEEK         = 0.78; // item = 78% of container width

  const jumpTo = useCallback((idx, animate) => {
    if (!trackRef.current || !containerRef.current) return;
    const cW = containerRef.current.offsetWidth;
    const iW = cW * PEEK;
    const x  = (cW - iW) / 2 - idx * (iW + GAP);
    trackRef.current.style.transition = animate
      ? 'transform 0.42s cubic-bezier(0.4,0,0.2,1)'
      : 'none';
    trackRef.current.style.transform = `translateX(${x}px)`;
    posRef.current = idx;
  }, []);

  useEffect(() => {
    // double-rAF: first frame commits DOM, second frame has layout measurements
    let id2;
    const id = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => jumpTo(n, false));
    });
    return () => { cancelAnimationFrame(id); cancelAnimationFrame(id2); };
  }, [n, jumpTo]);

  const slide = delta => {
    const next = posRef.current + delta;
    jumpTo(next, true);
    clearTimeout(animRef.current);
    animRef.current = setTimeout(() => {
      if (posRef.current < n)        jumpTo(posRef.current + n, false);
      else if (posRef.current >= n * 2) jumpTo(posRef.current - n, false);
    }, 450);
  };

  const onTouchStart = e => { startXRef.current = e.touches[0].clientX; };
  const onTouchEnd   = e => {
    if (startXRef.current === null) return;
    const dx = e.changedTouches[0].clientX - startXRef.current;
    if (Math.abs(dx) > 40) slide(dx < 0 ? 1 : -1);
    startXRef.current = null;
  };

  // Pixel item-width for initial render (before rAF fires)
  const initW = Math.min(typeof window !== 'undefined' ? window.innerWidth : 375, 384) * PEEK;

  return (
    <FadeSection style={{ backgroundColor: C.sec, padding: '96px 0' }}>
      <div style={{ paddingInline: 20, marginBottom: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <SectionTitle>גלריית עבודות</SectionTitle>
        <label style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 20px', borderRadius: 'var(--demo-radius-card)',
          border: '1.5px solid #5C3D2E', backgroundColor: 'var(--color-surface)',
          color: 'var(--color-primary-ink)', fontSize: 13, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'var(--demo-body-font)',
        }}>
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={() => {}} />
          + הוספת תמונה לגלריה
        </label>
      </div>

      <div
        ref={containerRef}
        style={{ overflowX: 'clip', overflowY: 'visible', cursor: 'grab', userSelect: 'none' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div ref={trackRef} style={{ display: 'flex', gap: GAP, paddingBlock: 8, marginBlock: -8 }}>
          {all.map((img, i) => (
            <div
              key={i}
              style={{
                flex: `0 0 ${initW}px`,
                width: initW,
                aspectRatio: '4/3',
                borderRadius: 'var(--demo-radius-card)',
                overflow: 'hidden',
                boxShadow: 'var(--demo-shadow-card)',
                flexShrink: 0,
              }}
            >
              <img
                src={img?.imageUrl || img}
                alt={`gallery-${i}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={e => {
                  if (DEFAULT_GALLERY.length) e.target.src = DEFAULT_GALLERY[i % DEFAULT_GALLERY.length];
                }}
                draggable={false}
              />
            </div>
          ))}
        </div>
      </div>
    </FadeSection>
  );
}

// ── About flip card ───────────────────────────────────────────
function AboutSection({ about, clinicInfo }) {
  const [flipped, setFlipped] = useState(false);
  const wa = clinicInfo?.ownerWhatsapp || clinicInfo?.whatsapp || '';
  const waClean = `https://wa.me/${digitsOnly(wa)}`;

  return (
    <FadeSection style={{ backgroundColor: C.surface }}>
      <SectionTitle>קצת עליי</SectionTitle>

      <div
        onClick={() => setFlipped(f => !f)}
        style={{ perspective: '1000px', height: 320, cursor: 'pointer' }}
      >
        <div style={{
          position: 'relative', width: '100%', height: '100%',
          transition: 'transform 0.65s cubic-bezier(0.4,0.2,0.2,1)',
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0)',
        }}>
          {/* Front — full-bleed image */}
          <div style={{
            position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
            borderRadius: 'var(--demo-radius-card)', overflow: 'hidden',
            boxShadow: 'var(--demo-shadow-card)',
          }}>
            <img
              src={about?.imageUrl || DEFAULT_ABOUT.imageUrl}
              alt="about"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={e => { e.target.src = DEFAULT_ABOUT.imageUrl; }}
            />
            {/* Overlay with hint + upload */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              padding: '28px 16px 14px',
              background: 'linear-gradient(to top, rgba(92,61,46,0.60), transparent)',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
            }}>
              <p style={{ color: 'rgba(253,250,247,0.90)', fontSize: 13, textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
                לחצי לקרוא עליי
              </p>
              <label onClick={e => e.stopPropagation()} style={{
                padding: '6px 12px', borderRadius: 8,
                backgroundColor: 'rgba(253,250,247,0.85)', color: 'var(--color-primary-ink)',
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                border: '1px solid rgba(92,61,46,0.3)',
              }}>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={() => {}} />
                החלפת תמונה
              </label>
            </div>
          </div>

          {/* Back — text + WhatsApp */}
          <div style={{
            position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
            backgroundColor: C.surface, borderRadius: 'var(--demo-radius-card)',
            border: `1px solid ${C.border}`,
            boxShadow: 'var(--demo-shadow-card)',
            transform: 'rotateY(180deg)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '24px 20px', gap: 16, overflow: 'hidden',
          }}>
            <p style={{ color: C.text, fontSize: 14, lineHeight: 1.9, textAlign: 'center', flex: 1, display: 'flex', alignItems: 'center' }}>
              {about?.text || DEFAULT_ABOUT.text}
            </p>
            {wa && (
              <motion.a
                href={waClean}
                target="_blank" rel="noreferrer"
                whileTap={{ scale: 0.97 }}
                onClick={e => e.stopPropagation()}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  width: '100%', height: 46, borderRadius: 'var(--demo-radius-card)',
                  backgroundColor: '#25D366', color: '#fff',
                  fontWeight: 700, fontSize: 14, textDecoration: 'none',
                  boxShadow: '0 4px 14px rgba(37,211,102,0.30)',
                  flexShrink: 0,
                }}
              >
                💬 WhatsApp ישיר
              </motion.a>
            )}
            <p style={{ color: C.muted, fontSize: 11 }}>לחצי שוב לסגור</p>
          </div>
        </div>
      </div>
    </FadeSection>
  );
}

// ── Reviews section ───────────────────────────────────────────
function ReviewsSection({ reviews, user, onAddReview }) {
  const [text, setText]     = useState('');
  const [rating, setRating] = useState(5);
  const [hover, setHover]   = useState(0);
  const [sent, setSent]     = useState(false);
  const [showForm, setShowForm] = useState(false);

  const submit = async () => {
    if (!text.trim() || !user) return;
    await onAddReview({ rating, text: text.trim() });
    setText(''); setSent(true); setShowForm(false);
  };

  const approved = reviews.filter(r => r.status === 'approved');

  return (
    <FadeSection leopard>
      <SectionTitle>מה אומרות עליי ⭐</SectionTitle>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
        {approved.map(r => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            style={{ backgroundColor: C.surface, borderRadius: 'var(--demo-radius-card)', padding: 16, border: `1px solid ${C.border}` }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <p style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>{r.userName}</p>
              <Stars rating={r.rating} />
            </div>
            <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.7 }}>{r.text}</p>
          </motion.div>
        ))}
      </div>

      {user && !sent && (
        showForm ? (
          <div style={{ backgroundColor: C.surface, borderRadius: 'var(--demo-radius-card)', padding: 16, border: `1px solid ${C.border}` }}>
            <p style={{ color: C.text, fontWeight: 600, fontSize: 14, marginBottom: 12 }}>הביקורת שלי:</p>
            <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
              {[1,2,3,4,5].map(i => (
                <motion.button
                  key={i}
                  onClick={() => setRating(i)}
                  onHoverStart={() => setHover(i)}
                  onHoverEnd={() => setHover(0)}
                  whileTap={{ scale: 0.9 }}
                  style={{ fontSize: 30, background: 'none', border: 'none', cursor: 'pointer',
                    color: i <= (hover || rating) ? '#C49A3C' : C.border }}
                >★</motion.button>
              ))}
            </div>
            <textarea
              value={text} onChange={e => setText(e.target.value)}
              placeholder="שתפי את החוויה שלך..." rows={3}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 'var(--demo-radius-card)',
                border: `1px solid ${C.border}`, resize: 'none', fontSize: 13,
                backgroundColor: C.surface, color: C.text, outline: 'none',
                fontFamily: 'var(--demo-body-font)',
              }}
              onFocus={e => e.target.style.borderColor = C.accent}
              onBlur={e => e.target.style.borderColor = C.border}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <motion.button onClick={submit} whileTap={{ scale: 0.97 }}
                style={{ flex: 1, height: 42, backgroundColor: C.accent, color: 'var(--color-surface)', border: 'none', borderRadius: 'var(--demo-radius-card)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--demo-body-font)', boxShadow: 'var(--demo-shadow-card)' }}>שלחי ביקורת</motion.button>
              <button onClick={() => setShowForm(false)}
                style={{ height: 42, flex: 1, borderRadius: 'var(--demo-radius-card)', border: `1px solid ${C.border}`, backgroundColor: 'transparent', color: C.muted, fontSize: 14, cursor: 'pointer', fontFamily: 'var(--demo-body-font)' }}>ביטול</button>
            </div>
          </div>
        ) : (
          <motion.button onClick={() => setShowForm(true)} whileTap={{ scale: 0.97 }}
            style={{ width: '100%', height: 46, borderRadius: 'var(--demo-radius-card)', border: `1.5px solid ${C.accent}`, backgroundColor: 'transparent', color: C.accent, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'var(--demo-body-font)' }}>
            + הוסיפי ביקורת
          </motion.button>
        )
      )}
      {sent && <p style={{ textAlign: 'center', color: C.accent, fontSize: 13 }}>תודה! הביקורת שלך נשלחה לאישור 💕</p>}
      {!user && <p style={{ textAlign: 'center', color: C.muted, fontSize: 13 }}>רק לקוחות רשומות יכולות לכתוב ביקורות</p>}
    </FadeSection>
  );
}

// ── Directions section ────────────────────────────────────────
function DirectionsSection({ clinicInfo }) {
  const info = clinicInfo || DEFAULT_CLINIC_INFO;
  const wa = `https://wa.me/${digitsOnly(info.whatsapp)}`;
  const rawWaze     = (info.wazeLink || '').trim();
  const isValidWaze = rawWaze.startsWith('https://') || rawWaze.startsWith('http://');
  const wazeHref    = (isValidWaze ? rawWaze : '') || (info.address ? `https://waze.com/ul?q=${encodeURIComponent(info.address)}` : '');

  return (
    <FadeSection style={{ backgroundColor: C.surface }}>
      <SectionTitle>איך מגיעים 📍</SectionTitle>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {info.phone && (
          <a href={`tel:${info.phone}`}
            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 'var(--demo-radius-card)', backgroundColor: C.bg, border: `1px solid ${C.border}`, textDecoration: 'none' }}>
            <span style={{ fontSize: 24 }}>📞</span>
            <div>
              <p style={{ color: C.muted, fontSize: 11, marginBottom: 2 }}>טלפון</p>
              <p style={{ color: C.text, fontWeight: 600, fontSize: 15 }} dir="ltr">{info.phone}</p>
            </div>
          </a>
        )}

        {info.address && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 'var(--demo-radius-card)', backgroundColor: C.bg, border: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 24 }}>🏠</span>
            <div>
              <p style={{ color: C.muted, fontSize: 11, marginBottom: 2 }}>כתובת</p>
              <p style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>{info.address}</p>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          {wazeHref && (
            <motion.a href={wazeHref} target="_blank" rel="noreferrer" whileTap={{ scale: 0.97 }}
              style={{ flex: 1, height: 50, borderRadius: 'var(--demo-radius-card)', backgroundColor: '#00AAFF', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none', boxShadow: '0 4px 16px rgba(0,170,255,0.30)' }}>
              🚗 Waze
            </motion.a>
          )}
          {info.whatsapp && (
            <motion.a href={wa} target="_blank" rel="noreferrer" whileTap={{ scale: 0.97 }}
              style={{ flex: 1, height: 50, borderRadius: 'var(--demo-radius-card)', backgroundColor: '#25D366', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none', boxShadow: '0 4px 16px rgba(37,211,102,0.30)' }}>
              💬 WhatsApp
            </motion.a>
          )}
        </div>
      </div>
    </FadeSection>
  );
}

// ── RISE section ──────────────────────────────────────────────
function BoltSection() {
  const waMsg = encodeURIComponent('היי! אשמח לשמוע עוד פרטים על בניית האתר לעסק שלי 🙏');

  return (
    <FadeSection leopard style={{ textAlign: 'center' }}>
      <div style={{
        width: 68, height: 68, borderRadius: '50%',
        margin: '0 auto 16px', overflow: 'hidden',
        boxShadow: 'var(--demo-shadow-deep)',
      }}>
        <img src="/assets/bolt-brand.png" alt="RISE" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>

      <h2 style={{ fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 6 }}>RISE</h2>
      <p style={{ color: C.brown, fontWeight: 600, fontSize: 13, marginBottom: 20 }}>
        בונה אתרים חכמים לעסקים קטנים
      </p>

      <p style={{
        color: C.muted, fontSize: 13, lineHeight: 1.9, marginBottom: 24,
        backgroundColor: C.surface, borderRadius: 'var(--demo-radius-card)', padding: '18px 16px',
        border: `1px solid ${C.border}`,
        textAlign: 'start',
      }}>
        עמוסה מלנהל לעצמך את העסק? לא רוצה להוציא הון על מזכירה?
        הפתרון המושלם עבורך! מערכת בולט קובעת עבורך תורים, מעדכנת אותך ואת
        הלקוחות בכל תור או שינוי, הופכת את העסק שלך למקצועי נגיש ואסתטי,
        ובעיקר הופכת את היומיום שלך לרגוע וקל. לעוד פרטים לחצי על הקישור לוואצאפ
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <a href="mailto:boltagent8@gmail.com"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            height: 48, borderRadius: 'var(--demo-radius-card)', backgroundColor: C.surface, color: C.text,
            border: `1px solid ${C.border}`, textDecoration: 'none', fontSize: 14, fontWeight: 500,
          }}>
          ✉️ boltagent8@gmail.com
        </a>
        <motion.a
          href={`https://wa.me/972505450408?text=${waMsg}`}
          target="_blank" rel="noreferrer"
          whileTap={{ scale: 0.97 }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            height: 52, borderRadius: 'var(--demo-radius-card)', backgroundColor: '#25D366', color: '#fff',
            textDecoration: 'none', fontSize: 15, fontWeight: 700,
            boxShadow: '0 4px 16px rgba(37,211,102,0.30)',
          }}
        >
          💬 דברו איתנו בוואטסאפ
        </motion.a>
      </div>
    </FadeSection>
  );
}

// ── Announcement popup ────────────────────────────────────────
function AnnouncementPopup({ text, onClose }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-5"
        style={{ backgroundColor: 'rgba(44,24,16,0.40)' }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          style={{
            width: '100%', maxWidth: 320, padding: 24, position: 'relative',
            backgroundColor: C.surface, borderRadius: 'var(--demo-radius-card)',
            boxShadow: 'var(--demo-shadow-deep)',
          }}
        >
          <button onClick={onClose}
            style={{
              position: 'absolute', top: 12, insetInlineStart: 12,
              width: 30, height: 30, borderRadius: '50%',
              backgroundColor: C.bg, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: C.muted, fontSize: 13,
            }}>✕</button>
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📢</div>
            <p style={{ color: C.text, fontSize: 14, lineHeight: 1.7 }}>{text}</p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Main Home ─────────────────────────────────────────────────
export default function Home({ user, onNavigate }) {
  const [visible, setVisible]         = useState(false);
  const [announce, setAnnounce]       = useState('');
  const [showPopup, setShowPopup]     = useState(false);
  const [hero, setHero]               = useState(null);
  const [about, setAbout]             = useState(null);
  const [clinicInfo, setClinicInfo]   = useState(null);
  const [businessLogo, setBusinessLogo] = useState('');
  const [reviews, setReviews]         = useState([]);
  const [gallery, setGallery]         = useState([]);

  useEffect(() => {
    let cancelled = false;

    setTimeout(() => { if (!cancelled) setVisible(true); }, 60);

    Promise.all([
      db.settings.get('adminSettings'),
      db.settings.get('hero',         DEFAULT_HERO),
      db.settings.get('about',        DEFAULT_ABOUT),
      db.settings.get('clinicInfo',   DEFAULT_CLINIC_INFO),
      db.settings.get('businessLogo', ''),
    ]).then(([settings, h, a, ci, logo]) => {
      if (cancelled) return;
      if (settings?.announcement?.show && settings?.announcement?.text) {
        setAnnounce(settings.announcement.text);
        setShowPopup(true);
      }
      setHero(h);
      setAbout(a);
      setClinicInfo(ci);
      // businessLogo key is the primary source; clinicInfo.logoUrl is the fallback
      setBusinessLogo(
        (typeof logo === 'string' && logo) ? logo :
        (typeof ci?.logoUrl === 'string' && ci?.logoUrl) ? ci.logoUrl : ''
      );
    });

    if (FEAT_REVIEWS) {
      db.reviews.list(true).then(r => { if (!cancelled) setReviews(r.length ? r : DEFAULT_REVIEWS); });
    }
    if (FEAT_GALLERY) {
      db.gallery.list().then(g => {
        if (!cancelled) setGallery(g.length ? g : DEFAULT_GALLERY.map((url, i) => ({ id: i, imageUrl: url })));
      });
    }
    return () => { cancelled = true; };
  }, []);

  const handleAddReview = async ({ rating, text }) => {
    if (!user) return;
    await db.reviews.create({ phone: user.phone, userName: user.name || user.firstName, rating, text });
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: C.bg }}>
      {showPopup && <AnnouncementPopup text={announce} onClose={() => setShowPopup(false)} />}

      <Hero user={user} hero={hero} onNavigate={onNavigate} visible={visible} businessLogo={businessLogo} />

      {FEAT_GALLERY && gallery.length > 0 && (
        <GallerySection images={gallery} />
      )}

      <AboutSection about={about} clinicInfo={clinicInfo} />

      {FEAT_REVIEWS && (
        <ReviewsSection reviews={reviews} user={user} onAddReview={handleAddReview} />
      )}

      <DirectionsSection clinicInfo={clinicInfo} />

      <BoltSection />

      <div style={{ height: 80 }} />
    </div>
  );
}
