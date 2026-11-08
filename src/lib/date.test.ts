import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  countdownLabel,
  dayAndDate,
  daysUntil,
  formatDate,
  formatDateRange,
  isOpenNow,
  parseDateOnly,
  verifiedAgo,
} from './date';

afterEach(() => vi.useRealTimers());

/** Freeze the clock at a local wall time in the pinned zone (America/New_York). */
function at(local: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(local));
}

describe('parseDateOnly', () => {
  it('reads a stored DATE as local midnight, never UTC', () => {
    // The whole reason the app passes 'YYYY-MM-DD' strings around: new
    // Date('2026-09-13') is UTC midnight, which is Sept 12 in Eastern.
    const d = parseDateOnly('2026-09-13');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(13);
    expect(d.getHours()).toBe(0);
  });
});

describe('daysUntil', () => {
  it('counts whole days ahead and behind', () => {
    at('2026-09-13T09:30:00');
    expect(daysUntil('2026-09-13')).toBe(0);
    expect(daysUntil('2026-09-14')).toBe(1);
    expect(daysUntil('2026-09-20')).toBe(7);
    expect(daysUntil('2026-09-12')).toBe(-1);
  });

  it('is not thrown off by the time of day', () => {
    at('2026-09-13T23:59:00');
    expect(daysUntil('2026-09-14')).toBe(1);
    at('2026-09-13T00:01:00');
    expect(daysUntil('2026-09-14')).toBe(1);
  });

  it('counts a day across the autumn DST change, where the day is 25 hours', () => {
    // US DST ends Sun 1 Nov 2026. A naive ms/86400000 would read 1.04 days
    // and a floor would read 0 — either way the opener would be off by one.
    at('2026-10-31T12:00:00');
    expect(daysUntil('2026-11-01')).toBe(1);
    expect(daysUntil('2026-11-02')).toBe(2);
  });

  it('counts a day across the spring DST change, where the day is 23 hours', () => {
    at('2027-03-13T12:00:00'); // DST begins Sun 14 Mar 2027
    expect(daysUntil('2027-03-14')).toBe(1);
    expect(daysUntil('2027-03-15')).toBe(2);
  });

  it('returns null rather than guessing when there is no date', () => {
    expect(daysUntil(null)).toBeNull();
  });
});

describe('isOpenNow', () => {
  it('is inclusive of both ends', () => {
    at('2026-10-17T06:00:00');
    expect(isOpenNow('2026-10-17', '2027-01-10')).toBe(true);
    at('2027-01-10T23:00:00');
    expect(isOpenNow('2026-10-17', '2027-01-10')).toBe(true);
  });

  it('is false outside the window', () => {
    at('2026-10-16T23:59:00');
    expect(isOpenNow('2026-10-17', '2027-01-10')).toBe(false);
    at('2027-01-11T00:01:00');
    expect(isOpenNow('2026-10-17', '2027-01-10')).toBe(false);
  });

  it('never says open on a half-known window', () => {
    // Saying a season is open when it is shut is the worst error this app can
    // make, so a missing close date is never treated as "still open".
    at('2026-11-01T12:00:00');
    expect(isOpenNow('2026-10-17', null)).toBe(false);
    expect(isOpenNow(null, '2027-01-10')).toBe(false);
    expect(isOpenNow(null, null)).toBe(false);
  });
});

describe('formatDate / dayAndDate', () => {
  it('writes the date the way the app says it', () => {
    expect(formatDate('2026-09-13')).toBe('Sep 13, 2026');
    expect(formatDate(null)).toBe('TBD');
  });

  it('leads with the weekday, which decides whether you can hunt it', () => {
    expect(dayAndDate('2026-11-14')).toBe('Sat 14 Nov');
    expect(dayAndDate(null)).toBe('date TBD');
  });
});

describe('formatDateRange', () => {
  it('collapses a repeated year', () => {
    expect(formatDateRange('2026-09-13', '2026-10-15')).toBe('Sep 13 – Oct 15, 2026');
  });

  it('keeps both years when a season crosses the new year', () => {
    expect(formatDateRange('2026-10-17', '2027-01-10')).toBe('Oct 17, 2026 – Jan 10, 2027');
  });

  it('says which end it knows when it only knows one', () => {
    expect(formatDateRange('2026-10-17', null)).toBe('From Oct 17, 2026');
    expect(formatDateRange(null, '2027-01-10')).toBe('Through Jan 10, 2027');
    expect(formatDateRange(null, null)).toBe('Dates TBD');
  });
});

describe('countdownLabel', () => {
  it('names today and tomorrow rather than counting them', () => {
    expect(countdownLabel(0)).toBe('Today');
    expect(countdownLabel(1)).toBe('Tomorrow');
    expect(countdownLabel(12)).toBe('in 12 days');
    expect(countdownLabel(-1)).toBe('Passed');
    expect(countdownLabel(null)).toBe('Date TBD');
  });
});

describe('verifiedAgo', () => {
  it('reads freshness in the words a reader would use', () => {
    at('2026-11-08T12:00:00');
    expect(verifiedAgo('2026-11-08T08:00:00Z')).toBe('Verified today');
    expect(verifiedAgo('2026-11-07T08:00:00Z')).toBe('Verified yesterday');
    expect(verifiedAgo('2026-11-01T12:00:00Z')).toBe('Verified 7 days ago');
    expect(verifiedAgo('2026-09-08T12:00:00Z')).toBe('Verified 2 months ago');
  });

  it('says so plainly when nothing has been verified', () => {
    expect(verifiedAgo(null)).toBe('Not yet verified');
  });
});
