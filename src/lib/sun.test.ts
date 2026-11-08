import { describe, expect, it } from 'vitest';
import { formatClock, legalLight } from './sun';

// Clock pinned to America/New_York by supabase/vitest.config.ts.
const ATLANTA = { lat: 33.749, lng: -84.388 };
const BARROW = { lat: 71.2906, lng: -156.7886 }; // Utqiagvik, AK — polar day/night

describe('legalLight', () => {
  it('puts sunrise and sunset on the day asked for, not the day either side', () => {
    // The noon anchor exists for this: asking at 23:00 local must not roll
    // the solar events onto tomorrow.
    const late = legalLight(new Date(2026, 9, 17, 23, 30), ATLANTA.lat, ATLANTA.lng, 30, 30);
    const early = legalLight(new Date(2026, 9, 17, 0, 30), ATLANTA.lat, ATLANTA.lng, 30, 30);
    expect(late!.sunrise.getDate()).toBe(17);
    expect(early!.sunrise.getDate()).toBe(17);
    expect(late!.sunrise.getTime()).toBe(early!.sunrise.getTime());
  });

  it('opens the window before sunrise and closes it after sunset', () => {
    const l = legalLight(new Date(2026, 9, 17, 12), ATLANTA.lat, ATLANTA.lng, 30, 30)!;
    expect(l.start.getTime()).toBe(l.sunrise.getTime() - 30 * 60000);
    expect(l.end.getTime()).toBe(l.sunset.getTime() + 30 * 60000);
    expect(l.start.getTime()).toBeLessThan(l.end.getTime());
  });

  it('honours a state whose rule adds nothing at either edge', () => {
    // Arizona big game is sunrise to sunset, exactly.
    const l = legalLight(new Date(2026, 9, 17, 12), 33.4484, -112.074, 0, 0)!;
    expect(l.start.getTime()).toBe(l.sunrise.getTime());
    expect(l.end.getTime()).toBe(l.sunset.getTime());
  });

  it('honours an asymmetric rule', () => {
    // Connecticut deer: half an hour before sunrise, ending at sunset.
    const l = legalLight(new Date(2026, 9, 17, 12), 41.6, -72.7, 30, 0)!;
    expect(l.start.getTime()).toBe(l.sunrise.getTime() - 30 * 60000);
    expect(l.end.getTime()).toBe(l.sunset.getTime());
  });

  it('gives a sane Atlanta sunrise in mid-October', () => {
    // Roughly 07:45 Eastern; the point is the hour, not the minute.
    const l = legalLight(new Date(2026, 9, 17, 12), ATLANTA.lat, ATLANTA.lng, 0, 0)!;
    expect(l.sunrise.getHours()).toBeGreaterThanOrEqual(7);
    expect(l.sunrise.getHours()).toBeLessThanOrEqual(8);
    expect(l.sunset.getHours()).toBeGreaterThanOrEqual(18);
    expect(l.sunset.getHours()).toBeLessThanOrEqual(19);
  });

  it('returns null in polar summer rather than inventing a sunrise', () => {
    // Midsummer above the Arctic Circle has no sunrise event at all. A
    // fabricated legal-light window is a legal problem, not a display bug.
    expect(legalLight(new Date(2026, 5, 21, 12), BARROW.lat, BARROW.lng, 30, 30)).toBeNull();
  });

  it('returns null in polar winter too', () => {
    expect(legalLight(new Date(2026, 11, 21, 12), BARROW.lat, BARROW.lng, 30, 30)).toBeNull();
  });
});

describe('formatClock', () => {
  it('reads as a clock, with noon and midnight as 12', () => {
    expect(formatClock(new Date(2026, 9, 17, 7, 5))).toBe('7:05 AM');
    expect(formatClock(new Date(2026, 9, 17, 0, 0))).toBe('12:00 AM');
    expect(formatClock(new Date(2026, 9, 17, 12, 0))).toBe('12:00 PM');
    expect(formatClock(new Date(2026, 9, 17, 18, 45))).toBe('6:45 PM');
  });
});
