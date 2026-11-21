/**
 * The prompt and structured-output schema for freshwater fishing extraction.
 *
 * Separate from extract_prompt.ts (hunting) because almost nothing about the
 * shape is shared: a fishing rule is about a SET of species on a NAMED WATER
 * with a window that is not a season, and getting any of those wrong produces
 * a confident wrong answer rather than a missing one.
 *
 * Everything the model is told here was learned from reading Georgia's pages
 * by hand first. The comments say which mistake each rule prevents, because a
 * prompt line with no reason attached is the first thing someone deletes.
 *
 * Pure TypeScript on purpose -- no Deno or Node APIs -- so a measurement
 * harness can send byte-identical requests to the ones production sends.
 */

export const speciesEnum = (keys: string[]) => ({ type: 'string', enum: keys });

/** The restrictions a state can place on taking fish. Must match the CHECK on
 *  fishing_rules.restrictions exactly, or a perfectly-read rule fails to
 *  apply and the failure surfaces a long way from its cause. */
export const RESTRICTIONS = [
  'artificial_only',
  'flies_only',
  'single_hook',
  'barbless',
  'no_live_bait',
  'one_pole_handheld',
  'catch_and_release',
  'reservation_required',
  'daylight_only',
  'no_night_fishing',
  'youth_senior_disabled_only',
  'trout_licence_required',
] as const;

export const WATER_KINDS = [
  'lake', 'reservoir', 'pond', 'river', 'stream', 'creek',
  'tailwater', 'impoundment', 'canal', 'bay', 'other',
] as const;

export const waterItem = () => ({
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    kind: { type: 'string', enum: [...WATER_KINDS] },
    // The state's own words. On a regulated stretch these landmarks ARE the
    // regulation -- "450 feet upstream of the Sandy Bottom Canoe Access" --
    // and paraphrasing them paraphrases the law.
    extent_note: { type: ['string', 'null'] },
    // The river a named stretch belongs to, by name, or null.
    parent_water: { type: ['string', 'null'] },
    county: { type: ['string', 'null'] },
    confidence: { type: 'number' },
    evidence: {
      type: 'object',
      additionalProperties: false,
      properties: {
        page: { type: ['integer', 'null'] },
        quote: { type: ['string', 'null'] },
      },
      required: ['page', 'quote'],
    },
  },
  required: ['name', 'kind', 'extent_note', 'parent_water', 'county', 'confidence', 'evidence'],
});

export const fishingRuleItem = (keys: string[]) => ({
  type: 'object',
  additionalProperties: false,
  properties: {
    // An ARRAY, not one species. "Total daily limit of 10 black bass" covers
    // ten species with one number between them; one species per row turns
    // that into ten rows each saying 10, which reads as ten of EACH.
    species: { type: 'array', items: speciesEnum(keys) },
    limit_basis: { type: 'string', enum: ['aggregate', 'per_species'] },
    // The water this applies to, by name, or null for statewide.
    water: { type: ['string', 'null'] },
    season_year: { type: 'integer' },

    size_rule: {
      type: 'string',
      enum: ['none', 'minimum', 'maximum', 'slot_release', 'slot_keep', 'see_notes'],
    },
    min_length_inches: { type: ['number', 'null'] },
    max_length_inches: { type: ['number', 'null'] },

    // Three different facts, not one nullable number.
    daily_limit_kind: {
      type: 'string',
      enum: ['count', 'no_limit', 'prohibited', 'unknown'],
    },
    daily_limit: { type: ['integer', 'null'] },
    possession_limit: { type: ['integer', 'null'] },
    trophy_allowance: { type: ['integer', 'null'] },
    trophy_min_length_inches: { type: ['number', 'null'] },

    restrictions: { type: 'array', items: { type: 'string', enum: [...RESTRICTIONS] } },

    // The window the RULE is in force. Null means all year. This is NOT a
    // season: see the prompt.
    effective_from: { type: ['string', 'null'] },
    effective_to: { type: ['string', 'null'] },

    notes: { type: ['string', 'null'] },
    confidence: { type: 'number' },
    evidence: {
      type: 'object',
      additionalProperties: false,
      properties: {
        page: { type: ['integer', 'null'] },
        quote: { type: ['string', 'null'] },
      },
      required: ['page', 'quote'],
    },
  },
  required: [
    'species', 'limit_basis', 'water', 'season_year',
    'size_rule', 'min_length_inches', 'max_length_inches',
    'daily_limit_kind', 'daily_limit', 'possession_limit',
    'trophy_allowance', 'trophy_min_length_inches',
    'restrictions', 'effective_from', 'effective_to',
    'notes', 'confidence', 'evidence',
  ],
});

export const fishingSchema = (keys: string[]) => ({
  type: 'object',
  additionalProperties: false,
  properties: {
    waters: { type: 'array', items: waterItem() },
    fishing_rules: { type: 'array', items: fishingRuleItem(keys) },
  },
  required: ['waters', 'fishing_rules'],
});

export const FISHING_SYSTEM =
  `You extract U.S. FRESHWATER fishing regulations from official state
wildlife-agency documents.

SCOPE
- FRESHWATER ONLY. If this document is about saltwater, coastal or marine
  fishing, return waters: [] and fishing_rules: []. Do not translate saltwater
  rules into freshwater ones. Signals that a page is saltwater: amberjack, red
  drum, snapper, grouper, flounder, cobia, tarpon, sheepshead, spotted
  seatrout, king mackerel, shrimp, crab, "fork length", "state waters",
  "federal waters", three-mile or nine-mile limits.
  This matters: one state files its saltwater limits under a page titled
  "Finfish Seasons, Limits, Sizes", which reads like the main freshwater page.
  Judge by the species and the water, never by the page title.
- Only report what you can read directly in the document. NEVER guess.
- NEVER write editorial notes, placeholders or "TODO" text in any field. If the
  document does not state a value, use null. Fields carry facts from the
  document only.

A RULE WINDOW IS NOT A SEASON
- Most freshwater fishing is open all year. Do NOT infer a closed season from a
  rule that only applies for part of the year.
- "Delayed harvest: release all trout and use artificial lures only with one
  single hook, Nov. 1 - May 14" is a RULE in force Nov 1 to May 14. The water
  is open the whole year. Put those dates in effective_from and effective_to.
- effective_from/effective_to null means the rule applies all year. That is the
  common case; prefer it when the document states no dates.
- A window may wrap the new year (Nov 1 to May 14). That is normal. Write the
  dates as they fall, earlier year first.
- Dates must be ISO YYYY-MM-DD, calendar days exactly as printed. Never add a
  time, never convert a timezone, never shift a date by a day. For a rule that
  recurs annually, use the dates of the season year you are reading.

SPECIES IS A LIST, AND limit_basis SAYS WHAT THE NUMBER MEANS
- Put every species the rule covers in the species array.
- limit_basis "aggregate": the number is shared between them. "Total daily
  limit of 10 black bass" -> all the black bass species in one row,
  daily_limit 10, limit_basis aggregate.
- limit_basis "per_species": the number applies to each of them. "5 of each
  species" -> daily_limit 5, limit_basis per_species.
- A nested sub-limit is its own row over the smaller set. "10 black bass, only
  5 of which may be Shoal, Smallmouth or Suwannee" is TWO rows: 10 aggregate
  over all of them, and 5 aggregate over those three.
- Never emit a row with an empty species array.

DAILY LIMITS: FOUR DIFFERENT ANSWERS
- "count": the document states a number. Put it in daily_limit.
- "no_limit": the document says there is no limit. daily_limit null.
- "prohibited": the species may not be taken at all ("Sturgeon may not be
  taken"). daily_limit 0.
- "unknown": this document does not say. daily_limit null. Use this rather than
  guessing; a page about gear rules usually says nothing about limits.

SIZES
- size_rule "minimum" with min_length_inches: "22 inch minimum".
- "maximum" with max_length_inches.
- "slot_release": fish BETWEEN the two lengths must be released ("none between
  18 and 24 inches"). Set both lengths.
- "slot_keep": only fish between the two lengths may be kept. Set both lengths.
- "none": the document sets no size limit here. This is a real answer and is
  different from not knowing -- use "none" only when the document covers sizes
  and sets none, and "see_notes" when the rule is real but too unusual to fit
  these shapes.
- A trophy allowance needs the length it is measured against: "15, only two of
  which can be 22 inches or longer" -> trophy_allowance 2,
  trophy_min_length_inches 22.
- Lengths in inches, as printed. Never convert from centimetres.

WATERS
- Emit a water when the document regulates it by name.
- A water row is the REGULATED UNIT as the state names it. If the state
  regulates a stretch, the water is that stretch, and extent_note is the
  state's own wording of where it runs, copied VERBATIM. Those landmarks are
  the regulation.
- parent_water is the river or lake a named stretch belongs to, by name, when
  the document makes that plain. Otherwise null.
- Do not invent waters from a list of place names that carries no rule. A page
  listing every trout stream in a county is a list, not a set of rules: emit
  the waters only if the document states a rule for them.
- In fishing_rules, "water" is the water's name exactly as you wrote it in
  waters, or null when the rule is statewide.

RESTRICTIONS
- Use only the listed values, and list every one that applies. Delayed harvest
  is usually catch_and_release AND artificial_only AND single_hook together.
- youth_senior_disabled_only is for a water open only to young, senior or
  disabled anglers -- a restriction on who may fish, not on tackle.
- Leave the array empty when the document states none.

CONFIDENCE AND EVIDENCE
- confidence: 0 to 1, how certain you are this row is correct as printed. Be
  honest -- a table you had to interpret deserves a lower number than a
  sentence you read directly.
- evidence: the page number if the document has one (else null) and a quote: a
  VERBATIM span of AT MOST 25 WORDS copied from the document showing this rule.
  Never paraphrase the quote; it exists so a person can check you.`;

/** The species keys this run may use, injected from the DB per run. Mirrors
 *  speciesCatalog() on the hunting side, with the synonyms an agency actually
 *  prints. */
export function fishingSpeciesCatalog(species: { key: string; name: string }[]): string {
  const list = species.map((s) => `${s.key} (${s.name})`).join(', ');
  return `\n- species MUST be keys from this list -- output the KEY (left), not the name: ${list}.
  Map document terms to the closest key: "black bass" is a GROUP -- expand it to every
  black bass key in the list, do not pick one. "bream"/"sunfish" is a group too: expand
  it to the sunfish keys the document names. "brookie"->brook-trout, "rainbow"->rainbow-trout,
  "brown"->brown-trout, "spec"/"speckled trout" in FRESHWATER->brook-trout, "stripers"->striped-bass,
  "hybrid"/"wiper"->hybrid-striped-bass, "crappie" unqualified->both black-crappie and
  white-crappie, "catfish" unqualified->channel-catfish and flathead-catfish,
  "walleyed pike"->walleye, "musky"/"muskie"->muskellunge, "pickerel" unqualified->chain-pickerel.
  "mountain trout" means brook, rainbow and brown trout together. If a fish in the document
  has no matching key, OMIT it -- never invent a key.`;
}
