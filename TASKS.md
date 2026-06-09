# TASKS — nailsweb

## משימות ממתינות — לפי עדיפות

---

### 1. תיקון CLAUDE.md — URLs ו-repo נכונים לnailsweb

**תיאור:** CLAUDE.md הועתק מ-template הגבות ועדיין מכיל eyebrowsweb-app URLs ו-GitHub repo. יש לתקן את כל ה-references ל-nailsweb.
**קבצים רלוונטיים:** `CLAUDE.md`
**הגדרת Done:** CLAUDE.md לא מכיל שום mention של "eyebrowsweb-app" — כל URL ו-repo מצביעים על nailsweb/galohana/nailsweb
**מותר לגעת:** CLAUDE.md בלבד — שינוי טקסט בלבד, אין שינוי לוגיקה
**אסור בלי אישור גל:** DB, Auth, ENV, ארכיטקטורה

---

### 2. מימוש smsReminders

**תיאור:** Feature flag קיים ב-features.js (תמיד false), אך הפיצ'ר לא בנוי. הכוונה: שליחת SMS תזכורת ללקוח X שעות לפני התור כ-fallback למי שאין לו push subscription.
**קבצים רלוונטיים:** `src/config/features.js`, `api/cron-reminders.js` (לא לגעת!), `api/notify.js`, `src/pages/admin-tabs/`
**הגדרת Done:** הטוגל באדמין עובד; כשמופעל — לקוחות ללא push subscription מקבלים SMS תזכורת; SMS לא נשלח לבעלות push; flag=false = אין שליחה
**מותר לגעת:** admin-tabs/reminders, api/notify — **אסור לגעת ב-cron-reminders.js**
**אסור בלי אישור גל:** DB, Auth, ENV, ארכיטקטורה

---

### 3. PayPlus / תשלומים אונליין מלאים

**תיאור:** VITE_FEATURE_PAYMENTS=false. יש להטמיע PayPlus או שרות תשלומים ישראלי מלא — תשלום בכרטיס בתוך הזרימה של הזמנת תור.
**קבצים רלוונטיים:** `src/config/features.js`, `src/components/PayButtons.jsx`, `src/pages/Booking.jsx`
**הגדרת Done:** לקוח יכול לשלם בכרטיס אשראי תוך כדי הזמנת תור; FEATURE_PAYMENTS=true מציג את זרימת התשלום; false מסתיר אותה לחלוטין
**מותר לגעת:** PayButtons.jsx, Booking.jsx (רק חלק התשלום), features.js, api routes חדשים
**אסור בלי אישור גל:** DB schema, Auth, ארכיטקטורה בסיסית — **לפני התחלה: לשאול גל איזה ספק תשלומים**

---

### 4. אימות SUPABASE_SERVICE_KEY ב-Vercel

**תיאור:** SUPABASE_SERVICE_KEY נדרש ל-push notifications וקבלות (RLS bypass). יש לוודא שמוגדר ב-Vercel environment variables של הפרויקט.
**קבצים רלוונטיים:** `api/_push.js`, `api/send-receipt.js`, `vercel.json`
**הגדרת Done:** `vercel env ls` מציג SUPABASE_SERVICE_KEY עם ערך; push + receipts עובדים ב-production
**מותר לגעת:** Vercel dashboard / CLI env management בלבד
**אסור בלי אישור גל:** DB, Auth, ENV ערכים עצמם

---

### 5. אימות cron-job.org רשום ופעיל

**תיאור:** cron-reminders.js ו-cron-pending.js רצים כל 15 דקות דרך cron-job.org. יש לוודא שהרישום קיים ומצביע ל-URL הנכון.
**קבצים רלוונטיים:** `api/cron-reminders.js` (קריאה בלבד!), `vercel.json`
**הגדרת Done:** cron-job.org מציג 2 jobs פעילים: /api/cron-reminders ו-/api/cron-pending עם interval 15 דקות; logs מראים הרצות מוצלחות
**מותר לגעת:** cron-job.org dashboard בלבד — **אסור לגעת בקוד**
**אסור בלי אישור גל:** DB, Auth, ENV, ארכיטקטורה
