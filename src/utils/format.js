// ── Date serialization ───────────────────────────────────────────────
export function toDS(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ── Week navigation helpers ──────────────────────────────────────────
export function getSunday(d) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - x.getDay()); return x;
}
export function addDays(d, n) {
  const x = new Date(d); x.setDate(x.getDate() + n); return x;
}

// ── Phone digits extraction ───────────────────────────────────────────
// Strips all non-digit characters. Accepts any value (null, undefined, number).
export function digitsOnly(str) {
  return String(str || '').replace(/\D/g, '');
}

// ── Duration formatting ────────────────────────────────────────────
// Converts minutes to a friendly Hebrew string.
// Under 60 min  → "45 דק׳"
// Exactly hours → "שעה" / "שעתיים" / "3 שעות"
// Mixed         → "שעה ו-30 דק׳" / "שעתיים ו-15 דק׳"
export function fmtDuration(min) {
  const m = Math.round(Number(min) || 0);
  if (m <= 0) return '0 דק׳';
  if (m <= 60) return `${m} דק׳`;

  const h   = Math.floor(m / 60);
  const rem = m % 60;

  const hPart = h === 1 ? 'שעה'
              : h === 2 ? 'שעתיים'
              : `${h} שעות`;

  return rem === 0 ? hPart : `${hPart} ו-${rem} דק׳`;
}
