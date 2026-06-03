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

let _iconCache = null;   // { icon192, icon512, primary, bg } — נבנה פעם אחת
let _lastKey   = '';     // הזהות האחרונה שהוחלה (תלוית-דף)

/* iOS (אייפון/אייפד) — Safari לא תומך ב-manifest מסוג data: URL, ולכן נופל
   ל-/manifest.json הסטטי (start_url '/') → גם האדמין נפתח לראשי. לכן ב-iOS
   מצביעים ל-קובץ manifest אמיתי נפרד (start_url נכון). */
function isIOS() {
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/* ── הפונקציה הראשית ── */
export async function applyDynamicPWA({ clinicName, isAdmin = false, colors = {}, headingFont, pwaLogo } = {}) {
  if (typeof document === 'undefined') return;
  const name = (clinicName || '').trim() || 'הסטודיו';
  // שם התצוגה תלוי-דף: באדמין → "שם הקליניקה admin"
  const displayName = isAdmin ? `${name} admin` : name;
  const ios = isIOS();

  // ── כותרת + manifest מוגדרים מיד (סינכרוני) — לפני כל await ──
  // iOS קורא את apple-mobile-web-app-title וה-manifest כשהמשתמש לוחץ "הוסף למסך הבית".
  if (displayName !== _lastKey) {
    _lastKey = displayName;
    document.title = displayName;
    upsertMeta('apple-mobile-web-app-title', displayName);
    if (ios) {
      // קובץ manifest אמיתי לפי הדף — iOS מכבד את ה-start_url שלו.
      // השם/אייקון ב-iOS ממילא מגיעים מ-apple-mobile-web-app-title + apple-touch-icon.
      upsertLink('manifest', isAdmin ? '/manifest-admin.json' : '/manifest.json');
    } else {
      // אנדרואיד/דסקטופ — data URL דינמי מלא (שם + אייקון + start_url פר-לקוחה)
      upsertLink('manifest', 'data:application/manifest+json,' + encodeURIComponent(JSON.stringify({
        id: isAdmin ? '/manage-x7k2' : '/',
        lang: 'he', dir: 'rtl',
        name: displayName,
        short_name: displayName.length <= 12 ? displayName : initials(displayName).toUpperCase(),
        description: `קביעת תורים — ${name}`,
        start_url: isAdmin ? '/manage-x7k2' : '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
      })));
    }
  }

  // ── האייקון + theme-color נבנים פעם אחת (לא תלויים בדף) ──
  if (!_iconCache) {
    const primary  = colors.primary || '#5C3D2E';
    const bg       = colors.bg || '#F2E8DC';
    const primary2 = lighten(primary, 0.14);
    const fg       = readableOn(primary);
    const mono     = initials(name).toUpperCase();

    // לוגו PWA שהועלה (URL) → משתמשים בו; אחרת מונוגרמה אוטומטית מצבעי העיצוב
    let icon192, icon512;
    if (pwaLogo && /^https?:\/\//.test(pwaLogo)) {
      icon192 = icon512 = pwaLogo;
    } else {
      [icon512, icon192] = await Promise.all([
        makeIconDataURL(512, { primary, primary2, fg, mono, headingFont }),
        makeIconDataURL(192, { primary, primary2, fg, mono, headingFont }),
      ]);
    }
    _iconCache = { icon192, icon512, primary, bg };
    try { window.__risePwaIcon = icon192; } catch {}
    upsertLink('apple-touch-icon', icon192);
    upsertMeta('theme-color', primary);
  }

  // ── manifest מתעדכן עכשיו עם אייקונים מלאים (אנדרואיד/דסקטופ בלבד) ──
  // ב-iOS משאירים את קובץ ה-manifest האמיתי (אחרת data URL ישבור את start_url).
  if (ios) return;
  if (!_iconCache) return;
  const { icon192, icon512, primary, bg } = _iconCache;
  const manifest = {
    // id ייחודי לכל מצב → iOS/Android רואים את האדמין ואת הראשי כשתי אפליקציות נפרדות,
    // אחרת הן ממוזגות ל-start_url אחד (שתיהן נפתחו לראשי).
    id: isAdmin ? '/manage-x7k2' : '/',
    lang: 'he',
    dir: 'rtl',
    name: displayName,
    short_name: displayName.length <= 12 ? displayName : initials(displayName).toUpperCase(),
    description: `קביעת תורים — ${name}`,
    start_url: isAdmin ? '/manage-x7k2' : '/',   // התקנה מהאדמין → נפתח לאדמין
    scope: '/',   // scope משותף — מאפשר ניווט פנימי באפליקציה (כולל יציאה לדף הבית)
    display: 'standalone',
    orientation: 'portrait',
    theme_color: primary,
    background_color: bg,
    icons: [
      { src: icon192, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  upsertLink('manifest', 'data:application/manifest+json,' + encodeURIComponent(JSON.stringify(manifest)));
}
