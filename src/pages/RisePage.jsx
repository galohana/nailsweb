import { motion } from 'framer-motion';
import PageHeader from '../components/PageHeader';

export default function RisePage({ embedded = false }) {
  const whatsappLink = 'https://wa.me/972505450408?text=' +
    encodeURIComponent('היי! אשמח לשמוע עוד פרטים על בניית האתר לעסק שלי🙏');

  return (
    <div style={{ minHeight: embedded ? 0 : '100vh', backgroundColor: 'var(--color-bg)', backgroundImage: 'var(--demo-bg-mat-surface)', backgroundRepeat: 'repeat', padding: embedded ? '48px 20px 40px' : '80px 20px 40px', direction: 'rtl', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {!embedded && <PageHeader />}

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, type: 'spring', stiffness: 120 }}
        style={{ width: '100%', maxWidth: '360px', backgroundColor: 'var(--color-surface)', borderRadius: '20px', padding: '24px 20px', boxShadow: '0 2px 16px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04)', marginTop: '12px' }}
      >
        {/* לוגו RISE — עצמאי, ללא מסגרת עגולה (הלוגו לא מותאם לעיגול) */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 220 }}
          style={{ width: '140px', height: 'auto', margin: '0 auto 14px', display: 'flex', justifyContent: 'center' }}
        >
          <img src="/assets/rise-brand.png" alt="RISE" style={{ width: '100%', height: 'auto', objectFit: 'contain', display: 'block' }} />
        </motion.div>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
          style={{ fontFamily: 'var(--demo-body-font)', fontSize: '11px', color: 'var(--color-section)', textAlign: 'center', letterSpacing: '2px', marginBottom: '16px', textTransform: 'uppercase' }}
        >
          אתרי תורים לעסקים
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
          style={{ fontFamily: 'var(--demo-body-font)', fontSize: '13px', lineHeight: 1.75, color: 'var(--color-text)', textAlign: 'center', marginBottom: '6px' }}
        >
          <p style={{ marginBottom: '8px', fontWeight: 600 }}>עמוסה מלנהל לעצמך את העסק?</p>
          <p style={{ marginBottom: '8px', fontWeight: 600 }}>לא רוצה להוציא הון על מזכירה?</p>
          <p style={{ marginBottom: '12px', fontFamily: 'Cormorant Garamond', fontSize: '18px', color: 'var(--color-primary-ink)', fontWeight: 600 }}>
            הפתרון המושלם עבורך!
          </p>
          <p style={{ color: 'var(--color-primary-ink)', opacity: 0.8, fontSize: '12.5px', lineHeight: 1.7 }}>
            מערכת RISE קובעת עבורך תורים, מעדכנת אותך ואת הלקוחות בכל תור, הופכת את העסק שלך למקצועי ואסתטי, ובעיקר הופכת את היומיום שלך לרגוע וקל.
          </p>
        </motion.div>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
          style={{ fontFamily: 'var(--demo-body-font)', fontSize: '12px', color: 'var(--color-section)', textAlign: 'center', margin: '14px 0' }}
        >
          לפרטים לחצי ⬇
        </motion.p>

        <motion.a
          href={whatsappLink} target="_blank" rel="noopener noreferrer"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1, y: [0, -6, 0] }}
          transition={{ opacity: { delay: 0.9 }, scale: { delay: 0.9, type: 'spring', stiffness: 200 }, y: { delay: 1.4, duration: 2.5, repeat: Infinity, ease: 'easeInOut' } }}
          whileTap={{ scale: 0.95 }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '13px', backgroundColor: '#25D366', borderRadius: '14px', textDecoration: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="#FDFAF7">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
          </svg>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: '14px', fontWeight: 700, color: 'var(--color-surface)', marginBottom: '1px' }}>דברו איתנו בוואטסאפ</p>
            <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: '11px', color: 'var(--color-surface)', opacity: 0.9 }}>050-5450408</p>
          </div>
        </motion.a>
      </motion.div>

      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.45 }} transition={{ delay: 1.4 }}
        style={{ fontFamily: 'var(--demo-body-font)', fontSize: '10px', color: 'var(--color-section)', marginTop: '20px', textAlign: 'center' }}
      >
        Powered by RISE
      </motion.p>
    </div>
  );
}
