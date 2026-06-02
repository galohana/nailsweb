import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

/* ═══════════════════════════════════════════════════════════════════
   InstallButton — PWA "הוספה למסך הבית" לתבנית RISE.

   זיהוי מכשיר:
   • Android/Chrome → event beforeinstallprompt → דיאלוג נייטיב בלחיצה אחת.
   • iPhone (Safari) → overlay ממותג עם אייקון השיתוף + הסבר (אין API נייטיב ב-iOS).
   • iPad לא נתמך בכוונה (הבקשה: אייפון בלבד).

   לוגיקת הצגה:
   1. כבר מותקן (display-mode: standalone) → לא מציג כלום.
   2. ביקור ראשון → popup עדין קופץ אחרי 3 שניות.
   3. נסגר בלי התקנה → נשמר ב-localStorage, לא קופץ שוב — נשאר כפתור צף קטן.
   4. גולש רגיל שלא התקין → כפתור צף קטן תמיד זמין.

   עיצוב: נשען על ה-CSS variables של design.js (color/font/corner/shadow) →
   מתאים אוטומטית לכל לקוחה. RTL מלא, עברית.
   ═══════════════════════════════════════════════════════════════════ */

const LS_DISMISSED = 'rise_pwa_dismissed';
const LS_INSTALLED = 'rise_pwa_installed';

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function isIphone() {
  const ua = window.navigator.userAgent || '';
  // אייפון/אייפוד בלבד — iPad מוחרג בכוונה
  return /iPhone|iPod/.test(ua) && !window.MSStream;
}

/* ── אייקון השיתוף של iOS — מזוהה לפי צורה (ריבוע + חץ כלפי מעלה) ── */
function IOSShareGlyph({ reduce }) {
  return (
    <div style={{ position: 'relative', width: 64, height: 64, margin: '0 auto' }}>
      {/* טבעת פעימה עדינה שמדגישה את האייקון */}
      {!reduce && (
        <motion.span
          aria-hidden
          animate={{ scale: [1, 1.35, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            border: '2px solid var(--color-primary)',
          }}
        />
      )}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        backgroundColor: 'var(--color-bg)',
        border: '1px solid var(--color-border, rgba(0,0,0,0.08))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="30" height="34" viewBox="0 0 24 28" fill="none"
          stroke="var(--color-primary)" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round">
          {/* תיבת השיתוף (פתוחה מלמעלה) */}
          <path d="M6 12 V22 a2 2 0 0 0 2 2 H16 a2 2 0 0 0 2 -2 V12" />
          {/* החץ כלפי מעלה — מונפש */}
          <motion.g
            animate={reduce ? {} : { y: [0, -3, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <path d="M12 3 V15" />
            <path d="M8 7 L12 3 L16 7" />
          </motion.g>
        </svg>
      </div>
    </div>
  );
}

/* ── אייקון מיני לכפתור הצף ── */
function PlusPhoneGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="var(--color-on-primary, #FDFAF7)" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
      <path d="M12 8.5 V15 M8.75 11.75 H15.25" />
    </svg>
  );
}

export default function InstallButton() {
  const reduce = useReducedMotion();
  const [mode, setMode]         = useState('hidden');   // 'hidden' | 'android' | 'ios'
  const [popupOpen, setPopup]   = useState(false);      // כרטיס/overlay אוטומטי
  const [overlayOpen, setOverlay] = useState(false);    // overlay של iOS מתוך הכפתור הצף
  const deferred = useRef(null);                        // beforeinstallprompt event

  // ── זיהוי מצב בעת טעינה ──
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStandalone() || localStorage.getItem(LS_INSTALLED) === '1') {
      setMode('hidden');
      return;
    }

    let resolvedMode = 'hidden';
    if (isIphone()) {
      resolvedMode = 'ios';
      setMode('ios');
    }

    const onBIP = (e) => {
      e.preventDefault();          // מונע את ה-mini-infobar הדיפולטי
      deferred.current = e;
      resolvedMode = 'android';
      setMode('android');
    };
    const onInstalled = () => {
      localStorage.setItem(LS_INSTALLED, '1');
      setMode('hidden');
      setPopup(false);
      setOverlay(false);
    };

    window.addEventListener('beforeinstallprompt', onBIP);
    window.addEventListener('appinstalled', onInstalled);

    // popup אוטומטי אחרי 3 שניות — רק אם לא נסגר בעבר וקיים מסלול התקנה
    const timer = setTimeout(() => {
      if (localStorage.getItem(LS_DISMISSED) === '1') return;
      if (resolvedMode === 'android' || resolvedMode === 'ios') setPopup(true);
    }, 3000);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP);
      window.removeEventListener('appinstalled', onInstalled);
      clearTimeout(timer);
    };
  }, []);

  const dismissPopup = useCallback(() => {
    setPopup(false);
    try { localStorage.setItem(LS_DISMISSED, '1'); } catch {}
  }, []);

  // ── התקנה נייטיב באנדרואיד ──
  const triggerAndroid = useCallback(async () => {
    const e = deferred.current;
    if (!e) return;
    setPopup(false);
    e.prompt();
    try {
      const { outcome } = await e.userChoice;
      if (outcome === 'accepted') localStorage.setItem(LS_INSTALLED, '1');
      else try { localStorage.setItem(LS_DISMISSED, '1'); } catch {}
    } catch {}
    deferred.current = null;
  }, []);

  // ── לחיצה על הכפתור הצף ──
  const onFab = useCallback(() => {
    try { navigator.vibrate?.(12); } catch {}
    if (mode === 'android') triggerAndroid();
    else if (mode === 'ios') setOverlay(true);
  }, [mode, triggerAndroid]);

  if (mode === 'hidden') return null;

  const EASE = [0.16, 1, 0.3, 1];
  const showIosOverlay = mode === 'ios' && (overlayOpen || popupOpen);
  const showAndroidCard = mode === 'android' && popupOpen;

  return (
    <div dir="rtl">
      {/* ── כפתור צף קטן (תמיד זמין, פינה תחתונה-ימין; שמאל תפוס ע"י תור דחוף) ── */}
      <motion.button
        type="button"
        aria-label="הוספה למסך הבית"
        onClick={onFab}
        initial={{ opacity: 0, scale: 0.6, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 1.2, type: 'spring', stiffness: 320, damping: 22 }}
        whileTap={{ scale: 0.92 }}
        whileHover={{ scale: 1.06 }}
        style={{
          position: 'fixed', bottom: 24, right: 18, zIndex: 90,
          width: 48, height: 48, borderRadius: 'var(--demo-radius-pill, 999px)',
          backgroundColor: 'var(--color-primary)',
          backgroundImage: 'var(--demo-primary-mat-overlay, none)',
          border: 'var(--demo-primary-mat-border, none)',
          boxShadow: 'var(--demo-shadow-deep, 0 8px 28px rgba(0,0,0,0.22))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', padding: 0,
        }}
      >
        <PlusPhoneGlyph />
      </motion.button>

      {/* ── כרטיס אוטומטי לאנדרואיד (bottom sheet עדין) ── */}
      <AnimatePresence>
        {showAndroidCard && (
          <>
            <motion.div
              key="and-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={dismissPopup}
              style={{ position: 'fixed', inset: 0, zIndex: 9000, backgroundColor: 'rgba(45,27,30,0.45)' }}
            />
            <motion.div
              key="and-card"
              initial={{ y: '110%' }} animate={{ y: 0 }} exit={{ y: '110%' }}
              transition={{ type: 'spring', stiffness: 280, damping: 30 }}
              style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9001,
                maxWidth: 440, margin: '0 auto',
                backgroundColor: 'var(--color-surface)',
                borderTopLeftRadius: 24, borderTopRightRadius: 24,
                padding: '22px 22px calc(22px + env(safe-area-inset-bottom))',
                boxShadow: '0 -10px 40px rgba(0,0,0,0.18)',
                textAlign: 'center',
              }}
            >
              <div style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: 'var(--color-border-dark, #D4B896)', margin: '0 auto 18px' }} />
              <img src={(typeof window !== 'undefined' && window.__risePwaIcon) || '/icons/icon-192.png'} alt="" width="60" height="60"
                style={{ borderRadius: 16, marginBottom: 14, boxShadow: 'var(--demo-shadow-card, 0 2px 12px rgba(0,0,0,0.10))' }} />
              <h3 style={{
                fontFamily: 'var(--demo-heading-font)', fontSize: 22, fontWeight: 600,
                color: 'var(--color-text)', marginBottom: 6,
              }}>האתר על מסך הבית</h3>
              <p style={{
                fontFamily: 'var(--demo-body-font)', fontSize: 14, lineHeight: 1.7,
                color: 'var(--color-text-muted, #7D5A47)', marginBottom: 20,
              }}>הוסיפי את האתר למסך הבית — קביעת תור במגע אחד, בלי לחפש בדפדפן ✨</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={triggerAndroid} style={{
                  flex: 1, height: 50, border: 'none', cursor: 'pointer',
                  borderRadius: 'var(--demo-radius-card)',
                  backgroundColor: 'var(--color-primary)',
                  backgroundImage: 'var(--demo-primary-mat-overlay, none)',
                  color: 'var(--color-on-primary, #FDFAF7)',
                  fontFamily: 'var(--demo-body-font)', fontSize: 15, fontWeight: 700,
                  boxShadow: 'var(--demo-shadow-card)',
                }}>התקיני עכשיו</button>
                <button onClick={dismissPopup} style={{
                  height: 50, padding: '0 18px', cursor: 'pointer',
                  borderRadius: 'var(--demo-radius-card)',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--color-border, #E8DCC8)',
                  color: 'var(--color-text-muted, #7D5A47)',
                  fontFamily: 'var(--demo-body-font)', fontSize: 14, fontWeight: 500,
                }}>אחר כך</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── overlay ל-iPhone — הסבר + אייקון השיתוף המונפש ── */}
      <AnimatePresence>
        {showIosOverlay && (
          <>
            <motion.div
              key="ios-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => { setOverlay(false); dismissPopup(); }}
              style={{ position: 'fixed', inset: 0, zIndex: 9000, backgroundColor: 'rgba(45,27,30,0.55)', backdropFilter: 'blur(2px)' }}
            />
            <motion.div
              key="ios-card"
              initial={{ opacity: 0, y: 30, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              style={{
                position: 'fixed', left: 16, right: 16, bottom: 'calc(24px + env(safe-area-inset-bottom))',
                zIndex: 9001, maxWidth: 380, margin: '0 auto',
                backgroundColor: 'var(--color-surface)',
                borderRadius: 24, padding: '26px 22px 22px',
                boxShadow: '0 16px 50px rgba(0,0,0,0.28)',
                textAlign: 'center',
              }}
            >
              <IOSShareGlyph reduce={reduce} />
              <h3 style={{
                fontFamily: 'var(--demo-heading-font)', fontSize: 22, fontWeight: 600,
                color: 'var(--color-text)', margin: '16px 0 14px',
              }}>להוספת האפליקציה למסך הבית</h3>

              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 22 }}>
                <Step n="1">
                  לחצי על אייקון השיתוף{' '}
                  <InlineShare /> (ריבוע עם חץ כלפי מעלה) — נמצא בתחתית המסך או למעלה
                </Step>
                <Step n="2">בחרי <b style={{ color: 'var(--color-text)' }}>"<InlineAddToHome />הוסף למסך הבית"</b></Step>
              </div>

              <button onClick={() => { setOverlay(false); dismissPopup(); }} style={{
                width: '100%', height: 50, border: 'none', cursor: 'pointer',
                borderRadius: 'var(--demo-radius-card)',
                backgroundColor: 'var(--color-primary)',
                backgroundImage: 'var(--demo-primary-mat-overlay, none)',
                color: 'var(--color-on-primary, #FDFAF7)',
                fontFamily: 'var(--demo-body-font)', fontSize: 15, fontWeight: 700,
                boxShadow: 'var(--demo-shadow-card)',
              }}>הבנתי</button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── שורת הסבר ממוספרת ── */
function Step({ n, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <span style={{
        flexShrink: 0, width: 24, height: 24, borderRadius: '50%',
        backgroundColor: 'var(--color-primary)',
        backgroundImage: 'var(--demo-primary-mat-overlay, none)',
        color: 'var(--color-on-primary, #FDFAF7)',
        fontFamily: 'var(--demo-body-font)', fontSize: 13, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginTop: 1,
      }}>{n}</span>
      <p style={{
        fontFamily: 'var(--demo-body-font)', fontSize: 14, lineHeight: 1.65,
        color: 'var(--color-text-muted, #7D5A47)', margin: 0,
      }}>{children}</p>
    </div>
  );
}

/* ── אייקון "הוספה למסך הבית" של iOS — ריבוע מעוגל עם + (זיהוי מהיר ממלל) ── */
function InlineAddToHome() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="var(--color-text)" strokeWidth="2.1"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: '-3px', marginInlineEnd: 4 }}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <path d="M12 8 V16 M8 12 H16" />
    </svg>
  );
}

/* ── אייקון שיתוף מוקטן בתוך הטקסט ── */
function InlineShare() {
  return (
    <svg width="15" height="17" viewBox="0 0 24 28" fill="none"
      stroke="var(--color-primary)" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle', margin: '0 2px' }}>
      <path d="M6 12 V22 a2 2 0 0 0 2 2 H16 a2 2 0 0 0 2 -2 V12" />
      <path d="M12 3 V15" />
      <path d="M8 7 L12 3 L16 7" />
    </svg>
  );
}
