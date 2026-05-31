# RISE MASTER — הקמת אתר לקוחה חדשה

> קובץ זה נשמר בתיקיית `C:\Users\גל\Bolt` ולא משתנה בין לקוחות.
> לכל הקמה חדשה — גורר קובץ זה + CLAUDE.md של הלקוחה מהאימייל.

---

## חלק א' — הבנת המערכת

### מה זה RISE
עסק שבונה אתרי קביעת תורים לסטודיואים של יופי. תבנית ציפורניים: `nailsweb`. כל לקוחה = clone עצמאי עם הגדרות משלה.

**עיקרון:** שינוי באתר-האב לא מתפשט לאתרי הלקוחות. תיקון גלובלי = תיקון ידני בכל repo.

### סטאק
React + Vite + Tailwind · Framer Motion · עברית RTL · Supabase (Frankfurt EU) · Vercel · Twilio · Resend · Telegram bot

### מיקומים
| פריט | ערך |
|---|---|
| תיקייה מקומית | `C:\Users\גל\Bolt\nailsweb` |
| GitHub | `https://github.com/galohana/nailsweb` |
| Branch | **`master`** |
| אתר חי | `https://nailsweb.vercel.app` |
| אדמין | `/manage-x7k2` (סיסמה: `admin123`) |

### קבצים קריטיים
| קובץ | תפקיד |
|---|---|
| `src/config/features.js` | feature flags — מתג לכל פיצ'ר |
| `src/config/design.js` | **הקובץ שמשנים פר-לקוחה** — צבעים, חומרים, גופן |
| `src/lib/applyDesign.js` | מזריק design.js ל-CSS variables אוטומטית |
| `src/styles/design-tokens.css` | כל משתני העיצוב |
| `cron-reminders.js` | **לא לגעת** |

---

## חלק ב' — Feature Flags

```js
export const features = {
  staff: true,        // עובדות ₪59
  reports: true,      // חנות + תשלומים + סטטיסטיקה ₪99
  receipts: true,     // קבלות ₪69
  smsReminders: false, // לא בנוי עדיין — תמיד false
};
```

- `staff` כבוי → טאב עובדות נעלם, בחירת מטפלת נעלמת
- `reports` כבוי → חנות + דוחות + כפתורי תשלום נעלמים
- `receipts` כבוי → קבלות נעלמות. דלוק + reports כבוי → קבלות כטאב עצמאי
- טאבים: שורה תחתונה תמיד ≥ עליונה

---

## חלק ג' — מערכת העיצוב

### עדכון design.js לכל לקוחה
```js
export const design = {
  colors: {
    primary: '#5C3D2E',  // צבע ראשי
    section: '#7D5A47',  // צבע משני
    bg: '#F2E8DC',       // צבע רקע
  },
  materials: {
    primary: 'flat',     // flat/matte/glass/metallic/wood/stripes/marble
    section: 'flat',
    bg: 'flat',
  },
  headingFont: 'Cormorant Garamond', // ראה טבלה מטה
  corners: 'normal',    // sharp/normal/rounded
  shadow: 'soft',       // none/soft/deep/glow
};
```

### מיפוי CSS Variables
| בחירה | CSS variable |
|---|---|
| צבע ראשי | `--color-primary` + `--color-primary-rgb` |
| צבע משני | `--color-section` + `--color-section-bg` + `--color-section-rgb` |
| צבע רקע | `--color-bg` + `--color-bg-rgb` |
| חומר ראשי | `--demo-primary-mat-surface` + `--demo-primary-mat-overlay` |
| חומר משני | `--demo-section-mat-surface` + `--demo-section-mat-overlay` |
| חומר רקע | `--demo-bg-mat-surface` + `--demo-bg-mat-overlay` |

### גופנים
| בחירה | ערך | גופן עברי אוטומטי |
|---|---|---|
| Cormorant Garamond | `'Cormorant Garamond'` | Bellefair |
| Playfair Display | `'Playfair Display'` | Frank Ruhl Libre |
| Pacifico | `'Pacifico'` | Amatic SC |
| Comfortaa | `'Comfortaa'` | Varela Round |
| Parisienne | `'Parisienne'` | Amatic SC |

### פינות וצל
| corners | --demo-radius-card | --demo-radius-pill |
|---|---|---|
| sharp | 2px | 4px |
| normal | 12px | 999px |
| rounded | 24px | 999px |

| shadow | --demo-shadow-card |
|---|---|
| none | none |
| soft | 0 2px 8px rgba(0,0,0,0.06) |
| deep | 0 18px 38px rgba(0,0,0,0.20) |
| glow | 0 0 0 1px rgba(r,g,b,0.18), 0 8px 28px rgba(r,g,b,0.42) |

---

## חלק ד' — Supabase

### טבלאות
`appointments` · `clients` · `gallery` · `orders` · `products` · `reviews` · `services` · `settings` · `staff`

### settings — key-value store
`workingHours`, `appointmentPayments`, `pendingPayments`, `smsTemplates`, `heroMedia`, `aboutMedia`, `bitAccount`, `paymentVisibility`, `productInventory`, `receiptCounter`, `heroStats` ועוד.

---

## חלק ה' — תשתית חיצונית

### Telegram
בוט אחד לכולם. `TELEGRAM_CHAT_ID` שונה לכל לקוחה. הלקוחה חייבת לשלוח /start לבוט לפני שההתראות יעבדו.

### Twilio
OTP + "ברוכה הבאה" תמיד פעיל. ⚠️ trim ל-70 תווים לכל SMS.

### Resend
קבלות HTML. `boltagent8@gmail.com` = חשבון הבעלים.

### תשלומים
ביט: `https://www.bitpay.co.il/app/me/{phone}` · פייבוקס: לא עובד · מזומן: הזמנה + טלגרם

---

## חלק ו' — ENV vars

```
# קבועים לכולם — אל תשנה
TWILIO_ACCOUNT_SID=<set in .env>
TWILIO_AUTH_TOKEN=<set in .env>
TWILIO_PHONE=<set in .env>
RESEND_API_KEY=<set in .env>
TELEGRAM_BOT_TOKEN=<set in .env>

# ספציפי ללקוחה — מה-CLAUDE.md
VITE_SUPABASE_URL=
VITE_SUPABASE_KEY=
OWNER_PHONE=[טלפון הלקוחה עם קידומת +972]
TELEGRAM_CHAT_ID=
```

---

## חלק ז' — חוקי עבודה

1. לפני משימה גדולה — קרא קבצים, הצג תוכנית + סיכונים, חכה לאישור
2. Double Verification — לא "הצלחתי חלקית"
3. import תמיד מ-`../lib/supabase`
4. input/textarea — מחוץ לפונקציה הראשית
5. ErrorBoundary על כל טאב באדמין
6. לא נוגעים ב-`cron-reminders.js`
7. `features.js` — אובייקט נקי בלבד
8. build check אחרי כל 2-3 שינויים
9. Sonnet לעבודה רגילה, Opus לבעיה תקועה
10. repo אחד בלבד בכל משימה

### ⚡ עצמאות — חובה לקרוא
בהקמת אתר חדש — בצע את כל השלבים ברצף **ללא עצירה לאישור בין שלב לשלב**.
דווח בסיום כל שלב (שורה קצרה: "✓ שלב X — הושלם"), ואז המשך מיד לשלב הבא.

**עצור לאישור רק אם:**
- עומד למחוק נתונים או קבצים קיימים
- נתקל בשגיאה שלא ניתן לפתור לבד
- חסר מידע שרק הבעלים יכול לספק

כל שאר ההחלטות — קבל לבד ותמשיך.

---

## חלק ח' — הקמת אתר — שלבי ביצוע

בצע בדיוק לפי הסדר. לפני כל שלב — דווח. אחרי כל שלב — ודא. אם נכשל — עצור ודווח.

### לפני שמתחיל — גל מכין ידנית

**Telegram בלבד:**
בקש מהלקוחה לשלוח /start לבוט לפני שמתחילים.

GitHub ו-Supabase — קלוד קוד עושה לבד.

---

### שלב 1 — יצירת Supabase project
```bash
# יצור project חדש ב-Supabase אוטומטית
curl -X POST https://api.supabase.com/v1/projects \
  -H "Authorization: Bearer YOUR_SUPABASE_PERSONAL_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "[שם קליניקה]", "region": "eu-central-1", "plan": "free"}'
```
חכה כ-2 דקות עד שה-project מוכן, אחר כך שלוף URL + anon key:
```bash
curl https://api.supabase.com/v1/projects \
  -H "Authorization: Bearer YOUR_SUPABASE_PERSONAL_ACCESS_TOKEN"
```
מצא את ה-project החדש ושמור את ה-`id`. אחר כך שלוף את ה-anon key:
```bash
curl https://api.supabase.com/v1/projects/[project-id]/api-keys \
  -H "Authorization: Bearer YOUR_SUPABASE_PERSONAL_ACCESS_TOKEN"
```

### שלב 1.5 — שכפול והרצת schema
```bash
cd C:\Users\גל\Bolt
git clone https://github.com/galohana/nailsweb "[שם באנגלית]"
cd "[שם באנגלית]"
npm install
```
אחר כך הרץ את schema.sql על ה-project החדש דרך Supabase Management API:
```bash
curl -X POST https://api.supabase.com/v1/projects/[project-id]/database/query \
  -H "Authorization: Bearer YOUR_SUPABASE_PERSONAL_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"$(cat docs/schema.sql | tr -d '\n' | sed 's/"/\\"/g')\"}"
```
⚠️ אם הפקודה נכשלת — הרץ את תוכן `docs/schema.sql` ישירות ב-Supabase → SQL Editor.

### שלב 1.6 — הרשאות + Storage bucket (חובה!)

⚠️ **בלי זה:** הוספת שירותים, העלאת תמונות ושמירת נתונים ייכשלו בשקט.

כנס ל-**Supabase → SQL Editor** של הפרויקט החדש והרץ:

```sql
-- 1. הרשאות לתפקיד anon (בלי זה INSERT/UPDATE/DELETE נחסמים)
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE appointments, clients, gallery, orders, products,
          reviews, services, settings, staff, waitlist
  TO anon, authenticated;

-- 2. יצירת bucket לאחסון תמונות
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

-- 3. מדיניות גישה ל-bucket
DROP POLICY IF EXISTS anon_all_media ON storage.objects;
CREATE POLICY anon_all_media ON storage.objects
  FOR ALL TO anon, authenticated
  USING (bucket_id = 'media')
  WITH CHECK (bucket_id = 'media');
```

אימות — הרץ בנפרד:
```sql
SELECT grantee, privilege_type FROM information_schema.role_table_grants
WHERE table_name = 'services' AND grantee = 'anon';
-- צפוי: 4 שורות (SELECT, INSERT, UPDATE, DELETE)
```

### שלב 2 — Feature flags
עדכן `src/config/features.js` לפי החבילה מה-CLAUDE.md.

### שלב 3 — עיצוב
עדכן `src/config/design.js` לפי ערכי העיצוב מה-CLAUDE.md.

### שלב 4 — משתני סביבה
צור `.env` בשורש עם כל הערכים מחלק ו' למעלה.

### שלב 4.5 — תיקון vercel.json לפני deploy
פתח `vercel.json` ושנה את ה-alias לשם הלקוחה:
```json
{
  "alias": ["[שם-קליניקה-באנגלית].vercel.app"]
}
```
⚠️ חובה לפני deploy — אחרת יגנוב את ה-alias של eyebrowsweb-app.

### שלב 5 — GitHub + Vercel

⚠️ **חובה לפני כל push:**
1. הרץ `git remote -v` וודא שה-remote מצביע על הריפו של הלקוחה — לא על eyebrowsweb-app
2. אם ה-remote לא נכון — תקן אותו לפני ה-push, לעולם אל תדחוף ל-nailsweb במהלך הקמת לקוחה
3. אם בשגגה נדחף commit ל-nailsweb — עצור הכל, דווח לגל מיד, וחכה לאישור לפני שממשיכים

```bash
gh repo create galohana/[שם-באנגלית] --private --source=. --remote=origin --push
git remote -v  # ← ודא שמצביע על הריפו של הלקוחה!
git remote set-url origin https://github.com/galohana/[שם-באנגלית].git
git add -A
git commit -m "init: [שם קליניקה]"
git push origin master
vercel --prod
```

### שלב 5.5 — הזנת פרטי הלקוחה ל-Supabase
כנס ל-Supabase dashboard של הלקוחה → SQL Editor → הרץ:

> ⚠️ **מספר הטלפון** — אותו מספר ממלא את כל השדות הבאים:
> - `phone` — טלפון ליצירת קשר (מופיע בדף צרי קשר)
> - `whatsapp` — WhatsApp לקביעת תורים (הכפתור הגדול בדף הבית)
> - `ownerWhatsapp` — WhatsApp האישי בכרטיס "קצת עליי"
> - `bitAccount` — מספר הטלפון הרשום בביט (לתשלומים) — או קישור Bit אישי (https://...)
>
> פורמט: מספר ישראלי ללא קידומת (לדוגמה: `0501234567`) — **חוץ מ-OWNER_PHONE ב-.env שם קידומת +972 חובה**.

```sql
INSERT INTO settings (key, value) VALUES
('clinicInfo', '{"name":"[שם קליניקה]","ownerName":"[שם פרטי]","ownerFullName":"[שם משפחה]","phone":"[טלפון]","whatsapp":"[טלפון]","ownerWhatsapp":"[טלפון]","address":"[כתובת]","instagram":"[אינסטגרם]","bitAccount":"[טלפון או URL]"}')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO settings (key, value) VALUES
('bitAccount', '"[טלפון]"')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO settings (key, value) VALUES
('telegramChatId', '"[telegram_id]"')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO settings (key, value) VALUES
('adminPassword', '"[סיסמה מה-CLAUDE.md]"')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO settings (key, value) VALUES
('terms', '"ברוכות הבאות לקליניקה! בקביעת תור את מאשרת את תנאי הביטול — ביטול פחות מ-24 שעות לפני התור יחויב בדמי ביטול. אי הגעה חוזרת ללא הודעה עלולה לגרום לחסימת זמנית. נשמח לראותך!"')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```
החלף את כל הערכים בסוגריים מרובעים לפי פרטי הלקוחה מה-CLAUDE.md.

> 💡 **תקנון:** הטקסט למעלה הוא ברירת מחדל — ניתן לערוך אותו אחר כך דרך האדמין → טאב "ביטולים".

### שלב 6 — הוספת env vars ל-Vercel
```bash
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_KEY production
vercel env add TWILIO_ACCOUNT_SID production
vercel env add TWILIO_AUTH_TOKEN production
vercel env add TWILIO_PHONE production
vercel env add OWNER_PHONE production
vercel env add RESEND_API_KEY production
vercel env add TELEGRAM_BOT_TOKEN production
vercel env add TELEGRAM_CHAT_ID production
vercel --prod
```

### שלב 7 — אימות
- [ ] האתר נפתח בדפדפן
- [ ] אדמין /manage-x7k2 עובד
- [ ] טאבים תואמים לחבילה
- [ ] צבעים ועיצוב תואמים לבחירה
- [ ] הודעת טלגרם ניסיון נשלחה
- [ ] SMS OTP עובד בהרשמה

אם אחד נכשל — עצור ודווח. אל תמשיך.

---

## מגבלות ידועות
- `smsReminders` — flag קיים, מערכת לא בנויה
- עדכון גלובלי למספר אתרים — לא קיים
- trim SMS ל-70 תווים — משימה פתוחה
