/**
 * How a leftover tag sale reads on screen.
 *
 * Pure functions, no React, because this is the part worth testing. The whole
 * feature rests on one sentence being right -- "Jul 1 at 10:00 AM MDT" -- and
 * being wrong by an hour on a sale that sells out in minutes costs somebody a
 * season. The push notification builds the same sentence in SQL
 * (public.clock_label); these two must agree, and the tests below are what
 * holds them together.
 */

import { daysUntil } from '@/lib/date';

/**
 * Month names rather than toLocaleDateString, matching lib/date.ts. Intl is
 * not something to lean on in Hermes, and a date is not worth a polyfill.
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export type SaleType = 'leftover' | 'otc' | 'reissue';

export type SaleShape = {
  sale_start_date: string;
  sale_start_time: string | null;
  sale_end_date: string | null;
  time_zone: string | null;
  residency: string[] | null;
  sale_type: SaleType;
};

/**
 * The US zones an agency can be in, and what to call their clock.
 *
 * Arizona and Hawaii have no daylight abbreviation because they never move
 * their clocks -- a null here is a fact about the state, not a missing value.
 */
const ZONES: Record<string, { std: string; dst: string | null }> = {
  'America/New_York': { std: 'EST', dst: 'EDT' },
  'America/Detroit': { std: 'EST', dst: 'EDT' },
  'America/Indiana/Indianapolis': { std: 'EST', dst: 'EDT' },
  'America/Chicago': { std: 'CST', dst: 'CDT' },
  'America/Denver': { std: 'MST', dst: 'MDT' },
  'America/Boise': { std: 'MST', dst: 'MDT' },
  'America/Phoenix': { std: 'MST', dst: null },
  'America/Los_Angeles': { std: 'PST', dst: 'PDT' },
  'America/Anchorage': { std: 'AKST', dst: 'AKDT' },
  'Pacific/Honolulu': { std: 'HST', dst: null },
};

/** The day-of-month of the nth given weekday in a month. Sunday = 0. */
function nthWeekday(year: number, month: number, weekday: number, n: number): number {
  const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const first = 1 + ((weekday - firstDow + 7) % 7);
  return first + (n - 1) * 7;
}

/**
 * Is US daylight time in effect on this date?
 *
 * Second Sunday in March through the first Sunday in November, the rule since
 * 2007. The changeover happens at 2 a.m. local and this works in whole days,
 * so a sale opening between midnight and 2 a.m. on one of those two Sundays
 * would be labelled an hour wrong. No agency in the registry opens a sale in
 * the middle of the night, and buying a wrong answer on the other 363 days to
 * fix that one is a bad trade -- but it is a simplification, not an oversight.
 */
export function isUsDst(dateISO: string): boolean {
  const [y, m, d] = dateISO.split('-').map(Number);
  if (!y || !m || !d) return false;
  const month = m - 1;
  if (month < 2 || month > 10) return false; // Dec, Jan, Feb -- standard
  if (month > 2 && month < 10) return true; // Apr through Oct -- daylight
  if (month === 2) return d >= nthWeekday(y, 2, 0, 2); // March
  return d < nthWeekday(y, 10, 0, 1); // November
}

/**
 * The clock label for a sale: 'MDT', 'EST', ''.
 *
 * Empty for a zone we do not know, and the callers drop it rather than print
 * a raw IANA name at a hunter.
 */
export function clockLabel(dateISO: string, zone: string | null | undefined): string {
  if (!zone) return '';
  const z = ZONES[zone];
  if (!z) return '';
  if (!z.dst) return z.std;
  return isUsDst(dateISO) ? z.dst : z.std;
}

/** '10:00:00' -> '10:00 AM'. Returns '' for anything unparseable. */
export function clock12(time: string | null | undefined): string {
  if (!time) return '';
  const m = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!m) return '';
  const h = Number(m[1]);
  const mi = m[2];
  if (h > 23 || Number(mi) > 59) return '';
  const suffix = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mi} ${suffix}`;
}

/**
 * When the sale opens, as one line: 'Jul 1 at 10:00 AM MDT', or 'Jul 1' when
 * the agency published no hour.
 *
 * A sale with no hour says the day and stops. The temptation is to fill in
 * midnight so every row looks the same; that would turn "we do not know" into
 * a specific wrong answer, which is the one failure this feature cannot
 * afford.
 */
export function saleClock(sale: SaleShape): string {
  const [, m, d] = sale.sale_start_date.split('-').map(Number);
  const day = m >= 1 && m <= 12 ? `${MONTHS[m - 1]} ${d}` : sale.sale_start_date;
  const time = clock12(sale.sale_start_time);
  if (!time) return day;
  const label = clockLabel(sale.sale_start_date, sale.time_zone);
  return label ? `${day} at ${time} ${label}` : `${day} at ${time}`;
}

/** 'Residents only' / 'Nonresidents only' / null when it is open to both. */
export function residencyNote(residency: string[] | null | undefined): string | null {
  if (!residency || residency.length === 0 || residency.length > 1) return null;
  if (residency[0] === 'resident') return 'Residents only';
  if (residency[0] === 'nonresident') return 'Nonresidents only';
  return null;
}

export function saleTypeLabel(t: SaleType): string {
  if (t === 'otc') return 'Over the counter';
  if (t === 'reissue') return 'Reissued';
  return 'Leftover';
}

export type SaleStatus = { label: string; urgent: boolean; past: boolean };

/**
 * The short status a row wears: 'Opens today', 'In 3 days', 'On sale now',
 * 'Closed'.
 *
 * Copper (urgent) is earned only inside the last three days, and by a sale
 * that is live. The design language keeps copper scarce; a sale three weeks
 * out is information, not a warning.
 */
export function saleStatus(sale: SaleShape): SaleStatus {
  const d = daysUntil(sale.sale_start_date);
  const end = sale.sale_end_date ? daysUntil(sale.sale_end_date) : null;

  if (d === null) return { label: '', urgent: false, past: false };

  if (d > 0) {
    if (d === 1) return { label: 'Opens tomorrow', urgent: true, past: false };
    return { label: `In ${d} days`, urgent: d <= 3, past: false };
  }

  // Open today or already started.
  const stillOpen = end === null ? d === 0 : end >= 0;
  if (stillOpen) {
    return { label: d === 0 ? 'On sale today' : 'On sale now', urgent: true, past: false };
  }
  return { label: 'Closed', urgent: false, past: true };
}

/**
 * The sales worth showing, soonest first: anything not finished.
 *
 * A sale with no end date counts as finished the day after it opens, because
 * a first-come sale with no stated close is over when the tags are gone, and
 * that is the same day in Colorado and Utah.
 */
export function upcomingSales<T extends SaleShape>(sales: T[]): T[] {
  return sales
    .filter((s) => !saleStatus(s).past)
    .sort((a, b) => a.sale_start_date.localeCompare(b.sale_start_date));
}
