export const DEFAULT_SERVICES = [];

export const DEFAULT_PRODUCTS = [];

export const DEFAULT_PRODUCT_DESCRIPTIONS = {};

export const DEFAULT_PRODUCT_LABELS = {};

export const DEFAULT_WORKING_HOURS = {
  days: {
    0: { active: true,  start: '09:00', end: '18:00' },
    1: { active: true,  start: '09:00', end: '18:00' },
    2: { active: true,  start: '09:00', end: '18:00' },
    3: { active: true,  start: '09:00', end: '18:00' },
    4: { active: true,  start: '09:00', end: '18:00' },
    5: { active: true,  start: '09:00', end: '14:00' },
    6: { active: false, start: '10:00', end: '13:00' },
  },
  slotDuration: 30,
  weeksAhead: 4,
};

export const DEFAULT_ADMIN_SETTINGS = {
  cancellation: { minHours: 24, allowCancel: true },
  noShow: {
    warningCount: 2,
    warningMessage: 'שימי לב — בחנו דפוס של אי-הגעה. בבקשה להודיע מראש אם אינך מגיעה.',
    blockCount: 4,
    autoBlock: false,
    sendSMS: false,
  },
  announcement: { text: '', show: false },
  reminders: {
    send: false,
    hoursBefore: 24,
    message: 'היי! תזכורת לתורך מחר. מחכות לך 💕',
    channel: 'sms',
  },
  payment: {
    requireDeposit: false,
    depositAmount: 50,
    fullOnline: false,
    provider: 'payplus',
  },
};

export const DEFAULT_CLINIC_INFO = {
  name:     '',
  ownerName:    '',
  ownerFullName: '',
  ownerPhone:   '',          // fallback for Bit if specific account not set
  bitAccount:    '',         // Bit deep-link target
  phone:    '',
  address:  '',
  wazeLink: '',
  whatsapp: '',
  ownerWhatsapp: '',
  instagram: '',
};

export const DEFAULT_ABOUT = {
  text:     '',
  imageUrl: '',
};

export const DEFAULT_HERO = {
  imageUrl: '',
  type:     'image',
};

export const DEFAULT_TERMS = 'ברוכות הבאות לקליניקה! בקביעת תור את מאשרת את תנאי הביטול — ביטול פחות מ-24 שעות לפני התור יחויב בדמי ביטול. אי הגעה חוזרת ללא הודעה עלולה לגרום לחסימת זמנית. נשמח לראותך!';

// ── SMS Templates ─────────────────────────────────────────────────────────────
// Hebrew SMS = UCS-2 = 70 chars per segment. All templates must be ≤70 chars.
// Owner notifications are now via Telegram (see DEFAULT_TELEGRAM_TEMPLATES below).
// Only client 'welcome' remains as SMS. reminder/waitlistSlot/orderApproved removed.
// Placeholders: {name} {phone} {service} {date} {time} {total} {items} {business}
export const DEFAULT_SMS_TEMPLATES = {
  client: {
    welcome: { enabled: true,  text: 'היי {name}! ברוכה הבאה ✨ נשמח לראותך 💕' },
    // reminder kept disabled so cron-reminders.js skips it (cannot modify that file)
    reminder: { enabled: false, text: 'תזכורת: {service} | {date} {time}. מחכות!' },
    otp:     { enabled: true,  text: 'קוד האימות שלך: {code} (תקף ל-5 דקות)' },
  },
};

// ── Telegram Templates (owner notifications) ──────────────────────────────────
// No 70-char limit. HTML supported: <b>, <i>, <code>.
// Stored in Supabase under key 'telegramTemplates'.
// Editable in Admin → יצירת קשר → הודעות טלגרם.
export const DEFAULT_TELEGRAM_TEMPLATES = {
  newBooking:     { enabled: true, text: '📅 <b>תור חדש!</b>\n👤 {name} | 📞 {phone}\n💅 {service}\n📆 {date} ⏰ {time}' },
  cancellation:   { enabled: true, text: '❌ <b>ביטול תור</b>\n👤 {name} | 📞 {phone}\n💅 {service}\n📆 {date} ⏰ {time}' },
  newClient:      { enabled: true, text: '🎉 <b>לקוחה חדשה!</b>\n👤 {name}\n📞 {phone}' },
  waitlistJoin:   { enabled: true, text: '⏳ <b>הצטרפות להמתנה</b>\n👤 {name} | 📞 {phone}\n📆 {date}' },
  waitlistFilled: { enabled: true, text: '✨ <b>מהמתנה לתור!</b>\n👤 {name} | 📞 {phone}\n📆 {date} ⏰ {time}' },
  orderPending:   { enabled: true, text: '🛍️ <b>הזמנה חדשה!</b>\n👤 {name} | 📞 {phone}\n{items}\nסה"כ: ₪{total}' },
  orderPurchase:  { enabled: true, text: '💳 <b>קנייה בחנות!</b>\n👤 {name} | 📞 {phone}\n{items}\nסה"כ: ₪{total}' },
};

export const DEFAULT_GALLERY = [];

export const DEFAULT_REVIEWS = [];
