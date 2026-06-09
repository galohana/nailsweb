# PROJECT_CONTEXT — nailsweb

## מה המוצר

אתר הזמנת תורים (PWA) למובייל עבור סטודיואים לטיפוח יופי (ציפורניים, גבות, ריסים).
לקוחות קובעות תורים, מבטלות, עיינות בחנות ומקבלות התראות SMS/push.
בעלת הסטודיו מנהלת הכל דרך פאנל אדמין מוגן סיסמה.

**משתמשים:**
- בעלות סטודיו — ניהול תורים, שירותים, צוות, חנות, דוחות (מסלול /manage-x7k2)
- לקוחות — הזמנת תורים, צפייה, קנייה מהחנות (ממשק ציבורי)

**מטרה עסקית:**
RISE system — template ראשי לנייל/ברבר. כל לקוח חדש = clone של הריפו הזה + עדכון design.js + credentials + deploy.
מודל הכנסה: דמי שימוש חודשיים קבועים לכל לקוח.

---

## סטאק טכני

| שכבה | טכנולוגיה |
|------|-----------|
| Frontend | React 19 + Vite 8 + Tailwind CSS + Framer Motion 12 |
| Database | Supabase (Frankfurt EU — eu-central-1) |
| Hosting | Vercel (serverless API routes) |
| SMS / OTP | Twilio |
| Email | Resend (domain: rise-booking.com) |
| Push Notifications | Web Push VAPID |
| PWA | Dynamic manifest via /api/manifest |
| Fonts | Heebo + Comfortaa |
| Language | Hebrew RTL throughout |

---

## מבנה תיקיות

```
nailsweb/
├── src/
│   ├── pages/              # קומפוננטות עמוד (Home, Booking, MyAppointments, Shop, AdminPanel, GalleryAbout, ContactPage...)
│   │   └── admin-tabs/     # 12 טאבים של פאנל האדמין
│   ├── components/         # UI משותף (Navbar, BubbleMenu, SplashScreen, PayButtons...)
│   ├── config/
│   │   ├── design.js       # צבעים, חומרים, פונטים — קובץ זה בלבד משתנה לכל לקוח
│   │   └── features.js     # feature flags לכל לקוח
│   ├── lib/
│   │   ├── supabase.js     # Supabase client
│   │   └── dynamicPWA.js   # PWA dynamic manifest helper
│   └── utils/
│       ├── db.js           # כל פעולות Supabase
│       ├── storage.js      # Supabase storage helpers
│       └── defaults.js     # ערכי ברירת מחדל לעסק
├── api/                    # Vercel serverless functions
├── public/                 # static assets (hero, icons, splash)
├── .claude/skills/         # קבצי skill מקומיים
├── PROJECT_CONTEXT.md      # (קובץ זה)
├── CURRENT_STATE.md
├── TASKS.md
├── AGENTS.md
└── CLAUDE.md
```

---

## קבצים קריטיים

| קובץ | תיאור |
|------|-------|
| `src/config/design.js` | **הקובץ היחיד שמשתנה לכל לקוח** — צבעים, חומרים, פונטים, פינות, צל |
| `src/config/features.js` | feature flags — מה מופעל/כבוי לכל לקוח |
| `src/App.jsx` | router ראשי + providers |
| `src/pages/Booking.jsx` | זרימת הזמנת התור המלאה (OTP + שירות + צוות + זמן + אישור) |
| `src/pages/AdminPanel.jsx` | פאנל האדמין הראשי עם 12 טאבים |
| `src/utils/defaults.js` | ערכי ברירת מחדל לשעות עבודה, הגדרות עסק |
| `api/cron-reminders.js` | **אסור לגעת** — cron להתראות תורים כל 15 דקות |
| `api/_push.js` | helper פנימי לשליחת Web Push |
| `api/send-telegram.js` | שליחת הודעות Telegram לבעלים |
| `api/telegram-webhook.js` | קבלת approve/reject מ-Telegram inline buttons |
| `vercel.json` | routing + cron config — שינוי alias חובה לפני deploy של clone |
| `CLAUDE.md` | הוראות לכל AI בפרויקט |

---

## API Routes

| Route | תיאור |
|-------|-------|
| `/api/send-otp` | שליחת OTP ל-SMS דרך Twilio |
| `/api/verify-otp` | אימות OTP |
| `/api/send-telegram` | שליחת הודעה ל-Telegram של הבעלים |
| `/api/telegram-webhook` | webhook — קבלת approve/reject מ-Telegram |
| `/api/register-telegram-webhook` | רישום ה-webhook ב-Telegram |
| `/api/send-receipt` | שליחת קבלה ב-email דרך Resend |
| `/api/send-push` | שליחת Web Push notification |
| `/api/notify` | unified notification (push + SMS fallback) |
| `/api/cron-reminders` | cron — תזכורות תורים (כל 15 דקות) |
| `/api/cron-pending` | cron — ניקוי תורים ממתינים |
| `/api/manifest` | dynamic PWA manifest לפי הגדרות אדמין |
| `/api/manifest-admin` | PWA manifest לאדמין |
| `/api/_push` | helper פנימי בלבד — לא לקריאה ישירה |

---

## החלטות ארכיטקטורה — אסור לשנות

1. **Supabase region: Frankfurt EU בלבד** — לא לשנות לעולם
2. **Admin route: /manage-x7k2** עם password gate — לא לשנות את ה-slug
3. **design.js הוא הקובץ היחיד שמשתנה לכל לקוח** — לא להardcode צבעים במקום אחר
4. **features.js שולט על כל feature flags** — smsReminders תמיד false עד שיבנה
5. **cron-reminders.js אסור לגעת בו** (כלל מפורש ב-CLAUDE.md)
6. **applyDesign.js מזריק design.js ל-CSS vars** — לא לעקוף אותו
7. **vercel.json alias חייב להיות מוגדר לדומיין של ה-clone לפני deploy ראשון** (לא eyebrowsweb-app)
8. **RTL תמיד — logical CSS properties בלבד** (ms/me/ps/pe)
9. **Mobile-first בלבד** — אין desktop layout נפרד
10. **Tab rule: שורה תחתונה בטאבים של AdminPanel >= שורה עליונה** תמיד
11. **הסטאק קבוע** — אין החלפת ספרייה ראשית בלי אישור גל
12. **אין git push + vercel --prod באותו session** — בחר אחד בלבד
13. **אחרי vercel --prod: תמיד** `vercel alias set <url> nailsweb.vercel.app`

---

## URL חשובים

| שם | URL |
|----|-----|
| Live site | https://nailsweb.vercel.app |
| Admin panel | https://nailsweb.vercel.app/manage-x7k2 |
| Supabase | https://expypgqdrjbthgxfddog.supabase.co |
| Supabase org | Rise - nailsweb (PRO) |
| GitHub repo | github.com/galohana/nailsweb |
