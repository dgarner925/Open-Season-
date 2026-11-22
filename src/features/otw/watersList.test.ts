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
  statewideFallback,
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
    rules_complete_at: null,
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
/** Checked against every exception list Georgia publishes, and on none of them. */
const SINCLAIR = water({
  name: 'Lake Sinclair',
  slug: 'lake-sinclair',
  kind: 'reservoir',
  rules_complete_at: '2026-11-22T00:00:00Z',
});
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
    expect(list.notTranscribed.map((w) => w.slug)).toEqual(['lake-lanier']);
    expect(list.statewide.map((r) => r.id)).toEqual(['r3']);
  });

  it('keeps a water that has no rules rather than hiding it', () => {
    const list = buildWatersList([HOOCH, LANIER], [rule('r1', 'chattahoochee-river')]);
    expect(waterCount(list)).toBe(2);
    expect(list.notTranscribed).toHaveLength(1);
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
    expect(list.notTranscribed.map((w) => w.name)).toEqual([
      'Lake Lanier',
      'Smith Creek',
      'St. Mary’s River',
    ]);
  });

  it('puts every water in notTranscribed when no rules are passed, which is why the caller must wait', () => {
    // This is CORRECT for the function and a trap for its caller. `waters`
    // and `fishing_rules` are separate queries; when waters resolved first,
    // the Waters tab rendered all 63 Georgia waters under "We have not
    // transcribed rules for them yet, so check the regulations before you
    // fish one" -- false for 47 of them.
    //
    // The function cannot tell "no rules exist" from "rules have not arrived"
    // and must not try: an empty array is an empty array. The screen is what
    // knows, so app/(otw)/waters.tsx renders nothing until both queries land.
    // This test pins the behaviour that makes that gate necessary.
    const list = buildWatersList([HOOCH, SMITH, LANIER], []);
    expect(list.notTranscribed).toHaveLength(3);
    expect(list.regulated).toHaveLength(0);
    expect(list.statewide).toHaveLength(0);
  });

  it('handles an empty state without throwing', () => {
    const list = buildWatersList([], []);
    expect(list).toEqual({
      statewide: [],
      regulated: [],
      noExceptions: [],
      notTranscribed: [],
    });
    expect(waterCount(list)).toBe(0);
  });
});

describe('a water with no rules: which kind of nothing', () => {
  it('puts a CHECKED water under noExceptions, not under "not read yet"', () => {
    // Lake Sinclair. Georgia publishes no exception for it, somebody read all
    // six exception lists to establish that, and the statewide rules are the
    // complete answer. Filing it as unread would throw that work away and
    // send the reader to the regulations for nothing.
    const list = buildWatersList([SINCLAIR], []);
    expect(list.noExceptions.map((w) => w.slug)).toEqual(['lake-sinclair']);
    expect(list.notTranscribed).toEqual([]);
  });

  it('PUTS AN UNCHECKED WATER UNDER notTranscribed, WHICH IS THE SAFE DEFAULT', () => {
    // The dangerous direction, and the reason the column exists. Ocmulgee PFA
    // has no rules in our table and largemouth bass are catch-and-release
    // there. Reading its silence as "no exception exists" would tell a reader
    // the statewide limit of ten applies on a catch-and-release lake.
    const list = buildWatersList([LANIER], []);
    expect(list.notTranscribed.map((w) => w.slug)).toEqual(['lake-lanier']);
    expect(list.noExceptions).toEqual([]);
  });

  it('never treats a falsy claim as a claim', () => {
    // Belt and braces against the shapes a null arrives in from the wire.
    for (const value of [null, undefined, '']) {
      const w = water({
        name: 'Somewhere',
        slug: 'somewhere',
        rules_complete_at: value as string | null,
      });
      const list = buildWatersList([w], []);
      expect(list.noExceptions).toEqual([]);
      expect(list.notTranscribed).toHaveLength(1);
    }
  });

  it('keeps a checked water in `regulated` when it does have rules', () => {
    // Lake Hartwell: checked AND carrying the border-agreement rules. The
    // claim is about completeness, not about being empty, so it must not
    // divert a water away from its own rules.
    const hartwell = water({
      name: 'Lake Hartwell',
      slug: 'lake-hartwell',
      rules_complete_at: '2026-11-22T00:00:00Z',
    });
    const list = buildWatersList([hartwell], [rule('r1', 'lake-hartwell')]);
    expect(list.regulated.map((r) => r.water.slug)).toEqual(['lake-hartwell']);
    expect(list.noExceptions).toEqual([]);
    expect(list.notTranscribed).toEqual([]);
  });

  it('counts and filters across all three groups', () => {
    const list = buildWatersList(
      [HOOCH, SINCLAIR, LANIER],
      [rule('r1', 'chattahoochee-river')],
    );
    expect(waterCount(list)).toBe(3);

    // "lake" matches Lake Sinclair (checked) and Lake Lanier (not), and the
    // two must stay in their own groups through the filter.
    const out = filterWatersList(list, 'lake');
    expect(out.noExceptions.map((w) => w.slug)).toEqual(['lake-sinclair']);
    expect(out.notTranscribed.map((w) => w.slug)).toEqual(['lake-lanier']);
    expect(waterCount(out)).toBe(2);
  });

  it('answers a search that matches only a checked water, so no fallback fires', () => {
    // Sinclair used to be the statewideFallback's whole reason for existing.
    // Now that it has a row, a search for it matches a water, so the fallback
    // must stay quiet -- the row itself says the statewide rules apply.
    const full = buildWatersList([SINCLAIR, HOOCH], [rule('sw', null)]);
    const filtered = filterWatersList(full, 'sinclair');
    expect(waterCount(filtered)).toBe(1);
    expect(statewideFallback(full, filtered, 'sinclair')).toEqual([]);
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
    expect(out.notTranscribed).toHaveLength(0);
  });

  it('matches a county and a kind', () => {
    expect(filterWatersList(list, 'white').notTranscribed.map((w) => w.slug)).toEqual([
      'smith-creek',
    ]);
    expect(filterWatersList(list, 'lake').notTranscribed.map((w) => w.slug)).toEqual([
      'lake-lanier',
    ]);
  });

  it('matches across punctuation, so "st marys" finds "St. Mary’s"', () => {
    const wide = buildWatersList([STMARYS], []);
    expect(filterWatersList(wide, 'st marys').notTranscribed).toHaveLength(1);
    expect(filterWatersList(wide, "st mary's").notTranscribed).toHaveLength(1);
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

describe('statewideFallback', () => {
  const full = buildWatersList(
    [HOOCH, SMITH, LANIER],
    [rule('r1', 'chattahoochee-river'), rule('statewide-1', null)],
  );

  it('answers a search that matched no water with the statewide rules', () => {
    // Lake Sinclair is not in `waters` because Georgia publishes no exception
    // for it -- the regs are statewide rules plus named exceptions. Searching
    // for it used to say "Nothing matching", which reads as "not covered".
    // The statewide rules on this screen ARE its rules.
    const filtered = filterWatersList(full, 'sinclair');
    expect(waterCount(filtered)).toBe(0);
    expect(statewideFallback(full, filtered, 'sinclair').map((r) => r.id)).toEqual([
      'statewide-1',
    ]);
  });

  it('stays silent when the search DID match a water', () => {
    // That water's own rules are the answer. Showing the statewide list
    // underneath would imply the search had found those too.
    const filtered = filterWatersList(full, 'chatta');
    expect(waterCount(filtered)).toBe(1);
    expect(statewideFallback(full, filtered, 'chatta')).toEqual([]);
  });

  it('stays silent when there is no search at all', () => {
    // The unfiltered screen already renders the statewide card at the top.
    expect(statewideFallback(full, full, '')).toEqual([]);
    expect(statewideFallback(full, full, '   ')).toEqual([]);
  });

  it('returns nothing when the state has no statewide rules to offer', () => {
    const bare = buildWatersList([SMITH], []);
    const filtered = filterWatersList(bare, 'sinclair');
    expect(statewideFallback(bare, filtered, 'sinclair')).toEqual([]);
  });
});
