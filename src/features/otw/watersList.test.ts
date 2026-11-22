/**
 * The Waters tab's grouping and search.
 *
 * The rule under test throughout: a water or a rule we hold is never dropped
 * to make the screen look tidier. A statewide rule has no water to sit under
 * and a water may have no rules yet; both are facts about Georgia's published
 * set, not gaps.
 */
import { describe, expect, it } from 'vitest';
import {
  buildWatersList,
  filterWatersList,
  waterCount,
  waterSubtitle,
} from './watersList';
import type { FishingRuleWithRefs } from './queries';
import type { WaterRow } from '@/lib/database.types';

function water(partial: Partial<WaterRow> & { name: string; slug: string }): WaterRow {
  return {
    id: `id-${partial.slug}`,
    state_id: 'ga',
    kind: 'river',
    county: null,
    extent_note: null,
    latitude: null,
    longitude: null,
    parent_water_id: null,
    notes: null,
    source_id: null,
    last_verified_at: null,
    status: 'published',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...partial,
  } as WaterRow;
}

function rule(id: string, waterSlug: string | null): FishingRuleWithRefs {
  return {
    id,
    waterName: waterSlug,
    waterSlug,
    extentNote: null,
    speciesNames: ['Rainbow Trout'],
    limitBasis: 'per_species',
    dailyLimitKind: 'count',
    dailyLimit: 8,
    sizeRule: 'none',
    minLengthInches: null,
    maxLengthInches: null,
    trophyAllowance: null,
    trophyMinLengthInches: null,
    restrictions: [],
    effectiveFrom: null,
    effectiveTo: null,
  } as FishingRuleWithRefs;
}

const HOOCH = water({ name: 'Chattahoochee River', slug: 'chattahoochee-river' });
const SMITH = water({ name: 'Smith Creek', slug: 'smith-creek', kind: 'creek', county: 'White' });
const LANIER = water({ name: 'Lake Lanier', slug: 'lake-lanier', kind: 'lake' });
const STMARYS = water({ name: 'St. Mary’s River', slug: 'st-marys-river' });

describe('buildWatersList', () => {
  it('separates the three parts', () => {
    const list = buildWatersList(
      [HOOCH, SMITH, LANIER],
      [rule('r1', 'chattahoochee-river'), rule('r2', 'smith-creek'), rule('r3', null)],
    );
    expect(list.regulated.map((r) => r.water.slug)).toEqual([
      'chattahoochee-river',
      'smith-creek',
    ]);
    expect(list.alsoListed.map((w) => w.slug)).toEqual(['lake-lanier']);
    expect(list.statewide.map((r) => r.id)).toEqual(['r3']);
  });

  it('keeps a water that has no rules rather than hiding it', () => {
    const list = buildWatersList([HOOCH, LANIER], [rule('r1', 'chattahoochee-river')]);
    expect(waterCount(list)).toBe(2);
    expect(list.alsoListed).toHaveLength(1);
  });

  it('counts a rule whose water did not come back as statewide, not as lost', () => {
    // The two queries are separate and RLS applies to each, so a published
    // rule can arrive without its water. The rule is still real.
    const list = buildWatersList([HOOCH], [rule('r1', 'a-water-we-did-not-get')]);
    expect(list.statewide.map((r) => r.id)).toEqual(['r1']);
    expect(list.regulated).toHaveLength(0);
  });

  it('gathers every rule on one water under it', () => {
    const list = buildWatersList(
      [HOOCH],
      [rule('r1', 'chattahoochee-river'), rule('r2', 'chattahoochee-river')],
    );
    expect(list.regulated).toHaveLength(1);
    expect(list.regulated[0].rules.map((r) => r.id)).toEqual(['r1', 'r2']);
  });

  it('sorts alphabetically ignoring punctuation', () => {
    const list = buildWatersList([STMARYS, SMITH, LANIER], []);
    expect(list.alsoListed.map((w) => w.name)).toEqual([
      'Lake Lanier',
      'Smith Creek',
      'St. Mary’s River',
    ]);
  });

  it('handles an empty state without throwing', () => {
    const list = buildWatersList([], []);
    expect(list).toEqual({ statewide: [], regulated: [], alsoListed: [] });
    expect(waterCount(list)).toBe(0);
  });
});

describe('filterWatersList', () => {
  const list = buildWatersList(
    [HOOCH, SMITH, LANIER],
    [rule('r1', 'chattahoochee-river'), rule('r2', null)],
  );

  it('returns everything for an empty query', () => {
    expect(filterWatersList(list, '')).toBe(list);
    expect(filterWatersList(list, '   ')).toBe(list);
  });

  it('matches a name, case-insensitively and part-way', () => {
    const out = filterWatersList(list, 'chatta');
    expect(out.regulated.map((r) => r.water.slug)).toEqual(['chattahoochee-river']);
    expect(out.alsoListed).toHaveLength(0);
  });

  it('matches a county and a kind', () => {
    expect(filterWatersList(list, 'white').alsoListed.map((w) => w.slug)).toEqual(['smith-creek']);
    expect(filterWatersList(list, 'lake').alsoListed.map((w) => w.slug)).toEqual(['lake-lanier']);
  });

  it('matches across punctuation, so "st marys" finds "St. Mary’s"', () => {
    const wide = buildWatersList([STMARYS], []);
    expect(filterWatersList(wide, 'st marys').alsoListed).toHaveLength(1);
    expect(filterWatersList(wide, "st mary's").alsoListed).toHaveLength(1);
  });

  it('DROPS statewide rules while searching', () => {
    // They are not a water, so they cannot match a water search. Pinning them
    // to the top of every result would make a search for "lanier" look like
    // it had found rules it had not.
    expect(filterWatersList(list, 'lanier').statewide).toEqual([]);
    expect(list.statewide).toHaveLength(1);
  });

  it('returns nothing matchable as an empty list, not as everything', () => {
    const out = filterWatersList(list, 'zzzzz');
    expect(waterCount(out)).toBe(0);
  });
});

describe('waterSubtitle', () => {
  it('joins what is known and skips what is not', () => {
    expect(waterSubtitle(SMITH)).toBe('Creek · White County');
    expect(waterSubtitle(LANIER)).toBe('Lake');
  });

  it('shows the state’s own extent wording verbatim', () => {
    const w = water({
      name: 'Chattahoochee River',
      slug: 'hooch-dh',
      extent_note: 'Sope Creek to US Hwy 41',
    });
    expect(waterSubtitle(w)).toBe('River · Sope Creek to US Hwy 41');
  });
});
