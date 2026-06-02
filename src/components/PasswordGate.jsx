import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { db } from '../utils/db';

const FALLBACK_PASSWORD = 'admin123';

export default function PasswordGate({ children }) {
  const [unlocked, setUnlocked] = useState(sessionStorage.getItem('admin_unlocked') === 'true');
  const [pwd, setPwd] = useState('');
  const [error, setError] = useState(false);
  const [adminPassword, setAdminPassword] = useState(null); // null = still loading
  const [loadFailed, setLoadFailed] = useState(false);

  /* Load admin password from Supabase on mount.
     Fallback to 'admin123' if not set (backward compat for existing clinics). */
  useEffect(() => {
    if (unlocked) return; // no need to fetch if already unlocked
    let cancelled = false;
    db.settings.get('adminPassword', FALLBACK_PASSWORD)
      .then((val) => {
        if (cancelled) return;
        const pwd = typeof val === 'string' && val.trim() ? val : FALLBACK_PASSWORD;
        setAdminPassword(pwd);
      })
      .catch(() => {
        if (cancelled) return;
        // Network/db failure — fall back so admin isn't locked out
        setAdminPassword(FALLBACK_PASSWORD);
        setLoadFailed(true);
      });
    return () => { cancelled = true; };
  }, [unlocked]);

  const loading = adminPassword === null;

  function tryUnlock() {
    if (loading) return;
    if (pwd === adminPassword) {
      sessionStorage.setItem('admin_unlocked', 'true');
      setUnlocked(true);
    } else {
      setError(true);
      setTimeout(() => setError(false), 1500);
    }
  }

  if (unlocked) return children;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', direction: 'rtl' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={error ? { opacity: 1, y: 0, x: [-10, 10, -10, 10, 0] } : { opacity: 1, y: 0 }}
        style={{ width: '100%', maxWidth: '360px', backgroundColor: 'var(--color-surface)', borderRadius: '20px', padding: '40px 28px', textAlign: 'center', boxShadow: '0 8px 40px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)' }}
      >
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Lock size={28} color="#5C3D2E" strokeWidth={1.5} />
        </div>
        <h2 style={{ fontFamily: 'var(--demo-heading-font)', fontSize: '26px', color: 'var(--color-text)', marginBottom: '8px', fontWeight: 500 }}>ניהול הסטודיו</h2>
        <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: '13px', color: 'var(--color-section)', marginBottom: '24px' }}>
          {loading ? 'טוענת...' : 'הזיני סיסמת ניהול'}
        </p>
        <input
          type="password"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && tryUnlock()}
          placeholder="••••••••"
          disabled={loading}
          style={{ width: '100%', padding: '14px', marginBottom: '16px', border: error ? '1.5px solid #A85A4A' : '1px solid #E8DCC8', borderRadius: '12px', fontFamily: 'var(--demo-body-font)', fontSize: '16px', textAlign: 'center', outline: 'none', boxSizing: 'border-box', opacity: loading ? 0.5 : 1 }}
        />
        <motion.button
          whileTap={loading ? {} : { scale: 0.97 }}
          onClick={tryUnlock}
          disabled={loading}
          style={{ width: '100%', padding: '14px', backgroundColor: 'var(--color-primary)', backgroundImage: 'var(--demo-primary-mat-overlay, none)', color: 'var(--color-on-primary)', border: 'var(--demo-primary-mat-border, none)', borderRadius: '12px', fontFamily: 'var(--demo-body-font)', fontSize: '15px', fontWeight: 600, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.5 : 1 }}
        >
          כניסה
        </motion.button>
        {loadFailed && (
          <p style={{ marginTop: 12, fontSize: 11, color: '#A85A4A', fontFamily: 'var(--demo-body-font)' }}>
            שגיאת רשת — נסי שוב
          </p>
        )}
      </motion.div>
    </div>
  );
}
