/**
 * What actually governs one species on one water.
 *
 * ---------------------------------------------------------------------------
 * THE BUG THIS EXISTS TO FIX
 *
 * The app showed statewide rules and water rules as two unrelated lists and
 * left the reader to work out that one overrides the other. Measured against
 * production on 2026-11-22, largemouth bass in Georgia:
 *
 *   statewide      12" minimum
 *   Lake Lanier    14" minimum
 *   Lake Burton    no minimum at all
 *
 * Both water rules rendered a BLANK subtitle, because ruleSubtitle joins a
 * list of nulls, so the only largemouth size rule visible anywhere in the app
 * was the statewide 12". On Lanier that is two inches short and a violation;
 * on Burton it invents a limit Georgia explicitly removed.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS COULD NOT BE WRITTEN BEFORE MIGRATION 20261212000000
 *
 * Overriding means deciding, per field, whether the water's rule SPEAKS to
 * that field or is silent on it. Before that migration `size_rule = 'none'`
 * meant both "there is no size limit here" and "this rule is not about size",
 * and the two pull opposite ways:
 *
 *   Lake Burton's `none`        cancels the statewide 12".
 *   The Buford Dam reach's      is a daylight-hours rule that says nothing
 *   `none`                      about size; the statewide trout limits stand.
 *
 * `unknown` is what separates them, and `statesSize` below is the entire
 * point of that migration.
 *
 * ---------------------------------------------------------------------------
 * PRECEDENCE, AND WHERE IT DELIBERATELY DOES NOT COLLAPSE
 *
 *   size          one winner. A water rule that states a size replaces the
 *                 statewide one outright. The displaced rule is RETURNED
 *                 rather than dropped, so the screen can say "Georgia's 12"
 *                 minimum does not apply here" instead of silently differing
 *                 from the statewide card the reader just looked at.
 *
 *   daily limit   possibly SEVERAL, and flattening them would be wrong.
 *                 Georgia's black bass limit is "10 per day combined, of
 *                 which only 5 may be Altamaha, Bartrams, Chattahoochee,
 *                 Coosa, Shoal, Smallmouth, Suwannee or Tallapoosa" -- two
 *                 statewide rules over nested species sets, and a shoal bass
 *                 angler needs both numbers. So: if the WATER states a limit
 *                 it replaces every statewide limit; otherwise every
 *                 applicable statewide limit is returned.
 *
 *   restrictions  UNION, never replace. Statewide "one pole, handheld" and a
 *                 water's "artificial lures only" both bind. Union is also
 *                 the conservative direction if the data is ever wrong: it
 *                 over-restricts rather than permitting something banned.
 */
import type { FishingRuleWithRefs } from './queries';

export type RuleOrigin = 'statewide' | 'water';

export type ApplicableRule = {
  rule: FishingRuleWithRefs;
  origin: RuleOrigin;
};

export type ResolvedSpecies = {
  species: string;
  /** The size rule that governs, or null when nothing states one. */
  governingSize: ApplicableRule | null;
  /** Statewide size rules a water rule displaced. Usually empty. */
  supersededSize: ApplicableRule[];
  /** Every limit that binds. More than one is legitimate -- nested limits. */
  limits: ApplicableRule[];
  /** Statewide limits a water-specific limit displaced. */
  supersededLimits: ApplicableRule[];
  /** Union of every applicable rule's restrictions, deduped, sorted. */
  restrictions: string[];
  /** True when no rule anywhere mentions this species. */
  empty: boolean;
};

/**
 * Does this rule actually say something about size?
 *
 * `unknown` is the only value that does not. `none` DOES -- it is the
 * statement "there is no size limit here", which is why it can cancel a
 * statewide minimum. Treating `none` as silence would re-introduce exactly
 * the bug migration 20261212000000 was written to remove.
 */
export function statesSize(rule: FishingRuleWithRefs): boolean {
  return rule.sizeRule !== 'unknown';
}

/**
 * Does this rule say something about how many you may keep?
 *
 * `prohibited` and `no_limit` are both statements; only `unknown` is silence.
 */
export function statesLimit(rule: FishingRuleWithRefs): boolean {
  return rule.dailyLimitKind !== 'unknown';
}

function mentions(rule: FishingRuleWithRefs, species: string): boolean {
  const want = species.trim().toLowerCase();
  if (!want) return false;
  return rule.speciesNames.some((n) => n.trim().toLowerCase() === want);
}

/**
 * Merge the statewide rules with one water's rules for a single species.
 *
 * `waterRules` may be empty -- that is the ordinary case, since `waters` is
 * an exceptions table and most waters a reader looks for have no row at all.
 * The statewide rules are then the whole answer, which is correct rather than
 * a gap.
 */
export function resolveSpeciesAtWater(
  species: string,
  statewide: readonly FishingRuleWithRefs[],
  waterRules: readonly FishingRuleWithRefs[] = [],
): ResolvedSpecies {
  const sw = statewide.filter((r) => mentions(r, species));
  const wr = waterRules.filter((r) => mentions(r, species));

  const tag = (rules: readonly FishingRuleWithRefs[], origin: RuleOrigin): ApplicableRule[] =>
    rules.map((rule) => ({ rule, origin }));

  // SIZE -- one winner, water first.
  const waterSize = tag(wr.filter(statesSize), 'water');
  const stateSize = tag(sw.filter(statesSize), 'statewide');
  const governingSize = waterSize[0] ?? stateSize[0] ?? null;
  const supersededSize = waterSize.length ? stateSize : [];

  // LIMITS -- a water limit replaces all statewide limits; otherwise keep
  // every statewide limit, because nested limits are two real numbers.
  const waterLimits = tag(wr.filter(statesLimit), 'water');
  const stateLimits = tag(sw.filter(statesLimit), 'statewide');
  const limits = waterLimits.length ? waterLimits : stateLimits;
  const supersededLimits = waterLimits.length ? stateLimits : [];

  // RESTRICTIONS -- union of everything that applies, including rules that
  // lost on size or limit. A rule displaced on one field still binds on its
  // own terms: Lake Burton removing a minimum does not switch off the
  // statewide gear rules.
  const restrictions = Array.from(
    new Set([...sw, ...wr].flatMap((r) => r.restrictions ?? [])),
  ).sort();

  return {
    species,
    governingSize,
    supersededSize,
    limits,
    supersededLimits,
    restrictions,
    empty: sw.length === 0 && wr.length === 0,
  };
}

/** Every species named by any of these rules, deduped and sorted. */
export function speciesCovered(
  ...groups: readonly (readonly FishingRuleWithRefs[])[]
): string[] {
  const seen = new Map<string, string>();
  for (const group of groups) {
    for (const rule of group) {
      for (const name of rule.speciesNames) {
        const key = name.trim().toLowerCase();
        if (key && !seen.has(key)) seen.set(key, name.trim());
      }
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
}
