import { describe, expect, it } from 'vitest';
import {
  inches,
  limitPhrase,
  restrictionPhrase,
  ruleInForce,
  ruleSubtitle,
  sizePhrase,
  speciesPhrase,
  trophyPhrase,
  windowPhrase,
  type RuleForDisplay,
} from './format';

const rule = (over: Partial<RuleForDisplay> = {}): RuleForDisplay => ({
  waterName: null,
  speciesNames: ['Rainbow trout'],
  limitBasis: 'aggregate',
  dailyLimitKind: 'count',
  dailyLimit: 8,
  // `unknown`, not `none`: the default fixture is a rule that does not
  // ADDRESS size. `none` is now the positive claim "no size limit".
  sizeRule: 'unknown',
  minLengthInches: null,
  maxLengthInches: null,
  trophyAllowance: null,
  trophyMinLengthInches: null,
  restrictions: [],
  effectiveFrom: null,
  effectiveTo: null,
  ...over,
});

describe('an aggregate limit is shared, not each', () => {
  it('says "combined" when several species share one number', () => {
    // Georgia: "Total daily limit of 10 black bass" across several species.
    // "10/day" beside a species list reads as ten of EACH.
    const r = rule({
      speciesNames: ['Largemouth bass', 'Shoal bass', 'Smallmouth bass'],
      dailyLimit: 10,
      limitBasis: 'aggregate',
    });
    expect(limitPhrase(r)).toBe('10/day combined');
  });

  it('says "each" when the number applies per species', () => {
    const r = rule({
      speciesNames: ['Largemouth bass', 'Shoal bass'],
      dailyLimit: 5,
      limitBasis: 'per_species',
    });
    expect(limitPhrase(r)).toBe('5/day each');
  });

  it('needs no qualifier for a single species, where there is nothing to confuse', () => {
    expect(limitPhrase(rule({ dailyLimit: 8 }))).toBe('8/day');
  });
});

describe('the four daily-limit answers stay four', () => {
  it('reports no limit as an answer', () => {
    expect(limitPhrase(rule({ dailyLimitKind: 'no_limit', dailyLimit: null }))).toBe('No daily limit');
  });

  it('reports prohibited plainly', () => {
    expect(limitPhrase(rule({ dailyLimitKind: 'prohibited', dailyLimit: 0 }))).toBe('May not be taken');
  });

  it('says NOTHING when the limit is unknown, because silence is not permission', () => {
    // The bug: a gear-rules page states no limits, and "unknown" renders as
    // "No daily limit" -- which tells someone they may keep as many as they like.
    expect(limitPhrase(rule({ dailyLimitKind: 'unknown', dailyLimit: null }))).toBeNull();
  });

  it('says nothing for a count with no number, rather than inventing one', () => {
    expect(limitPhrase(rule({ dailyLimitKind: 'count', dailyLimit: null }))).toBeNull();
  });
});

describe('a rule window is not a season', () => {
  const dh = rule({ effectiveFrom: '2026-11-01', effectiveTo: '2027-05-14' });

  it('is in force inside a window that wraps the new year', () => {
    // Georgia's delayed harvest. A naive from <= d <= to is wrong half the year.
    expect(ruleInForce(dh, '2026-11-21')).toBe(true);
    expect(ruleInForce(dh, '2026-12-25')).toBe(true);
    expect(ruleInForce(dh, '2027-01-02')).toBe(true);
    expect(ruleInForce(dh, '2027-05-14')).toBe(true);
  });

  it('is not in force outside it', () => {
    expect(ruleInForce(dh, '2027-05-15')).toBe(false);
    expect(ruleInForce(dh, '2027-08-01')).toBe(false);
    expect(ruleInForce(dh, '2026-10-31')).toBe(false);
  });

  it('applies all year when there is no window, which is the common case', () => {
    expect(ruleInForce(rule(), '2026-06-15')).toBe(true);
    expect(ruleInForce(rule({ effectiveFrom: '2026-11-01', effectiveTo: null }), '2026-06-15')).toBe(true);
  });

  it('handles a window inside one year too', () => {
    const summer = rule({ effectiveFrom: '2026-06-01', effectiveTo: '2026-08-31' });
    expect(ruleInForce(summer, '2026-07-04')).toBe(true);
    expect(ruleInForce(summer, '2026-09-01')).toBe(false);
  });

  it('prints the window as dates, never as a closure', () => {
    expect(windowPhrase(dh)).toBe('Nov 1 – May 14');
    expect(windowPhrase(rule())).toBeNull();
  });
});

describe('sizes and trophies', () => {
  it('formats a length without trailing zeros', () => {
    expect(inches(22)).toBe('22"');
    expect(inches(14.5)).toBe('14.5"');
    expect(inches(null)).toBeNull();
  });

  it.each([
    ['minimum', { sizeRule: 'minimum' as const, minLengthInches: 22 }, '22" minimum'],
    ['maximum', { sizeRule: 'maximum' as const, maxLengthInches: 16 }, '16" maximum'],
    ['slot_release', { sizeRule: 'slot_release' as const, minLengthInches: 18, maxLengthInches: 24 }, 'release 18"–24"'],
    ['slot_keep', { sizeRule: 'slot_keep' as const, minLengthInches: 14, maxLengthInches: 18 }, 'keep 14"–18" only'],
  ])('reads a %s rule', (_label, over, expected) => {
    expect(sizePhrase(rule(over))).toBe(expected);
  });

  it('says nothing when the rule does not address size', () => {
    expect(sizePhrase(rule({ sizeRule: 'unknown' }))).toBeNull();
  });

  it('SAYS SO when the source states there is no size limit', () => {
    // These two were the same value until migration 20261212000000. While
    // they were, Lake Burton -- which Georgia names as having no minimum on
    // largemouth against a statewide 12" -- rendered a blank subtitle, so
    // the only largemouth size rule visible in the app was the very one that
    // lake exists to cancel.
    expect(sizePhrase(rule({ sizeRule: 'none' }))).toBe('No size limit');
  });

  it('will not print a slot with only one end of it', () => {
    expect(sizePhrase(rule({ sizeRule: 'slot_release', minLengthInches: 18, maxLengthInches: null }))).toBeNull();
  });

  it('measures a trophy allowance against its length', () => {
    expect(trophyPhrase(rule({ trophyAllowance: 2, trophyMinLengthInches: 22 }))).toBe('only 2 over 22"');
  });

  it('does not invent a length when the allowance has none', () => {
    expect(trophyPhrase(rule({ trophyAllowance: 2, trophyMinLengthInches: null }))).toBe('only 2 oversize');
  });
});

describe('restrictions and the whole subtitle', () => {
  it('reads delayed harvest the way the regulation does', () => {
    expect(restrictionPhrase(['catch_and_release', 'artificial_only', 'single_hook'])).toBe(
      'catch & release · artificial lures only · single hook',
    );
  });

  it('says nothing when there are none', () => {
    expect(restrictionPhrase([])).toBeNull();
  });

  it('builds the real Georgia striped bass row', () => {
    const r = rule({
      speciesNames: ['Hybrid striped bass', 'Striped bass', 'White bass'],
      dailyLimit: 15,
      limitBasis: 'aggregate',
      trophyAllowance: 2,
      trophyMinLengthInches: 22,
    });
    expect(ruleSubtitle(r)).toBe('15/day combined · only 2 over 22"');
  });

  it('builds the real Amicalola delayed-harvest row, which states no limit', () => {
    const r = rule({
      speciesNames: ['Brook trout', 'Brown trout', 'Rainbow trout'],
      dailyLimitKind: 'unknown',
      dailyLimit: null,
      restrictions: ['catch_and_release', 'artificial_only', 'single_hook'],
      effectiveFrom: '2026-11-01',
      effectiveTo: '2027-05-14',
    });
    // No invented limit, and the restrictions carry the row.
    expect(ruleSubtitle(r)).toBe('catch & release · artificial lures only · single hook');
  });
});

describe('speciesPhrase', () => {
  it('lists up to three, then counts', () => {
    expect(speciesPhrase(['Rainbow trout'])).toBe('Rainbow trout');
    expect(speciesPhrase(['Brook trout', 'Brown trout'])).toBe('Brook trout & brown trout');
    expect(speciesPhrase(['Brook trout', 'Brown trout', 'Rainbow trout'])).toBe(
      'Brook trout, brown trout & rainbow trout',
    );
    expect(speciesPhrase(['Bluegill', 'Flier', 'Redear sunfish', 'Warmouth', 'Rock bass'])).toBe(
      'Bluegill, flier & 3 more',
    );
  });

  it('is empty for no species rather than printing a stray conjunction', () => {
    expect(speciesPhrase([])).toBe('');
    expect(speciesPhrase(['  '])).toBe('');
  });
});
