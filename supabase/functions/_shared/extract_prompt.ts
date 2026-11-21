/**
 * The prompt, the species catalog and the structured-output schema that
 * extract-source sends to the model.
 *
 * These live here, apart from the function, so that a measurement harness can
 * send byte-identical requests to the ones production sends. An eval that
 * reconstructs the prompt is measuring its own copy, not the pipeline.
 *
 * Pure TypeScript on purpose -- no Deno or Node APIs.
 */

// Structured-output schema. Constraints: additionalProperties:false, every key
// in `required`, no min/max/length (unsupported by structured outputs).
//
// The species enum is built from the DB at run time. It used to be hardcoded to
// four keys while the prompt offered all fifty — and because structured outputs
// ENFORCE the schema, the model physically could not emit turkey, goose, dove or
// any furbearer. That one line was silently capping extraction to deer, elk,
// bear and duck (found in the GA accuracy run, 2026-10-25).
export const speciesEnum = (keys: string[]) => ({ type: 'string', enum: keys });

export const seasonItem = (keys: string[]) => ({
  type: 'object',
  additionalProperties: false,
  properties: {
    species: speciesEnum(keys),
    method: { type: 'string', enum: ['archery', 'muzzleloader', 'firearm', 'general'] },
    zone: { type: 'string' },
    label: { type: ['string', 'null'] },
    season_year: { type: 'integer' },
    open_date: { type: ['string', 'null'] },
    close_date: { type: ['string', 'null'] },
    bag_limit_summary: { type: ['string', 'null'] },
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
  required: ['species', 'method', 'zone', 'label', 'season_year', 'open_date', 'close_date', 'bag_limit_summary', 'notes', 'confidence', 'evidence'],
});

export const windowItem = (keys: string[]) => ({
  type: 'object',
  additionalProperties: false,
  properties: {
    species: speciesEnum(keys),
    zone: { type: ['string', 'null'] },
    season_year: { type: 'integer' },
    name: { type: ['string', 'null'] },
    opens_at: { type: ['string', 'null'] },
    closes_at: { type: ['string', 'null'] },
    results_expected_at: { type: ['string', 'null'] },
    fee_summary: { type: ['string', 'null'] },
    application_url: { type: ['string', 'null'] },
    // Asked for from 2026-11-21. Without these two the proposal reached the
    // review queue with confidence NULL, approve_clean_reviews skipped it by
    // construction, and every draw deadline needed a human. The quote is also
    // the only grounding available when the source is a PDF.
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
  required: ['species', 'zone', 'season_year', 'name', 'opens_at', 'closes_at', 'results_expected_at', 'fee_summary', 'application_url', 'confidence', 'evidence'],
});

export const regItem = (keys: string[]) => ({
  type: 'object',
  additionalProperties: false,
  properties: {
    species: speciesEnum(keys),
    body: { type: 'string' },
  },
  required: ['species', 'body'],
});

export const extractionSchema = (keys: string[]) => ({
  type: 'object',
  additionalProperties: false,
  properties: {
    seasons: { type: 'array', items: seasonItem(keys) },
    application_windows: { type: 'array', items: windowItem(keys) },
    regulation_summaries: { type: 'array', items: regItem(keys) },
  },
  required: ['seasons', 'application_windows', 'regulation_summaries'],
});

export const SYSTEM = `You extract U.S. hunting data from official state wildlife-agency documents.
Rules:
- Only report data you can read directly in the document. NEVER guess. If a document
  is a season-dates chart with no draw/application info, return application_windows: [].
  If it has no season tables, return seasons: []. Same for regulation_summaries.
- Dates must be ISO YYYY-MM-DD, or null if the document does not state an exact date.
- NEVER write editorial notes, placeholders, or "TODO" text in any field. If a value
  (results date, fee, bag limit, etc.) is not stated in the document, use null — never a
  sentence describing what is missing. Fields are for facts from the document only.
- seasons: method one of archery, muzzleloader, firearm, general. zone is the geographic
  zone name ("Statewide" if statewide). season_year is the license year (2026 for a
  2026-27 season). label is a concise variant name ("1st Rifle", "Primitive Weapons").
- application_windows are tag/permit DRAW deadlines. closes_at is THE application deadline.
  name is the draw's name and must NOT repeat the species — use "Primary Draw", not "Elk
  Primary Draw" (the species is a separate field). zone null if not zone-specific.
  application_url is the page where hunters apply, if the document states one.
- regulation_summaries: a short markdown summary of the key rules for that species in
  this state (bag limits, legal weapons, license requirements). Keep it factual and brief.
- ZONE vs LABEL: zone is a GEOGRAPHIC area only — a named zone or unit, a county
  group, or Statewide. Access and land-type qualifiers are NOT zones: private
  lands, WMAs, public land, national forest, falconry, youth, military. Those go
  in the label, and zone stays the geographic area they apply to (Statewide if
  they apply state-wide).
- MULTI-WINDOW SEASONS: when a season runs in separate windows (splits, segments,
  an early and a late portion, archery plus extended archery), emit ONE ROW PER
  WINDOW, each with its own label and its own dates. Never merge two windows into
  a single row spanning the gap between them.
  Equally: if the document ALSO prints a headline row summarising those windows
  ("Goose (3 splits)", "Two Segments", "Oct 17 - Feb 1" above the detail rows),
  do NOT emit the headline as a season. Emit only the individual windows. The
  headline's extra days are days the season is closed.
- Dates are calendar days exactly as printed. Write them YYYY-MM-DD. Never add a
  time, never convert a timezone, never shift a date by a day.
- confidence: 0 to 1, how certain you are this row is correct as printed. Be honest
  — a table you had to interpret deserves a lower number than one you read directly.
- evidence: the page number if the document has one (else null) and a quote: a
  VERBATIM span of AT MOST 25 WORDS copied from the document showing these dates.
  Never paraphrase the quote; it exists so a human can check you.`;

// The set of valid species keys is injected per-run from the DB (see handler), so
// the model can extract every huntable species — not a hardcoded few. Maps common
// document synonyms onto our keys and tells the model to drop anything unlisted.
export function speciesCatalog(species: { key: string; name: string }[]): string {
  const list = species.map((s) => `${s.key} (${s.name})`).join(', ');
  return `\n- species MUST be one of these keys — output the KEY (left), not the name: ${list}.
  Map document terms to the closest key: "antelope"->pronghorn, "cougar"/"puma"/"mountain lion"->mountain-lion,
  "whitetail"/"white-tailed deer"/"mule deer"/"blacktail"->deer, "ducks"->duck, "geese"->goose,
  "grizzly"->brown-bear, "black bear"->bear, "wild boar"/"feral hog"/"wild pig"->wild-hog,
  "cottontail"/"jackrabbit"->rabbit, "gray/Hungarian partridge"->gray-partridge. If an animal
  in the document has no matching key, OMIT it — never invent a key.`;
}
