import { describe, expect, it } from 'vitest';
import { coverageLine, coverageOf, coverageWord, huntYear } from './gaps';
import type { SeasonWithRefs } from '@/features/reference/types';

function season(year: number, openDate: string | null, closeDate: string | null): SeasonWithRefs {
  return {
    id: `${year}-${openDate ?? 'x'}`,
    season_year: year,
    open_date: openDate,
    close_date: closeDate,
  } as unknown as SeasonWithRefs;
}

describe('huntYear', () => {
  it('turns in July, so spring turkey belongs to the previous fall', () => {
    expect(huntYear('2026-08-15')).toBe(2026);
    expect(huntYear('2026-12-31')).toBe(2026);
    // March 2027 turkey is part of the 2026 season.
    expect(huntYear('2027-03-20')).toBe(2026);
    expect(huntYear('2027-06-30')).toBe(2026);
    expect(huntYear('2027-07-01')).toBe(2027);
  });
});

describe('coverageOf', () => {
  it('reports absent when there is nothing at all', () => {
    expect(coverageOf([], '2026-11-08')).toEqual({ kind: 'absent' });
  });

  it('reports current while a season is open', () => {
    const s = [season(2026, '2026-10-17', '2027-01-10')];
    expect(coverageOf(s, '2026-11-08')).toEqual({ kind: 'current' });
  });

  it('reports current when a season is still ahead', () => {
    const s = [season(2026, '2026-12-01', '2026-12-20')];
    expect(coverageOf(s, '2026-11-08')).toEqual({ kind: 'current' });
  });

  it('reports awaiting once every date we hold is behind us', () => {
    const s = [season(2025, '2025-10-18', '2026-01-11'), season(2025, '2025-09-13', '2025-09-28')];
    expect(coverageOf(s, '2026-11-08')).toEqual({
      kind: 'awaiting',
      throughYear: 2025,
      lastOpen: '2025-10-18',
    });
  });

  it('stays quiet about a dangling close date in the current season year', () => {
    // Open date behind us, no close date, and the row belongs to THIS hunt
    // year: missing data, not a stale year. Saying "they haven't published
    // 2027" about a 2026 row would be a false statement, so say nothing.
    const s = [season(2026, '2026-08-01', null)];
    expect(coverageOf(s, '2026-11-08')).toEqual({ kind: 'current' });
  });

  it('still calls out a dangling close date from an old season year', () => {
    const s = [season(2024, '2024-08-01', null)];
    expect(coverageOf(s, '2026-11-08')).toMatchObject({ kind: 'awaiting', throughYear: 2024 });
  });

  it('ignores rows with no open date when picking the last opener', () => {
    const s = [season(2025, null, null), season(2025, '2025-10-18', '2026-01-11')];
    const cov = coverageOf(s, '2026-11-08');
    expect(cov).toMatchObject({ kind: 'awaiting', lastOpen: '2025-10-18' });
  });
});

describe('coverageLine', () => {
  it('says nothing when the dates are current', () => {
    expect(coverageLine({ kind: 'current' }, { species: 'Deer', state: 'Georgia' })).toBeNull();
  });

  it('names the agency and both years when we are waiting on a publication', () => {
    const line = coverageLine(
      { kind: 'awaiting', throughYear: 2025, lastOpen: '2025-10-18' },
      { species: 'Deer', state: 'Georgia', agency: 'Georgia DNR', followed: true },
    );
    expect(line).toBe(
      "Georgia DNR hasn't published the 2026 deer dates yet. Ours run through the 2025 season." +
        " You'll hear from us the day it lands.",
    );
  });

  it('falls back to the state when we have no agency name', () => {
    const line = coverageLine(
      { kind: 'awaiting', throughYear: 2025, lastOpen: null },
      { species: 'Elk', state: 'Montana' },
    );
    expect(line).toContain('Montana hasn\'t published the 2026 elk dates yet');
  });

  it('owns an absent pair as our gap, not the state\'s', () => {
    const line = coverageLine({ kind: 'absent' }, { species: 'Bear', state: 'Montana' });
    expect(line).toBe("We don't have Montana bear yet — that's our gap, not the state's.");
  });

  it('only promises a notification to someone the alerts can reach', () => {
    const unfollowed = coverageLine({ kind: 'absent' }, { species: 'Bear', state: 'Montana' });
    const followed = coverageLine(
      { kind: 'absent' },
      { species: 'Bear', state: 'Montana', followed: true },
    );
    expect(unfollowed).not.toContain("You'll hear");
    expect(followed).toContain("You'll hear from us the day it lands.");
  });

  it('never claims a state does not offer a season', () => {
    // A missing state_species mapping is indistinguishable from a real
    // absence here, and that mapping has been wrong before.
    for (const cov of [{ kind: 'absent' } as const, { kind: 'awaiting', throughYear: 0, lastOpen: null } as const]) {
      const line = coverageLine(cov, { species: 'Bear', state: 'Montana' }) ?? '';
      expect(line.toLowerCase()).not.toContain('no season');
      expect(line.toLowerCase()).not.toContain("doesn't offer");
      expect(line.toLowerCase()).not.toContain('not huntable');
    }
  });

  it('drops the year when we have no season year to name', () => {
    const line = coverageLine(
      { kind: 'awaiting', throughYear: 0, lastOpen: null },
      { species: 'Duck', state: 'Iowa', agency: 'Iowa DNR' },
    );
    expect(line).toBe("Iowa DNR hasn't published the next duck dates yet.");
  });
});

describe('coverageWord', () => {
  it('distinguishes the agency waiting from our own hole', () => {
    expect(coverageWord({ kind: 'current' })).toBeNull();
    expect(coverageWord({ kind: 'awaiting', throughYear: 2025, lastOpen: null })).toBe('Awaiting');
    expect(coverageWord({ kind: 'absent' })).toBe('Our gap');
  });
});
