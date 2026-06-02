import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Loader } from 'lucide-react';
import { db } from '../utils/db';
import { storage } from '../utils/storage';

export default function ProfileModal({ user, onClose, onUserUpdate }) {
  const [form, setForm] = useState({
    firstName: '',
    lastName:  '',
    phone: '',
    birthDate: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => {
    if (!user) return;
    setForm({
      firstName: user.firstName || user.first_name || '',
      lastName:  user.lastName  || user.last_name  || '',
      phone:     user.phone || '',
      birthDate: user.birthDate || user.birth_date || '',
    });
  }, [user]);

  const handleSave = async () => {
    if (!form.firstName.trim()) { setError('שם פרטי הוא שדה חובה'); return; }
    setSaving(true);
    setError('');
    try {
      await db.users.update(form.phone, {
        firstName: form.firstName.trim(),
        lastName:  form.lastName.trim(),
        birthDate: form.birthDate || null,
      });
      // Update clients table name too
      await db.clients.create({ phone: form.phone, name: `${form.firstName} ${form.lastName}`.trim() });

      // Sync localStorage
      const newUser = {
        ...user,
        firstName:  form.firstName.trim(),
        first_name: form.firstName.trim(),
        lastName:   form.lastName.trim(),
        last_name:  form.lastName.trim(),
        birthDate:  form.birthDate || user.birthDate,
        birth_date: form.birthDate || user.birthDate,
        name: `${form.firstName} ${form.lastName}`.trim(),
      };
      storage.set('user', newUser);
      onUserUpdate?.(newUser);

      setSaved(true);
      navigator.vibrate?.([30, 20, 30]);
      setTimeout(() => { setSaved(false); onClose(); }, 1200);
    } catch (e) {
      setError('שגיאה בשמירה, נסי שוב');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        key="profile-overlay"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(44,24,16,0.55)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      >
        <motion.div
          key="profile-sheet"
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 280, damping: 30 }}
          onClick={e => e.stopPropagation()}
          style={{
            backgroundColor: 'var(--color-surface)',
            borderRadius: '24px 24px 0 0',
            padding: '28px 24px 48px',
            width: '100%',
            maxWidth: 420,
            direction: 'rtl',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}
        >
          {/* Handle */}
          <div style={{ width: 40, height: 4, backgroundColor: '#D4B896', borderRadius: 2, margin: '0 auto 24px' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h2 style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 26, fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
              הפרופיל שלי
            </h2>
            <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid #E8DCC8', backgroundColor: '#F5EFE6', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={16} color="#7D5A47" />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="שם פרטי" value={form.firstName}
              onChange={v => setForm(p => ({ ...p, firstName: v }))} placeholder="שם פרטי" />
            <Field label="שם משפחה" value={form.lastName}
              onChange={v => setForm(p => ({ ...p, lastName: v }))} placeholder="שם משפחה" />
            <Field label="מספר טלפון" value={form.phone} disabled
              hint="הטלפון הוא המזהה שלך ולא ניתן לשינוי" />
            <Field label="תאריך לידה" value={form.birthDate}
              onChange={v => setForm(p => ({ ...p, birthDate: v }))} type="date" />
          </div>

          {error && (
            <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 13, color: '#A85A4A', marginTop: 14, textAlign: 'center' }}>
              {error}
            </p>
          )}

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleSave}
            disabled={saving || saved}
            style={{
              marginTop: 28,
              width: '100%', height: 52,
              borderRadius: 'var(--demo-radius-card)',
              border: saved ? 'none' : 'var(--demo-primary-mat-border, none)',
              backgroundColor: saved ? '#4CAF50' : 'var(--color-primary)',
              backgroundImage: saved ? 'none' : 'var(--demo-primary-mat-overlay, none)',
              color: 'var(--color-surface)',
              fontFamily: 'var(--demo-body-font)',
              fontSize: 16, fontWeight: 600,
              cursor: saving || saved ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background-color 0.25s',
            }}
          >
            {saved ? (
              <><Check size={18} /> נשמר!</>
            ) : saving ? (
              <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              'שמירת שינויים'
            )}
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', disabled, hint }) {
  return (
    <div>
      <label style={{ fontFamily: 'var(--demo-body-font)', fontSize: 12, fontWeight: 600, color: 'var(--color-primary-ink)', display: 'block', marginBottom: 6 }}>
        {label}
      </label>
      {hint && (
        <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 11, color: '#A89580', marginBottom: 6 }}>{hint}</p>
      )}
      <input
        type={type}
        dir={type === 'date' ? 'ltr' : undefined}
        value={value || ''}
        onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: '100%',
          height: 46,
          borderRadius: 'var(--demo-radius-card)',
          border: '1.5px solid',
          borderColor: disabled ? '#E8DCC8' : '#D4B896',
          backgroundColor: disabled ? '#F5EFE6' : 'var(--color-surface)',
          padding: '0 14px',
          fontFamily: 'var(--demo-body-font)',
          fontSize: 15,
          color: disabled ? '#A89580' : 'var(--color-text)',
          outline: 'none',
          boxSizing: 'border-box',
          display: 'block',
          minWidth: 0,
          ...(type === 'date'
            ? { WebkitAppearance: 'none', appearance: 'none', direction: 'ltr', textAlign: 'left' }
            : { direction: 'rtl', textAlign: 'right' }),
        }}
      />
    </div>
  );
}
