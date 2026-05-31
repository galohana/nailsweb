// Client-side notification helper — calls Vercel serverless functions.
// Twilio/Telegram credentials are NEVER here (server-side only).
//
// Owner notifications   → /api/notify → Telegram
// Client welcome SMS    → /api/notify → Twilio
// OTP                   → /api/send-otp / /api/verify-otp

async function post(payload) {
  try {
    await fetch('/api/notify', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
  } catch (e) {
    console.warn('[notify] request failed (non-fatal):', e.message);
  }
}

// ── Owner notifications (→ Telegram) ─────────────────────────────────────────
// aptId is included so the owner can cancel the appointment directly from Telegram.
export async function notifyOwnerNewAppointment({ clientName, clientPhone, service, date, time, aptId }) {
  await post({ type: 'new_appointment', clientName, clientPhone, service, date, time, aptId });
}

export async function notifyOwnerCancellation({ clientName, clientPhone, service, date, time }) {
  await post({ type: 'cancellation', clientName, clientPhone, service, date, time });
}

export async function notifyOwnerNewClient({ clientName, clientPhone }) {
  await post({ type: 'new_client', clientName, clientPhone });
}

export async function notifyOwnerWaitlistJoin({ clientName, clientPhone, date }) {
  await post({ type: 'waitlist_join', clientName, clientPhone, date });
}

export async function notifyOwnerWaitlistFilled({ clientName, clientPhone, date, time }) {
  await post({ type: 'waitlist_filled', clientName, clientPhone, date, time });
}

// paymentId = key in pendingPayments (bit flow — approve/reject)
// orderId   = ID of orders row (cash/pickup flow — "אשר הזמנה")
export async function notifyOwnerNewOrder({ clientName, clientPhone, items, total, paymentId, orderId }) {
  await post({ type: 'order_new', clientName, clientPhone, items, total, paymentId, orderId });
}

// orderId = ID of the order row in the orders table.
export async function notifyOwnerOrderPurchase({ clientName, clientPhone, items, total, orderId }) {
  await post({ type: 'order_purchase', clientName, clientPhone, items, total, orderId });
}

// Appointment paid online (bit) → owner gets "אישרתי קבלת תשלום" button
export async function notifyOwnerAppointmentPaid({ clientName, clientPhone, serviceName, amount, method, paymentId }) {
  await post({ type: 'appointment_paid', clientName, clientPhone, serviceName, amount, method, paymentId });
}

// ── Client notifications ──────────────────────────────────────────────────────
// Only welcome SMS remains. All other client notifications removed (website only).
export async function notifyClientWelcome({ clientPhone, clientName }) {
  await post({ type: 'welcome', clientPhone, clientName });
}

// ── OTP (separate endpoints) ──────────────────────────────────────────────────
export async function sendOtp(phone) {
  try {
    const res = await fetch('/api/send-otp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    return await res.json();
  } catch (e) {
    return { ok: false, error: 'network_error', detail: e.message };
  }
}

export async function verifyOtp(phone, code) {
  try {
    const res = await fetch('/api/verify-otp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code }),
    });
    return await res.json();
  } catch (e) {
    return { ok: false, error: 'network_error', detail: e.message };
  }
}
