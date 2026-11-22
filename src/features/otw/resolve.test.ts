/**
 * State -> Water -> Fish, the merge step.
 *
 * The cases are Georgia's real ones, read out of production on 2026-11-22,
 * because the bug this code fixes was a real pair of numbers on a real lake.
 */
import { describe, expect, it } from 'vitest';
import {
  resolveSpeciesAtWater,
  speciesCovered,
  statesLimit,
  statesSize,
} from './resolve';
import type { FishingRuleWithRefs } from './queries';

function rule(partial: Partial<FishingRuleWithRefs> & { id: string }): FishingRuleWithRefs {
  return {
    waterName: null,
    waterSlug: null,
    extentNote: null,
    speciesNames: ['Largemouth bass'],
    limitBasis: 'aggregate',
    dailyLimitKind: 'unknown',
    dailyLimit: null,
    sizeRule: 'unknown',
    minLengthInches: null,
    maxLengthInches: null,
    trophyAllowance: null,
    trophyMinLengthInches: null,
    restrictions: [],
    effectiveFrom: null,
    effectiveTo: null,
    ...partial,
  } as FishingRuleWithRefs;
}

/* Georgia, as production holds it. */
const SW_BASS_CREEL = rule({
  id: 'sw-creel',
  speciesNames: ['Largemouth bass', 'Shoal bass', 'Smallmouth bass'],
  dailyLimitKind: 'count',
  dailyLimit: 10,
  limitBasis: 'aggregate',
});
const SW_BASS_SUBLIMIT = rule({
  id: 'sw-sublimit',
  speciesNames: ['Shoal bass', 'Smallmouth bass'],
  dailyLimitKind: 'count',
  dailyLimit: 5,
  limitBasis: 'aggregate',
});
const SW_BASS_SIZE = rule({
  id: 'sw-size',
  speciesNames: ['Largemouth bass'],
  sizeRule: 'minimum',
  minLengthInches: 12,
});
const SW_GEAR = rule({
  id: 'sw-gear',
  speciesNames: ['Largemouth bass'],
  restrictions: ['one_pole_handheld'],
});

const LANIER_SIZE = rule({
  id: 'lanier',
  speciesNames: ['Largemouth bass'],
  sizeRule: 'minimum',
  minLengthInches: 14,
});
const BURTON_NO_MIN = rule({
  id: 'burton',
  speciesNames: ['Largemouth bass'],
  sizeRule: 'none',
});
/** The Buford Dam reach: a daylight-hours rule that says nothing about size. */
const BUFORD_HOURS = rule({
  id: 'buford',
  speciesNames: ['Largemouth bass'],
  sizeRule: 'unknown',
  dailyLimitKind: 'unknown',
  restrictions: ['daylight_only', 'no_night_fishing'],
});

const STATEWIDE = [SW_BASS_CREEL, SW_BASS_SUBLIMIT, SW_BASS_SIZE, SW_GEAR];

describe('statesSize / statesLimit', () => {
  it('treats `none` as a STATEMENT, not silence', () => {
    // The whole point of migration 20261212000000. "There is no size limit
    // here" cancels a statewide minimum; only `unknown` defers to it.
    expect(statesSize(BURTON_NO_MIN)).toBe(true);
    expect(statesSize(BUFORD_HOURS)).toBe(false);
    expect(statesSize(LANIER_SIZE)).toBe(true);
  });

  it('treats prohibited and no_limit as statements too', () => {
    expect(statesLimit(rule({ id: 'a', dailyLimitKind: 'prohibited', dailyLimit: 0 }))).toBe(true);
    expect(statesLimit(rule({ id: 'b', dailyLimitKind: 'no_limit' }))).toBe(true);
    expect(statesLimit(rule({ id: 'c', dailyLimitKind: 'unknown' }))).toBe(false);
  });
});

describe('resolveSpeciesAtWater -- size', () => {
  it('a water minimum beats the statewide one (Lake Lanier, 14" over 12")', () => {
    const out = resolveSpeciesAtWater('Largemouth bass', STATEWIDE, [LANIER_SIZE]);
    expect(out.governingSize?.rule.id).toBe('lanier');
    expect(out.governingSize?.origin).toBe('water');
    expect(out.governingSize?.rule.minLengthInches).toBe(14);
  });

  it('RETURNS the displaced statewide rule rather than dropping it', () => {
    // So the screen can say "Georgia's 12" minimum does not apply here"
    // instead of silently disagreeing with the statewide card.
    const out = resolveSpeciesAtWater('Largemouth bass', STATEWIDE, [LANIER_SIZE]);
    expect(out.supersededSize.map((a) => a.rule.id)).toEqual(['sw-size']);
  });

  it('a water saying NO minimum cancels the statewide minimum (Lake Burton)', () => {
    const out = resolveSpeciesAtWater('Largemouth bass', STATEWIDE, [BURTON_NO_MIN]);
    expect(out.governingSize?.rule.id).toBe('burton');
    expect(out.governingSize?.rule.sizeRule).toBe('none');
    expect(out.supersededSize.map((a) => a.rule.id)).toEqual(['sw-size']);
  });

  it('A WATER RULE THAT IS SILENT ON SIZE LEAVES THE STATEWIDE MINIMUM STANDING', () => {
    // The dangerous direction, and the reason `unknown` had to exist. The
    // Buford Dam reach regulates hours, not size. If its `unknown` were
    // treated as "no size limit", the app would report no minimum on trout
    // water where the statewide limits apply in full.
    const out = resolveSpeciesAtWater('Largemouth bass', STATEWIDE, [BUFORD_HOURS]);
    expect(out.governingSize?.rule.id).toBe('sw-size');
    expect(out.governingSize?.origin).toBe('statewide');
    expect(out.governingSize?.rule.minLengthInches).toBe(12);
    expect(out.supersededSize).toEqual([]);
  });

  it('is null when nothing anywhere states a size', () => {
    const out = resolveSpeciesAtWater('Largemouth bass', [SW_BASS_CREEL], [BUFORD_HOURS]);
    expect(out.governingSize).toBeNull();
  });
});

describe('resolveSpeciesAtWater -- limits', () => {
  it('KEEPS BOTH NESTED STATEWIDE LIMITS, because they are two real numbers', () => {
    // "10 black bass per day, of which only 5 may be shoal or smallmouth."
    // Flattening to one would delete half the regulation.
    const out = resolveSpeciesAtWater('Shoal bass', STATEWIDE, []);
    expect(out.limits.map((a) => a.rule.id).sort()).toEqual(['sw-creel', 'sw-sublimit']);
  });

  it('gives a species outside the sub-limit only the limit that covers it', () => {
    const out = resolveSpeciesAtWater('Largemouth bass', STATEWIDE, []);
    expect(out.limits.map((a) => a.rule.id)).toEqual(['sw-creel']);
  });

  it('a water limit replaces EVERY statewide limit', () => {
    // Lake Richard B. Russell: two striped bass per day. The statewide 15 is
    // gone there, not reduced, and both nested statewide rules must go with it.
    const russell = rule({
      id: 'russell',
      speciesNames: ['Shoal bass'],
      dailyLimitKind: 'count',
      dailyLimit: 2,
    });
    const out = resolveSpeciesAtWater('Shoal bass', STATEWIDE, [russell]);
    expect(out.limits.map((a) => a.rule.id)).toEqual(['russell']);
    expect(out.supersededLimits.map((a) => a.rule.id).sort()).toEqual([
      'sw-creel',
      'sw-sublimit',
    ]);
  });

  it('a water rule silent on limits leaves the statewide ones alone', () => {
    const out = resolveSpeciesAtWater('Largemouth bass', STATEWIDE, [BUFORD_HOURS]);
    expect(out.limits.map((a) => a.rule.id)).toEqual(['sw-creel']);
    expect(out.supersededLimits).toEqual([]);
  });
});

describe('resolveSpeciesAtWater -- restrictions', () => {
  it('UNIONS them; a water restriction adds to the statewide one', () => {
    const out = resolveSpeciesAtWater('Largemouth bass', STATEWIDE, [BUFORD_HOURS]);
    expect(out.restrictions).toEqual([
      'daylight_only',
      'no_night_fishing',
      'one_pole_handheld',
    ]);
  });

  it('keeps the restrictions of a rule that LOST on size', () => {
    // Burton removes the minimum. It does not switch off the statewide gear
    // rules, and a rule displaced on one field still binds on its own terms.
    const out = resolveSpeciesAtWater('Largemouth bass', STATEWIDE, [BURTON_NO_MIN]);
    expect(out.restrictions).toEqual(['one_pole_handheld']);
  });

  it('dedupes when both levels say the same thing', () => {
    const waterGear = rule({ id: 'w', restrictions: ['one_pole_handheld'] });
    const out = resolveSpeciesAtWater('Largemouth bass', STATEWIDE, [waterGear]);
    expect(out.restrictions).toEqual(['one_pole_handheld']);
  });
});

describe('resolveSpeciesAtWater -- species matching', () => {
  it('is case- and whitespace-insensitive', () => {
    expect(resolveSpeciesAtWater('  largemouth BASS ', STATEWIDE, []).empty).toBe(false);
  });

  it('does not match on a substring', () => {
    // "bass" must not drag in every bass rule as though it were a species.
    expect(resolveSpeciesAtWater('bass', STATEWIDE, []).empty).toBe(true);
  });

  it('reports empty for a species nothing mentions', () => {
    const out = resolveSpeciesAtWater('Muskellunge', STATEWIDE, [LANIER_SIZE]);
    expect(out.empty).toBe(true);
    expect(out.limits).toEqual([]);
    expect(out.governingSize).toBeNull();
  });

  it('answers from statewide alone when the water has no row at all', () => {
    // The ordinary case: `waters` is an exceptions table, so most waters a
    // reader looks for -- Lake Sinclair among them -- have no rules.
    const out = resolveSpeciesAtWater('Largemouth bass', STATEWIDE);
    expect(out.empty).toBe(false);
    expect(out.governingSize?.origin).toBe('statewide');
    expect(out.limits.map((a) => a.rule.id)).toEqual(['sw-creel']);
  });
});

describe('speciesCovered', () => {
  it('lists every species across both levels, deduped and sorted', () => {
    expect(speciesCovered(STATEWIDE, [LANIER_SIZE])).toEqual([
      'Largemouth bass',
      'Shoal bass',
      'Smallmouth bass',
    ]);
  });

  it('handles no rules at all', () => {
    expect(speciesCovered([], [])).toEqual([]);
  });
});

/**
 * Lake Lindsay Grace: two size rules on one water, and only one of them
 * carries numbers. Read out of production 2026-11-22.
 */
const GRACE_SLOT = rule({
  id: 'grace-slot',
  waterSlug: 'lake-lindsay-grace',
  speciesNames: ['Largemouth bass'],
  sizeRule: 'slot_release',
  minLengthInches: 15,
  maxLengthInches: 22,
});
const GRACE_TROPHY = rule({
  id: 'grace-trophy',
  waterSlug: 'lake-lindsay-grace',
  speciesNames: ['Largemouth bass'],
  sizeRule: 'see_notes',
  trophyAllowance: 1,
  trophyMinLengthInches: 22,
});

describe('two size rules on one water', () => {
  it('LETS THE RULE WITH NUMBERS GOVERN, WHICHEVER ORDER THEY ARRIVE IN', () => {
    // This was arbitrary: governingSize was waterSize[0], so the winner was
    // whatever Postgres returned first. Half the time Lake Lindsay Grace
    // read "special size rule" and the 15-22 inch slot -- the part that
    // tells a reader which fish to put back -- was gone from the screen.
    for (const order of [
      [GRACE_SLOT, GRACE_TROPHY],
      [GRACE_TROPHY, GRACE_SLOT],
    ]) {
      const out = resolveSpeciesAtWater('Largemouth bass', STATEWIDE, order);
      expect(out.governingSize?.rule.id).toBe('grace-slot');
      expect(out.governingSize?.origin).toBe('water');
    }
  });

  it('SHOWS THE LOSER AS DISPLACED RATHER THAN DROPPING IT', () => {
    // supersededSize used to hold statewide rules only, so a water rule that
    // lost on size vanished without trace -- no heading, no "superseded",
    // nothing. A reader could not tell the app held it.
    const out = resolveSpeciesAtWater('Largemouth bass', STATEWIDE, [GRACE_SLOT, GRACE_TROPHY]);
    const ids = out.supersededSize.map((a) => a.rule.id);
    expect(ids).toContain('grace-trophy');
    expect(ids).toContain('sw-size');
  });

  it('keeps a water rule that says "no size limit" ahead of nothing at all', () => {
    // `none` is a statement and must still beat see_notes-with-no-numbers.
    const noLimit = rule({
      id: 'grace-none',
      waterSlug: 'lake-lindsay-grace',
      speciesNames: ['Largemouth bass'],
      sizeRule: 'none',
    });
    const out = resolveSpeciesAtWater('Largemouth bass', STATEWIDE, [GRACE_TROPHY, noLimit]);
    expect(out.governingSize?.rule.id).toBe('grace-none');
  });

  it('does not reorder a single water rule, or an empty set', () => {
    expect(
      resolveSpeciesAtWater('Largemouth bass', STATEWIDE, [GRACE_TROPHY]).governingSize?.rule.id,
    ).toBe('grace-trophy');
    expect(
      resolveSpeciesAtWater('Largemouth bass', STATEWIDE, []).governingSize?.rule.id,
    ).toBe('sw-size');
  });
});
