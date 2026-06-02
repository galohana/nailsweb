import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../utils/db';
import { DEFAULT_ABOUT, DEFAULT_CLINIC_INFO } from '../utils/defaults';

const FALLBACK_IMAGES = [];

const ITEM_W     = 120;
const GAP        = 10;
const SHADOW     = '0 4px 8px rgba(0,0,0,0.2), 0 1px 3px rgba(0,0,0,0.1)';
const CAROUSEL_H = 260;

const slideV = {
  enter:  d => ({ y: d > 0 ? '100%' : '-100%', opacity: 0 }),
  center: { y: 0, opacity: 1 },
  exit:   d => ({ y: d > 0 ? '-100%' : '100%', opacity: 0 }),
};

export default function GalleryAbout({ onNavigate, embedded = false }) {
  const [flipped, setFlipped] = useState(false);

  // ── Filmstrip — native scroll + auto-advance ──────────────────
  const scrollerRef  = useRef(null);
  const pauseRef     = useRef(null);   // setTimeout id to resume after touch
  const scrollerRef2 = useRef(null);
  const pauseRef2    = useRef(null);

  // ── Data from Supabase ────────────────────────────────────────
  const [galleryUrls, setGalleryUrls]   = useState([]);
  const [gallery2Urls, setGallery2Urls] = useState([]);
  const [about, setAbout]               = useState(DEFAULT_ABOUT);
  const [clinicInfo, setClinicInfo]     = useState(DEFAULT_CLINIC_INFO);

  // ── Reviews state ─────────────────────────────────────────────
  const [reviews, setReviews]        = useState([]);
  const [displayCount, setDispCount] = useState(1);
  const [groupIdx, setGroupIdx]      = useState(0);
  const [dir, setDir]                = useState(1);
  const [showForm, setShowForm]      = useState(false);

  // ── Load all data ─────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      db.reviews.list(true),
      db.settings.get('reviewsDisplayCount', 1),
      db.settings.get('about', DEFAULT_ABOUT),
      db.settings.get('clinicInfo', DEFAULT_CLINIC_INFO),
      db.gallery.list(),
      db.settings.get('gallery2', []),
    ]).then(([rev, count, ab, ci, gal, gal2]) => {
      setReviews(rev);
      setDispCount(Number(count) || 1);
      if (ab) setAbout(ab);
      if (ci) setClinicInfo(ci);
      const urls = (gal || []).map(g => g.imageUrl).filter(Boolean);
      const resolved1 = urls.length > 0 ? urls : FALLBACK_IMAGES;
      setGalleryUrls(resolved1);
      const urls2 = (Array.isArray(gal2) ? gal2 : []).map(g => g.url).filter(Boolean);
      // fallback: use gallery1 images so carousel2 is never empty
      setGallery2Urls(urls2.length > 0 ? urls2 : resolved1);
    });
  }, []);

  // ── Doubled filmstrips for seamless loop (capped at 10 each) ──
  const filmImages = useMemo(() => {
    const src = (galleryUrls.length > 0 ? galleryUrls : FALLBACK_IMAGES).slice(0, 10);
    return [...src, ...src];
  }, [galleryUrls]);

  const filmImages2 = useMemo(() => {
    const src = gallery2Urls.slice(0, 10);
    return src.length > 0 ? [...src, ...src] : filmImages;
  }, [gallery2Urls, filmImages]);

  // ── Auto-scroll: 1px every 20ms, pauses on touch, resumes 1s ──
  // Recomputes `half` every tick so it stays correct after images load.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    let interval = null;
    const tick = () => {
      const half = el.scrollWidth / 2;
      if (half <= 0) return;
      // Always advance, then wrap with modulo for guaranteed infinite loop
      let next = el.scrollLeft + 1;
      if (next >= half) next -= half;
      el.scrollLeft = next;
    };
    const start = () => {
      if (interval) return;
      interval = setInterval(tick, 20);
    };
    const stop = () => {
      if (interval) { clearInterval(interval); interval = null; }
    };
    const pauseAndResume = () => {
      stop();
      if (pauseRef.current) clearTimeout(pauseRef.current);
      pauseRef.current = setTimeout(start, 1000);
    };

    // Start IMMEDIATELY — tick guards against scrollWidth=0
    start();

    el.addEventListener('touchstart', pauseAndResume, { passive: true });
    el.addEventListener('mousedown',  pauseAndResume);
    el.addEventListener('wheel',      pauseAndResume, { passive: true });

    return () => {
      stop();
      if (pauseRef.current) clearTimeout(pauseRef.current);
      el.removeEventListener('touchstart', pauseAndResume);
      el.removeEventListener('mousedown',  pauseAndResume);
      el.removeEventListener('wheel',      pauseAndResume);
    };
  }, []);

  // ── Reverse filmstrip — scrolls right ─────────────────────────
  useEffect(() => {
    const el = scrollerRef2.current;
    if (!el) return;
    let interval = null;
    const tick = () => {
      const half = el.scrollWidth / 2;
      if (half <= 0) return;
      let next = el.scrollLeft - 1;
      if (next <= 0) next += half;
      el.scrollLeft = next;
    };
    const start = () => { if (interval) return; interval = setInterval(tick, 20); };
    const stop  = () => { if (interval) { clearInterval(interval); interval = null; } };
    const pauseAndResume2 = () => {
      stop();
      if (pauseRef2.current) clearTimeout(pauseRef2.current);
      pauseRef2.current = setTimeout(start, 1000);
    };
    requestAnimationFrame(() => {
      const half = el.scrollWidth / 2;
      if (half > 0) el.scrollLeft = half;
      start();
    });
    el.addEventListener('touchstart', pauseAndResume2, { passive: true });
    el.addEventListener('mousedown',  pauseAndResume2);
    el.addEventListener('wheel',      pauseAndResume2, { passive: true });
    return () => {
      stop();
      if (pauseRef2.current) clearTimeout(pauseRef2.current);
      el.removeEventListener('touchstart', pauseAndResume2);
      el.removeEventListener('mousedown',  pauseAndResume2);
      el.removeEventListener('wheel',      pauseAndResume2);
    };
  }, []);

  // ── Reviews groups ────────────────────────────────────────────
  const groups = [];
  for (let i = 0; i < reviews.length; i += displayCount)
    groups.push(reviews.slice(i, i + displayCount));

  useEffect(() => {
    if (groups.length <= 1) return;
    const t = setInterval(() => {
      setDir(1);
      setGroupIdx(p => (p + 1) % groups.length);
    }, 4000);
    return () => clearInterval(t);
  }, [groups.length]);

  function goTo(idx) {
    const next = ((idx % groups.length) + groups.length) % groups.length;
    setDir(idx >= groupIdx ? 1 : -1);
    setGroupIdx(next);
  }

  function reloadReviews() {
    db.reviews.list(true).then(setReviews);
  }

  // ── WhatsApp link for about card ──────────────────────────────
  const waNum = (clinicInfo?.ownerWhatsapp || clinicInfo?.whatsapp || '').replace(/\D/g, '');
  const waLink = waNum
    ? `https://wa.me/${waNum.startsWith('972') ? waNum : '972' + waNum.replace(/^0/, '')}?text=${encodeURIComponent('היי! אשמח לקבוע תור 💕')}`
    : '#';

  return (
    <div style={{ backgroundColor: embedded ? 'transparent' : 'var(--color-section)', backgroundImage: embedded ? undefined : 'var(--demo-section-mat-surface)', backgroundRepeat: embedded ? undefined : 'repeat', position: 'relative', paddingTop: embedded ? 0 : 72, paddingBottom: embedded ? 0 : 60 }}>
      {!embedded && <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'var(--demo-section-mat-overlay)', mixBlendMode: 'overlay', zIndex: 0 }} />}

      {/* ── Brown wrapper ── */}
      <div style={{ backgroundColor: 'transparent', paddingBottom: 56, position: 'relative', zIndex: 1 }}>

        {/* Filmstrip */}
        <div id="section-gallery" style={{ padding: '24px 0 0' }}>
          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 28, fontWeight: 400, color: 'var(--color-surface)', textAlign: 'center', letterSpacing: '0.06em', margin: '0 0 20px' }}
          >
            העבודות שלי
          </motion.h2>
          <style>{`
            .gavot-filmstrip::-webkit-scrollbar{display:none}
            .gavot-filmstrip img,.gavot-filmstrip video{ transition: transform .35s ease, box-shadow .35s ease; }
            .gavot-filmstrip img:hover,.gavot-filmstrip video:hover{ transform: scale(1.06); box-shadow: 0 10px 26px rgba(0,0,0,0.25); z-index: 2; position: relative; }
          `}</style>
          <div
            ref={scrollerRef}
            className="gavot-filmstrip demo-tinted"
            dir="ltr"
            style={{
              padding: '12px 0',
              overflowX: 'auto',
              overflowY: 'hidden',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              direction: 'ltr',
            }}
          >
            <div style={{ display: 'flex', gap: GAP, width: 'max-content', direction: 'ltr' }}>
              {filmImages.map((src, i) => {
                const isVid = /\.(mp4|webm|mov|ogg)(\?|$)/i.test(src);
                return isVid ? (
                  <video
                    key={i} src={src} draggable={false}
                    autoPlay muted loop playsInline
                    style={{ height: 160, width: ITEM_W, objectFit: 'cover', borderRadius: 'var(--demo-radius-card)', flexShrink: 0, border: '3px solid var(--color-card-tint)' }}
                  />
                ) : (
                  <img
                    key={i} src={src} draggable={false}
                    style={{ height: 160, width: ITEM_W, objectFit: 'cover', borderRadius: 'var(--demo-radius-card)', flexShrink: 0, border: '3px solid var(--color-card-tint)' }}
                    onError={e => { e.target.style.backgroundColor = '#D4B896'; e.target.src = ''; }}
                  />
                );
              })}
            </div>
          </div>

          {/* ── חוצץ שקוף — רקע ה-section (צבע + חומר) נראה דרכו ── */}
          <div style={{ height: 14 }} />

          {/* ── Reverse filmstrip — gallery2, scrolls right ── */}
          <div
            ref={scrollerRef2}
            className="gavot-filmstrip demo-tinted"
            dir="ltr"
            style={{
              padding: '12px 0',
              overflowX: 'auto',
              overflowY: 'hidden',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              direction: 'ltr',
            }}
          >
            <div style={{ display: 'flex', gap: GAP, width: 'max-content', direction: 'ltr' }}>
              {filmImages2.map((src, i) => {
                const isVid = /\.(mp4|webm|mov|ogg)(\?|$)/i.test(src);
                return isVid ? (
                  <video
                    key={i} src={src} draggable={false}
                    autoPlay muted loop playsInline
                    style={{ height: 160, width: ITEM_W, objectFit: 'cover', borderRadius: 'var(--demo-radius-card)', flexShrink: 0, border: '3px solid var(--color-card-tint)' }}
                  />
                ) : (
                  <img
                    key={i} src={src} draggable={false}
                    style={{ height: 160, width: ITEM_W, objectFit: 'cover', borderRadius: 'var(--demo-radius-card)', flexShrink: 0, border: '3px solid var(--color-card-tint)' }}
                    onError={e => { e.target.style.backgroundColor = '#D4B896'; e.target.src = ''; }}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* About flip card — outer wrapper carries .demo-tinted (color + material).
            Inner motion.div has whileInView, which would create a composite layer
            that breaks ::after mix-blend-mode if placed on the tinted element. */}
        <div
          className="demo-tinted"
          style={{ margin: '64px 16px 0', borderRadius: 20, padding: 24, boxShadow: 'var(--demo-shadow-deep)' }}
        >
        <motion.div
          initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.5 }}
        >
          <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 14, color: 'var(--color-section)', textAlign: 'center', marginBottom: 20 }}>
            לחצי על התמונה בשביל לשמוע קצת עליי ✨
          </p>
          <motion.div onClick={() => setFlipped(!flipped)} style={{ perspective: 1500, cursor: 'pointer', maxWidth: 280, margin: '0 auto' }}>
            <motion.div
              animate={{ rotateY: flipped ? 180 : 0 }}
              transition={{ duration: 0.8, type: 'spring', stiffness: 80, damping: 15 }}
              style={{ position: 'relative', width: '100%', aspectRatio: '3/4', transformStyle: 'preserve-3d', WebkitTransformStyle: 'preserve-3d', borderRadius: 'var(--demo-radius-card)' }}
            >
              {/* Front face */}
              <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', borderRadius: 'var(--demo-radius-card)', overflow: 'hidden', boxShadow: 'var(--demo-shadow-deep)' }}>
                {about.mediaType === 'video' && about.videoUrl ? (
                  <video
                    src={about.videoUrl}
                    autoPlay muted loop playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <img
                    src={about.imageUrl || DEFAULT_ABOUT.imageUrl}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => { e.target.style.backgroundColor = '#D4B896'; e.target.src = ''; }}
                  />
                )}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, background: 'linear-gradient(to top, rgba(92,61,46,0.8), transparent)', color: 'var(--color-surface)', fontFamily: 'var(--demo-heading-font)', fontSize: 20, textAlign: 'center' }}>
                  {clinicInfo?.name || ''}
                </div>
              </div>
              {/* Back face */}
              <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)', backgroundColor: 'var(--color-primary)', backgroundImage: 'var(--demo-primary-mat-overlay, none)', border: 'var(--demo-primary-mat-border, none)', borderRadius: 'var(--demo-radius-card)', padding: '24px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', color: 'var(--color-on-primary)', direction: 'rtl', boxShadow: 'var(--demo-shadow-deep)' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 26, fontWeight: 400, marginBottom: 16, textAlign: 'center' }}>קצת עליי</h3>
                  <p style={{ fontSize: 14, lineHeight: 1.8, opacity: 0.95, fontFamily: 'var(--demo-body-font)' }}>
                    {about.text || DEFAULT_ABOUT.text}
                  </p>
                </div>
                {waNum && (
                  <a
                    href={waLink}
                    onClick={e => e.stopPropagation()}
                    style={{ display: 'block', padding: 12, marginTop: 20, backgroundColor: 'var(--color-surface)', color: 'var(--color-primary-ink)', textDecoration: 'none', borderRadius: 'var(--demo-radius-card)', textAlign: 'center', fontFamily: 'var(--demo-body-font)', fontSize: 14, fontWeight: 600, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}
                  >
                    דברי איתי בוואטסאפ
                  </a>
                )}
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
        </div>

        {/* ── Reviews section ── */}
        <div id="section-reviews" style={{ margin: '64px 16px 0' }}>
          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 26, fontWeight: 400, color: 'var(--color-surface)', textAlign: 'center', letterSpacing: '0.05em', marginBottom: 16 }}
          >
            ביקורות לקוחות
          </motion.h2>

          {reviews.length > 0 ? (
            <div className="demo-tinted" style={{ borderRadius: 20, padding: '4px 12px 8px' }}>
              {groups.length > 1 && (
                <button onClick={() => goTo(groupIdx - 1)} style={arrowBtn}>↑</button>
              )}
              <div style={{ position: 'relative', height: CAROUSEL_H, overflow: 'hidden' }}>
                <AnimatePresence mode="wait" custom={dir}>
                  <motion.div
                    key={groupIdx}
                    custom={dir}
                    variants={slideV}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                    style={{
                      position: 'absolute', inset: 0,
                      display: 'grid',
                      gridTemplateColumns: displayCount >= 2 ? '1fr 1fr' : '1fr',
                      gridTemplateRows: displayCount === 4 ? '1fr 1fr' : '1fr',
                      gap: 8,
                    }}
                  >
                    {(groups[groupIdx] || []).map((r, i) => (
                      <motion.div
                        key={r.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08, duration: 0.4, ease: 'easeOut' }}
                      >
                        <ReviewCard review={r} />
                      </motion.div>
                    ))}
                  </motion.div>
                </AnimatePresence>
              </div>
              {groups.length > 1 && (
                <button onClick={() => goTo(groupIdx + 1)} style={arrowBtn}>↓</button>
              )}
            </div>
          ) : (
            <p style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 18, color: 'rgba(253,250,247,0.7)', textAlign: 'center', marginBottom: 8 }}>
              אין עדיין ביקורות
            </p>
          )}

          <motion.button
            onClick={() => setShowForm(true)}
            whileTap={{ scale: 0.97 }}
            style={{ display: 'block', margin: '14px auto 0', padding: '10px 28px', background: 'rgba(253,250,247,0.15)', border: '1px solid rgba(253,250,247,0.45)', borderRadius: 'var(--demo-radius-card)', cursor: 'pointer', fontFamily: 'var(--demo-body-font)', fontSize: 14, color: 'var(--color-surface)' }}
          >
            {reviews.length === 0 ? 'היי הראשונה לכתוב ביקורת ✨' : 'הוסיפי ביקורת'}
          </motion.button>
        </div>
      </div>

      {/* Book button — standalone only */}
      {!embedded && onNavigate && (
        <motion.div initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ padding: '32px 16px 0' }}>
          <motion.button onClick={() => onNavigate('booking')} whileTap={{ scale: 0.97 }} style={{ width: '100%', height: 52, borderRadius: 'var(--demo-radius-card)', backgroundColor: 'rgba(253,250,247,0.9)', color: 'var(--color-primary-ink)', border: 'none', fontFamily: 'var(--demo-body-font)', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: SHADOW }}>
            לקביעת תור ←
          </motion.button>
        </motion.div>
      )}

      <AnimatePresence>
        {showForm && <ReviewForm onClose={() => { setShowForm(false); reloadReviews(); }} />}
      </AnimatePresence>
    </div>
  );
}

function ReviewCard({ review }) {
  return (
    <motion.div
      whileHover={{ y: -3, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      style={{ backgroundColor: 'var(--color-bg)', border: '1px solid rgba(0,0,0,0.16)', borderRadius: 'var(--demo-radius-card)', padding: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>{review.userName}</span>
        <span style={{ display: 'inline-flex', gap: 1, flexShrink: 0, marginInlineStart: 6 }}>
          {Array.from({ length: review.rating }).map((_, i) => (
            <motion.span
              key={i}
              whileHover={{ scale: 1.35, color: '#F5A623', rotate: -8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 14 }}
              style={{ display: 'inline-block', color: '#D4A574', fontSize: 12, cursor: 'default' }}
            >
              ★
            </motion.span>
          ))}
        </span>
      </div>
      <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 12, lineHeight: 1.65, color: 'var(--color-primary-ink)', flex: 1, overflow: 'hidden' }}>{review.text}</p>
    </motion.div>
  );
}

function ReviewForm({ onClose }) {
  const [name, setName]         = useState('');
  const [rating, setRating]     = useState(5);
  const [text, setText]         = useState('');
  const [submitting, setSubmit] = useState(false);

  async function submit() {
    if (!name.trim() || !text.trim()) return alert('מלאי את כל השדות');
    setSubmit(true);
    const res = await db.reviews.create({ userName: name.trim(), rating, text: text.trim() });
    setSubmit(false);
    if (!res.ok) return alert('שגיאה: ' + (res.error?.message || 'לא ידוע'));
    alert('תודה! הביקורת שלך נשלחה לאישור ✨');
    onClose();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <motion.div
        initial={{ scale: 0.85, y: 40 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.85, y: 40 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        onClick={e => e.stopPropagation()}
        style={{ backgroundColor: 'var(--color-surface)', borderRadius: 20, padding: '32px 24px', width: '100%', maxWidth: 380, direction: 'rtl' }}
      >
        <h3 style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 26, fontWeight: 400, color: 'var(--color-text)', marginBottom: 20, textAlign: 'center' }}>השאירי ביקורת</h3>
        <input placeholder="שמך" value={name} onChange={e => setName(e.target.value)} style={inputS} />
        <div style={{ marginBottom: 16, textAlign: 'center' }}>
          <p style={{ color: 'var(--color-primary-ink)', marginBottom: 8, fontSize: 14, fontFamily: 'var(--demo-body-font)' }}>דירוג:</p>
          {[1,2,3,4,5].map(s => (
            <button key={s} onClick={() => setRating(s)} style={{ background: 'none', border: 'none', fontSize: 32, color: s <= rating ? '#D4A574' : '#E8E0D8', cursor: 'pointer', padding: '0 3px' }}>★</button>
          ))}
        </div>
        <textarea placeholder="הביקורת שלך..." value={text} onChange={e => setText(e.target.value)} rows={4} style={{ ...inputS, resize: 'none', marginBottom: 20 }} />
        <motion.button onClick={submit} disabled={submitting} whileTap={{ scale: 0.97 }} style={{ width: '100%', padding: 14, backgroundColor: 'var(--color-section)', backgroundImage: 'var(--demo-section-mat-overlay-sm, none)', border: 'var(--demo-section-mat-border, none)', borderRadius: 'var(--demo-radius-card)', color: 'var(--color-on-section)', fontFamily: 'var(--demo-body-font)', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
          {submitting ? 'שולחת...' : 'שלחי לאישור'}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

const arrowBtn = { display: 'block', width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--color-section)', padding: '6px 0', textAlign: 'center', lineHeight: 1 };
const inputS   = { width: '100%', padding: 12, marginBottom: 16, boxSizing: 'border-box', border: '1.5px solid #D4B896', borderRadius: 'var(--demo-radius-card)', outline: 'none', fontFamily: 'var(--demo-body-font)', fontSize: 15, textAlign: 'right', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' };
