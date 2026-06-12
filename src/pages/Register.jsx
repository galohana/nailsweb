import React, { useState, useEffect } from 'react';
import { db } from '../utils/db';
import { digitsOnly } from '../utils/format';
import { DEFAULT_TERMS } from '../utils/defaults';
import { notifyOwnerNewClient, notifyClientWelcome, sendOtp, verifyOtp } from '../utils/sms';
import PageHeader from '../components/PageHeader';

const C = {
  bg:      'var(--color-bg)',
  surface: 'var(--color-surface)',
  accent:  'var(--color-primary)',
  brown:   'var(--color-border-alt)',
  text:    'var(--color-text)',
  muted:   'var(--color-text-muted)',
  border:  'var(--color-border-dark)',
};

const S = {
  input: {
    backgroundColor: C.surface, border: `1px solid ${C.border}`,
    borderRadius: 'var(--demo-radius-card)', color: C.text, padding: '11px 14px',
    fontSize: 14, width: '100%', outline: 'none',
    boxSizing: 'border-box', maxWidth: '100%',
  },
  label: { color: C.muted, fontSize: 12, marginBottom: 5, display: 'block' },
  btn: {
    backgroundColor: C.accent, color: 'var(--color-surface)', border: 'none',
    borderRadius: 'var(--demo-radius-card)', height: 48, width: '100%', fontWeight: 700,
    fontSize: 15, cursor: 'pointer',
    boxShadow: 'var(--shadow-btn)',
  },
};

export default function Register({ onUserSave, onNavigate, onPrivacy }) {
  const [mode, setMode]     = useState('choice');   // 'choice' | 'register' | 'login' | 'terms' | 'otp'
  const [terms, setTerms]   = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    firstName: '', lastName: '', phone: '', birthDate: '', gender: '', // 'male' | 'female'
  });
  const [successOpen, setSuccessOpen] = useState(false);

  // ── Gender palette — used here + later in ClientsTab via the same logic ──
  // הצבע פעיל ברגע שהמשתמשת בוחרת מין, צובע את ה-checkbox של התקנון, מסגרת בכרטיס וכו'
  const GENDER_COLORS = {
    male:   { solid: '#4A90E2', soft: 'rgba(74,144,226,0.10)', border: 'rgba(74,144,226,0.35)' },
    female: { solid: '#E91E8C', soft: 'rgba(233,30,140,0.10)', border: 'rgba(233,30,140,0.35)' },
  };
  const genderColor = form.gender ? GENDER_COLORS[form.gender] : null;

  // OTP state
  const [otpCode, setOtpCode]         = useState(['', '', '', '']);
  const [otpError, setOtpError]       = useState('');
  const [otpCooldown, setOtpCooldown] = useState(0); // seconds remaining for resend

  const [loginPhone, setLoginPhone] = useState('');

  useEffect(() => {
    db.settings.get('terms', DEFAULT_TERMS).then(t => {
      setTerms(typeof t === 'string' ? t : DEFAULT_TERMS);
    });
  }, []);

  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const focusStyle  = e => (e.target.style.borderColor = C.accent);
  const blurStyle   = e => (e.target.style.borderColor = C.border);

  // ── Register flow ────────────────────────────────────────────
  const doRegister = async () => {
    if (!form.firstName.trim() || !form.phone.trim()) {
      setError('נא למלא שם פרטי ומספר טלפון'); return;
    }
    if (!form.gender) { setError('נא לבחור מין'); return; }
    if (!agreed) { setError('יש לאשר את התקנון לפני ההרשמה'); return; }

    // Normalize: strip everything except digits
    const phoneDigits = digitsOnly(form.phone.trim());
    if (phoneDigits.length < 9 || phoneDigits.length > 10) {
      setError('מספר טלפון לא תקין — נא להזין 10 ספרות'); return;
    }

    setLoading(true); setError('');

    const blocked = await db.clients.isBlocked(phoneDigits);
    if (blocked) { setError('מספר זה חסום.'); setLoading(false); return; }

    // Duplicate check — only against the `clients` table (active accounts).
    // Exception: if the phone is in deletedAccounts OR permanentlyDeletedPhones →
    // allow re-registration even if the clients row wasn't fully purged (RLS).
    const [deletedList, permDeletedList] = await Promise.all([
      db.settings.get('deletedAccounts', []).catch(() => []),
      db.settings.get('permanentlyDeletedPhones', []).catch(() => []),
    ]);
    const wasDeleted = (Array.isArray(deletedList) &&
      deletedList.some(p => digitsOnly(p) === phoneDigits)) ||
      (Array.isArray(permDeletedList) &&
      permDeletedList.some(p => digitsOnly(p) === phoneDigits));

    if (!wasDeleted) {
      const existingClient = await db.clients.findByDigits(phoneDigits).catch(() => null);
      if (existingClient) {
        setError('מספר הטלפון הזה כבר רשום במערכת. אם שכחת להתחבר — חזרי לדף הבית ולחצי על כניסה');
        setLoading(false);
        return;
      }
    }

    // ── Send OTP, switch to verification screen ──
    const result = await sendOtp(phoneDigits);
    setLoading(false);
    if (!result.ok) {
      if (result.error === 'rate_limited') {
        setError(`נא להמתין ${result.retryAfter || 60} שניות לפני שליחה חוזרת`);
      } else {
        setError('שליחת קוד אימות נכשלה. נסי שוב או פני אלינו.');
      }
      return;
    }
    setOtpCode(['', '', '', '']);
    setOtpError('');
    setOtpCooldown(30);
    setMode('otp');
  };

  // ── OTP cooldown timer ─────────────────────────────────────
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const t = setTimeout(() => setOtpCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [otpCooldown]);

  const resendOtp = async () => {
    if (otpCooldown > 0) return;
    const phoneDigits = digitsOnly(form.phone.trim());
    setOtpError('');
    const result = await sendOtp(phoneDigits);
    if (!result.ok) {
      setOtpError(result.error === 'rate_limited'
        ? `המתיני ${result.retryAfter || 60} שניות`
        : 'שליחה חוזרת נכשלה');
      return;
    }
    setOtpCooldown(30);
  };

  const confirmOtp = async () => {
    const code = otpCode.join('');
    if (code.length !== 4) { setOtpError('נא להזין 4 ספרות'); return; }
    setLoading(true); setOtpError('');

    const phoneDigits = digitsOnly(form.phone.trim());
    const v = await verifyOtp(phoneDigits, code);
    if (!v.ok) {
      setLoading(false);
      if (v.error === 'expired')    setOtpError('הקוד פג תוקף. בקשי קוד חדש.');
      else if (v.error === 'mismatch') setOtpError('קוד שגוי. נסי שוב.');
      else if (v.error === 'not_found') setOtpError('לא נמצא קוד. בקשי קוד חדש.');
      else                              setOtpError('האימות נכשל. נסי שוב.');
      return;
    }

    // Verified — now create the account
    const firstName = form.firstName.trim();
    const lastName  = form.lastName.trim();
    const fullName  = `${firstName} ${lastName}`.trim();
    const phone     = phoneDigits;
    const gender    = form.gender; // 'male' | 'female' — required by validation above
    // Accounts live in `clients` only (no users table in this Supabase project).
    // Note: birthDate is collected but not persisted (no column for it).
    await db.clients.create({ phone, name: fullName });

    // Persist gender in settings.userGenders (map keyed by phone digits) —
    // no schema change needed, works against current Supabase tables.
    try {
      const cur = await db.settings.get('userGenders', {});
      const map = (cur && typeof cur === 'object') ? cur : {};
      await db.settings.set('userGenders', { ...map, [phone]: gender });
    } catch (e) { console.warn('[register] save gender failed:', e.message); }

    // Re-registration: clear deleted flags (soft + permanent) for this phone
    try {
      const [cur, curPerm] = await Promise.all([
        db.settings.get('deletedAccounts', []),
        db.settings.get('permanentlyDeletedPhones', []),
      ]);
      const p = phoneDigits;
      await Promise.all([
        Array.isArray(cur) && cur.some(x => digitsOnly(x) === p)
          ? db.settings.set('deletedAccounts', cur.filter(x => digitsOnly(x) !== p))
          : Promise.resolve(),
        Array.isArray(curPerm) && curPerm.some(x => digitsOnly(x) === p)
          ? db.settings.set('permanentlyDeletedPhones', curPerm.filter(x => digitsOnly(x) !== p))
          : Promise.resolve(),
      ]);
    } catch (e) { console.warn('[register] clear deleted flags failed:', e.message); }

    notifyOwnerNewClient({ clientName: fullName, clientPhone: phone });
    notifyClientWelcome({ clientName: firstName, clientPhone: phone });

    onUserSave({ name: fullName, firstName, lastName, phone, gender });
    setLoading(false);
    setSuccessOpen(true);
    setTimeout(() => onNavigate('home'), 1800);
  };

  const updateOtpDigit = (idx, val) => {
    const d = digitsOnly(val).slice(-1);
    setOtpCode(prev => {
      const next = [...prev];
      next[idx] = d;
      return next;
    });
    if (d && idx < 3) {
      const nextInput = document.getElementById(`otp-${idx + 1}`);
      nextInput?.focus();
    }
  };

  const handleOtpKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !otpCode[idx] && idx > 0) {
      const prev = document.getElementById(`otp-${idx - 1}`);
      prev?.focus();
    }
  };

  // ── Login flow (returning user) ──────────────────────────────
  const doLogin = async () => {
    const raw    = loginPhone.trim();
    const digits = digitsOnly(raw);
    if (!digits) { setError('נא להזין מספר טלפון'); return; }
    if (digits.length < 9 || digits.length > 10) {
      setError('מספר טלפון לא תקין — נא להזין 10 ספרות');
      return;
    }
    setLoading(true); setError('');

    const blocked = await db.clients.isBlocked(digits);
    if (blocked) { setError('מספר זה חסום.'); setLoading(false); return; }

    const [deletedList, permDeletedList] = await Promise.all([
      db.settings.get('deletedAccounts', []).catch(() => []),
      db.settings.get('permanentlyDeletedPhones', []).catch(() => []),
    ]);
    const wasDeleted =
      (Array.isArray(deletedList) && deletedList.some(p => digitsOnly(p) === digits)) ||
      (Array.isArray(permDeletedList) && permDeletedList.some(p => digitsOnly(p) === digits));
    if (wasDeleted) {
      setError('חשבון זה נמחק. כדי להשתמש שוב — אנא הירשמי מחדש.');
      setLoading(false);
      return;
    }

    // 1) Clients table — accounts live here
    const clientData = await db.clients.findByDigits(digits).catch(() => null);
    if (clientData?.name) {
      const [firstName, ...rest] = String(clientData.name).split(/\s+/);
      onUserSave({
        name: clientData.name,
        firstName: firstName || clientData.name,
        lastName: rest.join(' '),
        phone: digits,
      });
      setLoading(false); onNavigate('home'); return;
    }

    // 2) Legacy customers — only in appointments table
    const apts = await db.appointments.byPhoneDigits(digits).catch(() => []);
    if (Array.isArray(apts) && apts.length > 0) {
      const rawName = (apts[0].userName || '').trim();
      const [firstName, ...rest] = rawName.split(/\s+/);
      if (firstName) {
        onUserSave({
          name: rawName, firstName, lastName: rest.join(' '), phone: digits,
        });
        setLoading(false); onNavigate('home'); return;
      }
    }

    // 3) Not found — explicit error, no phone-as-name fallback
    setError('המספר לא נמצא במערכת. אם זו פעם ראשונה — חזרי לדף הבית והירשמי.');
    setLoading(false);
  };

  // ── Choice screen ─────────────────────────────────────────────
  if (mode === 'choice') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-5" style={{ backgroundColor: C.bg, paddingTop: 80 }}>
        <PageHeader />
        <p style={{ color: C.muted, fontSize: 14, marginBottom: 40 }}>שמחות שבאת 💕</p>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            onClick={() => setMode('register')}
            style={{ ...S.btn, height: 52 }}
          >
            הרשמה — לקוחה חדשה ✨
          </button>
          <button
            onClick={() => setMode('login')}
            style={{
              height: 48, width: '100%', borderRadius: 'var(--demo-radius-card)',
              border: `1.5px solid ${C.accent}`, backgroundColor: C.surface,
              color: C.accent, fontWeight: 700, fontSize: 15, cursor: 'pointer',
            }}
          >
            כניסה — לקוחה קיימת
          </button>
        </div>

        <button
          onClick={() => onNavigate('home')}
          style={{ marginTop: 24, color: C.muted, fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}
        >
          חזרה לדף הבית
        </button>
      </div>
    );
  }

  // ── Login screen ─────────────────────────────────────────────
  if (mode === 'login') {
    return (
      <div className="min-h-screen flex flex-col px-5" style={{ backgroundColor: C.bg, paddingTop: 80 }}>
        <PageHeader />
        <button onClick={() => { setMode('choice'); setError(''); }} style={{ color: C.muted, fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'right', marginBottom: 24 }}>
          ← חזרה
        </button>
        <h2 style={{ fontSize: 22, fontWeight: 600, color: C.text, marginBottom: 6 }}>כניסה</h2>
        <p style={{ color: C.muted, fontSize: 13, marginBottom: 28 }}>הכניסי את מספר הטלפון שלך</p>

        <div style={{ marginBottom: 16 }}>
          <label style={S.label}>מספר טלפון</label>
          <input
            type="tel" dir="ltr"
            value={loginPhone}
            onChange={e => setLoginPhone(e.target.value)}
            placeholder="050-0000000"
            style={S.input}
            onFocus={focusStyle} onBlur={blurStyle}
          />
        </div>

        {error && <p style={{ color: '#E57373', fontSize: 13, marginBottom: 12 }}>{error}</p>}

        <button onClick={doLogin} disabled={loading} style={{ ...S.btn, opacity: loading ? 0.7 : 1 }}>
          {loading ? 'מחפשת...' : 'כניסה ←'}
        </button>

        <div style={{ marginTop: 28, textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => { setMode('register'); setError(''); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 12px', fontFamily: 'var(--demo-body-font)', fontSize: 13, color: C.muted }}
          >
            עדיין לא רשומה?{' '}
            <span style={{ color: C.accent, fontWeight: 700, textDecoration: 'underline' }}>הירשמי כאן</span>
          </button>
        </div>
      </div>
    );
  }

  // ── OTP verification screen ────────────────────────────────────
  if (mode === 'otp') {
    const filled = otpCode.every(d => d !== '');
    return (
      <div className="min-h-screen flex flex-col px-5" style={{ backgroundColor: C.bg, paddingTop: 80 }}>
        <PageHeader />
        <button onClick={() => { setMode('register'); setOtpError(''); }} style={{ color: C.muted, fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'right', marginBottom: 24 }}>
          ← חזרה
        </button>
        <h2 style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 26, fontWeight: 600, color: C.text, marginBottom: 8 }}>אימות מספר טלפון</h2>
        <p style={{ color: C.muted, fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>
          שלחנו קוד בן 4 ספרות ל-<span dir="ltr" style={{ fontWeight: 600, color: C.text }}>{form.phone}</span>
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 20, direction: 'ltr' }}>
          {otpCode.map((digit, i) => (
            <input
              key={i}
              id={`otp-${i}`}
              type="tel"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              autoFocus={i === 0}
              onChange={e => updateOtpDigit(i, e.target.value)}
              onKeyDown={e => handleOtpKeyDown(i, e)}
              onFocus={focusStyle}
              onBlur={blurStyle}
              style={{
                width: 56, height: 64, textAlign: 'center',
                fontSize: 26, fontWeight: 700, color: C.text,
                backgroundColor: C.surface,
                border: `1.5px solid ${digit ? C.accent : C.border}`,
                borderRadius: 'var(--demo-radius-card)', outline: 'none',
                fontFamily: 'var(--demo-body-font)',
                boxSizing: 'border-box',
              }}
            />
          ))}
        </div>

        {otpError && (
          <p style={{ color: '#E57373', fontSize: 13, marginBottom: 14, textAlign: 'center' }}>{otpError}</p>
        )}

        <button
          onClick={confirmOtp}
          disabled={!filled || loading}
          style={{ ...S.btn, opacity: (!filled || loading) ? 0.5 : 1, marginBottom: 14 }}
        >
          {loading ? 'מאמתת...' : 'אימות ←'}
        </button>

        <div style={{ textAlign: 'center' }}>
          <button
            type="button"
            onClick={resendOtp}
            disabled={otpCooldown > 0}
            style={{ background: 'none', border: 'none', cursor: otpCooldown > 0 ? 'default' : 'pointer', padding: '8px 12px', fontFamily: 'var(--demo-body-font)', fontSize: 13, color: otpCooldown > 0 ? C.muted : C.accent, fontWeight: 600, textDecoration: otpCooldown > 0 ? 'none' : 'underline' }}
          >
            {otpCooldown > 0 ? `שלחי קוד חדש (${otpCooldown})` : 'שלחי קוד חדש'}
          </button>
        </div>
      </div>
    );
  }

  // ── Terms overlay ─────────────────────────────────────────────
  if (mode === 'terms') {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: C.bg, paddingTop: 60 }}>
        <PageHeader />
        <div className="px-5 pt-6 pb-4 flex items-center gap-3" style={{ borderBottom: `1px solid ${C.border}` }}>
          <button onClick={() => setMode('register')} style={{ color: C.muted, fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}>← חזרה</button>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: C.text }}>תקנון</h2>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <p style={{ color: C.text, fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{terms}</p>
        </div>
        <div className="px-5 pb-8 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
          <button
            onClick={() => { setAgreed(true); setMode('register'); }}
            style={{ ...S.btn }}
          >
            קראתי ומסכימה ✓
          </button>
        </div>
      </div>
    );
  }

  // ── Register form ─────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col px-5 pb-8" style={{ backgroundColor: C.bg, paddingTop: 80 }}>
      <PageHeader />
      <button onClick={() => { setMode('choice'); setError(''); }} style={{ color: C.muted, fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'right', marginBottom: 20 }}>
        ← חזרה
      </button>
      <h2 style={{ fontSize: 22, fontWeight: 600, color: C.text, marginBottom: 6 }}>הרשמה</h2>
      <p style={{ color: C.muted, fontSize: 13, marginBottom: 24 }}>מלאי את הפרטים כדי להצטרף 💕</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={S.label}>שם פרטי *</label>
            <input type="text" dir="rtl" value={form.firstName} onChange={e => upd('firstName', e.target.value)}
              placeholder="שם" style={S.input} onFocus={focusStyle} onBlur={blurStyle} />
          </div>
          <div>
            <label style={S.label}>שם משפחה *</label>
            <input type="text" dir="rtl" value={form.lastName} onChange={e => upd('lastName', e.target.value)}
              placeholder="משפחה" style={S.input} onFocus={focusStyle} onBlur={blurStyle} />
          </div>
        </div>

        <div>
          <label style={S.label}>מספר טלפון *</label>
          <input type="tel" dir="ltr" value={form.phone} onChange={e => upd('phone', e.target.value)}
            placeholder="050-0000000" style={S.input} onFocus={focusStyle} onBlur={blurStyle} />
        </div>

        <div>
          <label style={S.label}>תאריך לידה</label>
          <input type="date" value={form.birthDate} onChange={e => upd('birthDate', e.target.value)}
            style={{ ...S.input, display: 'block', color: form.birthDate ? C.text : C.muted, WebkitAppearance: 'none', appearance: 'none', height: 42, padding: '0 14px', lineHeight: '42px' }} onFocus={focusStyle} onBlur={blurStyle} />
        </div>

        {/* Gender selector — required */}
        <div>
          <label style={S.label}>מין *</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { val: 'female', label: 'נקבה', icon: '♀' },
              { val: 'male',   label: 'זכר',  icon: '♂' },
            ].map(opt => {
              const sel = form.gender === opt.val;
              const c   = GENDER_COLORS[opt.val];
              return (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => { try { navigator.vibrate?.(15); } catch {} upd('gender', opt.val); }}
                  style={{
                    height: 48,
                    backgroundColor: sel ? c.soft : C.surface,
                    border: `1.5px solid ${sel ? c.solid : C.border}`,
                    borderRadius: 'var(--demo-radius-card)',
                    color: sel ? c.solid : C.muted,
                    fontWeight: sel ? 700 : 500,
                    fontSize: 14, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'all 0.18s ease',
                    boxShadow: sel ? `0 2px 10px ${c.soft}` : 'none',
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{opt.icon}</span>
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Terms checkbox — checkmark + frame tint to selected gender */}
        <div
          style={{
            backgroundColor: agreed ? (genderColor ? genderColor.soft : 'var(--color-brown-07)') : 'var(--color-menu)',
            border: `1px solid ${agreed ? (genderColor ? genderColor.solid : C.accent) : C.border}`,
            borderRadius: 'var(--demo-radius-card)', padding: 14,
            transition: 'background-color 0.2s, border-color 0.2s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              style={{
                marginTop: 2, width: 18, height: 18, flexShrink: 0,
                accentColor: genderColor ? genderColor.solid : C.accent,
                cursor: 'pointer',
              }}
            />
            <p style={{ color: C.text, fontSize: 13, lineHeight: 1.5 }}>
              קראתי ומסכימה ל
              <button
                onClick={() => setMode('terms')}
                style={{ color: C.accent, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
              >
                תקנון
              </button>
              {' '}ול
              <button
                onClick={() => onNavigate('privacy')}
                style={{ color: C.accent, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
              >
                מדיניות הפרטיות
              </button>
              {' '}של הקליניקה
            </p>
          </div>
          {!agreed && (
            <p style={{ color: C.muted, fontSize: 11, marginTop: 6 }}>
              חובה לאשר את התקנון לפני ההרשמה
            </p>
          )}
        </div>

        {error && (
          <p style={{ color: '#E57373', fontSize: 13, padding: '8px 12px', backgroundColor: 'rgba(229,115,115,0.06)', borderRadius: 8, border: '1px solid rgba(229,115,115,0.2)' }}>
            {error}
          </p>
        )}

        <button
          onClick={doRegister}
          disabled={loading || !agreed}
          style={{ ...S.btn, opacity: (loading || !agreed) ? 0.6 : 1 }}
        >
          {loading ? 'נרשמת...' : 'הצטרפי עכשיו ✨'}
        </button>

        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => { setMode('login'); setError(''); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 12px', fontFamily: 'var(--demo-body-font)', fontSize: 13, color: C.muted }}
          >
            כבר רשומה?{' '}
            <span style={{ color: C.accent, fontWeight: 700, textDecoration: 'underline' }}>כניסה כאן</span>
          </button>
        </div>
      </div>

      {/* ── Success overlay — checkmark + greeting tinted by gender ── */}
      {successOpen && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(92,61,46,0.6)', zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          animation: 'fadeIn 0.3s ease',
        }}>
          <div style={{
            backgroundColor: 'var(--color-menu)', borderRadius: 20, padding: '32px 28px',
            maxWidth: 320, width: '100%', textAlign: 'center',
            boxShadow: '0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
            border: genderColor ? `2px solid ${genderColor.border}` : 'none',
          }}>
            {/* Animated checkmark circle in gender color (replaces 💕) */}
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              backgroundColor: genderColor ? genderColor.solid : '#E91E8C',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 14,
              boxShadow: `0 6px 20px ${genderColor ? genderColor.soft : 'rgba(233,30,140,0.25)'}`,
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M5 12.5l4.5 4.5L19 7.5" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 26, fontWeight: 500, color: C.text, marginBottom: 6 }}>
              {form.gender === 'male' ? 'ברוך הבא!' : 'ברוכה הבאה!'}
            </p>
            <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
              ההרשמה הושלמה בהצלחה
              <br />שלחנו לך SMS — {form.gender === 'male' ? 'נשמח לראותך אצלנו' : 'נשמח לראותך אצלנו'} ✨
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
