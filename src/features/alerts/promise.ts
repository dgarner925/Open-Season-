/**
 * What the app promises, and exactly when it keeps it.
 *
 * Reminders go out in one daily pass: pg_cron calls send-alerts at 13:00 UTC
 * (supabase/functions/README.md), which is early morning across the lower 48.
 * A follow's `opener_offsets` say how many days ahead it speaks; this turns
 * those into the dates and clock times a user can read back before the opener
 * arrives.
 *
 * The point of naming them (David, 2026-11-08): telling someone when a season
 * starts is the whole product, so the screen has to show the promise being
 * kept, not just offer a switch. Every time here is derived from the cron the
 * server actually runs and rendered in the device's own timezone — if the hour
 * in the README changes, change SEND_HOUR_UTC with it.
 */

/** The hour pg_cron fires send-alerts. Keep in step with the README. */
export const SEND_HOUR_UTC = 13;

export type Firing = {
  /** The moment the phone buzzes, in real time — render with toLocaleString. */
  at: Date;
  /** Days before the opener, as stored in alert_preferences.opener_offsets. */
  offset: number;
  /** "a week out", "the day before". */
  label: string;
  today: boolean;
};

/**
 * Offsets are constrained to this ladder (1/3/7/14/30/60/90/180/365) by the
 * alert_preferences check constraint; anything else falls back to a count.
 */
const OFFSET_LABEL: Record<number, string> = {
  365: 'a year out',
  180: 'six months out',
  90: 'three months out',
  60: 'two months out',
  30: 'a month out',
  14: 'two weeks out',
  7: 'a week out',
  3: 'three days out',
  1: 'the day before',
};

export function offsetLabel(days: number): string {
  if (OFFSET_LABEL[days]) return OFFSET_LABEL[days];
  return days === 0 ? 'the morning it opens' : `${days} days out`;
}

/** 13:00 UTC on an ISO date — the instant, not a wall clock. */
export function sendTimeFor(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, SEND_HOUR_UTC, 0, 0));
}

function shiftISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * The notices still to come for one opener: one per offset whose send time
 * hasn't passed yet, soonest first. A reminder that already went out this
 * morning is not a promise, so it drops off.
 */
export function firingsFor(openISO: string, offsets: number[], now: Date = new Date()): Firing[] {
  const todayISO = localISO(now);
  return offsets
    .map((offset) => ({ offset, iso: shiftISO(openISO, -offset) }))
    .map((f) => ({ ...f, at: sendTimeFor(f.iso) }))
    .filter((f) => f.at.getTime() > now.getTime())
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map((f) => ({ at: f.at, offset: f.offset, label: offsetLabel(f.offset), today: f.iso === todayISO }));
}

/**
 * The promise, led by when it gets kept: "You'll hear from us Fri 13 Nov,
 * 8:00 AM." A count ("you'll be told twice") was the first draft and it is a
 * weaker thing to say — it tells you how often the app speaks, not when you
 * will know (David, 2026-11-08). Any later reminders are listed beneath this
 * line, so it only ever names the soonest.
 */
export function promiseHead(firings: Firing[]): string {
  if (firings.length === 0) return 'No reminder left before this one.';
  const when = firingWhen(firings[0]);
  return `You'll hear from us ${when.charAt(0).toLowerCase()}${when.slice(1)}.`;
}

/** "Fri 13 Nov, 8:00 AM" — on the device's clock, not the server's. */
export function firingWhen(f: Firing): string {
  const time = f.at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (f.today) return `Later today, ${time}`;
  const day = f.at.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  return `${day}, ${time}`;
}

/** Local calendar date as YYYY-MM-DD (never the UTC one — that slips a day). */
export function localISO(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
