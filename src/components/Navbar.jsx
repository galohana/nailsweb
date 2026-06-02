import { motion, AnimatePresence } from 'framer-motion';

const C = {
  accent: 'var(--color-primary)',
  brown:  'var(--color-primary)',
  text:   'var(--color-primary)',
  muted:  '#8B6E52',
  border: '#C8A882',
  bg:     'var(--color-bg)',
};

export default function Navbar({ user, page, menuOpen, onMenuToggle, onNavigate, onLogout, showStore }) {
  const links = [
    { id: 'home',         label: 'דף הבית',    icon: '🏠' },
    { id: 'booking',      label: 'קביעת תור',   icon: '📅' },
    { id: 'appointments', label: 'התורים שלי',  icon: '✅' },
    { id: 'gallery',      label: 'גלריה',        icon: '🖼️' },
    { id: 'reviews',      label: 'ביקורות',      icon: '⭐' },
    { id: 'contact',      label: 'צרי קשר',      icon: '📍' },
    ...(showStore ? [{ id: 'shop', label: 'חנות', icon: '🛍️' }] : []),
  ];

  return (
    <>
      {/* Fixed navbar bar */}
      <nav
        className="fixed top-0 right-0 left-0 z-40 flex items-center px-4"
        style={{
          height: 56, position: 'fixed',
          backgroundColor: 'var(--demo-navbar-bg, rgba(242,232,220,0.85))',
          backgroundImage: 'var(--demo-navbar-mat-overlay, none)',
          backdropFilter: 'var(--demo-navbar-blur, blur(16px))',
          WebkitBackdropFilter: 'var(--demo-navbar-blur, blur(16px))',
          borderBottom: '1px solid rgba(0,0,0,0.08)',
          boxShadow: 'var(--demo-shadow-card)',
        }}
      >
        {/* BOLT logo — inline start (right in RTL) */}
        <svg width="44" height="22" viewBox="0 0 44 22" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, opacity: 0.82 }}>
          <path d="M9 2 L4 11.5 L8.2 11.5 L6 20 L14 9.5 L9.8 9.5 Z"
            style={{ fill: 'none', stroke: 'var(--demo-navbar-text, #5C3D2E)' }}
            strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round"/>
          <line x1="19" y1="5" x2="19" y2="17"
            style={{ stroke: 'var(--demo-navbar-text, #C8A882)', opacity: 0.5 }}
            strokeWidth="0.8"/>
          <text x="22" y="15.5" fontFamily="'Cormorant Garamond', 'Georgia', serif"
            fontSize="13" fontWeight="600" letterSpacing="2.5"
            style={{ fill: 'var(--demo-navbar-text, #5C3D2E)' }}>BOLT</text>
        </svg>

        {/* Clinic name — centered absolutely */}
        <motion.button
          onClick={() => onNavigate('home')}
          whileTap={{ scale: 0.97 }}
          style={{
            position: 'absolute', left: '50%', transform: 'translateX(-50%)',
            fontSize: 20, fontWeight: 300, letterSpacing: '0.12em',
            color: 'var(--demo-navbar-text, var(--color-primary))', background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--demo-body-font)', whiteSpace: 'nowrap',
          }}
        >
          Eyebrows
        </motion.button>

        {/* Hamburger — pushed to end */}
        <div style={{ marginInlineStart: 'auto' }} />
        <motion.button
          onClick={onMenuToggle}
          whileTap={{ scale: 0.94 }}
          style={{
            width: 38, height: 38, borderRadius: 'var(--demo-radius-card)',
            backgroundColor: menuOpen ? C.accent : 'transparent',
            border: `1px solid ${menuOpen ? C.accent : C.border}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
            cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          {[0, 1, 2].map(i => (
            <span
              key={i}
              style={{
                display: 'block', width: 16, height: 1.5, borderRadius: 2,
                backgroundColor: menuOpen ? 'var(--demo-navbar-text, #fff)' : 'var(--demo-navbar-text, #8B6E52)',
                transition: 'all 0.22s',
                ...(menuOpen && i === 0 ? { transform: 'translateY(5.5px) rotate(45deg)' } : {}),
                ...(menuOpen && i === 1 ? { opacity: 0, transform: 'scaleX(0)' } : {}),
                ...(menuOpen && i === 2 ? { transform: 'translateY(-5.5px) rotate(-45deg)' } : {}),
              }}
            />
          ))}
        </motion.button>
      </nav>

      {/* Dropdown menu */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Overlay */}
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-30"
              style={{ backgroundColor: 'rgba(45,27,30,0.22)' }}
              onClick={onMenuToggle}
            />

            {/* Menu panel */}
            <motion.div
              key="menu"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="fixed top-14 right-0 left-0 z-40"
              style={{
                  backgroundColor: 'var(--color-surface)',
                borderBottom: `1px solid ${C.border}`,
                boxShadow: 'var(--demo-shadow-card)',
              }}
            >
              {/* User greeting */}
              <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
                {user ? (
                  <p style={{ color: C.text, fontSize: 14 }}>
                    שלום, <strong>{user.firstName || user.name}</strong> 💕
                  </p>
                ) : (
                  <p style={{ color: C.muted, fontSize: 13 }}>ברוכה הבאה ✨</p>
                )}
              </div>

              {/* Navigation links */}
              <div className="py-2">
                {links.map(({ id, label, icon }) => (
                  <motion.button
                    key={id}
                    onClick={() => onNavigate(id)}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', textAlign: 'right',
                      padding: '13px 20px', fontSize: 15,
                      color: page === id ? C.accent : C.text,
                      fontWeight: page === id ? 600 : 400,
                      background: page === id ? 'rgba(107,79,58,0.06)' : 'none',
                      border: 'none', cursor: 'pointer',
                      borderInlineEnd: page === id ? `3px solid ${C.accent}` : '3px solid transparent',
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{icon}</span>
                    {label}
                  </motion.button>
                ))}
              </div>

              {/* Footer — register or logout */}
              <div className="px-4 pb-4 pt-2" style={{ borderTop: `1px solid ${C.border}` }}>
                {user ? (
                  <motion.button
                    onClick={onLogout}
                    whileTap={{ scale: 0.97 }}
                    style={{
                      width: '100%', height: 42, borderRadius: 'var(--demo-radius-card)',
                      border: `1px solid ${C.border}`,
                      backgroundColor: 'transparent', color: C.muted,
                      fontSize: 14, cursor: 'pointer', fontFamily: 'var(--demo-body-font)',
                    }}
                  >
                    יציאה מהחשבון
                  </motion.button>
                ) : (
                  <motion.button
                    onClick={() => onNavigate('register')}
                    whileTap={{ scale: 0.97 }}
                    style={{
                      width: '100%', height: 42, borderRadius: 'var(--demo-radius-card)',
                      backgroundColor: 'var(--color-surface)', color: 'var(--color-primary-ink)',
                      border: '1.5px solid #5C3D2E', fontWeight: 600, fontSize: 14, cursor: 'pointer',
                      boxShadow: 'var(--demo-shadow-card)',
                      fontFamily: 'var(--demo-body-font)',
                    }}
                  >
                    הרשמה / כניסה
                  </motion.button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
