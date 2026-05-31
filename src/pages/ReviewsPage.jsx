import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../utils/db';

export default function ReviewsPage({ onNavigate }) {
  const [reviews, setReviews]         = useState([]);
  const [displayCount, setDisplayCount] = useState(1);
  const [currentGroup, setCurrentGroup] = useState(0);
  const [direction, setDirection]     = useState(1);
  const [showForm, setShowForm]       = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [rev, count] = await Promise.all([
      db.reviews.list(true),
      db.settings.get('reviewsDisplayCount', 1),
    ]);
    setReviews(rev);
    setDisplayCount(Number(count) || 1);
  }

  const groups = [];
  for (let i = 0; i < reviews.length; i += displayCount) {
    groups.push(reviews.slice(i, i + displayCount));
  }

  useEffect(() => {
    if (groups.length <= 1) return;
    const t = setInterval(() => {
      setDirection(1);
      setCurrentGroup(p => (p + 1) % groups.length);
    }, 3500);
    return () => clearInterval(t);
  }, [groups.length]);

  function goTo(idx) {
    const next = ((idx % groups.length) + groups.length) % groups.length;
    setDirection(idx >= currentGroup ? 1 : -1);
    setCurrentGroup(next);
  }

  const variants = {
    enter:  d => ({ y: d > 0 ? -300 : 300, opacity: 0 }),
    center: { y: 0, opacity: 1 },
    exit:   d => ({ y: d > 0 ? 300 : -300, opacity: 0 }),
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-section)', backgroundImage: 'var(--demo-section-mat-surface)', backgroundRepeat: 'repeat', position: 'relative', paddingTop: 80, paddingBottom: 48, direction: 'rtl' }}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'var(--demo-section-mat-overlay)', mixBlendMode: 'overlay', zIndex: 0 }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
      <h1 style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 36, fontWeight: 400, color: 'var(--color-surface)', textAlign: 'center', marginBottom: 32, letterSpacing: '0.04em' }}>
        ביקורות לקוחות
      </h1>

      {reviews.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 24px' }}>
          <p style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 22, color: 'var(--color-surface)', marginBottom: 28 }}>
            אין עדיין ביקורות. היי הראשונה!
          </p>
          <button onClick={() => setShowForm(true)} style={primaryBtn}>הוסיפי ביקורת</button>
        </div>
      ) : (
        <div style={{ padding: '0 16px' }}>
          {/* Cards */}
          <div style={{ position: 'relative', maxWidth: 400, margin: '0 auto', aspectRatio: '3/4', overflow: 'hidden', borderRadius: 20 }}>
            <AnimatePresence mode="wait" custom={direction}>
              {groups[currentGroup] && (
                <motion.div
                  key={currentGroup}
                  custom={direction}
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                  drag="y"
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={0.4}
                  onDragEnd={(_, { offset }) => {
                    if (offset.y < -80) goTo(currentGroup + 1);
                    else if (offset.y > 80) goTo(currentGroup - 1);
                  }}
                  style={{
                    position: 'absolute', inset: 0,
                    display: 'grid',
                    gridTemplateColumns: displayCount >= 2 ? '1fr 1fr' : '1fr',
                    gridTemplateRows: displayCount === 4 ? '1fr 1fr' : '1fr',
                    gap: 12, cursor: 'grab',
                  }}
                >
                  {groups[currentGroup].map(r => (
                    <ReviewCard key={r.id} review={r} size={displayCount} />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Dot indicators */}
          {groups.length > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
              {groups.map((_, i) => (
                <motion.div
                  key={i}
                  onClick={() => goTo(i)}
                  animate={{
                    height: i === currentGroup ? 24 : 8,
                    backgroundColor: i === currentGroup ? 'var(--color-surface)' : 'rgba(253,250,247,0.4)',
                  }}
                  style={{ width: 8, borderRadius: 4, cursor: 'pointer' }}
                />
              ))}
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <motion.button
              onClick={() => setShowForm(true)}
              whileTap={{ scale: 0.97 }}
              style={{ ...primaryBtn, width: 'auto', padding: '14px 40px', display: 'inline-block' }}
            >
              הוסיפי ביקורת
            </motion.button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showForm && <ReviewForm onClose={() => { setShowForm(false); loadData(); }} />}
      </AnimatePresence>
      </div>
    </div>
  );
}

function ReviewCard({ review, size }) {
  const pad   = size === 1 ? 24 : 16;
  const nameF = size === 1 ? 20 : size === 2 ? 16 : 13;
  const bodyF = size === 1 ? 15 : size === 2 ? 13 : 11;
  const clamp = size === 1 ? 8  : size === 2 ? 5  : 3;

  return (
    <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: 'var(--demo-radius-card)', padding: pad, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: 'var(--demo-shadow-card)' }}>
      <div>
        <h3 style={{ fontFamily: 'var(--demo-heading-font)', fontSize: nameF, color: 'var(--color-text)', marginBottom: 8 }}>
          {review.userName}
        </h3>
        <div style={{ marginBottom: 12, color: '#D4A574', fontSize: nameF }}>
          {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
        </div>
        <p style={{ fontSize: bodyF, lineHeight: 1.65, color: 'var(--color-primary)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: clamp, WebkitBoxOrient: 'vertical' }}>
          {review.text}
        </p>
      </div>
    </div>
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
    const result = await db.reviews.create({ phone: null, userName: name.trim(), rating, text: text.trim() });
    setSubmit(false);
    if (!result) return alert('שגיאה — נסי שוב');
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
        <h3 style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 26, fontWeight: 400, color: 'var(--color-text)', marginBottom: 20, textAlign: 'center' }}>
          השאירי ביקורת
        </h3>

        <input
          placeholder="שמך"
          value={name}
          onChange={e => setName(e.target.value)}
          style={inputStyle}
        />

        <div style={{ marginBottom: 16, textAlign: 'center' }}>
          <p style={{ color: 'var(--color-primary)', marginBottom: 8, fontSize: 14, fontFamily: 'var(--demo-body-font)' }}>דירוג:</p>
          {[1,2,3,4,5].map(s => (
            <button key={s} onClick={() => setRating(s)} style={{ background: 'none', border: 'none', fontSize: 32, color: s <= rating ? '#D4A574' : '#E8E0D8', cursor: 'pointer', padding: '0 3px' }}>★</button>
          ))}
        </div>

        <textarea
          placeholder="הביקורת שלך..."
          value={text}
          onChange={e => setText(e.target.value)}
          rows={4}
          style={{ ...inputStyle, resize: 'none', marginBottom: 20 }}
        />

        <motion.button onClick={submit} disabled={submitting} whileTap={{ scale: 0.97 }} style={primaryBtn}>
          {submitting ? 'שולחת...' : 'שלחי לאישור'}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

const primaryBtn = {
  width: '100%', padding: 14, backgroundColor: 'var(--color-section)', color: 'var(--color-surface)',
  backgroundImage: 'var(--demo-section-mat-overlay-sm, none)',
  border: 'var(--demo-section-mat-border, none)', borderRadius: 'var(--demo-radius-card)', fontFamily: 'var(--demo-body-font)', fontSize: 15,
  fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)',
};

const inputStyle = {
  width: '100%', padding: 12, marginBottom: 16, boxSizing: 'border-box',
  border: '1.5px solid #D4B896', borderRadius: 'var(--demo-radius-card)', outline: 'none',
  fontFamily: 'var(--demo-body-font)', fontSize: 15, textAlign: 'right',
  backgroundColor: 'var(--color-surface)', color: 'var(--color-text)',
};
