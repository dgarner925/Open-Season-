import { describe, expect, it } from 'vitest';
import { keepingSince, logYears, parseFee, yearOf, yearSentence, type LogApplication } from './years';

function app(p: Partial<LogApplication>): LogApplication {
  return {
    status: 'applied',
    applied_on: null,
    results_on: null,
    fee_summary: null,
    points: null,
    created_at: '2026-09-01T00:00:00Z',
    stateName: 'Georgia',
    speciesName: 'Deer',
    ...p,
  };
}

describe('parseFee', () => {
  it('takes the first dollar figure, commas and cents included', () => {
    expect(parseFee('$341')).toBe(341);
    expect(parseFee('341.50')).toBe(341.5);
    expect(parseFee('$1,250 nonresident')).toBe(1250);
    expect(parseFee('$120 res / $341 nonres')).toBe(120);
  });

  it('returns null rather than zero when there is no figure', () => {
    expect(parseFee(null)).toBeNull();
    expect(parseFee('')).toBeNull();
    expect(parseFee('see the regulations')).toBeNull();
  });
});

describe('yearOf', () => {
  it('places a row by when it was applied, not when it was created', () => {
    expect(yearOf(app({ applied_on: '2025-06-01', created_at: '2026-09-01T00:00:00Z' }))).toBe(2024);
  });

  it('falls back to the created date when nothing was applied', () => {
    expect(yearOf(app({ applied_on: null, created_at: '2026-09-01T00:00:00Z' }))).toBe(2026);
  });

  it('keeps a spring result with the season it was applied for', () => {
    // Applied May 2026 (the 2025 season), result in June — still 2025.
    expect(yearOf(app({ applied_on: '2026-05-01', results_on: '2026-06-20' }))).toBe(2025);
  });
});

describe('logYears', () => {
  it('counts draws, wins, misses and waits apart from each other', () => {
    const [y] = logYears([
      app({ status: 'applied', applied_on: '2026-08-01' }),
      app({ status: 'successful', applied_on: '2026-08-02' }),
      app({ status: 'unsuccessful', applied_on: '2026-08-03' }),
      app({ status: 'purchased', applied_on: '2026-08-04' }),
    ]);
    expect(y).toMatchObject({ year: 2026, entered: 3, drawn: 1, missed: 1, pending: 1, bought: 1 });
  });

  it('never counts an intention as a draw entered', () => {
    const [y] = logYears([app({ status: 'planned', applied_on: '2026-08-01' })]);
    expect(y.entered).toBe(0);
  });

  it('leaves fees and points blank rather than writing a zero', () => {
    const [y] = logYears([app({ applied_on: '2026-08-01' })]);
    expect(y.fees).toBeNull();
    expect(y.points).toBeNull();
  });

  it('adds up the fees and points it does have', () => {
    const [y] = logYears([
      app({ applied_on: '2026-08-01', fee_summary: '$341', points: 3 }),
      app({ applied_on: '2026-08-02', fee_summary: '$120', points: 1 }),
      app({ applied_on: '2026-08-03', fee_summary: null, points: null }),
    ]);
    expect(y.fees).toBe(461);
    expect(y.points).toBe(4);
  });

  it('splits rows into their own hunting years, newest first', () => {
    const years = logYears([
      app({ applied_on: '2024-07-15' }),
      app({ applied_on: '2026-08-01' }),
      app({ applied_on: '2025-08-01' }),
    ]);
    expect(years.map((y) => y.year)).toEqual([2026, 2025, 2024]);
  });

  it('lists each state and species once', () => {
    const [y] = logYears([
      app({ applied_on: '2026-08-01', stateName: 'Georgia', speciesName: 'Deer' }),
      app({ applied_on: '2026-08-02', stateName: 'Georgia', speciesName: 'Turkey' }),
      app({ applied_on: '2026-08-03', stateName: 'Montana', speciesName: 'Deer' }),
    ]);
    expect(y.states).toEqual(['Georgia', 'Montana']);
    expect(y.species).toEqual(['Deer', 'Turkey']);
  });
});

describe('yearSentence', () => {
  it('tells the year in order: where, what, how it went, what it cost', () => {
    const [y] = logYears([
      app({ applied_on: '2026-08-01', stateName: 'Georgia', speciesName: 'Deer', fee_summary: '$341', points: 3 }),
      app({ status: 'successful', applied_on: '2026-08-02', stateName: 'Montana', speciesName: 'Elk' }),
    ]);
    expect(yearSentence(y)).toBe(
      'Georgia and Montana, deer and elk. 2 draws entered, 1 drawn, 1 still waiting. $341 in fees. 3 points committed.',
    );
  });

  it('leaves out every clause it has nothing for', () => {
    const [y] = logYears([app({ status: 'planned', applied_on: '2026-08-01', stateName: null, speciesName: null })]);
    expect(yearSentence(y)).toBe('Nothing recorded for this year.');
  });

  it('counts instead of listing once there are more than two', () => {
    const [y] = logYears([
      app({ applied_on: '2026-08-01', stateName: 'Georgia', speciesName: 'Deer' }),
      app({ applied_on: '2026-08-02', stateName: 'Montana', speciesName: 'Elk' }),
      app({ applied_on: '2026-08-03', stateName: 'Wyoming', speciesName: 'Antelope' }),
    ]);
    expect(yearSentence(y)).toContain('3 states, 3 species.');
  });

  it('writes no money clause when no fee was entered', () => {
    const [y] = logYears([app({ applied_on: '2026-08-01' })]);
    expect(yearSentence(y)).not.toContain('$');
  });
});

describe('keepingSince', () => {
  it('names the first year on record', () => {
    expect(
      keepingSince(
        [{ created_at: '2024-03-01T00:00:00Z', stateName: 'Georgia', speciesName: 'Deer' }],
        [],
        '2026-11-08',
      ),
    ).toBe(2023);
  });

  it('says nothing in the first season, when it would be a boast', () => {
    expect(
      keepingSince(
        [{ created_at: '2026-10-01T00:00:00Z', stateName: 'Georgia', speciesName: 'Deer' }],
        [],
        '2026-11-08',
      ),
    ).toBeNull();
  });

  it('falls back to applications when there are no follows', () => {
    expect(keepingSince([], [app({ applied_on: '2024-08-01' })], '2026-11-08')).toBe(2024);
  });

  it('says nothing with nothing to go on', () => {
    expect(keepingSince([], [], '2026-11-08')).toBeNull();
  });
});
