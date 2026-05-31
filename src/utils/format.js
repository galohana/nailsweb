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
