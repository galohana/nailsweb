# Skill: Twilio SMS

## Golden rule: SMS is sent from the SERVER only

Never call Twilio from the browser. No `VITE_TWILIO_*` env vars exist — they must not.

All SMS goes through `/api/notify.js` (Vercel serverless function).

## Phone number format

Israeli numbers must be in E.164 format: `+972XXXXXXXXX`

```js
function toE164(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('972')) return '+' + digits;
  if (digits.startsWith('0'))   return '+972' + digits.slice(1);
  return '+972' + digits;
}
```

Examples:
- `0501234567` → `+972501234567`
- `501234567`  → `+972501234567`
- `972501234567` → `+972501234567`

## `/api/notify.js` structure

```js
import twilio from 'twilio';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { type, phone, ...data } = req.body;

  if (type === 'appointment_confirmed') {
    await sendSMS(phone, `התור שלך ל${data.serviceName} ב-${data.date} בשעה ${data.time} אושר ✓`);
  }

  if (type === 'waitlist_notify') {
    for (const p of data.phones) {
      await sendSMS(p, `פתח מקום ל-${data.serviceName} בתאריך ${data.date}. קביעת תור: ${data.url}`);
    }
  }

  res.status(200).json({ ok: true });
}

async function sendSMS(to, body) {
  await client.messages.create({ from: process.env.TWILIO_FROM, to, body });
  // log to Supabase messages table
}
```

## Log every message

```sql
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_phone text NOT NULL,
  body text NOT NULL,
  type text,
  status text DEFAULT 'sent',
  created_at timestamptz DEFAULT now()
);
```

Insert after each send:
```js
await supabase.from('messages').insert({ to_phone: to, body, type, status: 'sent' });
```

## SMS types in this project

| type | trigger | recipients |
|---|---|---|
| `appointment_confirmed` | booking success | customer |
| `appointment_reminder` | cron 24h before | customer |
| `appointment_cancelled` | cancel action | customer |
| `waitlist_notify` | slot opens (cancellation) | all waitlist for that date |

## Credentials (env only)

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_FROM=+972XXXXXXXXX
```

Never hardcode. Never expose via `VITE_` prefix.
