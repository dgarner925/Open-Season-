/**
 * The Waters tab's shape, as pure data.
 *
 * ---------------------------------------------------------------------------
 * WHY THE LIST IS IN THREE PARTS AND NOT ONE
 *
 * Georgia's published set, measured 2026-11-21: 76 waters, of which 60 carry
 * at least one rule and 16 carry none, plus 17 rules that are statewide and
 * attach to no water at all.
 *
 * One flat alphabetical list would bury two different problems in it. A water
 * with no rules is a dead end -- you tap it and nothing opens -- and a
 * statewide rule has nowhere to live, so it would simply be missing from a
 * screen that looks like it lists everything. Both are facts about the data
 * rather than gaps to hide:
 *
 *   statewide     rules that apply wherever you are in the state.
 *   regulated     a water and the rules read off the agency's pages for it.
 *   alsoListed    waters the agency names but for which we hold no rule yet.
 *                 Shown, not dropped: "we know this water exists and have not
 *                 transcribed its rules" is more useful than silence, and
 *                 dropping them would make the list quietly incomplete.
 *
 * `alsoListed` is also the honest counter to a tempting shortcut -- filtering
 * waters down to those that already have rules would make the screen look
 * finished at the cost of being wrong about what Georgia regulates.
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
  /** Waters the state names, with no rule transcribed yet. Alphabetical. */
  alsoListed: WaterRow[];
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
  const alsoListed: WaterRow[] = [];
  for (const water of [...waters].sort(byName)) {
    const held = rulesBySlug.get(water.slug);
    if (held && held.length) regulated.push({ water, rules: held });
    else alsoListed.push(water);
  }

  return { statewide, regulated, alsoListed };
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
    alsoListed: list.alsoListed.filter(hit),
  };
}

/** How many waters a filtered list is showing, for the empty-state copy. */
export function waterCount(list: WatersList): number {
  return list.regulated.length + list.alsoListed.length;
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
