import { describe, expect, it } from 'vitest';
import { DEFAULT_BUDGET_MS, timeForAnother, WALL_CLOCK_MS } from './time_budget';

describe('timeForAnother', () => {
  it('always starts the first source', () => {
    // Nothing has been measured yet, and a run that reads nothing is worse
    // than a run that overruns.
    expect(timeForAnother(0, null)).toBe(true);
  });

  it('replays the night that started this', () => {
    // 2026-11-19: West Virginia 62s, Colorado's big-game PDF 83s, then the
    // worker died 145s in with South Carolina stamped and unread.
    expect(timeForAnother(0, null)).toBe(true);          // WV runs
    expect(timeForAnother(62_000, 62_000)).toBe(true);   // CO runs: 124s fits
    expect(timeForAnother(145_000, 83_000)).toBe(false); // SC does not: 228s
  });

  it('keeps going on a night of fast HTML pages', () => {
    // Six 20s pages fit where two slow ones did not, so the budget is not a
    // cap of two -- it is a cap of whatever actually fits.
    let elapsed = 0;
    let n = 0;
    while (timeForAnother(elapsed, n === 0 ? null : 20_000)) {
      elapsed += 20_000;
      n++;
      if (n > 50) break;
    }
    expect(n).toBe(7);
    expect(elapsed).toBeLessThan(WALL_CLOCK_MS);
  });

  it('stops after a single source that ate the whole night', () => {
    // One 140s PDF. There is no second source, and pretending otherwise is
    // how the third gets stamped unread.
    expect(timeForAnother(140_000, 140_000)).toBe(false);
  });

  it('allows a source that lands exactly on the budget', () => {
    expect(timeForAnother(DEFAULT_BUDGET_MS - 10_000, 10_000)).toBe(true);
    expect(timeForAnother(DEFAULT_BUDGET_MS - 10_000, 10_001)).toBe(false);
  });

  it('reserves time for the response rather than spending the whole clock', () => {
    // The run still has to report what it did. A budget equal to the wall
    // clock loses the report on the one night it matters most.
    expect(DEFAULT_BUDGET_MS).toBeLessThan(WALL_CLOCK_MS);
    expect(timeForAnother(WALL_CLOCK_MS - 1_000, 500)).toBe(false);
  });

  it('takes a caller-supplied budget', () => {
    expect(timeForAnother(5_000, 5_000, 20_000)).toBe(true);
    expect(timeForAnother(5_000, 5_000, 9_000)).toBe(false);
  });

  it('does not treat a negative duration as spare time', () => {
    // A clock that goes backwards must not buy another source.
    expect(timeForAnother(DEFAULT_BUDGET_MS, -50_000)).toBe(false);
  });

  it('fails safe on an unreadable elapsed time', () => {
    expect(timeForAnother(NaN, 10_000)).toBe(false);
  });

  it('treats an unreadable duration as unmeasured rather than stopping', () => {
    expect(timeForAnother(1_000, NaN)).toBe(true);
  });
});
