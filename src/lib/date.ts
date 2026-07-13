/**
 * Date helpers. Deliberately dependency-free (no dayjs/date-fns) since the app
 * only needs day-granularity countdowns and friendly formatting.
 *
 * All season/window dates are stored as DATE (no time) in Postgres and handled
 * here as 'YYYY-MM-DD' strings to avoid timezone drift — a season that opens
 * Sept 13 must read "Sept 13" for a hunter in every US timezone.
 */

/** Parse a 'YYYY-MM-DD' date string into a local-midnight Date. */
export function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Today at local midnight. */
export function today(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Whole days from today until the given date. Negative if in the past. */
export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const target = parseDateOnly(dateStr);
  const diffMs = target.getTime() - today().getTime();
  return Math.round(diffMs / 86_400_000);
}

/** Is `today` within [open, close] inclusive? Null dates => false. */
export function isOpenNow(openDate: string | null, closeDate: string | null): boolean {
  if (!openDate || !closeDate) return false;
  const t = today().getTime();
  return t >= parseDateOnly(openDate).getTime() && t <= parseDateOnly(closeDate).getTime();
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** 'Sep 13, 2026' — null-safe. */
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'TBD';
  const d = parseDateOnly(dateStr);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** 'Sep 13 – Oct 15, 2026', collapsing repeated year/month. */
export function formatDateRange(openDate: string | null, closeDate: string | null): string {
  if (!openDate && !closeDate) return 'Dates TBD';
  if (!openDate) return `Through ${formatDate(closeDate)}`;
  if (!closeDate) return `From ${formatDate(openDate)}`;
  const o = parseDateOnly(openDate);
  const c = parseDateOnly(closeDate);
  const openPart =
    o.getFullYear() === c.getFullYear()
      ? `${MONTHS[o.getMonth()]} ${o.getDate()}`
      : `${MONTHS[o.getMonth()]} ${o.getDate()}, ${o.getFullYear()}`;
  return `${openPart} – ${MONTHS[c.getMonth()]} ${c.getDate()}, ${c.getFullYear()}`;
}

/** Human countdown label, e.g. 'in 12 days', 'Tomorrow', 'Today', 'Closed'. */
export function countdownLabel(daysUntilValue: number | null): string {
  if (daysUntilValue === null) return 'Date TBD';
  if (daysUntilValue < 0) return 'Passed';
  if (daysUntilValue === 0) return 'Today';
  if (daysUntilValue === 1) return 'Tomorrow';
  return `in ${daysUntilValue} days`;
}

/** Verification freshness, e.g. 'Verified 3 days ago' from a timestamptz. */
export function verifiedAgo(verifiedAtIso: string | null): string {
  if (!verifiedAtIso) return 'Not yet verified';
  const then = new Date(verifiedAtIso).getTime();
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return 'Verified today';
  if (days === 1) return 'Verified yesterday';
  if (days < 30) return `Verified ${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? 'Verified 1 month ago' : `Verified ${months} months ago`;
}
