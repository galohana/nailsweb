import React, { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { db } from '../utils/db';
import { DEFAULT_HERO, DEFAULT_CLINIC_INFO } from '../utils/defaults';

const DEFAULT_HERO_STATS = [
  { label: 'שנות ניסיון',   value: 5,   enabled: true },
  { label: 'לקוחות מרוצות', value: 500, enabled: true },
  { label: 'תורים בשבוע',   value: 30,  enabled: true },
];
import GalleryAbout from './GalleryAbout';
import ContactPage from './ContactPage';
import RisePage from './RisePage';
import Ripple from '../components/Ripple';

// ── Palette ───────────────────────────────────────────────────
const BROWN  = 'var(--color-primary)';
const BG     = 'var(--color-bg)';
const WHITE  = 'var(--color-surface)';
const BORDER = '#8B6E52';

// ── Reusable button style ─────────────────────────────────────
// background+material מסופקים ע"י className="demo-tinted" שמתווסף ב-JSX —
// כש-menuColorExtend OFF: לבן (כמו קודם). כש-ON: צבע menu + חומר.
const btn = (extra = {}) => ({
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: '100%', height: 52, borderRadius: 'var(--demo-radius-card)',
  border: '1px solid rgba(var(--color-card-tint-rgb), 0.3)',
  color: 'var(--color-on-card-tint)',
  fontSize: 15, fontWeight: 600, cursor: 'pointer',
  fontFamily: 'var(--demo-body-font)',
  boxShadow: '0 0 0 1px rgba(var(--color-card-tint-rgb), 0.18), 0 0 22px rgba(var(--color-card-tint-rgb), 0.12)',
  letterSpacing: '0.02em',
  ...extra,
});

// ── Hero Page ─────────────────────────────────────────────────
// Animated counter — counts from 0 to `to` over `duration` ms when scrolled into view.
function Counter({ to, duration = 1400 }) {
  const ref = useRef(null);
  const [val, setVal] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !started.current) {
        started.current = true;
        const start = performance.now();
        const tick = (now) => {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          setVal(Math.round(to * eased));
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.4 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [to, duration]);
  return <span ref={ref}>{val}</span>;
}

export default function HeroNew({ user, onNavigate, onLogout, showStore }) {
  const [visible, setVisible]       = useState(false);
  const [heroImageUrl, setHeroImg]  = useState(DEFAULT_HERO.imageUrl);
  const [heroVideoUrl, setHeroVid]  = useState('');
  const [heroMediaType, setHeroMT]  = useState('image');
  const [businessName, setBizName]  = useState('');
  const [clinicLoaded, setClinicLoaded] = useState(false);
  const [ownerName, setOwnerName]   = useState('');
  const [businessLogo, setLogo]     = useState(null); // null = עוד לא נטען מה-DB; אחרי טעינה: URL או '' (אין לוגו)
  const [stats, setStats]           = useState(DEFAULT_HERO_STATS.filter(s => s.enabled));
  const [announcement, setAnnouncement] = useState(null);
  const [annDismissed, setAnnDismissed] = useState(false);
  const ctaRef   = useRef(null);
  const videoRef = useRef(null);

  // Parallax via Framer Motion useScroll (smoother than RAF, runs on compositor)
  const { scrollY } = useScroll();
  const parallaxY = useSpring(useTransform(scrollY, [0, 600], [0, 130]), { stiffness: 120, damping: 28 });
  const parallaxScale = useTransform(scrollY, [0, 400], [1.0, 1.06]);

  // Magnetic effect on the main CTA — button drifts toward pointer when within 80px
  const magX = useSpring(0, { stiffness: 220, damping: 18 });
  const magY = useSpring(0, { stiffness: 220, damping: 18 });

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    Promise.all([
      db.settings.get('hero', DEFAULT_HERO),
      db.settings.get('clinicInfo', DEFAULT_CLINIC_INFO),
      db.settings.get('heroStats', DEFAULT_HERO_STATS),
      db.settings.get('businessLogo', ''),
      db.settings.get('adminSettings', {}),
    ]).then(([h, ci, st, logo, adminSettings]) => {
      if (h?.imageUrl)  setHeroImg(h.imageUrl);
      if (h?.videoUrl)  setHeroVid(h.videoUrl);
      if (h?.mediaType) setHeroMT(h.mediaType);
      if (ci?.name)      setBizName(ci.name);
      if (ci?.ownerName) setOwnerName(ci.ownerName);
      if (Array.isArray(st)) setStats(st.filter(s => s && s.enabled));
      const resolvedLogo = (typeof logo === 'string' && logo) ? logo
        : (typeof ci?.logoUrl === 'string' && ci?.logoUrl) ? ci.logoUrl : '';
      setLogo(resolvedLogo);
      const ann = adminSettings?.announcement;
      if (ann?.show && ann?.text) setAnnouncement(ann.text);
      setClinicLoaded(true);
    });
    return () => clearTimeout(t);
  }, []);

  // Force autoplay on iOS Safari (attribute alone is sometimes ignored)
  useEffect(() => {
    if (heroMediaType === 'video' && heroVideoUrl && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [heroVideoUrl, heroMediaType]);

  // Magnetic tracking
  useEffect(() => {
    const onMove = (e) => {
      const el = ctaRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);
      const radius = 80;
      if (dist < radius) {
        const pull = (1 - dist / radius) * 0.25;  // up to 25% of vector
        magX.set(dx * pull);
        magY.set(dy * pull);
      } else {
        magX.set(0);
        magY.set(0);
      }
    };
    const reset = () => { magX.set(0); magY.set(0); };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerleave', reset);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', reset);
    };
  }, [magX, magY]);

  useEffect(() => {
    if (!announcement) return;
    const timer = setTimeout(() => setAnnDismissed(true), 5000);
    return () => clearTimeout(timer);
  }, [announcement]);

  const IMG_H = '80vh';

  // ── זיהוי שפה אוטומטי לאנימציית הכותרת ──
  // עברית → rtl (אות ראשונה מימין, אנימציה ימין→שמאל)
  // אנגלית → ltr (אות ראשונה משמאל, אנימציה שמאל→ימין)
  // הסדר במערך לא משתנה — flexbox עם dir מסדר את הכיוון, האנימציה (delay לפי i) נשארת אות-אחרי-אות
  const detectDir = (text) => (/[֐-׿]/.test(text || '') ? 'rtl' : 'ltr');
  const navbarDir = detectDir(businessName);

  if (!clinicLoaded) {
    return (
      <div style={{
        minHeight: '100vh', backgroundColor: 'var(--color-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          border: '2px solid var(--color-primary)',
          borderTopColor: 'transparent',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: BG, position: 'relative' }}>
      {/* ── Announcement banner ── */}
      {announcement && !annDismissed && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          style={{
            position: 'fixed', top: 60, left: 0, right: 0, zIndex: 200,
            maxWidth: 375, margin: '0 auto',
            backgroundColor: BROWN, color: WHITE,
            padding: '10px 40px 10px 14px',
            fontSize: 13, fontFamily: 'var(--demo-body-font)', lineHeight: 1.4,
            textAlign: 'center',
          }}
        >
          {announcement}
          <button
            onClick={() => setAnnDismissed(true)}
            style={{
              position: 'absolute', top: '50%', left: 10, transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: 'var(--color-on-primary)', opacity: 0.7,
              fontSize: 16, cursor: 'pointer', lineHeight: 1, padding: 4,
            }}
          >✕</button>
        </motion.div>
      )}
      {/* ── Nav bar — business name only ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 60, zIndex: 100,
        backgroundColor: 'var(--demo-navbar-bg, rgba(242,232,220,0.15))',
        backgroundImage: 'var(--demo-navbar-mat-overlay, none)',
        backdropFilter: 'var(--demo-navbar-blur, blur(8px))',
        WebkitBackdropFilter: 'var(--demo-navbar-blur, blur(8px))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <span dir={navbarDir} style={{
          fontFamily: 'var(--demo-heading-font)',
          fontSize: 21, fontWeight: 400, letterSpacing: '0.1em',
          color: 'var(--demo-navbar-text, var(--color-surface))', whiteSpace: 'nowrap',
          display: 'inline-flex', direction: navbarDir, unicodeBidi: 'isolate',
        }}>
          {Array.from(businessName).map((ch, i) => (
            <motion.span
              key={`${businessName}-${i}`}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.04, duration: 0.45, ease: 'easeOut' }}
              style={{ display: 'inline-block', whiteSpace: 'pre' }}
            >
              {ch}
            </motion.span>
          ))}
        </span>
      </nav>

      {/* ── Photo/Video — full width, 65vh ── */}
      <div style={{ position: 'relative', width: '100%', height: IMG_H, overflow: 'hidden' }}>
        {heroMediaType === 'video' && heroVideoUrl ? (
          <video
            ref={videoRef}
            src={heroVideoUrl}
            autoPlay muted loop playsInline
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <motion.div
            initial={{ filter: 'blur(8px)' }}
            animate={{ filter: 'blur(0px)' }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            style={{
              position: 'absolute', inset: -24,
              backgroundImage: `url('${heroImageUrl}')`,
              backgroundSize: 'cover', backgroundPosition: 'center 55%',
              willChange: 'transform, filter',
              y: parallaxY, scale: parallaxScale,
            }}
          />
        )}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(92,61,46,0.04) 50%, rgba(92,61,46,0.28) 100%)',
        }} />
      </div>

      {/* ═══════════════════════════════════════════════════════════
          UNIFIED BROWN SECTION — קונטיינר אחד שמחזיק arch + content +
          gallery + contact. החומר של section מתפרס רציפות על כולם
          ללא תפרים. ה-arch נוצר ע"י border-radius של הקונטיינר עצמו.
          ═══════════════════════════════════════════════════════════ */}
      <div style={{
        position: 'relative',
        marginTop: -160,
        marginLeft: '-20vw',
        marginRight: '-20vw',
        paddingLeft: '20vw',
        paddingRight: '20vw',
        zIndex: 2,
        borderRadius: '50% 50% 0 0 / 200px 200px 0 0',
        backgroundColor: 'var(--color-section)',
        backgroundImage: 'var(--demo-section-mat-surface)',
        backgroundRepeat: 'repeat',
        paddingTop: 120,
      }}>
        <div aria-hidden style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'var(--demo-section-mat-overlay)',
          mixBlendMode: 'overlay',
          pointerEvents: 'none',
          zIndex: 0,
          borderRadius: 'inherit',
        }} />

        {/* ── Content (welcome + buttons + stats) — background מוסר, מתפרס ע"י parent ── */}
        <div style={{
          position: 'relative', zIndex: 1,
          paddingTop: 40, paddingBottom: 48, paddingInline: 28,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 10 }}
          transition={{ duration: 0.65, ease: 'easeOut', delay: 0.55 }}
          style={{ textAlign: 'center', marginBottom: 16 }}
        >
          {user ? (
            <>
              <p style={{
                fontFamily: 'var(--demo-heading-font)',
                fontSize: 28, fontWeight: 500,
                color: 'var(--color-on-section)',
                lineHeight: 1.15, letterSpacing: '0.01em',
                marginBottom: 10,
              }}>
                שלום {user.firstName || user.name} 💕
              </p>
              <p style={{
                fontFamily: 'var(--demo-body-font)',
                fontSize: 16, fontWeight: 300,
                color: 'var(--color-on-section)', opacity: 0.75,
                letterSpacing: '0.04em',
              }}>
                כיף שחזרת אלינו
              </p>
            </>
          ) : (
            <>
              <p style={{
                fontFamily: 'var(--demo-heading-font)',
                fontSize: 28, fontWeight: 400,
                color: 'var(--color-on-section)',
                lineHeight: 1.2, letterSpacing: '0.02em',
                marginBottom: 10,
              }}>
                ברוכה הבאה
              </p>
              <p style={{
                fontFamily: 'var(--demo-body-font)',
                fontSize: 16, fontWeight: 300,
                color: 'var(--color-on-section)', opacity: 0.75,
                letterSpacing: '0.05em',
              }}>
                שמחות לראותך כאן ✨
              </p>
            </>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 14 }}
          transition={{ duration: 0.5, ease: 'easeOut', delay: 0.8 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}
        >
          <Ripple>
            <motion.button
              ref={ctaRef}
              onClick={() => onNavigate('booking')}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 350, damping: 22 }}
              className="demo-tinted"
              style={{ ...btn({ fontSize: 16 }), x: magX, y: magY }}
            >
              קביעת תור
            </motion.button>
          </Ripple>

          <Ripple>
            <motion.button
              onClick={() => onNavigate(user ? 'appointments' : 'register')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 350, damping: 22 }}
              className="demo-tinted"
              style={btn({ height: 46, fontSize: 14, fontWeight: 400 })}
            >
              {user ? 'התורים שלי' : 'הרשמה / כניסה'}
            </motion.button>
          </Ripple>
        </motion.div>

        {/* ── Stats badges (counter animation in viewport) ── */}
        {stats.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-30px' }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
              gap: 12, marginTop: 32, width: '100%',
            }}
          >
            {stats.map((s, i) => (
              <div key={i} style={{
                textAlign: 'center', padding: '14px 8px',
                backgroundColor: 'transparent',
                border: '1px solid rgba(var(--color-on-section-rgb), 0.40)',
                borderRadius: 'var(--demo-radius-card)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}>
                <p style={{
                  fontFamily: 'var(--demo-heading-font)',
                  fontSize: 28, fontWeight: 700, color: 'var(--color-on-section)',
                  lineHeight: 1, marginBottom: 4,
                }}>
                  <Counter to={Number(s.value) || 0} />+
                </p>
                <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 10, color: 'var(--color-on-section)', opacity: 0.80, letterSpacing: '0.04em' }}>
                  {s.label}
                </p>
              </div>
            ))}
          </motion.div>
        )}
        </div>

        {/* ── Gallery + About + Reviews — נכנסים לקונטיינר המאוחד ── */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <GalleryAbout embedded={true} />
        </div>

        {/* ── Contact (48px gap above) ── */}
        <div id="section-contact" style={{ position: 'relative', zIndex: 1, paddingTop: 48 }}>
          <ContactPage embedded={true} onNavigate={onNavigate} />
        </div>

        <div style={{ paddingBottom: 48 }} />

        {/* ── Logo (absolute, half above section top edge — outside inner so not clipped).
            Wrapper div מטפל במרכוז עם flex, motion.div מטפל באנימציה — מונע התנגשות
            עם transform של Framer Motion שדורס translateX. */}
        <div style={{
          position: 'absolute',
          top: -52,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          zIndex: 5,
          pointerEvents: 'none',
        }}>
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: visible ? 1 : 0, opacity: visible ? 1 : 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 0.35 }}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22,
            pointerEvents: 'auto',
          }}
        >
          {/* businessLogo===null → עוד לא נטען (אל תציג כלום) — מונע flash
              businessLogo=URL    → לוגו לקוח אמיתי בתוך עיגול עם floating
              businessLogo=''     → fallback RISE בלי עיגול (הלוגו לא מותאם לעיגול) */}
          {businessLogo === null ? null : businessLogo ? (
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 3.4, ease: 'easeInOut', repeat: Infinity }}
              style={{
                width: 105, height: 105, borderRadius: '50%',
                backgroundColor: BG, border: `1px solid ${BORDER}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)',
                overflow: 'hidden',
              }}>
              <img
                src={businessLogo}
                alt="לוגו"
                style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%' }}
              />
            </motion.div>
          ) : (
            <motion.img
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 3.4, ease: 'easeInOut', repeat: Infinity }}
              src="/assets/rise-brand.png"
              alt="RISE"
              style={{ width: 130, height: 'auto', objectFit: 'contain', userSelect: 'none' }}
            />
          )}
          <span dir="ltr" style={{
            fontFamily: 'var(--demo-body-font)',
            fontSize: 13, fontWeight: 300, letterSpacing: '0.18em',
            color: 'var(--color-on-section)', opacity: 0.80, userSelect: 'none',
            textTransform: 'uppercase',
            display: 'inline-flex', direction: 'ltr', unicodeBidi: 'isolate',
          }}>
            {Array.from(ownerName ? `by ${ownerName}` : '').map((ch, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 10 }}
                transition={{ delay: 0.9 + i * 0.04, duration: 0.4, ease: 'easeOut' }}
                style={{ display: 'inline-block', whiteSpace: 'pre' }}
              >
                {ch}
              </motion.span>
            ))}
          </span>
        </motion.div>
        </div>
      </div>
      {/* ═══════ end UNIFIED BROWN SECTION ═══════ */}

      {/* ── RISE — footer section (beige) ── */}
      <RisePage embedded={true} />

      {/* ── Privacy link ── */}
      <div style={{ textAlign: 'center', paddingBottom: 12, backgroundColor: BG, backgroundImage: 'var(--demo-bg-mat-surface)', backgroundRepeat: 'repeat' }}>
        <button
          onClick={() => onNavigate('privacy')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--demo-body-font)', fontSize: 12,
            color: BORDER, textDecoration: 'underline',
            padding: '8px 16px',
          }}
        >
          מדיניות פרטיות
        </button>
      </div>

    </div>
  );
}
