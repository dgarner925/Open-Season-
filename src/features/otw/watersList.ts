/**
 * The Waters tab's shape, as pure data.
 *
 * ---------------------------------------------------------------------------
 * WHY THE LIST IS IN FOUR PARTS AND NOT ONE
 *
 *   statewide        rules that apply wherever you are in the state. They
 *                    have no water to sit under, so a water-shaped list would
 *                    simply lose them.
 *   regulated        a water and the rules read off the agency's pages for it.
 *   noExceptions     a water the state publishes no special rule for. The
 *                    statewide rules above are its complete answer.
 *   notTranscribed   a water the state names and whose rules nobody has read
 *                    yet. There may be rules we do not hold.
 *
 * ---------------------------------------------------------------------------
 * THE LAST TWO USED TO BE ONE PART, AND THAT WAS A LIE ABOUT HALF OF THEM
 *
 * `waters` began as an EXCEPTIONS table. A row existed because the state
 * published something unusual there, so a water with no rules could only mean
 * "named but not yet read", and one heading covered it: "we have not
 * transcribed rules for them yet, so check the regulations before you fish
 * one."
 *
 * Georgia DNR's own list of major lakes and rivers is now in the table too,
 * so a water with no rules has two possible meanings that pull opposite ways:
 *
 *   Lake Sinclair    Checked against all six of Georgia's exception lists and
 *                    on none of them. The statewide rules ARE its rules, and
 *                    saying so is the most useful thing this screen can do.
 *   Ocmulgee PFA     Largemouth bass are catch-and-release there, published on
 *                    the Public Fishing Areas page, and we hold no rule for
 *                    it. A reader told "the statewide rules apply" would be
 *                    told they may keep five.
 *
 * `waters.rules_complete_at` is what separates them -- see migration
 * 20261213000000 -- and this module's only job is to not throw that
 * distinction away on the way to the screen. A null is the cautious value: a
 * water we are unsure about is listed as unread, never as cleared.
 *
 * Neither group is ever dropped. Filtering waters down to those that already
 * have rules would make the screen look finished at the cost of being wrong
 * about what the state regulates.
 */
import type { WaterRow } from '@/lib/database.types';
import type { FishingRuleWithRefs } from './queries';

export type WaterWithRules = {
  water: WaterRow;
  rules: FishingRuleWithRefs[];
};

export type WatersList = {
  /** Rules with no water. Applies everywhere in the state. */
  statewide: FishingRuleWithRefs[];
  /** Waters we hold rules for, alphabetical. */
  regulated: WaterWithRules[];
  /**
   * Waters with no rules, where the state's exception lists HAVE been read and
   * it is on none of them. The statewide rules are the whole answer.
   */
  noExceptions: WaterRow[];
  /**
   * Waters with no rules and no completeness claim. We do not know what the
   * state publishes for them. Alphabetical.
   */
  notTranscribed: WaterRow[];
};

/**
 * Case- and punctuation-insensitive, so "st marys" finds "St. Mary's".
 *
 * Apostrophes are DELETED, not turned into separators. The first version
 * collapsed every non-alphanumeric run to a space, which made "St. Mary's
 * River" into "st mary s river" -- so "st marys", the way a person actually
 * types it, matched nothing. Georgia publishes that river under two spellings
 * (straight and curly apostrophe), which is why it is worth getting right.
 */
function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’ʼ'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Split the state's waters and rules into the three parts above.
 *
 * Rules are matched to waters by id. A rule naming a water we did not receive
 * -- possible, since the two queries are separate and RLS applies to each --
 * is counted as statewide rather than dropped, because the rule itself is
 * published and real; it just lost its label.
 */
export function buildWatersList(
  waters: WaterRow[],
  rules: FishingRuleWithRefs[],
): WatersList {
  const bySlug = new Map<string, WaterRow>();
  for (const w of waters) bySlug.set(w.slug, w);

  const rulesBySlug = new Map<string, FishingRuleWithRefs[]>();
  const statewide: FishingRuleWithRefs[] = [];

  for (const rule of rules) {
    if (!rule.waterSlug || !bySlug.has(rule.waterSlug)) {
      statewide.push(rule);
      continue;
    }
    const list = rulesBySlug.get(rule.waterSlug) ?? [];
    list.push(rule);
    rulesBySlug.set(rule.waterSlug, list);
  }

  const byName = (a: { name: string }, b: { name: string }) =>
    normalise(a.name).localeCompare(normalise(b.name));

  const regulated: WaterWithRules[] = [];
  const noExceptions: WaterRow[] = [];
  const notTranscribed: WaterRow[] = [];
  for (const water of [...waters].sort(byName)) {
    const held = rulesBySlug.get(water.slug);
    if (held && held.length) {
      regulated.push({ water, rules: held });
    } else if (water.rules_complete_at) {
      // Somebody read the state's exception lists for this water and it was on
      // none of them. Zero rules is the finding, not the gap.
      noExceptions.push(water);
    } else {
      // No claim either way. The cautious branch, and the default: an
      // unrecognised or missing value lands here, never in noExceptions.
      notTranscribed.push(water);
    }
  }

  return { statewide, regulated, noExceptions, notTranscribed };
}

/**
 * Narrow the list to what matches `query`.
 *
 * Matches a water's name, its county, and its kind, so "creek", "White" and
 * "chattahoochee" all work. An empty query returns the list unchanged.
 *
 * Statewide rules are kept only when the query is empty: they are not a
 * water, so they cannot match a water search, and leaving them pinned at the
 * top of every result would make a search for "lanier" look like it had
 * found rules it had not.
 */
export function filterWatersList(list: WatersList, query: string): WatersList {
  const q = normalise(query);
  if (!q) return list;

  const hit = (w: WaterRow) =>
    normalise(`${w.name} ${w.county ?? ''} ${w.kind ?? ''}`).includes(q);

  return {
    statewide: [],
    regulated: list.regulated.filter((r) => hit(r.water)),
    noExceptions: list.noExceptions.filter(hit),
    notTranscribed: list.notTranscribed.filter(hit),
  };
}

/**
 * The statewide rules, when a search found no water and they ARE the answer.
 *
 * ---------------------------------------------------------------------------
 * WHY AN EMPTY SEARCH RESULT IS USUALLY A WRONG ANSWER HERE
 *
 * Georgia's regulations are statewide rules plus a list of named exceptions.
 * The source says so outright: "There are no minimum length limits on
 * freshwater game fish unless they are listed below." A water earns a row in
 * `waters` by differing from the default, or by being on the agency's own
 * list of major waters -- never by being fishable, of which Georgia has
 * 500,000 acres.
 *
 * Lake Sinclair was the case that proved it. Absent from the table, correctly,
 * because Georgia publishes no exception for it; a search returned "Nothing
 * matching", which a reader can only take to mean the app does not cover Lake
 * Sinclair. It does -- the statewide rules already on this screen are exactly
 * the rules that govern it. The data was right and the screen was wrong.
 *
 * Sinclair now has a row of its own, under "Statewide rules apply", so it is
 * no longer the example. This function still earns its place and always will:
 * the agency's list runs to 32 reservoirs and 19 rivers, and Georgia has
 * thousands of farm ponds, creeks and backwaters that will never be on any
 * list. A search for one of those must land on the rules that govern it, not
 * on a dead end.
 *
 * This is the silence-reads-as-absence failure rather than the usual
 * absence-reads-as-permission one, and it is why the fix belongs here and not
 * in the extractor: there is nothing missing to extract.
 *
 * Returned ONLY when the search matched no water. When it did match one, that
 * water's own rules are the answer and pinning the statewide list underneath
 * would suggest the search had found those too -- the reason
 * filterWatersList drops them in the first place.
 */
export function statewideFallback(
  full: WatersList,
  filtered: WatersList,
  query: string,
): FishingRuleWithRefs[] {
  if (!query.trim()) return [];
  if (waterCount(filtered) > 0) return [];
  return full.statewide;
}

/** How many waters a filtered list is showing, for the empty-state copy. */
export function waterCount(list: WatersList): number {
  return list.regulated.length + list.noExceptions.length + list.notTranscribed.length;
}

/** "River · White County" -- whatever of the two is known. */
export function waterSubtitle(water: WaterRow): string {
  const kind = water.kind ? water.kind.charAt(0).toUpperCase() + water.kind.slice(1) : null;
  const county = water.county ? `${water.county} County` : null;
  // extent_note is the state's own wording for a regulated stretch and is
  // shown verbatim, because paraphrasing where a rule applies is how you
  // move a boundary.
  return [kind, county, water.extent_note].filter(Boolean).join(' · ');
}
