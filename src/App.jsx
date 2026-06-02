import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { storage } from './utils/storage';
import { db } from './utils/db';
import HeroNew from './pages/HeroNew';
import Booking from './pages/Booking';
import MyAppointments from './pages/MyAppointments';
import Shop from './pages/Shop';
import AdminPanel from './pages/AdminPanel';
import PasswordGate from './components/PasswordGate';
import SplashScreen from './components/SplashScreen';
import Register from './pages/Register';
import BubbleMenu from './components/BubbleMenu';
import ProfileModal from './components/ProfileModal';
import UrgentBooking from './components/UrgentBooking';
import InstallButton from './components/InstallButton';
import GalleryAbout from './pages/GalleryAbout';
import ReviewsPage from './pages/ReviewsPage';
import ManageReviews from './pages/ManageReviews';
import ContactPage from './pages/ContactPage';
import RisePage from './pages/RisePage';
import PrivacyPage from './pages/PrivacyPage';
import { features } from './config/features';
import { design } from './config/design';
import { DEFAULT_CLINIC_INFO } from './utils/defaults';
import { applyDynamicPWA } from './lib/dynamicPWA';

const ADMIN_PATH    = '/manage-x7k2';
const RISE_PATH     = '/rise';     // עמוד המותג של RISE Builder
const RISE_LEGACY   = '/bolt';     // backward-compat: bookmarks ישנים → redirect ל-RISE
const REGISTER_PATH = '/register';
const PRIVACY_PATH  = '/privacy';

export default function App() {
  const [page, setPage]             = useState('home');
  const [user, setUser]             = useState(null);
  const [urgentOpen, setUrgentOpen] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showWarning, setShowWarning] = useState('');   // אזהרת אי-הגעה — הודעה או ''
  const [blockedUser, setBlockedUser] = useState(false); // חסימה מלאה
  const [clinicName, setClinicName]   = useState('');    // שם הסטודיו (ל-PWA + כותרת)
  const [pwaLogo, setPwaLogo]         = useState('');    // לוגו ייעודי ל-PWA (אם הועלה)

  // ── בדיקת סטטוס אי-הגעות בסילנט (לא חוסמת טעינה) ───────────
  const checkNoShowStatus = (phone) => {
    if (!phone || window.location.pathname === ADMIN_PATH) return;
    Promise.all([
      db.clients.findByDigits(phone),
      db.settings.get('adminSettings', null),
    ]).then(([clientRow, settings]) => {
      if (!clientRow) return;
      // חסום — מסך מלא, לא ניתן לסגור
      if (clientRow.is_blocked) { setBlockedUser(true); return; }
      // אזהרה — מוצגת פעם אחת ב-24 שעות (localStorage + TTL)
      const count  = clientRow.no_show_count || 0;
      const warnAt = settings?.noShow?.warningCount ?? 2;
      if (count >= warnAt) {
        const key      = `noshow_warned_${String(phone).replace(/\D/g, '')}`;
        const lastSeen = Number(localStorage.getItem(key) || 0);
        const TTL      = 24 * 60 * 60 * 1000; // 24 שעות
        if (Date.now() - lastSeen > TTL) {
          setShowWarning(settings?.noShow?.warningMessage ||
            'שימי לב — בחנו דפוס של אי-הגעה. בבקשה להודיע מראש אם אינך מגיעה.');
        }
      }
    }).catch(() => {}); // שגיאת network לא משבשת את האפליקציה
  };

  useEffect(() => {
    db.seedDefaults();
    const saved = storage.get('user');
    if (saved) {
      setUser(saved);
      checkNoShowStatus(saved.phone);
    }
    const syncFromPath = () => {
      const p = window.location.pathname;
      if (p === ADMIN_PATH) setPage('admin');
      else if (p === RISE_PATH || p === RISE_LEGACY) setPage('rise');
      else if (p === REGISTER_PATH) setPage('register');
      else if (p === PRIVACY_PATH) setPage('privacy');
      else setPage('home');
    };
    syncFromPath();
    window.addEventListener('popstate', syncFromPath);
    return () => window.removeEventListener('popstate', syncFromPath);
  }, []);

  // ── טעינת שם הסטודיו + לוגו PWA פעם אחת (ל-PWA + כותרת הטאב) ──
  useEffect(() => {
    db.settings.get('clinicInfo', DEFAULT_CLINIC_INFO)
      .then((ci) => {
        setClinicName((ci?.name || '').trim());
        setPwaLogo((ci?.pwaLogo || '').trim());
      })
      .catch(() => {});
  }, []);

  // ── זהות PWA דינמית: שם + לוגו (מועלה או מונוגרמה אוטומטית); אדמין → "+admin" ──
  useEffect(() => {
    if (!clinicName) return;
    applyDynamicPWA({
      clinicName,
      isAdmin: page === 'admin',
      colors: design.colors,
      headingFont: design.headingFont,
      pwaLogo,
    });
  }, [clinicName, page, pwaLogo]);

  // ── Admin-only splash: shows on every entry to /manage-x7k2 ──
  // Image loads via background-image; if /splash.jpg is missing, BG color shows.
  useEffect(() => {
    if (page !== 'admin') return;
    setShowSplash(true);
  }, [page]);

  const saveUser = (u) => {
    storage.set('user', u);
    setUser(u);
    checkNoShowStatus(u.phone);
  };

  const logout = () => {
    storage.remove('user');
    setUser(null);
    navigate('home');
  };

  const SCROLL_SECTIONS = { gallery: 'section-gallery', reviews: 'section-reviews', contact: 'section-contact' };

  const scrollTo = (sectionId) => {
    setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  const navigate = (p) => {
    if (window.location.pathname === ADMIN_PATH) window.history.pushState({}, '', '/');

    const sectionId = SCROLL_SECTIONS[p];
    if (sectionId) {
      if (page === 'home') {
        scrollTo(sectionId);
      } else {
        setPage('home');
        setTimeout(() => scrollTo(sectionId), 120);
      }
      return;
    }

    if (p === 'home' && page === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setPage(p);
    if (p === 'admin') window.history.pushState({}, '', ADMIN_PATH);
    else if (p === 'rise' || p === 'bolt') window.history.pushState({}, '', RISE_PATH);
    else if (p === 'register') window.history.pushState({}, '', REGISTER_PATH);
    else if (p === 'privacy') window.history.pushState({}, '', PRIVACY_PATH);
    else { if (window.location.pathname !== '/') window.history.pushState({}, '', '/'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  };

  const isAdmin = page === 'admin' || page === 'manage-reviews' || page === 'rise';

  const renderPage = () => {
    switch (page) {
      case 'home':           return <HeroNew user={user} onNavigate={navigate} onLogout={logout} showStore={features.reports} />;
      case 'booking':        return <Booking user={user} onUserSave={saveUser} onNavigate={navigate} />;
      case 'appointments':   return <MyAppointments user={user} onNavigate={navigate} />;
      case 'gallery':        return <GalleryAbout onNavigate={navigate} />;
      case 'reviews':        return <ReviewsPage onNavigate={navigate} />;
      case 'manage-reviews': return <ManageReviews />;
      case 'contact':        return <ContactPage onNavigate={navigate} />;
      case 'shop':           return features.reports ? <Shop user={user} onNavigate={navigate} /> : null;
      case 'register':       return <Register onUserSave={saveUser} onNavigate={navigate} />;
      case 'admin':          return <PasswordGate><AdminPanel /></PasswordGate>;
      case 'rise':           return <RisePage />;
      case 'privacy':        return <PrivacyPage onNavigate={navigate} />;
      default:               return null;
    }
  };

  return (
    <div className="min-h-screen font-heebo" style={{ backgroundColor: 'var(--color-bg)', backgroundImage: 'var(--demo-bg-mat-surface)', backgroundRepeat: 'repeat', color: 'var(--color-primary)' }} dir="rtl">
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}

      {/* ── מסך חסימה מלא — לא ניתן לסגור ── */}
      {blockedUser && page !== 'admin' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          backgroundColor: '#1A0F0A',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: 32, direction: 'rtl',
        }}>
          {/* decorative ring */}
          <div style={{
            width: 100, height: 100, borderRadius: '50%',
            border: '1.5px solid rgba(253,250,247,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 32,
            boxShadow: '0 2px 16px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <span style={{ fontSize: 42, lineHeight: 1 }}>🚫</span>
          </div>

          <p style={{
            fontFamily: 'var(--demo-heading-font)',
            fontSize: 34, fontWeight: 600, letterSpacing: '0.06em',
            color: 'var(--color-surface)', marginBottom: 8, textAlign: 'center', lineHeight: 1.15,
          }}>
            הגישה חסומה
          </p>

          <div style={{ width: 40, height: 1, backgroundColor: 'rgba(253,250,247,0.25)', margin: '16px auto 20px' }} />

          <p style={{
            fontFamily: 'var(--demo-body-font)', fontSize: 14,
            color: 'rgba(253,250,247,0.58)', textAlign: 'center',
            lineHeight: 1.9, maxWidth: 270, letterSpacing: '0.01em',
          }}>
            חשבונך חסום מלקביעת תורים.
            <br />לפרטים — צרי קשר עם הסלון.
          </p>
        </div>
      )}

      {/* ── מודל אזהרת אי-הגעה — פעם אחת בsession ── */}
      <AnimatePresence>
        {showWarning && (
          <motion.div
            key="noshow-warning"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 8000,
              backgroundColor: 'rgba(44,24,16,0.60)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 24, direction: 'rtl',
            }}>
            <motion.div
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 20,
                padding: '36px 28px 28px',
                maxWidth: 340, width: '100%',
                textAlign: 'center',
                boxShadow: '0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
              }}>
              <div style={{ fontSize: 48, marginBottom: 18 }}>⚠️</div>
              <p style={{
                fontFamily: 'var(--demo-heading-font)',
                fontSize: 28, fontWeight: 700, color: '#111111',
                marginBottom: 12, lineHeight: 1.2,
              }}>
                שימי לב
              </p>
              <p style={{
                fontFamily: 'var(--demo-body-font)',
                fontSize: 14, color: '#333333',
                lineHeight: 1.8, marginBottom: 28,
              }}>
                {showWarning}
              </p>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  const key = `noshow_warned_${String(user?.phone || '').replace(/\D/g, '')}`;
                  localStorage.setItem(key, String(Date.now()));
                  setShowWarning('');
                }}
                style={{
                  width: '100%', padding: '15px',
                  backgroundColor: '#111111',
                  color: '#FFFFFF',
                  border: 'none', borderRadius: 'var(--demo-radius-card)',
                  fontFamily: 'var(--demo-body-font)',
                  fontSize: 15, fontWeight: 700,
                  cursor: 'pointer',
                  letterSpacing: '0.03em',
                }}>
                הבנתי
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="w-full relative min-h-screen overflow-x-hidden">

        {!isAdmin && (
          <BubbleMenu
            onNavigate={navigate}
            showStore={features.reports}
            user={user}
            onLogout={logout}
            onProfile={() => setProfileOpen(true)}
          />
        )}

        {profileOpen && user && (
          <ProfileModal
            user={user}
            onClose={() => setProfileOpen(false)}
            onUserUpdate={saveUser}
          />
        )}

        <div>
          {renderPage()}
        </div>

        {!isAdmin && (
          <UrgentBooking
            open={urgentOpen}
            onOpen={() => setUrgentOpen(true)}
            onClose={() => setUrgentOpen(false)}
            onBook={() => { setUrgentOpen(false); navigate('booking'); }}
          />
        )}

        {/* PWA — הוספה למסך הבית (גם לקוחות וגם אדמין) */}
        <InstallButton />
      </div>
    </div>
  );
}
