/**
 * The party screen's pure formatting.
 *
 * Split out of the components so it can be tested: the test runner lives in a
 * separate package that imports nothing from React Native, so anything a test
 * needs to reach has to sit in a file that does not import it either.
 */

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Dates between two ISO days, inclusive.
 *
 * Noon, not midnight: a `new Date('2026-11-14')` is parsed as UTC midnight,
 * which in Eastern is the 13th at seven in the evening, and the row would be
 * labelled the day before the one it means. Noon is far enough from either
 * edge that no US offset can push it across a date line.
 *
 * Capped, because a season can run ninety days and nobody plans ninety days.
 */
export function daysBetween(openISO: string | null, closeISO: string | null, cap = 14): string[] {
  if (!openISO) return [];
  const start = new Date(`${openISO}T12:00:00`);
  const end = closeISO ? new Date(`${closeISO}T12:00:00`) : start;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];
  const out: string[] = [];
  const d = new Date(start);
  while (d <= end && out.length < cap) {
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    );
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** "Sat Nov 14". Same noon trick, same reason. */
export function dayLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${WEEKDAY[d.getDay()]} ${MONTH[d.getMonth()]} ${d.getDate()}`;
}

/** A message's time of day, in the reader's own zone. */
export function clock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
}

/**
 * Who is coming, as a sentence rather than a list of every first name.
 *
 * "Everyone" is worth saying outright; past four names the row stops being
 * readable, so the rest become a count.
 */
export function comingSentence(names: string[], partySize: number): string {
  if (names.length === 0) return 'Nobody yet.';
  if (partySize > 1 && names.length === partySize) return 'Everyone.';
  const firsts = names.map((n) => (n ?? '').trim().split(/\s+/)[0]).filter(Boolean);
  if (firsts.length === 0) return 'Nobody yet.';
  if (firsts.length <= 4) return firsts.join(', ');
  return `${firsts.slice(0, 4).join(', ')} +${firsts.length - 4}`;
}
