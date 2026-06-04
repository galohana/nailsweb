/* ═══════════════════════════════════════════════════════════════════
   dynamicPWA — נוסחה קבועה לזהות ה-PWA של כל לקוחה, ב-runtime.

   במקום manifest/אייקון סטטיים עם "RISE", הכל נגזר אוטומטית:
   • שם ה-PWA + כותרת הטאב = שם הסטודיו (מ-clinicInfo ב-Supabase).
     בדף האדמין: שם הסטודיו + " admin".
   • האייקון = לוגו-מונוגרמה: ריבוע בצבע ה-primary של הלקוחה +
     ראשי-התיבות של מילות שם הקליניקה בצבע הניגוד (למשל "Adi studio" → "AS").
   • manifest דינמי (data URL) + apple-touch-icon + theme-color מוזרקים ל-<head>.

   אפס עבודה ידנית פר-לקוחה — מתאים את עצמו לצבעים ולשם של כל אתר.
   ═══════════════════════════════════════════════════════════════════ */

function hexToRgb(hex) {
  const h = String(hex || '#5C3D2E').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/* צבע טקסט קריא מעל רקע נתון — קרם על כהה, כמעט-שחור על בהיר */
function readableOn(hex) {
  return luminance(hex) > 0.6 ? '#2C1810' : '#FDFAF7';
}

/* הבהרה עדינה של צבע (לגרדיאנט הרקע) */
function lighten(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  const m = (v) => Math.round(v + (255 - v) * amt);
  return `rgb(${m(r)}, ${m(g)}, ${m(b)})`;
}

/* ראשי-תיבות ממילות שם הקליניקה. שתי מילים → אות מכל אחת; מילה אחת → 2 אותיות. */
export function initials(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '★';
  if (words.length === 1) return words[0].slice(0, 2);
  return (words[0][0] || '') + (words[1][0] || '');
}

/* מייצר אייקון PNG (data URL) — ריבוע מלא בצבע primary + מונוגרמה במרכז.
   ריבוע מלא (ללא שקיפות) → תואם גם ל-iOS (ממסך פינות בעצמו) וגם ל-maskable של Android. */
async function makeIconDataURL(size, { primary, primary2, fg, mono, headingFont }) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');

  // רקע — גרדיאנט אנכי עדין מ-primary לגוון בהיר ממנו
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, primary);
  grad.addColorStop(1, primary2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // ודא שגופן הכותרות נטען לפני הציור (אחרת fallback ל-serif)
  const fontFamily = `"${headingFont || 'Cormorant Garamond'}", Georgia, 'Times New Roman', serif`;
  try { await document.fonts.load(`700 ${Math.round(size * 0.42)}px ${fontFamily}`); } catch {}

  // מונוגרמה ממורכזת
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(size * 0.42)}px ${fontFamily}`;
  ctx.fillText(mono, size / 2, size * 0.545);

  return c.toDataURL('image/png');
}

/* יוצר/מעדכן <link> או <meta> ב-<head> לפי rel/name */
function upsertLink(rel, href, extra = {}) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) { el = document.createElement('link'); el.rel = rel; document.head.appendChild(el); }
  el.href = href;
  Object.entries(extra).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}
function upsertMeta(name, content) {
  let el = document.head.querySelector(`meta[name="${name}"]`);
  if (!el) { el = document.createElement('meta'); el.name = name; document.head.appendChild(el); }
  el.content = content;
  return el;
}

// cache נפרד לכל מצב: ראשי (pwaLogo) ואדמין (adminLogo) — אחרת שניהם חולקים אייקון אחד
let _iconCache = { main: null, admin: null };   // לכל מפתח: { icon192, icon512 }
let _lastKey   = '';     // הזהות האחרונה שהוחלה (תלוית-דף)
let _themeSet  = false;  // theme-color נקבע פעם אחת (לפי primary המשותף)

/* בונה זוג אייקונים (192/512): לוגו שהועלה (URL) אם קיים, אחרת מונוגרמה אוטומטית */
async function buildIconPair({ logo, primary, primary2, fg, mono, headingFont }) {
  if (logo && /^https?:\/\//.test(logo)) return { icon192: logo, icon512: logo };
  const [icon512, icon192] = await Promise.all([
    makeIconDataURL(512, { primary, primary2, fg, mono, headingFont }),
    makeIconDataURL(192, { primary, primary2, fg, mono, headingFont }),
  ]);
  return { icon192, icon512 };
}

/* iOS (אייפון/אייפד) — Safari לא תומך ב-manifest מסוג data: URL, ולכן נופל
   ל-/manifest.json הסטטי (start_url '/') → גם האדמין נפתח לראשי. לכן ב-iOS
   מצביעים ל-קובץ manifest אמיתי נפרד (start_url נכון). */
function isIOS() {
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/* ── הפונקציה הראשית ── */
export async function applyDynamicPWA({ clinicName, isAdmin = false, colors = {}, headingFont, pwaLogo, adminLogo, pwaAppName } = {}) {
  if (typeof document === 'undefined') return;
  const name = (clinicName || '').trim() || 'הסטודיו';          // שם העסק (לתיאור/מונוגרמה)
  // שם האפליקציה ל-PWA — ניתן לעריכה מהאדמין; ריק → שם העסק כברירת מחדל
  const appName = (pwaAppName || '').trim() || name;
  // שם התצוגה תלוי-דף: באדמין → "שם האפליקציה admin"
  const displayName = isAdmin ? `${appName} admin` : appName;
  const ios = isIOS();

  // ── כותרת + מטא של iOS (סינכרוני) ──
  // ה-manifest עצמו מוגש דינמית ע"י Edge Function (/api/manifest, /api/manifest-admin)
  // ומקושר ב-index.html — אין צורך לדרוס אותו כאן. כאן רק title + apple metas.
  if (displayName !== _lastKey) {
    _lastKey = displayName;
    document.title = displayName;
    upsertMeta('apple-mobile-web-app-title', displayName);
  }

  // ── אייקון תלוי-מצב: אדמין ← adminLogo, ראשי ← pwaLogo (כל אחד fallback למונוגרמה) ──
  const primary  = colors.primary || '#5C3D2E';
  const bg       = colors.bg || '#F2E8DC';
  const primary2 = lighten(primary, 0.14);
  const fg       = readableOn(primary);
  const mono     = initials(name).toUpperCase();
  const modeKey  = isAdmin ? 'admin' : 'main';

  if (!_iconCache[modeKey]) {
    const logo = isAdmin ? (adminLogo || '') : (pwaLogo || '');
    _iconCache[modeKey] = await buildIconPair({ logo, primary, primary2, fg, mono, headingFont });
  }
  const { icon192 } = _iconCache[modeKey];
  try { window.__risePwaIcon = icon192; } catch {}
  // apple-touch-icon מתעדכן בכל מעבר דף → iOS לוקח אותו בעת "הוסף למסך הבית"
  // (ה-manifest מגיע מ-Edge Function; כאן רק האייקון הייעודי ל-iOS + theme-color)
  upsertLink('apple-touch-icon', icon192);
  if (!_themeSet) { upsertMeta('theme-color', primary); _themeSet = true; }
}
