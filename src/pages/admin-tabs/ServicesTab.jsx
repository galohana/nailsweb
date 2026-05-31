import { useState, useEffect, memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit2, Trash2, Check } from 'lucide-react';
import { db } from '../../utils/db';
import * as S from '../../utils/adminStyles';
import ImageUploader from '../../components/ImageUploader';

// ── Form extracted OUTSIDE main component (memoized) ─────────────
// Stable identity → React keeps inputs mounted → keyboard stays open on mobile.
const ServiceForm = memo(function ServiceForm({ form, onChange, onSave, onCancel, saveError }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12, paddingTop: 14, borderTop: '1px solid var(--color-border-soft)' }}>
      <div>
        <label style={S.label}>שם שירות</label>
        <input style={S.input} value={form.name} onChange={e => onChange('name', e.target.value)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={S.label}>משך (דק׳)</label>
          <input style={S.input} type="number" value={form.duration} onChange={e => onChange('duration', e.target.value)} />
        </div>
        <div>
          <label style={S.label}>מחיר (₪)</label>
          <input style={S.input} type="number" value={form.price} onChange={e => onChange('price', e.target.value)} />
        </div>
      </div>
      <ImageUploader
        label="תמונה לשירות (אופציונלי)"
        currentUrl={form.imageUrl || ''}
        onUploaded={url => onChange('imageUrl', url)}
      />
      {saveError && (
        <p style={{ color: '#c0392b', fontSize: 13, fontFamily: 'var(--font-body)', textAlign: 'center' }}>{saveError}</p>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <motion.button whileTap={{ scale: 0.97 }} onClick={onSave} style={{ ...S.primaryBtn, flex: 1, padding: '12px' }}><Check size={16} />שמרי</motion.button>
        <button onClick={onCancel} style={S.secondaryBtn}>ביטול</button>
      </div>
    </div>
  );
});

export default function ServicesTab() {
  const [list, setList] = useState(null);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({ name: '', duration: 30, price: 0, imageUrl: '' });
  const [saveError, setSaveError] = useState(null);

  useEffect(() => { db.services.list().then(setList); }, []);

  // Stable callbacks so memoized ServiceForm doesn't re-render on every parent state change.
  const handleChange = useCallback((k, v) => setForm(p => ({ ...p, [k]: v })), []);
  const handleCancel = useCallback(() => { setEdit(null); setSaveError(null); }, []);

  const save = async () => {
    const p = { name: form.name.trim(), duration: Number(form.duration), price: Number(form.price), imageUrl: form.imageUrl || '' };
    if (!p.name) return;
    setSaveError(null);
    try {
      if (edit === 'new') {
        const c = await db.services.create(p);
        if (!c) { setSaveError('שגיאה בשמירה — בדקי הרשאות Supabase'); return; }
        setList(prev => [...prev, c]);
      } else {
        await db.services.update(edit, p);
        setList(prev => prev.map(s => s.id === edit ? { ...s, ...p } : s));
      }
      setEdit(null);
    } catch (err) {
      setSaveError(err?.message || 'שגיאה בשמירה — בדקי הרשאות Supabase');
    }
  };

  const del = async (id) => {
    if (!confirm('למחוק את השירות?')) return;
    await db.services.delete(id);
    setList(prev => prev.filter(s => s.id !== id));
  };

  const startEdit = (s) => {
    setEdit(s.id);
    setForm({ name: s.name, duration: s.duration, price: s.price, imageUrl: s.imageUrl || '' });
  };

  if (list === null) return <p style={{ ...S.emptyText, padding: '20px 0', textAlign: 'center' }}>טוענת...</p>;

  return (
    <div>
      {list.length === 0 && edit !== 'new' && (
        <div style={S.emptyState}><p style={S.emptyEmoji}>✂️</p><p style={S.emptyText}>אין שירותים עדיין</p></div>
      )}
      {list.map(s => (
        <div key={s.id} style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {s.imageUrl ? (
              <img src={s.imageUrl} alt={s.name}
                style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', objectFit: 'cover', flexShrink: 0 }}
                onError={e => { e.target.style.display = 'none'; }} />
            ) : (
              <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-border-soft)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 20 }}>✂️</span>
              </div>
            )}
            <div style={{ flex: 1 }}>
              <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text)', fontWeight: 600, fontSize: 15 }}>{s.name}</p>
              <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-muted)', fontSize: 13, marginTop: 4 }}>{s.duration} דק׳ · ₪{s.price}</p>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => startEdit(s)} style={{ ...S.secondaryBtn, padding: '8px 10px' }}><Edit2 size={14} /></button>
              <button onClick={() => del(s.id)} style={{ ...S.deleteBtn, padding: '8px 10px' }}><Trash2 size={14} /></button>
            </div>
          </div>
          {edit === s.id && (
            <ServiceForm form={form} onChange={handleChange} onSave={save} onCancel={handleCancel} saveError={saveError} />
          )}
        </div>
      ))}
      {edit === 'new' ? (
        <div style={S.card}>
          <p style={S.heading}>שירות חדש</p>
          <ServiceForm form={form} onChange={handleChange} onSave={save} onCancel={handleCancel} saveError={saveError} />
        </div>
      ) : (
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => { setEdit('new'); setForm({ name: '', duration: 30, price: 0 }); }} style={{ ...S.primaryBtn, marginTop: 4 }}>
          <Plus size={18} />הוסיפי שירות
        </motion.button>
      )}
    </div>
  );
}
