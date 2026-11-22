/**
 * One water, every species, and what we are entitled to say about it.
 *
 * ---------------------------------------------------------------------------
 * THE STEP THAT WAS MISSING
 *
 * The Waters tab answers "what does Georgia regulate differently?" -- a
 * question about the data. A reader standing on Lake Burton is asking
 * something else: "what may I keep here?" That is State -> Water -> Fish, and
 * until this module the third step did not exist. resolveSpeciesAtWater was
 * written, tested, and called by nothing.
 *
 * ---------------------------------------------------------------------------
 * WHY EVERY SPECIES IS LISTED, NOT JUST THE ONES THE WATER NAMES
 *
 * Lake Burton carries exactly one rule: largemouth bass, no minimum length.
 * A screen showing only the water's own rules would list that one line and
 * nothing else -- and a reader would reasonably conclude Burton has no crappie
 * limit, no trout limit, and no sunfish limit. It has all three. They are
 * Georgia's statewide limits, which apply there in full.
 *
 * So the list is every species named at either level, and the ones the water
 * itself regulates come FIRST, because those are the answers that differ from
 * what the reader would otherwise assume. The rest follow, from the statewide
 * rules, labelled as such.
 *
 * ---------------------------------------------------------------------------
 * THE THREE STANDINGS, AND WHY THE SCREEN MUST NOT FLATTEN THEM
 *
 *   regulated       the water carries rules of its own. Show them, and show
 *                   what they displace.
 *   statewideOnly   somebody read every exception list the state publishes
 *                   and this water is on none of them. The statewide rules
 *                   are the complete answer, and saying so is useful.
 *   unread          no claim has been made. The statewide rules are what we
 *                   can show, and they may not be the whole story -- seven
 *                   Georgia Public Fishing Areas publish limits we do not
 *                   hold, and on Ocmulgee PFA largemouth bass are
 *                   catch-and-release while the statewide answer is five.
 *
 * The second and third look identical on the data -- a water with no rules --
 * and differ only in `rules_complete_at`. Rendering them the same way is the
 * whole bug this screen has to avoid: it would either tell a reader to go
 * check regulations that say nothing new, or tell them nothing needs checking
 * on a water where it does.
 */
import type { WaterRow } from '@/lib/database.types';
import { limitPhrase, sizePhrase, trophyPhrase } from './format';
import type { FishingRuleWithRefs } from './queries';
import {
  resolveSpeciesAtWater,
  ruleMentions,
  speciesCovered,
  type ResolvedSpecies,
} from './resolve';

export type WaterStanding = 'regulated' | 'statewideOnly' | 'unread';

export type SpeciesEntry = {
  species: string;
  resolved: ResolvedSpecies;
  /**
   * The water's own rules name this species. These sort first and are the
   * reason the reader opened the screen.
   */
  waterSpecific: boolean;
};

export type WaterDetail = {
  water: WaterRow;
  standing: WaterStanding;
  /** The water's own rules, as held. Empty for the other two standings. */
  waterRules: FishingRuleWithRefs[];
  /** Every species either level names. Water-specific first, then alphabetical. */
  species: SpeciesEntry[];
};

/**
 * What we may claim about this water.
 *
 * Order matters: holding a rule beats holding a claim. A water can be both
 * regulated and fully read -- the five Georgia-South Carolina border lakes
 * are -- and for the reader the rules are the headline, not the audit trail.
 */
export function waterStanding(
  water: Pick<WaterRow, 'rules_complete_at'>,
  waterRules: readonly FishingRuleWithRefs[],
): WaterStanding {
  if (waterRules.length) return 'regulated';
  // Falsy covers null, undefined and '' -- the shapes a timestamp arrives in
  // from the wire. The cautious branch is the default on purpose: an
  // unrecognised value must read as "we do not know", never as "we checked".
  return water.rules_complete_at ? 'statewideOnly' : 'unread';
}

/**
 * Build the whole screen's data from the two rule sets already in cache.
 *
 * `statewide` and `allRules` both come from useFishingRules for the state, so
 * opening a water costs no query: the rules were fetched when the Waters tab
 * loaded. That is why this takes rules rather than a water id -- a per-water
 * fetch would be a second source of truth for the same rows.
 */
export function buildWaterDetail(
  water: WaterRow,
  statewide: readonly FishingRuleWithRefs[],
  waterRules: readonly FishingRuleWithRefs[],
): WaterDetail {
  const names = speciesCovered(statewide, waterRules);

  const entries: SpeciesEntry[] = names.map((species) => ({
    species,
    resolved: resolveSpeciesAtWater(species, statewide, waterRules),
    waterSpecific: waterRules.some((r) => ruleMentions(r, species)),
  }));

  // Water-specific first. Within each group, the order speciesCovered already
  // produced, which is localeCompare on the name -- re-sorting with a plain
  // `<` here would put "Brown trout" and "brook trout" in a different order
  // than the list above them.
  const sorted = [
    ...entries.filter((e) => e.waterSpecific),
    ...entries.filter((e) => !e.waterSpecific),
  ];

  return {
    water,
    standing: waterStanding(water, waterRules),
    waterRules: [...waterRules],
    species: sorted,
  };
}

/**
 * The water's rules out of a state-wide list, by id.
 *
 * By id and not by slug: waters.slug is unique per state, not globally --
 * `chattooga-river` exists in Georgia AND South Carolina -- and a slug match
 * across a list that was fetched per state would be right by luck rather than
 * by construction.
 */
export function rulesForWater(
  water: Pick<WaterRow, 'slug'>,
  rules: readonly FishingRuleWithRefs[],
): FishingRuleWithRefs[] {
  return rules.filter((r) => r.waterSlug === water.slug);
}

/** Rules with no water: they apply wherever you are in the state. */
export function statewideRules(
  rules: readonly FishingRuleWithRefs[],
  knownSlugs: ReadonlySet<string>,
): FishingRuleWithRefs[] {
  // A rule naming a water we did not receive counts as statewide rather than
  // vanishing, the same call buildWatersList makes and for the same reason:
  // the rule is published and real, it has only lost its label.
  return rules.filter((r) => !r.waterSlug || !knownSlugs.has(r.waterSlug));
}

/**
 * How many species have an answer here, for the header count.
 *
 * Counts species with something to say, not rules. "17 rules" is a fact about
 * our table; "22 species" is a fact about the water.
 */
export function answeredSpecies(detail: WaterDetail): number {
  return detail.species.filter((e) => !e.resolved.empty).length;
}

/**
 * The one line a collapsed species row shows: the limit, then the size.
 *
 * ---------------------------------------------------------------------------
 * NULL RATHER THAN A REASSURING SENTENCE
 *
 * When neither level states a limit or a size, this returns null and the row
 * prints nothing. The tempting alternatives are all worse:
 *
 *   "No limit"       asserts something the source never said.
 *   "No restrictions" same, and broader.
 *   "Unregulated"     wrong about every water in the state.
 *
 * Silence in the source is not permission, and a summary line is exactly
 * where that gets forgotten -- it is the part a reader skims. So the row goes
 * quiet and the expanded view says which of the two it is.
 *
 * The LIMIT leads because it is the question people open the screen with:
 * how many may I keep. The size qualifies it.
 */
export function speciesHeadline(entry: SpeciesEntry): string | null {
  const parts: string[] = [];

  for (const applicable of entry.resolved.limits) {
    const limit = limitPhrase(applicable.rule);
    if (limit) parts.push(limit);
    const trophy = trophyPhrase(applicable.rule);
    if (trophy) parts.push(trophy);
  }

  const governing = entry.resolved.governingSize;
  if (governing) {
    const size = sizePhrase(governing.rule);
    if (size) parts.push(size);
  }

  return parts.length ? parts.join(' · ') : null;
}

/**
 * Does this species' answer differ from what the statewide rules alone say?
 *
 * Not the same question as `waterSpecific`. A water rule about gear names a
 * species without changing any number, and a reader scanning for "what is
 * different here" should not be sent to it. This asks whether the WATER
 * actually governs a size or a limit.
 */
export function differsFromStatewide(entry: SpeciesEntry): boolean {
  const { governingSize, limits } = entry.resolved;
  return (
    governingSize?.origin === 'water' || limits.some((a) => a.origin === 'water')
  );
}
