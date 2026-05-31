import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, ExternalLink } from 'lucide-react';

// Bit doesn't support third-party pre-filled payment deep links — requires server-generated request ID.
// UX: show amount BIG → copy button → open app → user pastes amount inside app.
//
// bitAccount accepts two formats:
//   • Phone number (digits, e.g. "0501234567") → opens generic Bit landing, user copies phone
//   • URL (e.g. "https://www.bitpay.co.il/p/XXX") → opens link directly (Bit Business / Grow / Hyp)
// In both cases the AMOUNT is shown big with a "copy" button — Bit can't inject amount into URLs.

function normPhone(p) {
  let d = String(p || '').replace(/\D/g, '');
  if (d.startsWith('972') && d.length >= 12) d = '0' + d.slice(3);
  return d;
}

function formatPhone(d) {
  if (!d || d.length < 10) return d;
  return `${d.slice(0, 3)}-${d.slice(3)}`;
}

function isUrlLike(v) {
  return /^https?:\/\//i.test(String(v || '').trim());
}

export default function PayButtons({ ownerPhone, bitAccount, amount, onPaid }) {
  const raw = String(bitAccount || '').trim();
  const accountIsUrl = isUrlLike(raw);
  const bitUrl       = accountIsUrl ? raw : '';
  const bitPhone     = accountIsUrl ? '' : normPhone(raw);

  const amt = Math.max(0, Math.round(Number(amount) || 0));
  const hasAmt = amt > 0;

  const [copiedAmt,    setCopiedAmt]    = useState(false);
  const [copiedSecond, setCopiedSecond] = useState(false);

  // Render nothing only if no payment method is configured
  if (!bitUrl && !bitPhone) return null;

  // Secondary row: shows phone (formatted) for tel-mode, or shortened URL for link-mode.
  // For tel-mode fallback to ownerPhone if bitAccount is empty (shouldn't happen here but defensive)
  const displayPhone   = bitPhone || normPhone(ownerPhone);
  const formattedPhone = formatPhone(displayPhone);
  // Shorten URL for display: strip protocol + truncate
  const shortUrl = bitUrl
    .replace(/^https?:\/\//i, '')
    .replace(/\/$/, '')
    .slice(0, 30) + (bitUrl.replace(/^https?:\/\//i, '').length > 30 ? '…' : '');

  const copyAmount = async () => {
    try {
      await navigator.clipboard.writeText(String(amt));
      setCopiedAmt(true);
      try { navigator.vibrate?.(15); } catch {}
      setTimeout(() => setCopiedAmt(false), 1800);
    } catch (e) { console.error('[PayButtons] copy amount failed:', e); }
  };

  // Copies phone (tel-mode) OR copies the URL (link-mode — for sharing via WhatsApp etc.)
  const copySecondary = async () => {
    try {
      await navigator.clipboard.writeText(accountIsUrl ? bitUrl : displayPhone);
      setCopiedSecond(true);
      try { navigator.vibrate?.(15); } catch {}
      setTimeout(() => setCopiedSecond(false), 1800);
    } catch (e) { console.error('[PayButtons] copy secondary failed:', e); }
  };

  const handleAppClick = () => {
    try { navigator.vibrate?.(15); } catch {}
    if (typeof onPaid === 'function') onPaid('bit');
  };

  // Open URL directly (link-mode) or Bit landing (tel-mode)
  const openHref = accountIsUrl ? bitUrl : 'https://www.bitpay.co.il/app/';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ── Amount hero ── */}
      <div style={{
        padding: '18px 16px 14px',
        backgroundColor: 'rgba(107,79,58,0.05)',
        borderRadius: 'var(--demo-radius-card)',
        border: '1px solid rgba(107,79,58,0.15)',
        textAlign: 'center',
      }}>
        {/* Label */}
        <p style={{
          fontFamily: 'var(--demo-body-font)', fontSize: 11,
          color: 'var(--color-section)', marginBottom: 6, letterSpacing: '0.04em',
        }}>
          סכום לתשלום
        </p>

        {hasAmt ? (
          <>
            {/* Big amount */}
            <p style={{
              fontFamily: 'var(--demo-heading-font)',
              fontSize: 48, fontWeight: 700,
              color: 'var(--color-primary)', lineHeight: 1,
              marginBottom: 14,
              letterSpacing: '-0.01em',
            }}>
              ₪{amt}
            </p>

            {/* Copy amount button — primary CTA */}
            <motion.button
              onClick={copyAmount}
              whileTap={{ scale: 0.96 }}
              style={{
                width: '100%', height: 46, borderRadius: 11,
                border: copiedAmt ? 'none' : 'var(--demo-primary-mat-border, none)',
                backgroundColor: copiedAmt ? '#4CAF50' : 'var(--color-primary)',
                backgroundImage: copiedAmt ? 'none' : 'var(--demo-primary-mat-overlay, none)',
                color: 'var(--color-surface)',
                fontFamily: 'var(--demo-body-font)', fontSize: 14, fontWeight: 700,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                boxShadow: copiedAmt
                  ? '0 4px 14px rgba(76,175,80,0.30)'
                  : '0 4px 14px rgba(92,61,46,0.25)',
                transition: 'background-color 0.2s',
                marginBottom: 10,
              }}
            >
              <AnimatePresence mode="wait" initial={false}>
                {copiedAmt ? (
                  <motion.span key="done"
                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Check size={16} /> הסכום הועתק!
                  </motion.span>
                ) : (
                  <motion.span key="copy"
                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Copy size={15} /> העתיקי סכום
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </>
        ) : (
          <p style={{
            fontFamily: 'var(--demo-body-font)', fontSize: 13,
            color: 'var(--color-section)', marginBottom: 14, textAlign: 'center',
          }}>
            יש לאשר את הסכום עם הקוסמטיקאית
          </p>
        )}

        {/* Secondary row — phone (tel-mode) or link (url-mode) */}
        <button
          onClick={copySecondary}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid rgba(107,79,58,0.18)',
            borderRadius: 9, cursor: 'pointer',
            fontFamily: 'var(--demo-body-font)',
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--color-section)' }}>
            {accountIsUrl ? 'קישור' : 'מספר'}
          </span>
          <span dir="ltr" style={{
            fontSize: accountIsUrl ? 12 : 14,
            fontWeight: 700, color: 'var(--color-text)',
            letterSpacing: accountIsUrl ? 'normal' : '0.04em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            maxWidth: '70%',
          }}>
            {accountIsUrl ? shortUrl : formattedPhone}
          </span>
          {copiedSecond
            ? <Check size={15} color="#4CAF50" />
            : <Copy size={13} color="#8B6E52" />}
        </button>
      </div>

      {/* ── Open Bit app / link button ── */}
      <motion.a
        href={openHref}
        target={accountIsUrl ? '_blank' : undefined}
        rel={accountIsUrl ? 'noopener noreferrer' : undefined}
        whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.03, y: -2 }}
        onClick={handleAppClick}
        aria-label={accountIsUrl ? 'פתחי קישור Bit' : 'פתחי את אפליקציית ביט'}
        style={{
          width: '100%', height: 48, borderRadius: 'var(--demo-radius-card)', border: 'none',
          background: 'linear-gradient(135deg, #0099FF 0%, #0066CC 100%)',
          color: '#FFFFFF', fontFamily: 'var(--demo-body-font)', fontSize: 13, fontWeight: 700,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          boxShadow: '0 4px 14px rgba(0,153,255,0.30)', textDecoration: 'none',
        }}
      >
        <span style={{ fontFamily: 'var(--demo-heading-font)', fontSize: 17, fontWeight: 700, letterSpacing: '0.04em' }}>bit</span>
        <span style={{ opacity: 0.9, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
          {accountIsUrl ? <>פתחי קישור <ExternalLink size={11} /></> : 'פתחי'}
        </span>
      </motion.a>
    </div>
  );
}
