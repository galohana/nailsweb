import { useState, useEffect, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit2, Trash2, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { db } from '../../utils/db';
import { fmtDuration } from '../../utils/format';
import * as S from '../../utils/adminStyles';
import ImageUploader from '../../components/ImageUploader';

// ── Base service form ──────────────────────────────────────────────
const BaseForm = memo(function BaseForm({ form, onChange, onSave, onCancel, saveError }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12, paddingTop: 14, borderTop: '1px solid var(--color-border-soft)' }}>
      <div>
        <label style={S.label}>שם שירות</label>
        <input style={S.input} value={form.name} onChange={e => onChange('name', e.target.value)} placeholder="מניקור ג׳ל" />
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
      <ImageUploader label="תמונה (אופציונלי)" currentUrl={form.imageUrl || ''} onUploaded={url => onChange('imageUrl', url)} />
      {saveError && <p style={{ color: '#c0392b', fontSize: 13, fontFamily: 'var(--font-body)', textAlign: 'center' }}>{saveError}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <motion.button whileTap={{ scale: 0.97 }} onClick={onSave} style={{ ...S.primaryBtn, flex: 1, padding: '12px' }}><Check size={16} />שמרי</motion.button>
        <button onClick={onCancel} style={S.secondaryBtn}>ביטול</button>
      </div>
    </div>
  );
});

// ── Addon form (no image) ──────────────────────────────────────────
const AddonForm = memo(function AddonForm({ form, onChange, onSave, onCancel, saveError }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--color-border-soft)' }}>
      <div>
        <label style={S.label}>שם תוספת</label>
        <input style={S.input} value={form.name} onChange={e => onChange('name', e.target.value)} placeholder='פרנץ׳' />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <label style={S.label}>משך נוסף (דק׳)</label>
          <input style={S.input} type="number" value={form.duration} onChange={e => onChange('duration', e.target.value)} />
        </div>
        <div>
          <label style={S.label}>מחיר נוסף (₪)</label>
          <input style={S.input} type="number" value={form.price} onChange={e => onChange('price', e.target.value)} />
        </div>
      </div>
      {saveError && <p style={{ color: '#c0392b', fontSize: 12, fontFamily: 'var(--font-body)' }}>{saveError}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <motion.button whileTap={{ scale: 0.97 }} onClick={onSave} style={{ ...S.primaryBtn, flex: 1, padding: '10px', fontSize: 13 }}><Check size={14} />שמרי תוספת</motion.button>
        <button onClick={onCancel} style={{ ...S.secondaryBtn, fontSize: 12 }}>ביטול</button>
      </div>
    </div>
  );
});

const EMPTY_BASE  = { name: '', duration: 30, price: 0, imageUrl: '' };
const EMPTY_ADDON = { name: '', duration: 0, price: 0 };

export default function ServicesTab() {
  const [allServices, setAllServices] = useState(null);
  // edit state: { type: 'base'|'addon', id: id|'new', parentId? }
  const [editState, setEditState]     = useState(null);
  const [form, setForm]               = useState(EMPTY_BASE);
  const [saveError, setSaveError]     = useState(null);
  const [expanded, setExpanded]       = useState({}); // { serviceId: bool }

  useEffect(() => { db.services.list().then(setAllServices); }, []);

  const handleChange = useCallback((k, v) => setForm(p => ({ ...p, [k]: v })), []);
  const cancelEdit   = useCallback(() => { setEditState(null); setSaveError(null); }, []);

  const baseServices = allServices ? allServices.filter(s => !s.parentId) : [];
  const addonsOf     = (parentId) => (allServices || []).filter(s => s.parentId === parentId);

  // ── Save base service ──────────────────────────────────────────────
  const saveBase = async () => {
    const p = { name: form.name.trim(), duration: Number(form.duration), price: Number(form.price), imageUrl: form.imageUrl || '' };
    if (!p.name) return;
    setSaveError(null);
    try {
      if (editState.id === 'new') {
        const c = await db.services.create(p);
        if (!c) { setSaveError('שגיאה בשמירה'); return; }
        setAllServices(prev => [...prev, c]);
      } else {
        await db.services.update(editState.id, p);
        setAllServices(prev => prev.map(s => s.id === editState.id ? { ...s, ...p } : s));
      }
      setEditState(null);
    } catch (err) { setSaveError(err?.message || 'שגיאה בשמירה'); }
  };

  // ── Save addon ─────────────────────────────────────────────────────
  const saveAddon = async () => {
    const p = { name: form.name.trim(), duration: Number(form.duration), price: Number(form.price), parentId: editState.parentId };
    if (!p.name) return;
    setSaveError(null);
    try {
      if (editState.id === 'new') {
        const c = await db.services.create(p);
        if (!c) { setSaveError('שגיאה בשמירה'); return; }
        setAllServices(prev => [...prev, c]);
      } else {
        await db.services.update(editState.id, p);
        setAllServices(prev => prev.map(s => s.id === editState.id ? { ...s, ...p } : s));
      }
      setEditState(null);
    } catch (err) { setSaveError(err?.message || 'שגיאה בשמירה'); }
  };

  // ── Delete ─────────────────────────────────────────────────────────
  const delService = async (id) => {
    if (!confirm('למחוק? תוספות של שירות זה ייחמקו גם כן.')) return;
    await db.services.delete(id);
    setAllServices(prev => prev.filter(s => s.id !== id && s.parentId !== id));
  };
  const delAddon = async (id) => {
    if (!confirm('למחוק תוספת?')) return;
    await db.services.delete(id);
    setAllServices(prev => prev.filter(s => s.id !== id));
  };

  if (allServices === null) return <p style={{ ...S.emptyText, padding: '20px 0', textAlign: 'center' }}>טוענת...</p>;

  return (
    <div>
      {baseServices.length === 0 && !editState && (
        <div style={S.emptyState}><p style={S.emptyEmoji}>💅</p><p style={S.emptyText}>אין שירותים עדיין</p></div>
      )}

      {baseServices.map(svc => {
        const addons     = addonsOf(svc.id);
        const isExpanded = expanded[svc.id];
        const isEditingBase  = editState?.type === 'base' && editState.id === svc.id;
        const isAddingAddon  = editState?.type === 'addon' && editState.id === 'new' && editState.parentId === svc.id;

        return (
          <div key={svc.id} style={{ ...S.card, marginBottom: 10 }}>
            {/* ── Base service row ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {svc.imageUrl ? (
                <img src={svc.imageUrl} alt={svc.name}
                  style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', objectFit: 'cover', flexShrink: 0 }}
                  onError={e => { e.target.style.display = 'none'; }} />
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-border-soft)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 18 }}>💅</span>
                </div>
              )}
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text)', fontWeight: 600, fontSize: 15 }}>{svc.name}</p>
                <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-muted)', fontSize: 12, marginTop: 2 }}>
                  {fmtDuration(svc.duration)} · ₪{svc.price}
                  {addons.length > 0 && <span style={{ marginInlineStart: 8, color: 'var(--color-primary-ink)', fontWeight: 600 }}>+ {addons.length} תוספות</span>}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <button onClick={() => setExpanded(p => ({ ...p, [svc.id]: !p[svc.id] }))}
                  style={{ ...S.secondaryBtn, padding: '8px 10px' }}>
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                <button onClick={() => { setEditState({ type: 'base', id: svc.id }); setForm({ name: svc.name, duration: svc.duration, price: svc.price, imageUrl: svc.imageUrl || '' }); setSaveError(null); }}
                  style={{ ...S.secondaryBtn, padding: '8px 10px' }}><Edit2 size={14} /></button>
                <button onClick={() => delService(svc.id)}
                  style={{ ...S.deleteBtn, padding: '8px 10px' }}><Trash2 size={14} /></button>
              </div>
            </div>

            {/* ── Edit base form ── */}
            {isEditingBase && (
              <BaseForm form={form} onChange={handleChange} onSave={saveBase} onCancel={cancelEdit} saveError={saveError} />
            )}

            {/* ── Addons list (expanded) ── */}
            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border-soft)' }}>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 8, fontWeight: 600, letterSpacing: '0.05em' }}>תוספות לשירות זה</p>

                    {addons.map(addon => {
                      const isEditingAddon = editState?.type === 'addon' && editState.id === addon.id;
                      return (
                        <div key={addon.id} style={{ marginBottom: 8, padding: '10px 12px', backgroundColor: 'var(--color-brown-07)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-soft)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 14 }}>✨</span>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{addon.name}</p>
                              <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1 }}>+{fmtDuration(addon.duration)} · +₪{addon.price}</p>
                            </div>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button
                                onClick={() => { setEditState({ type: 'addon', id: addon.id, parentId: svc.id }); setForm({ name: addon.name, duration: addon.duration, price: addon.price }); setSaveError(null); }}
                                style={{ ...S.secondaryBtn, padding: '6px 8px' }}><Edit2 size={12} /></button>
                              <button onClick={() => delAddon(addon.id)} style={{ ...S.deleteBtn, padding: '6px 8px' }}><Trash2 size={12} /></button>
                            </div>
                          </div>
                          {isEditingAddon && (
                            <AddonForm form={form} onChange={handleChange} onSave={saveAddon} onCancel={cancelEdit} saveError={saveError} />
                          )}
                        </div>
                      );
                    })}

                    {/* Add addon button / form */}
                    {isAddingAddon ? (
                      <div style={{ padding: '10px 12px', backgroundColor: 'var(--color-success-10)', borderRadius: 'var(--radius-md)', border: '1px dashed rgba(76,175,80,0.3)' }}>
                        <AddonForm form={form} onChange={handleChange} onSave={saveAddon} onCancel={cancelEdit} saveError={saveError} />
                      </div>
                    ) : (
                      <motion.button whileTap={{ scale: 0.97 }}
                        onClick={() => { setEditState({ type: 'addon', id: 'new', parentId: svc.id }); setForm(EMPTY_ADDON); setSaveError(null); }}
                        style={{ ...S.secondaryBtn, width: '100%', marginTop: 4, fontSize: 12, padding: '8px 12px', gap: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Plus size={13} />הוסיפי תוספת
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {/* ── New base service ── */}
      {editState?.type === 'base' && editState.id === 'new' ? (
        <div style={S.card}>
          <p style={S.heading}>שירות חדש</p>
          <BaseForm form={form} onChange={handleChange} onSave={saveBase} onCancel={cancelEdit} saveError={saveError} />
        </div>
      ) : (
        <motion.button whileTap={{ scale: 0.97 }}
          onClick={() => { setEditState({ type: 'base', id: 'new' }); setForm(EMPTY_BASE); setSaveError(null); }}
          style={{ ...S.primaryBtn, marginTop: 4 }}>
          <Plus size={18} />הוסיפי שירות בסיס
        </motion.button>
      )}
    </div>
  );
}
