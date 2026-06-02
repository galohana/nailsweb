import { useState, useEffect, memo, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Trash2, Check, Edit2, Calendar } from 'lucide-react';
import { db } from '../../utils/db';
import * as S from '../../utils/adminStyles';
import ImageUploader from '../../components/ImageUploader';
import StaffHoursEditor from '../../components/StaffHoursEditor';

// ── Form extracted OUTSIDE main component (memoized) ─────────────
// Stable identity → React keeps inputs mounted → keyboard stays open on mobile.
const StaffForm = memo(function StaffForm({ form, onChange, onUploadImage, onSave, onCancel }) {
  return (
    <div style={{ marginTop: 12, paddingTop: 14, borderTop: '1px solid #F0E6D6' }}>
      <ImageUploader
        label="תמונת עובדת (אופציונלי)"
        currentUrl={form.imageUrl || ''}
        onUploaded={onUploadImage}
      />
      <label style={S.label}>שם</label>
      <input style={S.input} value={form.name} onChange={e => onChange('name', e.target.value)} />
      <label style={S.label}>טלפון</label>
      <input style={S.input} type="tel" dir="ltr" value={form.phone} onChange={e => onChange('phone', e.target.value)} />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <motion.button whileTap={{ scale: 0.97 }} onClick={onSave} style={{ ...S.primaryBtn, flex: 1 }}><Check size={16} />שמרי</motion.button>
        <button onClick={onCancel} style={S.secondaryBtn}>ביטול</button>
      </div>
    </div>
  );
});

export default function StaffTab() {
  const [list, setList]     = useState(null);
  const [edit, setEdit]     = useState(null);   // staffId or 'new' or null
  const [form, setForm]     = useState({ name: '', phone: '', imageUrl: '' });
  const [hoursFor, setHoursFor] = useState(null);  // {id, name} or null

  useEffect(() => { db.staff.list().then(setList); }, []);

  // Stable callbacks so memoized form doesn't re-render on parent state churn
  const handleChange      = useCallback((k, v) => setForm(p => ({ ...p, [k]: v })), []);
  const handleUploadImage = useCallback((url) => setForm(p => ({ ...p, imageUrl: url })), []);
  const handleCancel      = useCallback(() => setEdit(null), []);

  const startEdit = (s) => {
    setEdit(s.id);
    setForm({ name: s.name || '', phone: s.phone || '', imageUrl: s.imageUrl || '' });
  };

  const save = async () => {
    if (!form.name.trim()) return;
    const payload = { name: form.name.trim(), phone: form.phone.trim(), imageUrl: form.imageUrl || '' };
    if (edit === 'new') {
      const c = await db.staff.create(payload);
      if (c) setList(prev => [...prev, c]);
    } else {
      await db.staff.update(edit, payload);
      setList(prev => prev.map(s => s.id === edit ? { ...s, ...payload } : s));
    }
    setEdit(null);
    setForm({ name: '', phone: '', imageUrl: '' });
  };

  const remove = async (id) => {
    if (!confirm('להסיר את העובדת?')) return;
    await db.staff.delete(id);
    setList(prev => prev.filter(s => s.id !== id));
  };

  if (list === null) return <p style={{ ...S.emptyText, padding: '20px 0', textAlign: 'center' }}>טוענת...</p>;

  return (
    <div>
      {list.length === 0 && edit !== 'new' && (
        <div style={S.emptyState}><p style={S.emptyEmoji}>👥</p><p style={S.emptyText}>אין עובדות עדיין</p></div>
      )}

      {list.map(s => (
        <div key={s.id} style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {s.imageUrl ? (
              <img src={s.imageUrl} alt={s.name}
                style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: '1px solid #F0E6D6', flexShrink: 0 }}
                onError={e => { e.target.style.display = 'none'; }} />
            ) : (
              <div style={{ width: 52, height: 52, borderRadius: '50%', backgroundColor: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 22, fontWeight: 600, color: 'var(--color-surface)' }}>
                  {(s.name || '?').charAt(0)}
                </span>
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: 'var(--demo-body-font)', color: 'var(--color-text)', fontWeight: 600, fontSize: 15 }}>{s.name}</p>
              {s.phone && <p style={{ fontFamily: 'var(--demo-body-font)', color: 'var(--color-section)', fontSize: 13, marginTop: 3 }} dir="ltr">{s.phone}</p>}
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={() => startEdit(s)} style={{ ...S.secondaryBtn, padding: '8px 10px' }} title="עריכה"><Edit2 size={14} /></button>
              <button onClick={() => remove(s.id)} style={{ ...S.deleteBtn, padding: '8px 10px' }} title="מחיקה"><Trash2 size={14} /></button>
            </div>
          </div>

          {/* Hours & breaks button (always visible per staff) */}
          {edit !== s.id && (
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={() => setHoursFor({ id: s.id, name: s.name })}
              style={{
                width: '100%', marginTop: 12,
                padding: '10px', borderRadius: 'var(--demo-radius-card)',
                border: '1px solid #E8DCC8', backgroundColor: 'transparent',
                color: 'var(--color-primary-ink)', fontFamily: 'var(--demo-body-font)', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
              <Calendar size={14} />שעות וחופשות
            </motion.button>
          )}

          {edit === s.id && (
            <StaffForm
              form={form}
              onChange={handleChange}
              onUploadImage={handleUploadImage}
              onSave={save}
              onCancel={handleCancel}
            />
          )}
        </div>
      ))}

      {list.length < 5 && (edit === 'new' ? (
        <div style={S.card}>
          <p style={S.heading}>עובדת חדשה</p>
          <StaffForm
            form={form}
            onChange={handleChange}
            onUploadImage={handleUploadImage}
            onSave={save}
            onCancel={handleCancel}
          />
        </div>
      ) : (
        <motion.button whileTap={{ scale: 0.97 }}
          onClick={() => { setEdit('new'); setForm({ name: '', phone: '', imageUrl: '' }); }}
          style={{ ...S.primaryBtn, marginTop: 4 }}>
          <Plus size={18} />הוסיפי עובדת
        </motion.button>
      ))}
      {list.length >= 5 && <p style={{ ...S.subText, textAlign: 'center', marginTop: 12 }}>מקסימום 5 עובדות</p>}

      {/* Hours editor sheet */}
      <AnimatePresence>
        {hoursFor && (
          <StaffHoursEditor
            staffId={hoursFor.id}
            staffName={hoursFor.name}
            onClose={() => setHoursFor(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
