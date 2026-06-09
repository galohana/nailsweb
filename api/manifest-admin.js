// Vercel Edge Function — manifest דינמי לאפליקציית הניהול (אדמין).
// שם = "[שם העסק] admin", start_url/id/scope = /manage-x7k2, אייקונים מ-adminLogo.
// URL אמיתי נפרד → iOS/Android רואים את האדמין כאפליקציה נפרדת מהראשי.

export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

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
  return [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ];
}

export default async function handler() {
  let base = 'הסטודיו';
  let adminLogo = '';
  try {
    const s = await fetchSettings(['clinicInfo', 'pwaAppName']);
    const ci = s.clinicInfo || {};
    const appName = (s.pwaAppName || '').toString().trim();
    base = appName || (ci.name || '').toString().trim() || 'הסטודיו';
    // אייקון אדמין ייעודי; אם אין — נופל ללוגו הראשי, אחרת ברירת מחדל
    adminLogo = (ci.adminLogo || ci.pwaLogo || '').toString().trim();
  } catch {}

  const name = `${base} admin`;

  const manifest = {
    id: '/manage-x7k2',
    lang: 'he',
    dir: 'rtl',
    name,
    short_name: name,
    description: `ניהול — ${base}`,
    start_url: '/manage-x7k2',
    scope: '/manage-x7k2',
    display: 'standalone',
    orientation: 'portrait',
    theme_color: '#5C3D2E',
    background_color: '#F2E8DC',
    icons: iconsFrom(adminLogo),
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}
