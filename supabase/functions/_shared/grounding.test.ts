import { describe, expect, it } from 'vitest';
import {
  allowedDatesFrom,
  checkGrounding,
  expandDate,
  extractDateMentions,
  looksLikeQuestion,
  normalizeQuestion,
} from './grounding';

const FACTS = [
  { season_id: 'a', species: 'Deer', method: 'archery', open_date: '2026-09-12', close_date: '2026-10-09' },
];

describe('expandDate', () => {
  it('renders every legitimate spelling of a date', () => {
    const forms = expandDate('2026-09-12');
    expect(forms).toContain('2026-09-12');
    expect(forms).toContain('sep 12');
    expect(forms).toContain('september 12');
    expect(forms).toContain('9/12');
  });

  it('ignores non-dates', () => {
    expect(expandDate('not a date')).toEqual([]);
    expect(expandDate('2026-13-01')).toEqual([]);
  });
});

describe('extractDateMentions', () => {
  it('finds dates written as words, numbers, or ISO', () => {
    const raws = extractDateMentions(
      'Archery opens September 12 and runs to Oct 9. Firearms start 10/17, muzzleloader 2026-10-10.',
    ).map((m) => m.raw);
    expect(raws).toContain('September 12');
    expect(raws).toContain('Oct 9');
    expect(raws).toContain('10/17');
    expect(raws).toContain('2026-10-10');
  });

  it('does not treat ordinary numbers as dates', () => {
    expect(extractDateMentions('The bag limit is 2 bucks and 10 does.')).toHaveLength(0);
  });
});

describe('checkGrounding', () => {
  it('accepts an answer whose dates all came from tool results', () => {
    const r = checkGrounding('Deer archery opens September 12 and closes October 9.', FACTS);
    expect(r.ok).toBe(true);
    expect(r.unsupported).toEqual([]);
  });

  it('accepts ISO and slash spellings of the same facts', () => {
    expect(checkGrounding('Opens 2026-09-12.', FACTS).ok).toBe(true);
    expect(checkGrounding('Opens 9/12.', FACTS).ok).toBe(true);
  });

  it('rejects a hallucinated date — the whole point', () => {
    const r = checkGrounding('Deer archery opens September 10.', FACTS);
    expect(r.ok).toBe(false);
    expect(r.unsupported).toContain('September 10');
  });

  it('rejects a plausible-but-invented date mixed in with real ones', () => {
    const r = checkGrounding('Archery runs September 12 to October 9, and firearms open November 1.', FACTS);
    expect(r.ok).toBe(false);
    expect(r.unsupported).toEqual(['November 1']);
  });

  it('passes an answer with no dates at all', () => {
    expect(checkGrounding("We don't have that on file for Georgia.", FACTS).ok).toBe(true);
  });

  it('treats empty tool results as grounding nothing', () => {
    expect(checkGrounding('Opens September 12.', []).ok).toBe(false);
  });
});

describe('allowedDatesFrom', () => {
  it('collects dates from anywhere in the result payload', () => {
    const allowed = allowedDatesFrom(FACTS);
    expect(allowed.has('sep 12')).toBe(true);
    expect(allowed.has('oct 9')).toBe(true);
    expect(allowed.has('nov 1')).toBe(false);
  });
});

describe('looksLikeQuestion', () => {
  it('routes real questions to the model', () => {
    expect(looksLikeQuestion('when does deer season open in georgia')).toBe(true);
    expect(looksLikeQuestion('can I hunt bear with a rifle in October?')).toBe(true);
    expect(looksLikeQuestion('what is the bag limit for ducks')).toBe(true);
    expect(looksLikeQuestion('tell me about georgia deer seasons')).toBe(true);
  });

  it('leaves keyword searches to the on-device index', () => {
    expect(looksLikeQuestion('deer')).toBe(false);
    expect(looksLikeQuestion('georgia deer')).toBe(false);
    expect(looksLikeQuestion('elk september')).toBe(false);
    expect(looksLikeQuestion('open now')).toBe(false);
  });
});

describe('normalizeQuestion', () => {
  it('collapses punctuation and case so the cache hits', () => {
    expect(normalizeQuestion('  When does DEER season open?? ')).toBe('when does deer season open');
    expect(normalizeQuestion('When does deer season open')).toBe(
      normalizeQuestion('when does deer season open?'),
    );
  });
});
