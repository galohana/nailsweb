import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Trash2, Plus } from 'lucide-react';
import { db } from '../../utils/db';
import * as S from '../../utils/adminStyles';

export default function ReviewsTab({ onBadgeUpdate }) {
  const [reviews, setReviews] = useState(null);
  const [count, setCount] = useState(3);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ userName: '', rating: 5, text: '' });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    db.reviews.list().then(setReviews);
    db.settings.get('reviewsDisplayCount', 3).then(v => setCount(v || 3));
  }, []);

  const updCount = (n) => {
    setCount(n);
    db.settings.set('reviewsDisplayCount', n);
    setSaved(true); setTimeout(() => setSaved(false), 1600);
  };
  const approve = async (id) => {
    await db.reviews.approve(id);
    setReviews(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' } : r));
    onBadgeUpdate?.();
  };
  const del = async (id) => {
    if (!confirm('למחוק את הביקורת?')) return;
    await db.reviews.delete(id);
    setReviews(prev => prev.filter(r => r.id !== id));
    onBadgeUpdate?.();
  };
  const addManual = async () => {
    if (!form.userName.trim() || !form.text.trim()) return;
    const r = await db.reviews.createApproved(form);
    if (r?.ok) {
      const list = await db.reviews.list();
      setReviews(list);
      setForm({ userName: '', rating: 5, text: '' });
      setAdding(false);
    }
  };

  if (!reviews) return <p style={{ ...S.emptyText, padding: '20px 0', textAlign: 'center' }}>טוענת...</p>;
  const pending = reviews.filter(r => r.status !== 'approved');
  const approved = reviews.filter(r => r.status === 'approved');

  return (
    <div>
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <p style={S.heading}>כמות ביקורות להציג בדף הבית</p>
          <AnimatePresence>{saved && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ color: '#4CAF50', fontSize: 12 }}>✓ נשמר</motion.span>}</AnimatePresence>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[1, 2, 4].map(n => (
            <button key={n} onClick={() => updCount(n)} style={{ ...S.subTab(count === n), flex: 1 }}>{n}</button>
          ))}
        </div>
      </div>

      {pending.length > 0 && (
        <div style={S.card}>
          <p style={S.heading}>ממתינות לאישור ({pending.length})</p>
          {pending.map(r => (
            <div key={r.id} style={{ padding: '12px 0', borderBottom: '1px solid #F0E6D6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <p style={{ fontFamily: 'var(--demo-body-font)', color: 'var(--color-text)', fontWeight: 600, fontSize: 14 }}>{r.userName}</p>
                <span style={{ color: '#F5A623' }}>{'★'.repeat(r.rating)}</span>
              </div>
              <p style={{ fontFamily: 'var(--demo-body-font)', color: 'var(--color-section)', fontSize: 13, marginBottom: 8 }}>{r.text}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => approve(r.id)} style={{ ...S.primaryBtn, flex: 1, padding: '8px 14px' }}><Check size={14} />אשרי</motion.button>
                <button onClick={() => del(r.id)} style={S.deleteBtn}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={S.card}>
        <p style={S.heading}>מאושרות ({approved.length})</p>
        {approved.length === 0 ? (
          <p style={{ ...S.subText, textAlign: 'center', padding: '20px 0', marginBottom: 0 }}>אין ביקורות מאושרות</p>
        ) : approved.map(r => (
          <div key={r.id} style={{ padding: '10px 0', borderBottom: '1px solid #F0E6D6', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <p style={{ fontFamily: 'var(--demo-body-font)', color: 'var(--color-text)', fontWeight: 500, fontSize: 13 }}>{r.userName}</p>
                <span style={{ color: '#F5A623', fontSize: 12 }}>{'★'.repeat(r.rating)}</span>
              </div>
              <p style={{ fontFamily: 'var(--demo-body-font)', color: 'var(--color-section)', fontSize: 12, marginTop: 3 }}>{r.text}</p>
            </div>
            <button onClick={() => del(r.id)} style={{ ...S.deleteBtn, padding: '6px 10px' }}><Trash2 size={12} /></button>
          </div>
        ))}
      </div>

      {adding ? (
        <div style={S.card}>
          <p style={S.heading}>הוספה ידנית</p>
          <label style={S.label}>שם</label>
          <input style={S.input} value={form.userName} onChange={e => setForm(p => ({ ...p, userName: e.target.value }))} />
          <label style={S.label}>דירוג</label>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} onClick={() => setForm(p => ({ ...p, rating: n }))} style={{ fontSize: 24, background: 'none', border: 'none', cursor: 'pointer', color: form.rating >= n ? '#F5A623' : '#D4B896' }}>★</button>
            ))}
          </div>
          <label style={S.label}>טקסט</label>
          <textarea rows={3} style={{ ...S.input, resize: 'vertical' }} value={form.text} onChange={e => setForm(p => ({ ...p, text: e.target.value }))} />
          <div style={{ display: 'flex', gap: 8 }}>
            <motion.button whileTap={{ scale: 0.97 }} onClick={addManual} style={{ ...S.primaryBtn, flex: 1 }}><Check size={16} />הוסיפי</motion.button>
            <button onClick={() => setAdding(false)} style={S.secondaryBtn}>ביטול</button>
          </div>
        </div>
      ) : (
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => setAdding(true)} style={S.primaryBtn}><Plus size={18} />הוסיפי ביקורת ידנית</motion.button>
      )}
    </div>
  );
}
