import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Scissors, Clock, CalendarX, XCircle, Bell, ShoppingBag, Users, Image, MapPin, UserCircle, BarChart3, LogOut, Heart, X, FileText, Lock } from 'lucide-react';
import TabBoundary from '../components/TabBoundary';
import { db } from '../utils/db';

import ServicesTab          from './admin-tabs/ServicesTab';
import HoursTab             from './admin-tabs/HoursTab';
import BreaksTab            from './admin-tabs/BreaksTab';
import CancellationsTab     from './admin-tabs/CancellationsTab';
import RemindersTab         from './admin-tabs/RemindersTab';
import ShopTab              from './admin-tabs/ShopTab';
import StaffTab             from './admin-tabs/StaffTab';
import GalleryTab           from './admin-tabs/GalleryTab';
import ContactTab           from './admin-tabs/ContactTab';
import ClientsReviewsTab    from './admin-tabs/ClientsReviewsTab';
import ReportsTab           from './admin-tabs/ReportsTab';
import ReceiptsTab          from './admin-tabs/ReceiptsTab';
import { features } from '../config/features';

// ── כל הטאבים בסדר קבוע — 6 שורה עליונה + 6 שורה תחתונה ──
// lock: פונקציה שמחזירה true כשהטאב נעול (חבילה לא נרכשה)
const ALL_TABS = [
  // ─── שורה עליונה (מימין לשמאל ב-RTL) ───
  { id: 'services',        label: 'שירותים',            icon: Scissors,    Comp: ServicesTab },
  { id: 'contact',         label: 'פרטי קשר\nוקליניקה', icon: MapPin,      Comp: ContactTab },
  { id: 'reminders',       label: 'תזכורות\nו-SMS',     icon: Bell,        Comp: RemindersTab },
  { id: 'clients-reviews', label: 'לקוחות\nוביקורות',   icon: UserCircle,  Comp: ClientsReviewsTab },
  {
    id: 'staff', label: 'עובדות', icon: Users, Comp: StaffTab,
    lock: () => !features.staff,
    packageName: 'תוספת עובדות',
    packageDesc: 'ניהול מספר עובדות, לוח זמנים נפרד לכל עובדת, הזמנות לפי שם העובדת.',
  },
  {
    id: 'receipts', label: 'קבלות', icon: FileText, Comp: ReceiptsTab,
    lock: () => !features.receipts,
    packageName: 'תוספת קבלות',
    packageDesc: 'קבלות ממוחשבות ללקוחות, שליחה אוטומטית באימייל אחרי כל תשלום.',
  },
  // ─── שורה תחתונה ───
  { id: 'hours',         label: 'שעות\nותורים',       icon: Clock,       Comp: HoursTab },
  { id: 'gallery',       label: 'גלריה\nורקע',        icon: Image,       Comp: GalleryTab },
  { id: 'breaks',        label: 'חופשות\nוחריגים',    icon: CalendarX,   Comp: BreaksTab },
  { id: 'cancellations', label: 'ביטולים\nואי הגעות', icon: XCircle,     Comp: CancellationsTab },
  {
    id: 'shop', label: 'חנות\nותשלומים', icon: ShoppingBag, Comp: ShopTab,
    lock: () => !features.reports,
    packageName: 'חבילת Pro',
    packageDesc: 'חנות מוצרים, תשלומים מקוונים, ניהול הזמנות ממשק אדמין.',
  },
  {
    id: 'reports', label: 'דוחות\nוסטטיסטיקה', icon: BarChart3, Comp: ReportsTab,
    lock: () => !features.reports,
    packageName: 'חבילת Pro',
    packageDesc: 'דוחות הכנסות, סטטיסטיקות תורים, גרפים וייצוא נתונים.',
  },
];

const buildTabs = () => ALL_TABS.map(t => ({ ...t, locked: t.lock ? t.lock() : false }));
const TABS = buildTabs();

// ISO week key: "YYYY-WW" — used to gate Sunday reminder dismissal per week
function weekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-${String(weekNum).padStart(2, '0')}`;
}

const DEFAULT_REMINDER_TEXT = 'אל תשכחי לקבוע שעות עבודה ❤️';

function UpsellScreen({ tab }) {
  const waText = encodeURIComponent(`היי אשמח לפרטים על תוספת ${tab.packageName} לאתר שלי 🙏🏼`);
  const waUrl  = `https://wa.me/972505450408?text=${waText}`;
  return (
    <div style={{
      padding: '48px 24px 40px',
      textAlign: 'center',
      direction: 'rtl',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: '50%',
        backgroundColor: 'rgba(92,61,46,0.08)',
        border: '1px solid rgba(92,61,46,0.18)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 20,
      }}>
        <Lock size={28} color="var(--color-on-bg)" strokeWidth={1.5} />
      </div>
      <h3 style={{
        fontFamily: 'var(--demo-heading-font)',
        fontSize: 26, color: 'var(--color-on-bg)',
        fontWeight: 500, marginBottom: 10,
      }}>
        {tab.packageName}
      </h3>
      <p style={{
        fontFamily: 'var(--demo-body-font)',
        fontSize: 14, color: 'var(--color-on-bg)',
        marginBottom: 32, lineHeight: 1.7,
        maxWidth: 280,
      }}>
        {tab.packageDesc}
      </p>
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '14px 32px',
          backgroundColor: '#25D366', color: '#fff',
          borderRadius: 'var(--demo-radius-card)',
          fontFamily: 'var(--demo-body-font)', fontSize: 14, fontWeight: 600,
          textDecoration: 'none',
          boxShadow: '0 4px 14px rgba(37,211,102,0.35)',
        }}
      >
        💬 דברו איתנו בוואטסאפ
      </a>
    </div>
  );
}

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('services');
  const [notif, setNotif]         = useState({ 'clients-reviews': 0, shop: 0 });
  const [reminder, setReminder]   = useState({ show: false, text: DEFAULT_REMINDER_TEXT, enabled: true });

  const activeTabData = TABS.find(t => t.id === activeTab);
  const ActiveComp = activeTabData?.Comp;

  // ── Persistent "seen" timestamps (localStorage) ──
  // ה-badge מבוסס על ביקורות חדשות + לקוחות חדשים מאז הצפייה האחרונה.
  // ללא זה — refresh היה גורם ל-badge לחזור על אותו אייטם שכבר נצפה.
  const getLastSeen = (key) => {
    try { return Number(localStorage.getItem(`adminLastSeen_${key}`)) || 0; } catch { return 0; }
  };
  const markSeen = (key) => {
    try { localStorage.setItem(`adminLastSeen_${key}`, String(Date.now())); } catch {}
  };

  const refreshNotif = useCallback(() => {
    const lastSeen = getLastSeen('clientsReviews');
    Promise.all([
      db.reviews.list(false).catch(() => []),
      db.orders.list().catch(() => []),
      db.settings.get('pendingPayments', {}).catch(() => ({})),
    ]).then(([reviews, orders, pendingPays]) => {
      // סופר רק ביקורות חדשות (pending + נוצרו אחרי הצפייה האחרונה)
      const reviewsCount = (reviews || []).filter(r => {
        if (r.status === 'approved') return false;
        const created = new Date(r.createdAt || 0).getTime();
        return created > lastSeen;
      }).length;
      const ordersPending = (orders || []).filter(o => o.status === 'pending').length;
      const paysPending = Object.keys(pendingPays || {}).length;
      setNotif({ 'clients-reviews': reviewsCount, shop: ordersPending + paysPending });
    });
  }, []);

  /* Auto-clear badge when user enters the clients-reviews tab — persist via localStorage */
  useEffect(() => {
    if (activeTab === 'clients-reviews') {
      markSeen('clientsReviews');
      setNotif(prev => ({ ...prev, 'clients-reviews': 0 }));
    }
  }, [activeTab]);

  useEffect(() => {
    // Load notification counts
    refreshNotif();

    // Sunday reminder — check enabled, time, and dismissal
    db.settings.get('adminReminder', { enabled: true, text: DEFAULT_REMINDER_TEXT, time: '09:00' }).then(r => {
      const enabled = r?.enabled !== false;
      const text = r?.text || DEFAULT_REMINDER_TEXT;
      const isSunday = new Date().getDay() === 0;
      const dismissed = (typeof localStorage !== 'undefined' && localStorage.getItem('adminReminderDismissed')) === weekKey();
      const [rh, rm] = (r?.time || '09:00').split(':').map(Number);
      const now = new Date();
      const afterTime = now.getHours() * 60 + now.getMinutes() >= rh * 60 + rm;
      setReminder({ show: enabled && isSunday && !dismissed && afterTime, text, enabled });
    }).catch(() => {});
  }, [refreshNotif]);

  const dismissReminder = () => {
    try { localStorage.setItem('adminReminderDismissed', weekKey()); } catch {}
    setReminder(r => ({ ...r, show: false }));
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg)', backgroundImage: 'var(--demo-bg-mat-surface)', backgroundRepeat: 'repeat', direction: 'rtl', paddingBottom: '40px' }}>
      <div style={{ padding: '24px 20px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ textAlign: 'right' }}>
            <h1 style={{ fontFamily: 'var(--demo-heading-font)', fontSize: '32px', color: 'var(--color-text)', lineHeight: 1, marginBottom: '4px', fontWeight: 500 }}>ניהול</h1>
            <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: '13px', color: 'var(--color-on-bg)' }}>{activeTabData?.label.replace('\n', ' ')}</p>
          </div>
          <button
            onClick={() => { window.history.pushState({}, '', '/'); window.location.reload(); }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', backgroundColor: 'var(--color-surface)', color: 'var(--color-on-bg)', border: '1px solid var(--color-border)', borderRadius: '10px', fontFamily: 'var(--demo-body-font)', fontSize: '13px', cursor: 'pointer' }}
          >
            <LogOut size={14} />יציאה
          </button>
        </div>
      </div>

      {/* Sunday reminder banner */}
      <AnimatePresence>
        {reminder.show && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            style={{ margin: '12px 16px 0', padding: '12px 14px', backgroundColor: 'rgba(212,184,150,0.25)', border: '1px solid rgba(92,61,46,0.20)', borderRadius: 'var(--demo-radius-card)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Heart size={16} color="var(--color-accent)" strokeWidth={1.8} />
            <p style={{ flex: 1, fontFamily: 'var(--demo-body-font)', fontSize: 13, color: 'var(--color-on-bg)', margin: 0, fontWeight: 500 }}>
              {reminder.text}
            </p>
            <button onClick={dismissReminder}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--color-on-bg)' }}>
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ TAB CAROUSEL — backdrop בצבע/חומר section שמתפרס לכל הרוחב,
            כולל הצדדים שנגללים אופקית. ═══ */}
      <div style={{
        position: 'relative',
        backgroundColor: 'var(--color-section)',
        backgroundImage: 'var(--demo-section-mat-surface)',
        backgroundRepeat: 'repeat',
      }}>
        {/* gradient top: bg → transparent (seamless entry) */}
        <div aria-hidden style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 24,
          background: 'linear-gradient(to bottom, var(--color-bg), transparent)',
          pointerEvents: 'none', zIndex: 2,
        }} />
        {/* gradient bottom: transparent → bg (seamless exit) */}
        <div aria-hidden style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 24,
          background: 'linear-gradient(to top, var(--color-bg), transparent)',
          pointerEvents: 'none', zIndex: 2,
        }} />
        <div aria-hidden style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'var(--demo-section-mat-overlay)',
          mixBlendMode: 'overlay',
          pointerEvents: 'none',
          zIndex: 0,
        }} />
        <div style={{ position: 'relative', zIndex: 1, padding: '20px 16px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}>
        {(() => {
          const topCount  = Math.floor(TABS.length / 2);
          const tabRows   = [TABS.slice(0, topCount), TABS.slice(topCount)];
          const renderTab = (tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const badgeCount = notif[tab.id] || 0;
            const isLocked = !!tab.locked;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  position: 'relative',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  padding: '16px 8px',
                  width: 110, flexShrink: 0,
                  backgroundColor: isActive
                    ? (isLocked ? 'rgba(92,61,46,0.55)' : 'var(--color-primary)')
                    : 'var(--color-menu)',
                  backgroundImage: isActive && !isLocked
                    ? 'var(--demo-primary-mat-overlay)'
                    : 'var(--demo-menu-mat-overlay)',
                  color: isActive ? 'var(--color-on-primary)' : (isLocked ? 'rgba(92,61,46,0.55)' : 'var(--color-on-menu)'),
                  border: isActive ? 'var(--demo-primary-mat-border, none)' : 'var(--demo-menu-mat-border, none)',
                  borderRadius: 'var(--demo-radius-card)',
                  fontFamily: 'var(--demo-heading-font)', fontSize: '12px', fontWeight: 500,
                  cursor: 'pointer', height: '90px',
                  boxShadow: isActive ? 'var(--demo-shadow-deep)' : 'var(--demo-shadow-card)',
                  transition: 'background-color 0.2s, color 0.2s, border-color 0.2s, transform 0.1s',
                  opacity: isLocked && !isActive ? 0.7 : 1,
                }}
                onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.96)'; }}
                onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                {/* Badge for reviews / orders */}
                {badgeCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 18 }}
                    style={{
                      position: 'absolute', top: 6, insetInlineEnd: 6,
                      minWidth: 20, height: 20, padding: '0 5px', borderRadius: 'var(--demo-radius-pill)',
                      backgroundColor: 'var(--color-accent)', color: 'var(--color-surface)',
                      fontFamily: 'var(--demo-body-font)', fontSize: 11, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 2px 6px rgba(168,90,74,0.4)',
                      zIndex: 2,
                    }}>
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </motion.span>
                )}
                {/* Lock indicator for unpurchased packages */}
                {isLocked && (
                  <span style={{
                    position: 'absolute', top: 6, insetInlineStart: 7,
                    opacity: 0.65,
                  }}>
                    <Lock size={11} strokeWidth={2.2} />
                  </span>
                )}
                <Icon size={22} strokeWidth={1.5} />
                <span style={{ textAlign: 'center', lineHeight: 1.3, whiteSpace: 'pre-line' }}>{tab.label}</span>
              </button>
            );
          };
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 'fit-content' }}>
              {tabRows.map((row, i) => (
                <div key={i} style={{ display: 'flex', gap: 10 }}>
                  {row.map(renderTab)}
                </div>
              ))}
            </div>
          );
        })()}
        </div>
      </div>

      <div style={{ padding: '8px 16px' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTabData?.locked
            ? <UpsellScreen tab={activeTabData} />
            : ActiveComp
              ? <TabBoundary key={activeTab}><ActiveComp onBadgeUpdate={refreshNotif} /></TabBoundary>
              : null
          }
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
