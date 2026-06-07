// Web Push — client utility. Chrome (Android + iOS Safari PWA).
// ה-public key בלבד חי ב-client (VITE_VAPID_PUBLIC_KEY) — ה-private רק בשרת.
// keys updated 2026-06-07

import { supabase } from '../lib/supabase';

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function deviceInfo() {
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Android/.test(ua)) return 'Android';
  return 'Desktop';
}

export function isPushSupported() {
  return typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;
}

export function isPushGranted() {
  return isPushSupported() && Notification.permission === 'granted';
}

export async function subscribeToPush(userType, userIdentifier) {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' };
  if (!VAPID_PUBLIC)        return { ok: false, reason: 'no-vapid' };

  let permission = Notification.permission;
  if (permission === 'default') permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'denied' };

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      });
    }
    const subscription = sub.toJSON();
    const endpoint = subscription.endpoint;

    await supabase.from('push_subscriptions').delete().eq('subscription->>endpoint', endpoint);
    const { error } = await supabase.from('push_subscriptions').insert({
      user_type: userType,
      user_identifier: String(userIdentifier || '').trim() || userType,
      subscription,
      device_info: deviceInfo(),
      active: true,
    });
    if (error) return { ok: false, reason: 'db', error: error.message };

    return { ok: true, subscription };
  } catch (err) {
    return { ok: false, reason: 'subscribe-failed', error: err?.message || String(err) };
  }
}

export async function unsubscribeFromPush() {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' };
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.toJSON().endpoint;
      await supabase.from('push_subscriptions').delete().eq('subscription->>endpoint', endpoint);
      await sub.unsubscribe();
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: 'unsubscribe-failed', error: err?.message || String(err) };
  }
}

export async function sendPush({ user_type, user_identifier, title, body, url }) {
  try {
    const res = await fetch('/api/send-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_type, user_identifier, title, body, url }),
    });
    return await res.json().catch(() => ({}));
  } catch {
    return { sent: 0, failed: 0 };
  }
}
