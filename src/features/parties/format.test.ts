import { describe, expect, it } from 'vitest';
import { clock, comingSentence, dayLabel, daysBetween } from './format';

// vitest.config.ts pins TZ to America/New_York.

describe('daysBetween', () => {
  it('is inclusive of both ends', () => {
    expect(daysBetween('2026-11-14', '2026-11-16')).toEqual([
      '2026-11-14',
      '2026-11-15',
      '2026-11-16',
    ]);
  });

  it('gives a single day when there is no close date', () => {
    expect(daysBetween('2026-11-14', null)).toEqual(['2026-11-14']);
  });

  it('returns nothing without an open date', () => {
    expect(daysBetween(null, '2026-11-16')).toEqual([]);
  });

  it('refuses a close date before the open date', () => {
    expect(daysBetween('2026-11-16', '2026-11-14')).toEqual([]);
  });

  it('caps a long season', () => {
    const d = daysBetween('2026-09-12', '2027-01-10');
    expect(d).toHaveLength(14);
    expect(d[0]).toBe('2026-09-12');
    expect(d[13]).toBe('2026-09-25');
  });

  it('honours a smaller cap', () => {
    expect(daysBetween('2026-11-14', '2026-11-30', 3)).toEqual([
      '2026-11-14',
      '2026-11-15',
      '2026-11-16',
    ]);
  });

  it('crosses a month boundary', () => {
    expect(daysBetween('2026-10-30', '2026-11-02')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
  });

  it('crosses a year boundary', () => {
    expect(daysBetween('2026-12-31', '2027-01-01')).toEqual(['2026-12-31', '2027-01-01']);
  });

  it('survives the end of daylight saving without losing or doubling a day', () => {
    // Clocks go back 2026-11-01 in the US. A midnight-based loop either
    // repeats Nov 1 or skips it; noon cannot.
    expect(daysBetween('2026-10-31', '2026-11-03')).toEqual([
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
    ]);
  });

  it('survives the start of daylight saving', () => {
    expect(daysBetween('2027-03-13', '2027-03-15')).toEqual([
      '2027-03-13',
      '2027-03-14',
      '2027-03-15',
    ]);
  });

  it('includes Feb 29 in a leap year', () => {
    expect(daysBetween('2028-02-28', '2028-03-01')).toEqual([
      '2028-02-28',
      '2028-02-29',
      '2028-03-01',
    ]);
  });

  it('gives nothing for a date it cannot read', () => {
    expect(daysBetween('not a date', '2026-11-16')).toEqual([]);
  });
});

describe('dayLabel', () => {
  it('names the day the date actually is, not the one UTC midnight lands on', () => {
    // 2026-11-14 is a Saturday. Parsed as UTC midnight it is Friday evening
    // in Eastern, and this read "Fri Nov 13" before the noon fix.
    expect(dayLabel('2026-11-14')).toBe('Sat Nov 14');
  });

  it('does not pad the day of the month', () => {
    expect(dayLabel('2026-11-01')).toBe('Sun Nov 1');
  });

  it('hands back what it was given when it cannot read it', () => {
    expect(dayLabel('whenever')).toBe('whenever');
  });
});

describe('clock', () => {
  it('reads midnight as 12 AM', () => {
    expect(clock('2026-11-09T05:00:00Z')).toBe('12:00 AM'); // Eastern
  });

  it('reads noon as 12 PM', () => {
    expect(clock('2026-11-09T17:00:00Z')).toBe('12:00 PM');
  });

  it('pads the minutes', () => {
    expect(clock('2026-11-09T12:05:00Z')).toBe('7:05 AM');
  });

  it('is empty when the timestamp is unreadable', () => {
    expect(clock('')).toBe('');
  });
});

describe('comingSentence', () => {
  it('says so when nobody is in', () => {
    expect(comingSentence([], 4)).toBe('Nobody yet.');
  });

  it('says everyone when the whole party is in', () => {
    expect(comingSentence(['David Butler', 'Sam Kephart'], 2)).toBe('Everyone.');
  });

  it('does not say "everyone" of a party of one', () => {
    expect(comingSentence(['David Butler'], 1)).toBe('David');
  });

  it('uses first names only', () => {
    expect(comingSentence(['David Butler', 'Sam Kephart'], 4)).toBe('David, Sam');
  });

  it('counts the overflow past four', () => {
    expect(
      comingSentence(['Al Ward', 'Bo Rice', 'Cy Vance', 'Di Shaw', 'Ed Pope', 'Fay Lin'], 9),
    ).toBe('Al, Bo, Cy, Di +2');
  });

  it('treats a blank display name as nobody rather than printing a gap', () => {
    expect(comingSentence(['   '], 3)).toBe('Nobody yet.');
  });
});
