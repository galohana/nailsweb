# CLAUDE.md — Nails Project

## זהות הפרויקט
אתר קביעת תורים לסטודיו ציפורניים.
בונה: גל אוחנה | מותג: RISE

## הסטאק
- React + Vite + Tailwind CSS
- Supabase (Frankfurt EU)
- Vercel (hosting)
- Twilio (SMS)
- PWA מוכן
- עברית RTL, פונט Heebo + Cormorant Garamond לכותרות

## כתובות
- אתר: https://nailsweb.vercel.app  ← הכתובת הנכונה והיחידה
- Admin: https://nailsweb.vercel.app/manage-x7k2
- עמוד המותג (RISE) באתר: https://nailsweb.vercel.app/rise
- GitHub: https://github.com/galohana/nailsweb (private)
- Supabase: Rise - nailsweb project (Frankfurt EU)

## ⚠️ DEPLOY — חובה לקרוא
- **כלל ברזל:** לעולם לא `vercel --prod` אחרי `git push` באותו session
- בחר אחד בלבד: `git push` (Vercel עולה אוטומטי) **או** `vercel --prod` (בלי git push לפני) — לא שניהם
- תמיד לאחר `vercel --prod`: להריץ `vercel alias set <deployment-url> nailsweb.vercel.app`

## עיצוב — עקרונות קבועים
- תחושה: יוקרה, בגרות, מודרניות, נינוחות, חדשנות
- הצבעים משתנים לפי לקוחה — אל תנעל על צבע ספציפי
- כל הכפתורים: פינות מעוגלות + צל תחתון עדין
- whitespace נדיב בין אלמנטים
- מותאם מובייל בלבד
- לשון נקבה בכל מקום

## CSS Variables — היררכיית צבעים
- `--color-surface` = `#FDFAF7` — inputs, גבולות, אלמנטי ניווט קטנים בלבד
- `--color-menu` = `colors.menu || colors.section` — מאחסן palette שמשתנה בזמן אמת
  - **משפיע על:** stats tags, about card, reviews carousel, success overlays, booking card (S.card), payment/calendar buttons, time-picker bottom sheet, terms section, login button
  - **אל תשנה ל-surface:** כל אלמנט שנגדיר כ"menu" יגיב לשינויי palette אוטומטית
- `--color-menu-rgb` = triple RGB — לשימוש ב-rgba() עם opacity

## menuColorExtend — Card-tint Feature (חשוב!)

### מה זה
טוגל ב-`design.menuColorExtend` (boolean, default=false) שקובע אם קלפים/CTAs/sheets/map יקבלו את צבע + חומר ה-menu או יישארו לבנים.

### CSS Variables (מוזרקים ע"י applyDesign.js)
- `--color-card-tint` = `menu color` (כש-extend=true) או `#FDFAF7` (כש-false)
- `--color-card-tint-rgb` = triple RGB של ה-tint — לשימוש ב-rgba(...,opacity)
- `--color-on-card-tint` = readable text color על ה-tint
- `--color-tint-mat-overlay` = menu material overlay (true) או `none` (false)
- `--color-tint-blend` = `screen` (true, מבהיר על כהה) או `overlay` (false, על לבן)
- `--color-tint-opacity` = `0.55` (true) או `1` (false)

### `.demo-tinted` CSS class (ב-design-tokens.css)
מיישם DUAL-APPROACH לחומר:
1. `background-image + background-blend-mode` על האלמנט — עובד בתוך framer-motion composite layers
2. `::after` עם `mix-blend-mode` — תוספת punch

**שימוש:** הוסף `className="demo-tinted"` ל-wrapper, **מבלי** `backgroundColor` inline.

### Bug ידוע: framer-motion + composite layer
אם ה-element ש-`.demo-tinted` מיושם עליו הוא `motion.div` עם `whileInView + scale` או `transform`, ה-`::after mix-blend-mode` עלול להישבר. הפתרון: לעטוף ב-`<div className="demo-tinted">` חיצוני ולהשאיר את ה-motion.div הפנימי.

### אלמנטים שמשתמשים ב-.demo-tinted
- `pages/HeroNew.jsx` — Stats badges (rgba מ-RGB tuple), CTAs (קביעת תור + הרשמה/כניסה)
- `pages/GalleryAbout.jsx` — Filmstrip wrapper, About flip card outer wrapper, Reviews carousel wrapper
- `pages/Booking.jsx` — payment sheet, post-time-picker sheet, staff picker sheet
- `pages/ContactPage.jsx` — Map card outer wrapper (מסגרת מפת waze)

### Backward Compatibility
`menuColorExtend: false` הוא ברירת המחדל. אתר שמשכפלים יראה זהה לחלוטין למצב הישן עד שמפעילים את הטוגל ב-rise-builder.

## אנימציות — חובה
- whileTap={{ scale: 0.98 }} על כל כפתור
- fade-in + slide-up בגלילה (whileInView, once:true)
- parallax עדין על תמונת רקע ראשית
- AnimatePresence על כל מודל/sheet
- רטט: navigator.vibrate(15) בבחירה, ([30,20,30]) באישור
- אנימציית הצלחה אחרי קביעת תור

## ארכיטקטורת מודולים
כל תוספת נשלטת דרך .env — כיבוי מודול לא שובר שאר הפיצ'רים:
- FEATURE_STORE
- FEATURE_PAYMENTS
- FEATURE_STAFF
- FEATURE_REPORTS
- FEATURE_REVIEWS
- FEATURE_GALLERY
- FEATURE_WAITLIST

## חוקי עבודה
1. אל תמחק קוד קיים בלי לשאול
2. כל שינוי — בדוק שלא שובר מודול אחר
3. אחרי כל בנייה — הרץ vercel --prod מתוך nailsweb
4. אחרי כל deploy — git commit + git push עם תיאור קצר של מה שינית
5. Double verification — אחרי כל פעולה בדוק שבוצעה
6. SMS דרך Twilio בלבד
7. Supabase — Frankfurt EU בלבד
8. הסטאק קבוע — אל תחליף ספרייה בלי אישור
9. RTL תמיד — logical properties בלבד (ms/me/ps/pe)

## GitHub
- Repository: https://github.com/galohana/nailsweb (private)
- Branch: master
- gh CLI path: C:\Program Files\GitHub CLI\gh.exe
- אחרי כל deploy: git add -A && git commit -m "תיאור" && git push

## Twilio
- TWILIO_ACCOUNT_SID=<set in .env>
- TWILIO_PHONE=+19896253806
- OWNER_PHONE=<set in .env>

## מה בנוי ועובד
- קביעת תורים + לוגיקת חפיפות
- Admin מלא
- SMS לבעלת האתר
- Cron Job כל 15 דקות
- הזמנות איסוף + אישור/דחייה
- רשימת המתנה לפי תאריך
- Google Calendar — כפתור "📅 הוסף ליומן" בכל תור (לקוחה + Admin)
  - לקוחה: Booking.jsx Step 4 + MyAppointments.jsx (AptCard)
  - Admin: HoursTab.jsx WeekCalendar — כפתור "📅 יומן" בכל יום פותח modal עם כפתור הוסף לכל תור
  - ⚠️ אין "הוסף הכל בלחיצה אחת" — Google Calendar לא תומך בזה ללא OAuth

## עיקרון העיצוב המרכזי
"פחות זה יותר — כל אלמנט מרוויח מרחב, וכל מרחב מוסיף ערך."

כשבונים כל קומפוננט — שאל את עצמך:
- האם זה חייב להיות כאן?
- האם יש מספיק מרחב סביבו?
- האם הצבע הזה הכרחי?

חוקים:
- whitespace נדיב תמיד — לא ריק, נושם
- צבעים מעטים — חום, בז', לבן בלבד
- טיפוגרפיה עדינה — Cormorant Garamond לכותרות, Heebo לטקסט, משקל דק
- אנימציות איטיות וחלקות — לא קופצות, מחליקות
- כל אלמנט מקבל מרחב — לא צפיפות
- יוקרה שקטה — לא צועקת, נוכחת

## Template
האתר הזה הוא ה-template הרשמי.
לקוחה חדשה = העתק template + שנה credentials + vercel --prod

## Session End Rule
בסוף כל session — חובה לעדכן CURRENT_STATE.md ו-TASKS.md לפני סגירה.
