# CURRENT_STATE — nailsweb
> עדכון אחרון: יוני 2026

## מה עובד

- [x] הזמנת תורים עם זיהוי חפיפות וקונפליקטים
- [x] פאנל אדמין מלא עם 12 טאבים (שירותים, שעות, הפסקות, ביטולים, תזכורות, חנות, צוות, גלריה, יצירת קשר, לקוחות+ביקורות, דוחות, קבלות)
- [x] אימות OTP דרך Twilio SMS
- [x] התראות Telegram לבעלים (הזמנה חדשה, ביטול, המתנה, הזמנות) עם כפתורי approve/reject
- [x] Web Push notifications (VAPID) לבעלים ולקוחות
- [x] SMS fallback דרך Twilio כשאין push subscription
- [x] Cron תזכורות כל 15 דקות (דרך cron-job.org)
- [x] מערכת רשימת המתנה לפי תאריך
- [x] חנות עם הזמנות מוצרים וזרימת אישור תשלום
- [x] קבלות email דרך Resend
- [x] Dynamic PWA (manifest, שם, לוגו, splash מהגדרות אדמין)
- [x] menuColorExtend — card-tint feature עם material overlays
- [x] מערכת אזהרת no-show וחסימת משתמשים
- [x] כפתור "הוסף ל-Google Calendar" לכל תור (לקוחה + אדמין)
- [x] גלריה, ביקורות, עמוד יצירת קשר עם מפת Waze
- [x] ממשק עברית RTL מלא
- [x] מערכת feature flags (staff, reports, receipts, smsReminders)

---

## שבור / חצי גמור

- [ ] **PayPlus / תשלומים אונליין מלאים** — VITE_FEATURE_PAYMENTS=false, לא ממומש
- [ ] **Bit payment deep-link** — עשוי לדרוש הגדרה per-client
- [ ] **Test suite** — אין בדיקות אוטומטיות

---

## חסר

- [ ] **PayPlus / תשלומים אונליין מלאים** — VITE_FEATURE_PAYMENTS=false, לא ממומש
- [ ] **Test suite** — אין בדיקות אוטומטיות

---

## Priority קרוב

אינטגרציית תשלומים אונליין מלאה.

---
> עדכון יוני 2026: `smsReminders` הופעל (true) — Twilio מוגדר ופעיל. cron-reminders.js שולח SMS ללקוחות ש-push subscription שלהן לא פעיל (SMS fallback).
> session 2026-06-09: קבצי handoff (AGENTS/PROJECT_CONTEXT/TASKS) קובעו ל-git (commit 6727da4). הותקן plugin `lovable-claude-code` v1.7.0 — גלובלי ב-`~/.claude/`, לא משפיע על repo זה.
