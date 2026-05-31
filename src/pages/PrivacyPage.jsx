import { motion } from 'framer-motion';
import PageHeader from '../components/PageHeader';

const C = {
  bg:      'var(--color-bg)',
  surface: 'var(--color-surface)',
  accent:  'var(--color-primary)',
  text:    'var(--color-text)',
  muted:   '#8B6E52',
  border:  '#D4B896',
};

const sections = [
  {
    title: 'מידע שאנו אוספים',
    content: `כאשר את נרשמת לאתר, אנו אוספים את הפרטים הבאים:
• שם מלא
• מספר טלפון נייד
• כתובת דואר אלקטרוני (אופציונלי)
• תאריך לידה (אופציונלי)
• היסטוריית תורים ושירותים שנרכשו

מידע זה נאסף אך ורק לצורך מתן השירות ושיפורו.`,
  },
  {
    title: 'כיצד אנו משתמשים במידע',
    content: `המידע שנאסף משמש אך ורק למטרות הבאות:
• קביעה, אישור וניהול תורים
• שליחת תזכורות ועדכונים לגבי תורים קיימים
• שליחת קבלות דיגיטליות לאחר ביצוע תשלום
• יצירת קשר בנושאים הקשורים לשירות
• שיפור חוויית המשתמש באתר

אנו לא נמכור, נשכיר או נשתף את המידע שלך עם גורמים שלישיים לצרכי שיווק.`,
  },
  {
    title: 'הודעות SMS',
    content: `עם ההרשמה לאתר, את מסכימה לקבל הודעות SMS בנושאים הבאים:
• אישור קביעת תור
• תזכורת יום לפני התור
• עדכונים על שינויים או ביטולים
• הודעת ברוכה הבאה עם ההרשמה הראשונה

ניתן לבטל קבלת הודעות SMS בכל עת על ידי פנייה אלינו ישירות.
הודעות SMS נשלחות דרך Twilio, ספק מאושר ומאובטח.`,
  },
  {
    title: 'אבטחת מידע',
    content: `אנו נוקטים באמצעי אבטחה מתקדמים להגנה על המידע שלך:
• כל המידע מאוחסן בשרתי Supabase המוצפנים (אירופה — פרנקפורט)
• גישה למידע מוגבלת אך ורק לבעלת העסק
• החיבור לאתר מוצפן בפרוטוקול HTTPS
• סיסמאות אינן נשמרות במערכת — כניסה מתבצעת דרך קוד חד-פעמי בלבד (OTP)`,
  },
  {
    title: 'זכויותייך',
    content: `בהתאם לחוק הגנת הפרטיות הישראלי, עומדות לך הזכויות הבאות:
• לדעת אילו מידע מוחזק אודותייך
• לעיין, לתקן או לעדכן את פרטייך בכל עת
• לבקש מחיקת המידע שלך מהמערכת
• לבקש הפסקת קבלת הודעות

לממוש זכויות אלו, ניתן לפנות אלינו בכל אחד מאמצעי הקשר המפורטים להלן.`,
  },
  {
    title: 'קבצי Cookie',
    content: `האתר עשוי להשתמש ב-cookies מינימליים לצורך שמירת מצב ההתחברות שלך בין הביקורים. אין שימוש ב-cookies לצרכי פרסום או מעקב.`,
  },
  {
    title: 'שינויים במדיניות',
    content: `אנו שומרים לעצמנו את הזכות לעדכן מדיניות זו מעת לעת. שינויים מהותיים יפורסמו באתר. המשך השימוש באתר לאחר פרסום שינויים מהווה הסכמה למדיניות המעודכנת.`,
  },
  {
    title: 'יצירת קשר',
    content: `לכל שאלה, בקשה או תלונה בנוגע למדיניות הפרטיות, ניתן לפנות אלינו:
• בוואטסאפ — דרך כפתור "צרי קשר" באתר
• בדואר אלקטרוני — boltagent8@gmail.com

נשוב אליך בהקדם האפשרי.`,
  },
];

export default function PrivacyPage({ onNavigate }) {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: C.bg, paddingBottom: 60 }}>
      <PageHeader />

      <div style={{ padding: '72px 20px 0' }}>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => onNavigate('home')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: C.muted, fontSize: 13, fontFamily: 'var(--demo-body-font)',
            padding: '4px 0', marginBottom: 24, display: 'block',
          }}
        >
          ← חזרה לדף הבית
        </motion.button>

        <h1 style={{
          fontFamily: 'var(--demo-heading-font)',
          fontSize: 32, fontWeight: 500, color: C.text,
          marginBottom: 6, lineHeight: 1.2,
        }}>
          מדיניות פרטיות
        </h1>
        <p style={{
          fontFamily: 'var(--demo-body-font)', fontSize: 12,
          color: C.muted, marginBottom: 32,
        }}>
          עדכון אחרון: מאי 2025
        </p>

        <p style={{
          fontFamily: 'var(--demo-body-font)', fontSize: 14, color: C.text,
          lineHeight: 1.8, marginBottom: 32,
          backgroundColor: C.surface, borderRadius: 'var(--demo-radius-card)', padding: '18px 16px',
          border: `1px solid ${C.border}`,
        }}>
          מדיניות פרטיות זו מסבירה כיצד האתר אוסף, משתמש ומגן על המידע האישי שלך.
          השימוש באתר מהווה הסכמה למדיניות זו.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {sections.map((sec, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45, ease: 'easeOut', delay: i * 0.04 }}
              style={{
                backgroundColor: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 'var(--demo-radius-card)', padding: '20px 18px',
              }}
            >
              <h2 style={{
                fontFamily: 'var(--demo-heading-font)',
                fontSize: 19, fontWeight: 600, color: C.accent,
                marginBottom: 12,
              }}>
                {sec.title}
              </h2>
              <p style={{
                fontFamily: 'var(--demo-body-font)', fontSize: 13,
                color: C.text, lineHeight: 1.85, whiteSpace: 'pre-wrap',
              }}>
                {sec.content}
              </p>
            </motion.div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <p style={{ fontFamily: 'var(--demo-body-font)', fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
            האתר מופעל על ידי RISE — בניית אתרים חכמים לעסקים קטנים
          </p>
        </div>
      </div>
    </div>
  );
}
