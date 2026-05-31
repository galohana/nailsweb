import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { db } from '../utils/db';

const PASS = 'admin123';

export default function ManageReviews() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw]         = useState('');

  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, direction: 'rtl' }}>
        <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: 20, padding: '36px 28px', width: '100%', maxWidth: 320, textAlign: 'center', boxShadow: '0 2px 16px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04)' }}>
          <h2 style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 28, fontWeight: 400, color: 'var(--color-text)', marginBottom: 24 }}>
            ניהול ביקורות
          </h2>
          <input
            type="password"
            placeholder="סיסמה"
            value={pw}
            onChange={e => setPw(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (pw === PASS ? setAuthed(true) : alert('סיסמה שגויה'))}
            style={{ width: '100%', padding: 12, marginBottom: 16, boxSizing: 'border-box', border: '1.5px solid #D4B896', borderRadius: 'var(--demo-radius-card)', fontFamily: 'var(--demo-body-font)', fontSize: 15, textAlign: 'center', outline: 'none' }}
          />
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => { if (pw === PASS) setAuthed(true); else alert('סיסמה שגויה'); }}
            style={{ width: '100%', padding: 13, backgroundColor: 'var(--color-section)', backgroundImage: 'var(--demo-section-mat-overlay-sm, none)', border: 'var(--demo-section-mat-border, none)', borderRadius: 'var(--demo-radius-card)', color: 'var(--color-surface)', fontFamily: 'var(--demo-body-font)', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
          >
            כניסה
          </motion.button>
        </div>
      </div>
    );
  }

  return <ReviewsAdmin />;
}

function ReviewsAdmin() {
  const [pending, setPending]           = useState([]);
  const [approved, setApproved]         = useState([]);
  const [displayCount, setDisplayCount] = useState(1);
  const [showAddForm, setShowAddForm]   = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [all, count] = await Promise.all([
      db.reviews.list(false),
      db.settings.get('reviewsDisplayCount', 1),
    ]);
    setPending(all.filter(r => r.status === 'pending'));
    setApproved(all.filter(r => r.status === 'approved'));
    setDisplayCount(Number(count) || 1);
  }

  async function approve(id) {
    await db.reviews.approve(id);
    loadAll();
  }

  async function del(id) {
    if (!confirm('למחוק לצמיתות?')) return;
    await db.reviews.delete(id);
    loadAll();
  }

  async function setCount(n) {
    await db.settings.set('reviewsDisplayCount', n);
    setDisplayCount(n);
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg)', padding: '28px 16px 48px', direction: 'rtl' }}>
      <h1 style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 30, fontWeight: 400, color: 'var(--color-text)', marginBottom: 28 }}>
        ניהול ביקורות
      </h1>

      {/* Display count selector */}
      <Section title="כמה ביקורות להציג בכל קבוצה">
        <div style={{ display: 'flex', gap: 10 }}>
          {[1, 2, 4].map(n => (
            <motion.button
              key={n}
              whileTap={{ scale: 0.95 }}
              onClick={() => setCount(n)}
              style={{
                flex: 1, padding: '11px 0', borderRadius: 'var(--demo-radius-card)',
                backgroundColor: displayCount === n ? 'var(--color-section)' : 'var(--color-surface)',
                backgroundImage: displayCount === n ? 'var(--demo-section-mat-overlay-sm, none)' : 'none',
                color: displayCount === n ? 'var(--color-surface)' : 'var(--color-primary)',
                border: '1.5px solid #D4B896',
                fontFamily: 'var(--demo-body-font)', fontSize: 16, fontWeight: 600, cursor: 'pointer',
                transition: 'background 0.2s',
              }}
            >
              {n}
            </motion.button>
          ))}
        </div>
      </Section>

      {/* Add approved review */}
      <Section title="הוסף ביקורת מאושרת">
        {showAddForm ? (
          <AddReviewForm onDone={() => { setShowAddForm(false); loadAll(); }} />
        ) : (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowAddForm(true)}
            style={{ width: '100%', padding: 13, backgroundColor: 'var(--color-section)', backgroundImage: 'var(--demo-section-mat-overlay-sm, none)', border: 'var(--demo-section-mat-border, none)', borderRadius: 'var(--demo-radius-card)', color: 'var(--color-surface)', fontFamily: 'var(--demo-body-font)', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
          >
            + הוסף ביקורת
          </motion.button>
        )}
      </Section>

      {/* Pending */}
      <Section title={`ממתינות לאישור (${pending.length})`}>
        {pending.length === 0 ? (
          <p style={{ color: '#8B6E52', fontSize: 14, fontFamily: 'var(--demo-body-font)' }}>אין ממתינות ✓</p>
        ) : (
          pending.map(r => (
            <ReviewRow key={r.id} review={r} onApprove={() => approve(r.id)} onDelete={() => del(r.id)} showApprove />
          ))
        )}
      </Section>

      {/* Approved */}
      <Section title={`מאושרות (${approved.length})`}>
        {approved.length === 0 ? (
          <p style={{ color: '#8B6E52', fontSize: 14, fontFamily: 'var(--demo-body-font)' }}>אין ביקורות מאושרות עדיין</p>
        ) : (
          approved.map(r => (
            <ReviewRow key={r.id} review={r} onDelete={() => del(r.id)} />
          ))
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: 'var(--demo-radius-card)', padding: '20px 16px', marginBottom: 20, boxShadow: '0 2px 16px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04)' }}>
      <h2 style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 20, fontWeight: 400, color: 'var(--color-text)', marginBottom: 16 }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function ReviewRow({ review, onApprove, onDelete, showApprove = false }) {
  return (
    <div style={{ borderBottom: '1px solid #F0E6DA', paddingBottom: 14, marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--demo-body-font)', fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
          {review.userName}
        </span>
        <span style={{ color: '#D4A574', fontSize: 14 }}>{'★'.repeat(review.rating)}</span>
      </div>
      <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 13, color: 'var(--color-primary)', lineHeight: 1.6, marginBottom: 10 }}>
        {review.text}
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        {showApprove && (
          <motion.button whileTap={{ scale: 0.96 }} onClick={onApprove} style={approveBtn}>אשרי ✓</motion.button>
        )}
        <motion.button whileTap={{ scale: 0.96 }} onClick={onDelete} style={deleteBtn}>מחקי</motion.button>
      </div>
    </div>
  );
}

function AddReviewForm({ onDone }) {
  const [name, setName]     = useState('');
  const [rating, setRating] = useState(5);
  const [text, setText]     = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim() || !text.trim()) return alert('מלאי את כל השדות');
    setSaving(true);
    await db.reviews.createApproved({ userName: name.trim(), rating, text: text.trim() });
    setSaving(false);
    onDone();
  }

  return (
    <div>
      <input
        placeholder="שם"
        value={name}
        onChange={e => setName(e.target.value)}
        style={adminInput}
      />
      <div style={{ marginBottom: 12 }}>
        {[1,2,3,4,5].map(s => (
          <button key={s} onClick={() => setRating(s)} style={{ background: 'none', border: 'none', fontSize: 26, color: s <= rating ? '#D4A574' : '#E8E0D8', cursor: 'pointer', padding: '0 2px' }}>★</button>
        ))}
      </div>
      <textarea
        placeholder="טקסט הביקורת..."
        value={text}
        onChange={e => setText(e.target.value)}
        rows={3}
        style={{ ...adminInput, resize: 'none' }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <motion.button whileTap={{ scale: 0.96 }} onClick={save} disabled={saving} style={{ ...approveBtn, flex: 2 }}>
          {saving ? 'שומר...' : 'שמור ואשר'}
        </motion.button>
        <motion.button whileTap={{ scale: 0.96 }} onClick={onDone} style={{ ...deleteBtn, flex: 1 }}>
          ביטול
        </motion.button>
      </div>
    </div>
  );
}

const approveBtn = {
  flex: 1, padding: '8px 0', backgroundColor: 'var(--color-section)', color: 'var(--color-surface)',
  backgroundImage: 'var(--demo-section-mat-overlay-sm, none)',
  border: 'var(--demo-section-mat-border, none)', borderRadius: 8, fontFamily: 'var(--demo-body-font)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
const deleteBtn = {
  flex: 1, padding: '8px 0', backgroundColor: 'transparent', color: '#C0564B',
  border: '1.5px solid #C0564B', borderRadius: 8, fontFamily: 'var(--demo-body-font)', fontSize: 13, cursor: 'pointer',
};
const adminInput = {
  width: '100%', padding: '10px 12px', marginBottom: 12, boxSizing: 'border-box',
  border: '1.5px solid #D4B896', borderRadius: 'var(--demo-radius-card)', outline: 'none',
  fontFamily: 'var(--demo-body-font)', fontSize: 14, textAlign: 'right',
  backgroundColor: 'var(--color-surface)', color: 'var(--color-text)',
};
