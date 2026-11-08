import { describe, expect, it } from 'vitest';
import { firingsFor, firingWhen, localISO, offsetLabel, promiseHead, sendTimeFor, SEND_HOUR_UTC } from './promise';

// Clock pinned to America/New_York by supabase/vitest.config.ts.
const OPENER = '2026-11-14'; // a Saturday

describe('offsetLabel', () => {
  it('speaks the ladder rather than counting it', () => {
    expect(offsetLabel(1)).toBe('the day before');
    expect(offsetLabel(7)).toBe('a week out');
    expect(offsetLabel(30)).toBe('a month out');
    expect(offsetLabel(365)).toBe('a year out');
  });

  it('falls back to a count for anything off the ladder', () => {
    expect(offsetLabel(0)).toBe('the morning it opens');
    expect(offsetLabel(5)).toBe('5 days out');
  });
});

describe('sendTimeFor', () => {
  it('is the cron hour in UTC, not a local wall clock', () => {
    const d = sendTimeFor('2026-11-13');
    expect(d.toISOString()).toBe(`2026-11-13T${String(SEND_HOUR_UTC).padStart(2, '0')}:00:00.000Z`);
  });
});

describe('firingsFor', () => {
  it('lists the notices still to come, soonest first', () => {
    const now = new Date('2026-11-01T12:00:00Z');
    const f = firingsFor(OPENER, [7, 1, 30], now);
    expect(f.map((x) => x.offset)).toEqual([7, 1]); // 30 days out already passed
    expect(f.map((x) => x.label)).toEqual(['a week out', 'the day before']);
  });

  it('drops a reminder that already went out this morning', () => {
    // 13:00 UTC on 7 Nov is the "a week out" send; at 14:00 it is history.
    const after = new Date('2026-11-07T14:00:00Z');
    expect(firingsFor(OPENER, [7], after)).toEqual([]);
    const before = new Date('2026-11-07T12:00:00Z');
    expect(firingsFor(OPENER, [7], before)).toHaveLength(1);
  });

  it('marks a send happening later the same local day', () => {
    // 08:00 Eastern on 7 Nov; the send is 13:00 UTC the same date.
    const now = new Date('2026-11-07T12:00:00Z');
    const [f] = firingsFor(OPENER, [7], now);
    expect(f.today).toBe(true);
  });

  it('shifts the send date across a month boundary without drifting', () => {
    const now = new Date('2026-09-01T00:00:00Z');
    const [f] = firingsFor('2026-11-14', [30], now);
    expect(f.at.toISOString().slice(0, 10)).toBe('2026-10-15');
  });

  it('returns nothing when no offsets are armed', () => {
    expect(firingsFor(OPENER, [], new Date('2026-11-01T12:00:00Z'))).toEqual([]);
  });
});

describe('promiseHead', () => {
  it('names when the promise gets kept, not how often', () => {
    const now = new Date('2026-11-01T12:00:00Z');
    const head = promiseHead(firingsFor(OPENER, [7, 1], now));
    expect(head.startsWith("You'll hear from us ")).toBe(true);
    expect(head.endsWith('.')).toBe(true);
  });

  it('keeps the weekday capitalised mid-sentence', () => {
    // Build 101 shipped "You'll hear from us fri, Nov 13" because the whole
    // phrase was lowercased. A weekday is a name; it never drops its capital.
    const now = new Date('2026-11-01T12:00:00Z');
    const head = promiseHead(firingsFor(OPENER, [7], now));
    expect(head).toMatch(/^You'll hear from us (Mon|Tue|Wed|Thu|Fri|Sat|Sun) /);
  });

  it('drops the capital on "Later today", which is a phrase and not a name', () => {
    const now = new Date('2026-11-07T12:00:00Z');
    const head = promiseHead(firingsFor(OPENER, [7], now));
    expect(head).toContain('later today,');
    expect(head).not.toContain('Later today');
  });

  it('says plainly when there is nothing left to promise', () => {
    expect(promiseHead([])).toBe('No reminder left before this one.');
  });
});

describe('firingWhen', () => {
  it('uses the house date format, not the locale default', () => {
    // toLocaleDateString('en-US') gives "Sat, Nov 7", which made the sentence
    // read "You'll hear from us Sat, Nov 7, 8:00 AM" — two commas, and a
    // month order the rest of the app does not use.
    const now = new Date('2026-11-01T12:00:00Z');
    const [f] = firingsFor(OPENER, [7], now);
    const when = firingWhen(f);
    expect(when).toMatch(/^Sat 7 Nov, \d{1,2}:\d{2}/);
    expect(when).not.toContain('Nov 7');
  });
});

describe('localISO', () => {
  it('uses the local calendar date, which the UTC one can be a day off from', () => {
    // 01:00 UTC on 9 Nov is still 8 Nov in Eastern.
    expect(localISO(new Date('2026-11-09T01:00:00Z'))).toBe('2026-11-08');
  });
});
