# AGENTS.md — הוראות עבודה לכל AI
## (GPT-4o / Gemini / Claude Code)

---

## סדר קריאה חובה

1. **PROJECT_CONTEXT.md** — הבן את המוצר והארכיטקטורה
2. **CURRENT_STATE.md** — הבן מה עובד ומה שבור
3. **TASKS.md** — בחר משימה ספציפית
4. **AGENTS.md** — קרא הוראות עבודה (קובץ זה)

---

## הרצה מקומית

```bash
# Clone & install
git clone https://github.com/galohana/nailsweb
cd nailsweb
npm install

# פיתוח מקומי
npm run dev

# .env — העתק והגדר ערכים
cp .env.example .env.local
# פנה לגל לקבלת כל הערכים האמיתיים
```

---

## Deploy

```bash
# Build בדיקה לפני deploy
npm run build

# Deploy לproduction — רק אחרי אישור גל
vercel --prod

# חובה אחרי כל deploy
vercel alias set <deployment-url> nailsweb.vercel.app
```

**אזהרה קריטית:** לפני deploy ראשון של כל clone — שנה את `vercel.json` alias לדומיין של ה-clone.
אחרת זה יחטוף את nailsweb.vercel.app.

---

## מה אסור בלי אישור גל

- DB schema / Supabase / RLS / Auth
- ENV variables (שמות או ערכים)
- החלפת ספרייה ראשית (React, Vite, Supabase וכד')
- שינוי ארכיטקטורה בסיסית (routing, auth flow, cron jobs)
- Push ישיר ל-main/master ללא build נקי
- vercel --prod לפני אישור גל
- גישה ל-cron-reminders.js (קריאה בסדר, שינוי אסור)

---

## כללי עבודה

- **RTL תמיד** — logical CSS properties בלבד: `ms/me/ps/pe`, לא `left/right`
- **Mobile-first** — אין עיצוב desktop נפרד
- **לשון נקבה** בכל הטקסטים בממשק
- **design.js בלבד** לשינוי צבעים/עיצוב — לא להardcode צבעים בקומפוננטות
- **npm run build חייב לעבור** אחרי כל שינוי
- **Double verification:** אחרי DELETE — SELECT, אחרי UPDATE — SELECT

---

## Feature Flags

ב-`src/config/features.js`:

```js
{
  staff: true/false,       // ניהול צוות
  reports: true/false,     // דוחות
  receipts: true/false,    // קבלות email
  smsReminders: false      // תמיד false — לא בנוי עדיין
}
```

---

## חוק סיכום חובה — בסוף כל session

לפני סגירה, עדכן:
1. `CURRENT_STATE.md` — מה השתנה (הוסף ל"מה עובד", הסר מ"חסר" אם הושלם)
2. `TASKS.md` — סמן משימות שהושלמו, הוסף חדשות שהתגלו

דווח:
1. אילו קבצים שונו
2. מה בוצע
3. מה לבדוק (עמודים, flows)
4. סיכונים / דברים פתוחים
5. האם ה-build עבר?
