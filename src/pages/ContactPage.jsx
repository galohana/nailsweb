import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { db } from '../utils/db';
import { DEFAULT_CLINIC_INFO } from '../utils/defaults';
import PageHeader from '../components/PageHeader';

export default function ContactPage({ onNavigate, embedded = false }) {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    db.settings.get('clinicInfo', DEFAULT_CLINIC_INFO).then(setInfo);
  }, []);

  if (!info) return null;

  const address      = info.address || '';
  const rawWaze      = (info.wazeLink || '').trim();
  const isValidWaze  = rawWaze.startsWith('https://') || rawWaze.startsWith('http://');
  const wazeLink     = (isValidWaze ? rawWaze : '') || (address ? `https://waze.com/ul?q=${encodeURIComponent(address)}` : '#');
  const mapEmbed     = address ? `https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=17&output=embed` : '';
  const igUser       = info.instagram || '';
  const whatsappMsg  = encodeURIComponent('היי, רציתי לקבוע תור 😊');

  const toIntl = (num) => {
    const clean = (num || '').replace(/\D/g, '');
    if (!clean) return '';
    if (clean.startsWith('972')) return clean;
    if (clean.startsWith('0')) return '972' + clean.slice(1);
    return clean;
  };
  const whatsappNum = toIntl(info.whatsapp);

  return (
    <div style={{
      backgroundColor: embedded ? 'transparent' : 'var(--color-section)',
      paddingTop: embedded ? 0 : 80,
      paddingBottom: 48,
      paddingInline: 20,
      direction: 'rtl',
    }}>
      {!embedded && <PageHeader />}
      {!embedded && (
        <>
          <h1 style={{
            fontFamily: 'var(--demo-heading-font)',
            fontSize: 34, fontWeight: 400,
            color: 'var(--color-surface)', textAlign: 'center',
            marginBottom: 6, letterSpacing: '0.04em',
          }}>
            צרי קשר
          </h1>
          <div className="rise-divider" />
        </>
      )}

      {/* Map card — outer wrapper carries .demo-tinted (color + material).
          Inner motion.div carries whileInView animation. Splitting avoids the
          composite-layer bug where transform on the tinted element breaks
          ::after mix-blend-mode (lesson learned in rise-builder). */}
      {mapEmbed && (
        <div
          className="demo-tinted"
          style={{
            borderRadius: 20,
            boxShadow: 'var(--demo-shadow-deep)',
            marginBottom: 24,
          }}
        >
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ type: 'spring', stiffness: 180, damping: 22 }}
        >
          <p style={{
            fontFamily: 'var(--demo-body-font)', fontSize: 14, color: 'var(--color-section)',
            textAlign: 'center', padding: '16px 16px 8px', fontWeight: 600,
          }}>
            למסלול לחצי על התמונה
          </p>

          <motion.a
            href={wazeLink} target="_blank" rel="noopener noreferrer"
            whileTap={{ scale: 0.98 }}
            style={{ display: 'block', position: 'relative', width: '100%', aspectRatio: '3/4' }}
          >
            <iframe
              src={mapEmbed}
              style={{ width: '100%', height: '100%', border: 0, pointerEvents: 'none' }}
              loading="lazy"
              title="מפת מיקום"
            />
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
                backgroundColor: 'var(--color-surface)', color: 'var(--color-section)', padding: '10px 20px',
                borderRadius: 50, fontFamily: 'var(--demo-body-font)', fontSize: 14, fontWeight: 700,
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)', whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Waze_logo.svg/2048px-Waze_logo.svg.png"
                alt="Waze"
                style={{ width: 40, height: 40, objectFit: 'contain' }}
              />
              פתחי ניווט ב-Waze
            </motion.div>
          </motion.a>

          {address && (
            <p style={{
              fontFamily: 'var(--demo-body-font)', fontSize: 15, color: 'var(--color-text)',
              textAlign: 'center', padding: '12px 16px 16px', fontWeight: 600,
            }}>
              📍 {address}
            </p>
          )}
        </motion.div>
        </div>
      )}

      {/* WhatsApp + Instagram side by side */}
      {(whatsappNum || igUser) && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
          {whatsappNum && (
            <motion.a
              href={`https://wa.me/${whatsappNum}?text=${whatsappMsg}`}
              target="_blank" rel="noopener noreferrer"
              initial={{ opacity: 0, x: 60 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-30px' }}
              transition={{ type: 'spring', stiffness: 220, damping: 22 }}
              whileTap={{ scale: 0.95 }}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '20px 12px', backgroundColor: '#25D366',
                borderRadius: 'var(--demo-radius-card)', textDecoration: 'none',
                boxShadow: 'var(--demo-shadow-card)',
              }}
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="#FDFAF7">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
              </svg>
              <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 13, fontWeight: 700, color: 'var(--color-surface)', textAlign: 'center', margin: 0 }}>
                וואטסאפ
              </p>
            </motion.a>
          )}

          {igUser && (
            <motion.a
              href={`https://instagram.com/${igUser}`}
              target="_blank" rel="noopener noreferrer"
              initial={{ opacity: 0, x: -60 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-30px' }}
              transition={{ type: 'spring', stiffness: 220, damping: 22 }}
              whileTap={{ scale: 0.95 }}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '20px 12px',
                background: 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                borderRadius: 'var(--demo-radius-card)', textDecoration: 'none',
                boxShadow: 'var(--demo-shadow-card)',
              }}
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#FDFAF7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
              </svg>
              <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 13, fontWeight: 700, color: 'var(--color-surface)', textAlign: 'center', margin: 0 }}>
                אינסטגרם
              </p>
            </motion.a>
          )}
        </div>
      )}
    </div>
  );
}
