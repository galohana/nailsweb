# Skill: Vercel Deploy

## Environment variable rules

### Browser-visible (Vite client bundle)
Must have `VITE_` prefix. Accessible via `import.meta.env.VITE_*`.

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
VITE_FEATURE_STORE=true
VITE_FEATURE_REVIEWS=true
```

### Server-only secrets (Vercel serverless functions)
NEVER add `VITE_` prefix — these must not reach the browser.

```env
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...   ← server only
TWILIO_ACCOUNT_SID=ACxxx               ← server only
TWILIO_AUTH_TOKEN=xxxxx                ← server only
TWILIO_FROM=+972XXXXXXXXX             ← server only
```

Accessed in `/api/*.js` via `process.env.*`.

## Deploy flow

```bash
# 1. Verify build passes locally first
npm run build

# 2. Deploy to production
vercel --prod
```

Never deploy without a passing local build — Vercel build errors cost time and quota.

## After any env var change

A redeploy is required for changes to take effect:

```bash
vercel --prod
```

Or push to the connected git branch if CI/CD is configured.

## Serverless function rules (`/api/*.js`)

- Runtime: Node.js (Vercel default)
- Each file exports `default async function handler(req, res)`
- CORS header required if called from the browser:

```js
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
if (req.method === 'OPTIONS') { res.status(200).end(); return; }
```

## Feature flags pattern

```js
// src/utils/features.js
export const FEAT_STORE    = import.meta.env.VITE_FEATURE_STORE    === 'true';
export const FEAT_REVIEWS  = import.meta.env.VITE_FEATURE_REVIEWS  === 'true';
export const FEAT_GALLERY  = import.meta.env.VITE_FEATURE_GALLERY  === 'true';
export const FEAT_WAITLIST = import.meta.env.VITE_FEATURE_WAITLIST === 'true';
export const FEAT_REPORTS  = import.meta.env.VITE_FEATURE_REPORTS  === 'true';
export const FEAT_STAFF    = import.meta.env.VITE_FEATURE_STAFF    === 'true';
export const FEAT_PAYMENTS = import.meta.env.VITE_FEATURE_PAYMENTS === 'true';
```

Disabling a flag (`=false`) must make the feature disappear completely with zero broken imports.

## Current project

- Project: `gavot-app`
- Team: `gal-ohana-s-projects`
- Production alias: `https://gavot-app.vercel.app`
- Serverless functions: `/api/notify.js`, `/api/cron-reminders.js`
