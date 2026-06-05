import { db } from './db';

// מתריע לכל לקוחות רשימת ההמתנה של תאריך מסוים שהתפנה/נפתח מקום.
// כל לקוחה: push אם יש subscription, אחרת SMS — דרך /api/notify (type=waitlist_available).
// נקרא כש: (א) משתנות שעות העבודה לתאריך, (ב) תור באותו תאריך מתבטל.
export async function notifyWaitlistForDate(date) {
  if (!date) return;
  try {
    const waiters = await db.waitlist.byDate(date);
    if (!waiters || !waiters.length) return;
    await Promise.all(waiters.map(w =>
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'waitlist_available', clientPhone: w.phone, date }),
      }).catch(() => {})
    ));
  } catch (e) {
    console.warn('[waitlist] notify failed:', e.message);
  }
}
