import { describe, expect, it } from 'vitest';
import { checkBriefNumbers, composeBrief, hasSomethingToSay, type BriefFacts } from './brief';

const EMPTY: BriefFacts = {
  today: '2026-10-24',
  open_now: [],
  opening_soon: [],
  next_deadline: null,
  counts: { open_now: 0, opening_soon: 0 },
};

const FULL: BriefFacts = {
  today: '2026-10-24',
  open_now: [
    { species: 'Deer', state: 'Georgia', method: 'archery' },
    { species: 'Ducks', state: 'Georgia', method: 'general' },
  ],
  opening_soon: [
    { species: 'Turkey', state: 'Alabama', open_date: '2026-10-27', in_days: 3 },
    { species: 'Quail', state: 'Georgia', open_date: '2026-10-30', in_days: 6 },
  ],
  next_deadline: { species: 'Elk', state: 'Colorado', closes_at: '2026-11-05', in_days: 12 },
  counts: { open_now: 2, opening_soon: 2 },
};

describe('hasSomethingToSay', () => {
  it('stays quiet when there is no news', () => {
    expect(hasSomethingToSay(EMPTY)).toBe(false);
    expect(hasSomethingToSay(null)).toBe(false);
  });

  it('speaks when anything is open, opening, or closing', () => {
    expect(hasSomethingToSay(FULL)).toBe(true);
    expect(hasSomethingToSay({ ...EMPTY, next_deadline: FULL.next_deadline })).toBe(true);
  });
});

describe('composeBrief', () => {
  it('writes the deterministic brief with numerals', () => {
    const s = composeBrief(FULL);
    expect(s).toContain('Deer and Ducks open in Georgia.');
    expect(s).toContain('Turkey opens in 3 days in Alabama');
    expect(s).not.toMatch(/three|six|twelve/i);
  });

  it('never runs past two sentences', () => {
    expect(composeBrief(FULL).split('. ').length).toBeLessThanOrEqual(2);
  });

  it('says today and tomorrow rather than 0 and 1 days', () => {
    const s = composeBrief({
      ...EMPTY,
      opening_soon: [{ species: 'Deer', state: 'Georgia', open_date: '2026-10-25', in_days: 1 }],
    });
    expect(s).toContain('opens tomorrow');
  });

  it('handles a deadline on its own', () => {
    const s = composeBrief({ ...EMPTY, next_deadline: FULL.next_deadline });
    expect(s).toBe('The Colorado elk draw closes in 12 days.');
  });
});

describe('checkBriefNumbers', () => {
  it('accepts the deterministic brief it was built from', () => {
    expect(checkBriefNumbers(composeBrief(FULL), FULL).ok).toBe(true);
  });

  it('accepts a model rephrasing that keeps the numbers', () => {
    const r = checkBriefNumbers('Deer and Ducks are open in Georgia; Turkey opens in 3 days.', FULL);
    expect(r.ok).toBe(true);
  });

  it('rejects an invented day count', () => {
    const r = checkBriefNumbers('Turkey opens in 5 days in Alabama.', FULL);
    expect(r.ok).toBe(false);
    expect(r.unsupported).toContain('5');
  });

  it('rejects an invented date', () => {
    const r = checkBriefNumbers('The Colorado elk draw closes 2026-12-01.', FULL);
    expect(r.ok).toBe(false);
    expect(r.unsupported).toContain('2026-12-01');
  });

  it('passes a brief with no numbers', () => {
    expect(checkBriefNumbers('Deer and Ducks are open in Georgia.', FULL).ok).toBe(true);
  });
});
