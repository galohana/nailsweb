# Skill: PWA Config

## Plugin

```bash
npm install -D vite-plugin-pwa
```

```js
// vite.config.js
import { VitePWA } from 'vite-plugin-pwa';

export default {
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'גאות - קליניקת גבות',
        short_name: 'גאות',
        description: 'קביעת תורים לקליניקת גבות',
        theme_color: '#C2587A',
        background_color: '#FFF0F3',
        display: 'standalone',
        dir: 'rtl',
        lang: 'he',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
};
```

## Required icon files (place in `/public/`)

| File | Size | Required for |
|---|---|---|
| `pwa-192x192.png` | 192×192 | Android Chrome |
| `pwa-512x512.png` | 512×512 | Android splash + maskable |
| `apple-touch-icon.png` | **180×180** | iOS Safari — mandatory |
| `favicon.ico` | 32×32 | browser tab |

iOS will silently ignore the manifest icon — `apple-touch-icon.png` is the only path.

## Android install prompt

```jsx
// src/components/InstallBanner.jsx
import { useState, useEffect } from 'react';

export default function InstallBanner() {
  const [prompt, setPrompt] = useState(null);

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!prompt) return null;

  return (
    <button
      onClick={() => { prompt.prompt(); setPrompt(null); }}
      style={{ /* bottom banner styles */ }}
    >
      הוסיפי לדף הבית ⬇
    </button>
  );
}
```

## iOS — manual instructions (no beforeinstallprompt)

Detect iOS and show a tooltip:

```jsx
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

if (isIOS && !isStandalone) {
  // show instruction bubble
  return (
    <div style={{ /* speech bubble pointing to share icon */ }}>
      לחצי על <strong>שתף ↑</strong> ואז <strong>"הוסיפי למסך הבית"</strong>
    </div>
  );
}
```

## Service worker caching strategy

For this project (SPA + Supabase API):

```js
VitePWA({
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
        handler: 'NetworkFirst',
        options: { cacheName: 'supabase-cache', expiration: { maxAgeSeconds: 60 } },
      },
    ],
  },
})
```
