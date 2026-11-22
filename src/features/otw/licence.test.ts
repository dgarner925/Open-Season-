/**
 * The licence countdown.
 *
 * The rule under test: a licence expires at the END of its day, in the
 * reader's own zone, and we say nothing at all when we do not know.
 *
 * Tests run with TZ=America/New_York (supabase/vitest.config.ts), which is
 * what makes the evening cases meaningful -- a UTC-parsed date is already on
 * the next day by 7pm Eastern, which is exactly when someone checks whether
 * they can fish in the morning.
 */
import { describe, expect, it } from 'vitest';
import {
  daysUntil,
  governingExpiry,
  licenceDaysLeft,
  parseDateOnly,
} from './licence';

/** A local wall-clock instant, stated the way a reader would experience it. */
function local(y: number, m: number, d: number, h = 12, min = 0): Date {
  return new Date(y, m - 1, d, h, min);
}

describe('parseDateOnly', () => {
  it('reads a plain SQL date', () => {
    expect(parseDateOnly('2027-03-31')).toEqual([2027, 3, 31]);
  });

  it('ignores a time suffix if one ever arrives', () => {
    expect(parseDateOnly('2027-03-31T00:00:00Z')).toEqual([2027, 3, 31]);
  });

  it('refuses a day that does not exist rather than rolling it forward', () => {
    // new Date(2027, 1, 30) silently becomes 2 March. An expiry that moves is
    // worse than one that is missing.
    expect(parseDateOnly('2027-02-30')).toBeNull();
    expect(parseDateOnly('2027-13-01')).toBeNull();
    expect(parseDateOnly('2027-00-10')).toBeNull();
  });

  it('refuses junk and absence', () => {
    expect(parseDateOnly(null)).toBeNull();
    expect(parseDateOnly(undefined)).toBeNull();
    expect(parseDateOnly('')).toBeNull();
    expect(parseDateOnly('soon')).toBeNull();
    expect(parseDateOnly(20270331 as unknown as string)).toBeNull();
  });
});

describe('daysUntil', () => {
  it('counts whole calendar days', () => {
    expect(daysUntil('2027-03-31', local(2027, 3, 1))).toBe(30);
    expect(daysUntil('2027-03-31', local(2027, 3, 30))).toBe(1);
  });

  it('is 0 on the expiry day, because a licence is valid until the day ends', () => {
    expect(daysUntil('2027-03-31', local(2027, 3, 31, 0, 1))).toBe(0);
    expect(daysUntil('2027-03-31', local(2027, 3, 31, 23, 59))).toBe(0);
  });

  it('goes negative once the day has passed', () => {
    expect(daysUntil('2027-03-31', local(2027, 4, 1, 0, 1))).toBe(-1);
  });

  it('DOES NOT SHIFT IN THE EVENING, which a UTC parse would', () => {
    // 11:30pm Eastern on 30 March is already 03:30 on 31 March in UTC, while
    // the expiry parses as 00:00 UTC on the 31st -- so the difference is
    // NEGATIVE. The naive version reports a licence that is valid today and
    // all of tomorrow as having already expired, every evening, for every
    // angler west of Greenwich.
    const evening = local(2027, 3, 30, 23, 30);
    expect(daysUntil('2027-03-31', evening)).toBe(1);

    const naive =
      (new Date('2027-03-31').getTime() - evening.getTime()) / 86_400_000;
    expect(Math.floor(naive)).toBe(-1); // the bug this test exists to prevent
    expect(naive).toBeLessThan(0);
  });

  it('is unmoved by the spring-forward boundary', () => {
    // 8 March 2027 is a US DST start. A 23-hour day makes any
    // milliseconds-and-divide approach drift by one.
    expect(daysUntil('2027-03-15', local(2027, 3, 5))).toBe(10);
    expect(daysUntil('2027-03-09', local(2027, 3, 7))).toBe(2);
  });

  it('is unmoved by the autumn fall-back boundary', () => {
    // 1 November 2026 is a 25-hour day.
    expect(daysUntil('2026-11-10', local(2026, 10, 30))).toBe(11);
  });

  it('crosses a year end', () => {
    expect(daysUntil('2027-01-02', local(2026, 12, 31))).toBe(2);
  });

  it('says nothing when there is no date', () => {
    expect(daysUntil(null, local(2026, 11, 22))).toBeNull();
    expect(daysUntil('not a date', local(2026, 11, 22))).toBeNull();
  });
});

describe('governingExpiry', () => {
  it('returns null when the angler holds no licence', () => {
    expect(governingExpiry([])).toBeNull();
    expect(governingExpiry(null)).toBeNull();
    expect(governingExpiry(undefined)).toBeNull();
  });

  it('takes the LATEST fishing-permitting expiry, not the first row', () => {
    // A lapsed fishing licence alongside a current combination licence. The
    // angler is licensed. Nagging them daily would be wrong.
    const out = governingExpiry([
      { kind: 'fishing', expires_on: '2026-12-01' },
      { kind: 'combination', expires_on: '2027-09-30' },
    ]);
    expect(out).toBe('2027-09-30');
  });

  it('is order-independent', () => {
    const rows = [
      { kind: 'combination', expires_on: '2027-09-30' },
      { kind: 'fishing', expires_on: '2026-12-01' },
    ];
    expect(governingExpiry(rows)).toBe('2027-09-30');
  });

  it('IGNORES a hunting licence, which does not let you fish', () => {
    expect(
      governingExpiry([
        { kind: 'fishing', expires_on: '2026-12-01' },
        { kind: 'hunting', expires_on: '2030-01-01' },
      ]),
    ).toBe('2026-12-01');
    expect(governingExpiry([{ kind: 'hunting', expires_on: '2030-01-01' }])).toBeNull();
  });

  it('skips a row whose date is unusable rather than treating it as now', () => {
    expect(
      governingExpiry([
        { kind: 'fishing', expires_on: null },
        { kind: 'combination', expires_on: '2027-04-04' },
      ]),
    ).toBe('2027-04-04');
    expect(governingExpiry([{ kind: 'fishing', expires_on: null }])).toBeNull();
  });
});

describe('licenceDaysLeft', () => {
  it('is null with no licence, so the banner says nothing at all', () => {
    // The whole point. The old screen told every user "expires in 23 days".
    expect(licenceDaysLeft([], local(2026, 11, 22))).toBeNull();
  });

  it('counts from the governing licence', () => {
    const rows = [
      { kind: 'fishing', expires_on: '2026-11-25' },
      { kind: 'combination', expires_on: '2026-12-22' },
    ];
    expect(licenceDaysLeft(rows, local(2026, 11, 22))).toBe(30);
  });

  it('reports a lapsed licence as negative rather than hiding it', () => {
    expect(
      licenceDaysLeft([{ kind: 'fishing', expires_on: '2026-11-20' }], local(2026, 11, 22)),
    ).toBe(-2);
  });
});
