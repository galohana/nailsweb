import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { db } from '../utils/db';

/* טקסט ברירת מחדל לחלונית ההורדה (ללקוחות, באתר הראשי) — ניתן לעריכה מהאדמין */
export const DEFAULT_PWA_INSTALL_TEXT = 'הורידי את האתר למסך הבית לחוויה מלאה וקביעת תורים מהירה 📲';

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
const LS_AUTOSHOWN = 'rise_pwa_autoshown';   // per-session — popup אוטומטי פעם אחת בכל ביקור

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
  const [customText, setCustomText] = useState('');     // טקסט עריך מהאדמין (ללקוחות)
  const deferred = useRef(null);                        // beforeinstallprompt event

  // ── טעינת טקסט חלונית ההורדה מ-Supabase (ניתן לעריכה מהאדמין) ──
  useEffect(() => {
    db.settings.get('pwaInstallText', '')
      .then((t) => setCustomText((typeof t === 'string' ? t : '').trim()))
      .catch(() => {});
  }, []);

  // ── זיהוי מצב + פתיחה אוטומטית ──
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // רק כשרצים כאפליקציה מותקנת (standalone) לא מציגים. בדפדפן — תמיד מציגים,
    // כדי ללמד את המשתמשים שאפשר להתקין (גם אם כבר הותקן פעם).
    if (isStandalone()) { setMode('hidden'); return; }

    // המצב נקבע מיד, ללא תלות ב-beforeinstallprompt: אייפון → ios, אחרת → android.
    // כך החלונית נפתחת מיד גם כשאנדרואיד לא יורה את האירוע בזמן.
    const iphone = isIphone();
    setMode(iphone ? 'ios' : 'android');

    const onBIP = (e) => {
      e.preventDefault();          // מונע את ה-mini-infobar הדיפולטי
      deferred.current = e;
      if (!iphone) setMode('android');   // יש מסלול התקנה נייטיב
    };
    const onInstalled = () => {
      try { localStorage.setItem(LS_INSTALLED, '1'); } catch {}
      setMode('hidden'); setPopup(false); setOverlay(false);
    };
    window.addEventListener('beforeinstallprompt', onBIP);
    window.addEventListener('appinstalled', onInstalled);

    // popup אוטומטי — נפתח מיד (1.2s), בשתי הפלטפורמות (iOS+Android) ובשני המצבים.
    // פעם אחת לכל מצב (ראשי/אדמין) ב-session → גם הראשי וגם /manage-x7k2 נפתחים.
    const adminPage = window.location.pathname.indexOf('/manage-x7k2') === 0;
    const key = LS_AUTOSHOWN + (adminPage ? '_admin' : '_main');
    const timer = setTimeout(() => {
      if (sessionStorage.getItem(key) === '1') return;
      setPopup(true);
      try { sessionStorage.setItem(key, '1'); } catch {}
    }, 1200);

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
    if (mode === 'android' && deferred.current) triggerAndroid();   // מסלול נייטיב
    else setOverlay(true);                                          // iOS / אנדרואיד-ידני → הוראות
  }, [mode, triggerAndroid]);

  if (mode === 'hidden') return null;

  const EASE = [0.16, 1, 0.3, 1];
  const hasNative = mode === 'android' && !!deferred.current;
  // אנדרואיד עם מסלול נייטיב → כרטיס התקנה; אחרת (iOS או אנדרואיד-ידני) → overlay הוראות
  const showAndroidCard = hasNative && popupOpen;
  const showIosOverlay = (mode === 'ios' || (mode === 'android' && !deferred.current)) && (overlayOpen || popupOpen);
  // האם אנחנו בפאנל הניהול — שם מציגים טיפ לוגו; בראשי מציגים את הטקסט העריך ללקוחות
  const isAdmin = typeof window !== 'undefined' && window.location.pathname === '/manage-x7k2';
  const clientText = (customText || DEFAULT_PWA_INSTALL_TEXT);

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
              }}>{isAdmin ? 'הוסיפי את אתר הניהול למסך הבית — גישה מהירה בלי לחפש בדפדפן ✨' : clientText}</p>
              {isAdmin && <AdminLogoTip />}
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
                color: 'var(--color-text)', margin: '16px 0 10px',
              }}>להוספת האפליקציה למסך הבית</h3>

              {!isAdmin && (
                <p style={{
                  fontFamily: 'var(--demo-body-font)', fontSize: 13.5, lineHeight: 1.65,
                  color: 'var(--color-text-muted, #7D5A47)', margin: '0 0 16px',
                }}>{clientText}</p>
              )}

              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 22 }}>
                <Step n="1">
                  לחצי על כפתור התפריט של הדפדפן{' '}
                  <span dir="ltr" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, verticalAlign: 'middle' }}>
                    <IconCircle><ShareMark /></IconCircle>
                    <span style={{ color: 'rgba(0,0,0,0.45)', fontWeight: 700 }}>/</span>
                    <IconCircle><DotsMark /></IconCircle>
                  </span>
                  {' '}— בתחתית המסך או למעלה
                </Step>
                <Step n="2">בחרי <b style={{ color: 'var(--color-text)' }}>"<InlineAddToHome />הוסף למסך הבית"</b></Step>
              </div>

              {isAdmin && <AdminLogoTip />}

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

/* ── טיפ אדמין בלבד: היכן בוחרים לוגו לאפליקציות (ניהול + ראשי) ── */
function AdminLogoTip() {
  return (
    <p style={{
      fontFamily: 'var(--demo-body-font)', fontSize: 12.5, lineHeight: 1.65,
      color: 'var(--color-text-muted, #7D5A47)',
      backgroundColor: 'rgba(var(--color-primary-rgb, 92,61,46), 0.06)',
      border: '1px solid var(--color-border, #E8DCC8)',
      borderRadius: 14, padding: '10px 13px', margin: '0 0 18px', textAlign: 'right',
    }}>
      💡 אפשר לבחור לוגו נפרד לאפליקציית הניהול ולאפליקציה הראשית — בטאב{' '}
      <b style={{ color: 'var(--color-text)' }}>"פרטי קשר וקליניקה"</b>.
    </p>
  );
}

/* ── עיגול-כפתור שקוף-בערך שעוטף אייקון — מסמן "זה כפתור" ── */
function IconCircle({ children }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 27, height: 27, borderRadius: '50%',
      /* שחור קבוע — הרקע של חלונית ההתקנה תמיד בהיר, לכן לא תלוי ב-primary של הלקוחה */
      border: '1px solid rgba(0,0,0,0.30)',
      backgroundColor: 'rgba(0,0,0,0.05)',
      flexShrink: 0,
    }}>{children}</span>
  );
}

/* אייקון שיתוף (ריבוע עם חץ למעלה) — ספארי. שחור קבוע (רקע חלונית בהיר תמיד) */
function ShareMark() {
  return (
    <svg width="13" height="15" viewBox="0 0 24 28" fill="none"
      stroke="#1F1F1F" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      <path d="M6 12 V22 a2 2 0 0 0 2 2 H16 a2 2 0 0 0 2 -2 V12" />
      <path d="M12 3 V15" />
      <path d="M8 7 L12 3 L16 7" />
    </svg>
  );
}

/* אייקון שלוש נקודות אופקיות — תפריט. שחור קבוע (רקע חלונית בהיר תמיד) */
function DotsMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="#1F1F1F" style={{ display: 'block' }}>
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}
