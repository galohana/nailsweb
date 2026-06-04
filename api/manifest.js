// Vercel Edge Function — manifest דינמי לאתר הראשי (לקוחות).
// שולף clinicInfo + pwaAppName מ-Supabase ומחזיר manifest מלא עם שם העסק האמיתי
// (לא "RISE"). iOS קורא URL אמיתי זה בעת "הוסף למסך הבית" → מציג את שם העסק.

export const config = { runtime: 'edge' };

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || 'https://expypgqdrjbthgxfddog.supabase.co';
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4cHlwZ3FkcmpidGhneGZkZG9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MzE3OTIsImV4cCI6MjA5NDQwNzc5Mn0.2hrcszcSFM3kT1VDAY7LGAF3vZEUm0moZYCCQgzGfiI';

/* שולף מספר מפתחות מטבלת settings בבת אחת */
async function fetchSettings(keys) {
  const url =
    `${SUPABASE_URL}/rest/v1/settings?select=key,value&key=in.(${keys.join(',')})`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) return {};
  const rows = await res.json();
  const map = {};
  for (const r of rows || []) map[r.key] = r.value;
  return map;
}

/* סוג תמונה לפי סיומת ה-URL */
function iconType(u) {
  if (/\.svg(\?|$)/i.test(u)) return 'image/svg+xml';
  if (/\.(jpe?g)(\?|$)/i.test(u)) return 'image/jpeg';
  if (/\.webp(\?|$)/i.test(u)) return 'image/webp';
  return 'image/png';
}

function iconsFrom(logo) {
  if (logo && /^https?:\/\//.test(logo)) {
    const t = iconType(logo);
    return [
      { src: logo, sizes: '192x192', type: t, purpose: 'any' },
      { src: logo, sizes: '512x512', type: t, purpose: 'any' },
      { src: logo, sizes: '512x512', type: t, purpose: 'maskable' },
    ];
  }
  // אין לוגו → אייקוני ברירת מחדל סטטיים
  return [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ];
}

export default async function handler() {
  let name = 'הסטודיו';
  let pwaLogo = '';
  try {
    const s = await fetchSettings(['clinicInfo', 'pwaAppName']);
    const ci = s.clinicInfo || {};
    const appName = (s.pwaAppName || '').toString().trim();
    name = appName || (ci.name || '').toString().trim() || 'הסטודיו';
    pwaLogo = (ci.pwaLogo || '').toString().trim();
  } catch {}

  const manifest = {
    id: '/',
    lang: 'he',
    dir: 'rtl',
    name,
    short_name: name,
    description: `קביעת תורים — ${name}`,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    theme_color: '#5C3D2E',
    background_color: '#F2E8DC',
    icons: iconsFrom(pwaLogo),
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}
