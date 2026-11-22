/**
 * State -> Water -> Fish, the screen's data.
 *
 * The fixtures are Georgia's real rules, read out of production 2026-11-22,
 * because every bug this module exists to prevent was a real pair of numbers
 * on a real lake.
 */
import { describe, expect, it } from 'vitest';
import {
  answeredSpecies,
  buildWaterDetail,
  rulesForWater,
  statewideRules,
  waterStanding,
} from './waterDetail';
import type { FishingRuleWithRefs } from './queries';
import type { WaterRow } from '@/lib/database.types';

function water(partial: Partial<WaterRow> & { name: string; slug: string }): WaterRow {
  return {
    id: `id-${partial.slug}`,
    state_id: 'ga',
    kind: 'lake',
    county: null,
    extent_note: null,
    latitude: null,
    longitude: null,
    parent_water_id: null,
    notes: null,
    source_id: null,
    last_verified_at: '2026-11-22T00:00:00Z',
    rules_complete_at: null,
    status: 'published',
    usgs_site_no: null,
    wadeable_cfs_max: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...partial,
  } as WaterRow;
}

function rule(
  partial: Partial<FishingRuleWithRefs> & { id: string },
): FishingRuleWithRefs {
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

/* Georgia statewide, as production holds it. */
const SW_BASS_LIMIT = rule({
  id: 'sw-bass-limit',
  speciesNames: ['Largemouth bass', 'Shoal bass', 'Smallmouth bass'],
  dailyLimitKind: 'count',
  dailyLimit: 10,
});
const SW_BASS_SIZE = rule({
  id: 'sw-bass-size',
  speciesNames: ['Largemouth bass'],
  sizeRule: 'minimum',
  minLengthInches: 12,
});
const SW_CRAPPIE = rule({
  id: 'sw-crappie',
  speciesNames: ['Black crappie', 'White crappie'],
  dailyLimitKind: 'count',
  dailyLimit: 30,
});
const SW_TROUT = rule({
  id: 'sw-trout',
  speciesNames: ['Brook trout', 'Brown trout', 'Rainbow trout'],
  dailyLimitKind: 'count',
  dailyLimit: 8,
});
const STATEWIDE = [SW_BASS_LIMIT, SW_BASS_SIZE, SW_CRAPPIE, SW_TROUT];

/* Lake Burton: one rule, and it REMOVES a statewide minimum. */
const BURTON = water({
  name: 'Lake Burton',
  slug: 'lake-burton',
  rules_complete_at: '2026-11-22T00:00:00Z',
});
const BURTON_RULE = rule({
  id: 'burton',
  waterSlug: 'lake-burton',
  waterName: 'Lake Burton',
  speciesNames: ['Largemouth bass'],
  sizeRule: 'none',
});

/* Lake Sinclair: checked against every exception list, on none of them. */
const SINCLAIR = water({
  name: 'Lake Sinclair',
  slug: 'lake-sinclair',
  kind: 'reservoir',
  rules_complete_at: '2026-11-22T00:00:00Z',
});

/* Ocmulgee PFA: no rules held, and no claim. Largemouth is really
   catch-and-release there, which is exactly what we cannot say. */
const OCMULGEE_PFA = water({ name: 'Ocmulgee', slug: 'ocmulgee' });

describe('waterStanding', () => {
  it('calls a water with rules regulated, claim or no claim', () => {
    expect(waterStanding(BURTON, [BURTON_RULE])).toBe('regulated');
    expect(waterStanding(OCMULGEE_PFA, [BURTON_RULE])).toBe('regulated');
  });

  it('calls a checked water with no rules statewideOnly', () => {
    expect(waterStanding(SINCLAIR, [])).toBe('statewideOnly');
  });

  it('CALLS AN UNCHECKED WATER UNREAD, WHICH IS THE SAFE DEFAULT', () => {
    // The whole reason rules_complete_at exists. Ocmulgee PFA has no rules in
    // our table and largemouth bass are catch-and-release there. Reading that
    // silence as "we checked" would show the statewide limit of ten.
    expect(waterStanding(OCMULGEE_PFA, [])).toBe('unread');
  });

  it('never reads a falsy claim as a claim', () => {
    for (const value of [null, undefined, '']) {
      expect(waterStanding({ rules_complete_at: value as string | null }, [])).toBe('unread');
    }
  });
});

describe('buildWaterDetail', () => {
  it('LISTS EVERY SPECIES, not only the one the water names', () => {
    // Burton carries one rule. A screen showing only that would imply Burton
    // has no crappie limit and no trout limit. It has Georgia's.
    const detail = buildWaterDetail(BURTON, STATEWIDE, [BURTON_RULE]);
    expect(detail.species.map((e) => e.species)).toEqual([
      'Largemouth bass', // water-specific, so first
      'Black crappie',
      'Brook trout',
      'Brown trout',
      'Rainbow trout',
      'Shoal bass',
      'Smallmouth bass',
      'White crappie',
    ]);
  });

  it('puts the species the water regulates first, whatever the alphabet says', () => {
    const detail = buildWaterDetail(BURTON, STATEWIDE, [BURTON_RULE]);
    expect(detail.species[0]).toMatchObject({
      species: 'Largemouth bass',
      waterSpecific: true,
    });
    expect(detail.species.slice(1).every((e) => !e.waterSpecific)).toBe(true);
  });

  it('resolves the water rule over the statewide one, and keeps what it displaced', () => {
    const detail = buildWaterDetail(BURTON, STATEWIDE, [BURTON_RULE]);
    const bass = detail.species[0].resolved;
    // Burton states there is NO minimum. That cancels Georgia's 12 inches.
    expect(bass.governingSize?.rule.id).toBe('burton');
    expect(bass.governingSize?.origin).toBe('water');
    expect(bass.supersededSize.map((a) => a.rule.id)).toEqual(['sw-bass-size']);
    // The creel limit is untouched: Burton said nothing about how many.
    expect(bass.limits.map((a) => a.rule.id)).toEqual(['sw-bass-limit']);
  });

  it('answers a water with no rules entirely from the statewide set', () => {
    // Lake Sinclair. Every species, every answer, origin statewide -- and the
    // 12-inch largemouth minimum present rather than missing.
    const detail = buildWaterDetail(SINCLAIR, STATEWIDE, []);
    expect(detail.standing).toBe('statewideOnly');
    expect(detail.species).toHaveLength(8);
    expect(detail.species.every((e) => !e.waterSpecific)).toBe(true);

    const bass = detail.species.find((e) => e.species === 'Largemouth bass')!;
    expect(bass.resolved.governingSize?.origin).toBe('statewide');
    expect(bass.resolved.governingSize?.rule.minLengthInches).toBe(12);
    expect(bass.resolved.limits.map((a) => a.rule.id)).toEqual(['sw-bass-limit']);
  });

  it('gives an unread water the same answers and a different standing', () => {
    // This is the pair that matters. The DATA is identical -- no rules, so the
    // statewide set is all there is to show. Only the standing differs, and
    // the screen must carry that difference because the numbers cannot.
    const checked = buildWaterDetail(SINCLAIR, STATEWIDE, []);
    const unread = buildWaterDetail(OCMULGEE_PFA, STATEWIDE, []);

    expect(checked.species.map((e) => e.species)).toEqual(
      unread.species.map((e) => e.species),
    );
    expect(checked.standing).toBe('statewideOnly');
    expect(unread.standing).toBe('unread');
  });

  it('handles a state with no statewide rules at all', () => {
    const detail = buildWaterDetail(BURTON, [], [BURTON_RULE]);
    expect(detail.species.map((e) => e.species)).toEqual(['Largemouth bass']);
    expect(detail.species[0].resolved.governingSize?.origin).toBe('water');
  });

  it('handles a water with nothing anywhere', () => {
    const detail = buildWaterDetail(SINCLAIR, [], []);
    expect(detail.species).toEqual([]);
    expect(detail.standing).toBe('statewideOnly');
    expect(answeredSpecies(detail)).toBe(0);
  });
});

describe('answeredSpecies', () => {
  it('counts species, not rules', () => {
    // Eight species across four statewide rules plus one water rule. "17
    // rules" is a fact about our table; "8 species" is a fact about the lake.
    const detail = buildWaterDetail(BURTON, STATEWIDE, [BURTON_RULE]);
    expect(answeredSpecies(detail)).toBe(8);
  });
});

describe('rulesForWater / statewideRules', () => {
  const ALL = [...STATEWIDE, BURTON_RULE, rule({ id: 'orphan', waterSlug: 'a-water-we-lack' })];
  const known = new Set(['lake-burton', 'lake-sinclair']);

  it('picks out one water’s rules', () => {
    expect(rulesForWater(BURTON, ALL).map((r) => r.id)).toEqual(['burton']);
    expect(rulesForWater(SINCLAIR, ALL)).toEqual([]);
  });

  it('counts a rule whose water we did not receive as statewide, not as lost', () => {
    // The two queries are separate and RLS applies to each, so a published
    // rule can arrive without its water. Dropping it would hide a real rule;
    // buildWatersList makes the same call for the same reason.
    expect(statewideRules(ALL, known).map((r) => r.id)).toEqual([
      'sw-bass-limit',
      'sw-bass-size',
      'sw-crappie',
      'sw-trout',
      'orphan',
    ]);
  });

  it('does not let a water’s own rules leak into the statewide set', () => {
    expect(statewideRules(ALL, known).some((r) => r.id === 'burton')).toBe(false);
  });
});
