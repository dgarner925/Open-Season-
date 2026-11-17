import { describe, expect, it } from 'vitest';
import { licenceYear, staleProposal, staleSeasonYear, yearInQuote } from './licence_year';

describe('licenceYear', () => {
  it('runs with the autumn, not the calendar', () => {
    expect(licenceYear('2026-11-17')).toBe(2026);
    expect(licenceYear('2026-05-01')).toBe(2026);
  });

  it('keeps January through April on the previous year', () => {
    // Wisconsin's 2026 deer season closes in January 2027. A hunter reading
    // the app that morning is still inside the 2026 season.
    expect(licenceYear('2027-01-02')).toBe(2026);
    expect(licenceYear('2027-04-30')).toBe(2026);
    expect(licenceYear('2027-05-01')).toBe(2027);
  });

  it('is NaN on a date it cannot read, so callers fail open', () => {
    expect(Number.isNaN(licenceYear('not a date'))).toBe(true);
  });
});

describe('staleSeasonYear', () => {
  it('rejects the Wisconsin batch that started this', () => {
    // The real row: WI deer, Gun, 2025-11-22 -> 2025-11-30, proposed on
    // 2026-11-15 off a mirror still publishing 2025-26.
    const v = staleSeasonYear(2025, '2026-11-17', '2025-11-30');
    expect(v.stale).toBe(true);
    expect(v.reason).toContain('2026 licence year');
  });

  it('keeps the current year', () => {
    expect(staleSeasonYear(2026, '2026-11-17', '2027-01-10').stale).toBe(false);
  });

  it('keeps a year-old row whose season has not closed yet', () => {
    // Read on 2 January 2027, the 2026 season is still open. licenceYear says
    // 2026, so this is not even behind -- but prove the close-date escape
    // hatch holds for a genuinely late revision too.
    expect(staleSeasonYear(2025, '2026-05-02', '2026-06-30').stale).toBe(false);
  });

  it('fails open on a missing or unparseable year rather than binning the row', () => {
    expect(staleSeasonYear(null, '2026-11-17').stale).toBe(false);
    expect(staleSeasonYear(2025, 'nonsense').stale).toBe(false);
  });
});

describe('yearInQuote', () => {
  it('reads the year out of a quoted line', () => {
    expect(yearInQuote('Gun (Hunters with Disabilities): October 4 - 12, 2025')).toBe(2025);
  });

  it('takes the later year of a span, which is what dates the document', () => {
    expect(yearInQuote("We've included dates for the 2025-2026 season")).toBe(2026);
  });

  it('returns null when the quote names no year', () => {
    expect(yearInQuote('Spring Youth Portion: April 11-12')).toBeNull();
    expect(yearInQuote(null)).toBeNull();
  });

  it('does not mistake a number for a year', () => {
    expect(yearInQuote('Bag limit 2 per day, 6 in possession')).toBeNull();
  });
});

describe('staleProposal', () => {
  it('catches a stale quote even when the season year looks current', () => {
    // The shape that would slip past the year check alone: the extractor
    // stamped season_year from the run, the prose it quoted did not.
    const v = staleProposal(
      { seasonYear: 2026, closeDate: '2025-11-30', quote: 'Gun: November 22 - 30, 2025' },
      '2026-11-17',
    );
    expect(v.stale).toBe(true);
    expect(v.reason).toContain('2025');
  });

  it('passes a proposal that is current on both counts', () => {
    const v = staleProposal(
      { seasonYear: 2026, closeDate: '2027-01-15', quote: 'Fall Archery: Nov. 25, 2026 - Jan. 15, 2027' },
      '2026-11-17',
    );
    expect(v.stale).toBe(false);
  });

  it('passes a dateless quote rather than guessing', () => {
    // Missouri's "Spring Youth Portion: April 11-12" names no year and is
    // perfectly good evidence; silence is not staleness.
    const v = staleProposal(
      { seasonYear: 2026, closeDate: '2026-04-12', quote: 'Spring Youth Portion: April 11-12' },
      '2026-11-17',
    );
    expect(v.stale).toBe(false);
  });
});
