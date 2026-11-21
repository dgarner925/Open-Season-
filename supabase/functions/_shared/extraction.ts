/**
 * Extraction guards: identity, date safety, confidence, and the accuracy
 * report used to grade a state before we trust the pipeline on it.
 *
 * Two edge cases this file exists to prevent:
 *
 *   1. Multi-window seasons collapsing. A season's identity must include its
 *      label — Georgia runs "Archery" and "Extended Archery" for the same
 *      species, zone, method and year, and matching without the label makes
 *      the second window look like an edit of the first.
 *
 *   2. UTC date drift. A date is a calendar day printed in a regulations
 *      booklet, not an instant. We never construct a Date to parse one; a
 *      value is either already YYYY-MM-DD or it is rejected.
 */

export type ExtractedSeason = {
  species: string;
  method: string;
  zone: string | null;
  label: string | null;
  season_year: number;
  open_date: string | null;
  close_date: string | null;
  bag_limit_summary?: string | null;
  notes?: string | null;
  confidence?: number | null;
  evidence?: { page?: number | null; quote?: string | null } | null;
};

/** Strict calendar-day check. No times, no zones, no Date construction. */
/**
 * Returns `boolean`, deliberately, and not `value is string`.
 *
 * A predicate asserting `value is string` tells TypeScript that anything
 * failing the check is NOT a string -- so on an argument already known to be
 * one, the false branch narrows to `never` and every line after it goes
 * unchecked. normalizeExtractedDate below was unchecked from its second line
 * down, which is the last function in this pipeline that should be. This
 * function validates a shape, not a type; the two callers that wanted the
 * narrowing already cast instead.
 */
export function isLocalISODate(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const lengths = [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d <= lengths[mo - 1];
}

/**
 * Take the calendar day out of whatever the model returned, without ever
 * shifting it. A trailing time is sliced off literally — never parsed — so
 * "2026-09-12T00:00:00Z" stays Sep 12 instead of becoming Sep 11 in a
 * western timezone. Anything else is rejected rather than guessed at.
 */
export function normalizeExtractedDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (isLocalISODate(trimmed)) return trimmed;
  const head = trimmed.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(head) && /^[T\s]/.test(trimmed.slice(10)) && isLocalISODate(head)) {
    return head;
  }
  return null;
}

/**
 * Labels are prose written by whoever typed the regulations, so they vary in
 * ways that mean nothing: "youth firearms" vs "youth-only firearms",
 * "firearms" vs "firearms (one day)". Comparing them verbatim turned one
 * season into a phantom addition plus a phantom removal (GA accuracy run,
 * 2026-10-25). Normalize away the noise, keep what distinguishes a window.
 */
export function normalizeLabel(label: string | null | undefined): string {
  return (label ?? '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')          // "(one day)", "(select days)"
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')         // punctuation, dashes, en-dashes
    .split(/\s+/)
    .filter((w) => w && !LABEL_NOISE.has(w))
    .join(' ')
    .trim();
}

// Words that never distinguish one season window from another.
const LABEL_NOISE = new Set([
  'only', 'the', 'a', 'an', 'and', 'season', 'seasons', 'day', 'days', 'select',
]);

/** Everything about a season except its label — the matching group. */
export function seasonGroup(r: {
  species_id?: string;
  species?: string;
  zone_id?: string | null;
  zone?: string | null;
  method: string;
  season_year: number;
}): string {
  const species = r.species_id ?? r.species ?? '';
  const zone = (r.zone_id ?? r.zone ?? 'Statewide') || 'Statewide';
  return [species, String(zone).trim().toLowerCase(), r.method, r.season_year].join('|');
}

/** What makes two season rows the same row. Label included — see the header. */
export function seasonIdentity(r: {
  species_id?: string;
  species?: string;
  zone_id?: string | null;
  zone?: string | null;
  method: string;
  label: string | null;
  season_year: number;
}): string {
  return [seasonGroup(r), normalizeLabel(r.label)].join('|');
}

/**
 * Drop the agency's SUMMARY line when the batch also carries its splits.
 *
 * Agencies print a headline window above the detail rows -- "Goose (3 splits)",
 * "Dove (three splits)", "Two Segments", "Split Season" -- and a model reading
 * the page faithfully emits both. The headline is not a season. The only days
 * it adds are the days the season is SHUT, so publishing it tells a hunter the
 * season is open on a day it is closed. Thirteen of these were live across five
 * states on 2026-11-02; four were lying that morning.
 *
 * The prompt already forbids MERGING two windows into one row. This is the
 * other half, which a prompt alone cannot guarantee: the model merged nothing,
 * it simply also transcribed the summary line. So the batch is checked here.
 *
 * The test: inside one season group (species, zone, method, year -- so same
 * ZONE by construction), a row whose earliest child opens on its open date and
 * whose latest child closes on its close date, with at least one uncovered day
 * in between, is a summary of those children. Tiling BOTH ends is what keeps it
 * safe. Virginia's falconry duck season spans the same gun segments but runs on
 * past them to Feb 7, so it does not tile, and it survives -- correctly, since
 * DWR publishes it as a season in its own right.
 */
export function dropSummarySpans<T extends ExtractedSeason>(rows: T[]): { kept: T[]; dropped: T[] } {
  const day = (iso: string) => Date.parse(iso + 'T00:00:00Z') / 86_400_000;
  const groups = new Map<string, T[]>();
  for (const r of rows) {
    if (!isLocalISODate(r.open_date) || !isLocalISODate(r.close_date)) continue;
    const k = seasonGroup(r);
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
  }

  const dropped = new Set<T>();
  for (const g of groups.values()) {
    for (const c of g) {
      const co = day(c.open_date as string), cc = day(c.close_date as string);
      const kids = g.filter((r) => {
        if (r === c) return false;
        const o = day(r.open_date as string), k = day(r.close_date as string);
        return o >= co && k <= cc && k - o < cc - co;
      });
      if (kids.length < 2) continue;
      const kidOpen = Math.min(...kids.map((r) => day(r.open_date as string)));
      const kidClose = Math.max(...kids.map((r) => day(r.close_date as string)));
      if (kidOpen !== co || kidClose !== cc) continue;
      // Any day inside the container that no child covers is a closure the
      // container would hide. Walk the children in date order and look for air.
      const spans = kids
        .map((r) => [day(r.open_date as string), day(r.close_date as string)] as const)
        .sort((a, b) => a[0] - b[0]);
      let reach = spans[0][1], hole = false;
      for (const [o, k] of spans.slice(1)) {
        if (o > reach + 1) { hole = true; break; }
        reach = Math.max(reach, k);
      }
      if (hole) dropped.add(c);
    }
  }
  return { kept: rows.filter((r) => !dropped.has(r)), dropped: rows.filter((r) => dropped.has(r)) };
}

export type Validation = { ok: boolean; errors: string[]; dates: { open: string | null; close: string | null } };

/**
 * Schema-level sanity on one extracted season. A row that fails still reaches
 * the review queue — it just arrives flagged and low-confidence, never
 * published.
 */
export function validateSeason(row: ExtractedSeason): Validation {
  const errors: string[] = [];

  if (!row.species) errors.push('missing species');
  if (!row.method) errors.push('missing method');
  if (!Number.isInteger(row.season_year) || row.season_year < 2000 || row.season_year > 2100) {
    errors.push(`implausible season_year: ${row.season_year}`);
  }

  const open = normalizeExtractedDate(row.open_date);
  const close = normalizeExtractedDate(row.close_date);
  if (row.open_date && !open) errors.push(`unparseable open_date: ${String(row.open_date)}`);
  if (row.close_date && !close) errors.push(`unparseable close_date: ${String(row.close_date)}`);
  if (open && close && close < open) errors.push(`close_date ${close} precedes open_date ${open}`);

  // A quote long enough to be a paraphrase isn't evidence.
  const quote = row.evidence?.quote ?? null;
  if (quote && quote.trim().split(/\s+/).length > 25) errors.push('evidence quote longer than 25 words');

  return { ok: errors.length === 0, errors, dates: { open, close } };
}

export const LOW_CONFIDENCE = 0.7;

/**
 * The model's own confidence, lowered by anything we can see is wrong. Rows
 * below LOW_CONFIDENCE are flagged for a closer look in the review queue.
 */
export function scoreConfidence(row: ExtractedSeason, v: Validation): number {
  let c = typeof row.confidence === 'number' && row.confidence >= 0 && row.confidence <= 1 ? row.confidence : 0.5;
  if (!v.ok) c = Math.min(c, 0.3);
  if (!v.dates.open) c = Math.min(c, 0.6);
  if (!row.evidence?.quote) c = Math.min(c, 0.6);
  return Math.max(0, Math.min(1, Math.round(c * 100) / 100));
}

// ---------------------------------------------------------------------------
// Application windows (draw deadlines)
//
// Until 2026-11-21 none of this existed. `windowItem` did not ask the model for
// a confidence or an evidence quote, nothing validated an extracted window, and
// the proposal reached review_queue with confidence NULL -- which
// approve_clean_reviews skips by construction. Every one of the 335 draw
// deadlines ever published was therefore approved by hand, and the nightly draw
// sweep had just started producing sixty a night.
// ---------------------------------------------------------------------------

export type ExtractedWindow = {
  species: string;
  zone: string | null;
  season_year: number;
  name: string | null;
  opens_at: string | null;
  closes_at: string | null;
  results_expected_at: string | null;
  fee_summary: string | null;
  application_url: string | null;
  confidence?: number;
  evidence?: { page: number | null; quote: string | null } | null;
};

export type WindowValidation = {
  ok: boolean;
  errors: string[];
  dates: { opens: string | null; closes: string | null; results: string | null };
};

export function validateWindow(row: ExtractedWindow): WindowValidation {
  const errors: string[] = [];

  if (!row.species) errors.push('missing species');
  if (!Number.isInteger(row.season_year) || row.season_year < 2000 || row.season_year > 2100) {
    errors.push(`implausible season_year: ${row.season_year}`);
  }

  const opens = normalizeExtractedDate(row.opens_at);
  const closes = normalizeExtractedDate(row.closes_at);
  const results = normalizeExtractedDate(row.results_expected_at);
  if (row.opens_at && !opens) errors.push(`unparseable opens_at: ${String(row.opens_at)}`);
  if (row.closes_at && !closes) errors.push(`unparseable closes_at: ${String(row.closes_at)}`);
  if (row.results_expected_at && !results) {
    errors.push(`unparseable results_expected_at: ${String(row.results_expected_at)}`);
  }
  if (opens && closes && closes < opens) errors.push(`closes_at ${closes} precedes opens_at ${opens}`);
  if (closes && results && results < closes) {
    errors.push(`results ${results} precede the deadline ${closes}`);
  }

  // The deadline IS the row. A window with no closing date cannot tell a hunter
  // the one thing they came for, and it should never publish itself.
  if (!closes) errors.push('no closes_at: nothing to apply by');

  const quote = row.evidence?.quote ?? null;
  if (quote && quote.trim().split(/\s+/).length > 25) errors.push('evidence quote longer than 25 words');

  return { ok: errors.length === 0, errors, dates: { opens, closes, results } };
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Every way an agency might print one ISO date, so a literal search for it
 * stands a fair chance of finding it.
 *
 * Deliberately generous on format and strict on value: "Nov 23" matches, but a
 * different day never does. The point is to fail a date the page does not
 * contain, not to prove the page is well formatted.
 */
export function dateRenderings(iso: string): string[] {
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return [iso];
  const full = MONTHS[m - 1];
  const abbr = full.slice(0, 3);
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  const yy = String(y).slice(2);
  return [
    iso,
    `${full} ${d}, ${y}`, `${full} ${d} ${y}`, `${full} ${d}`,
    `${abbr} ${d}, ${y}`, `${abbr} ${d} ${y}`, `${abbr} ${d}`, `${abbr}. ${d}`,
    `${m}/${d}/${y}`, `${mm}/${dd}/${y}`, `${m}/${d}/${yy}`, `${mm}/${dd}/${yy}`,
    `${m}-${d}-${y}`, `${mm}-${dd}-${y}`, `${m}.${d}.${y}`,
  ];
}


/**
 * Write out the end of a compressed date range, so a literal search can find it.
 *
 * Agencies write a window as "Feb. 3-24, 2027", and the closing date -- the one
 * thing a hunter needs -- appears nowhere on the page as "Feb 24". A search for
 * the renderings of 2027-02-24 therefore missed it, scored a correct deadline
 * at 0.30, and would have held Tennessee's elk quota hunt out of the site while
 * reporting it as ungrounded.
 *
 * Found 2026-11-21 by checking the page by hand instead of believing the
 * checker, which is the only way this class of error ever surfaces: a
 * verification step that is too strict does not announce itself, it just
 * quietly refuses good data.
 *
 * Only the same-month form needs this. "Sept. 26-Oct. 16" already states both
 * ends in full, so an ordinary search finds them.
 */
export function expandCompressedRanges(text: string): string {
  const re = new RegExp(
    MONTH_RE + '\\.?\\s*(\\d{1,2})\\s*[\\u2010-\\u2015\\u2212-]\\s*(\\d{1,2})(?:\\s*,?\\s*(\\d{4}))?',
    'gi',
  );
  const extra: string[] = [];
  for (const m of text.matchAll(re)) {
    const [, month, , d2, year] = m;
    extra.push(year ? `${month} ${d2}, ${year}` : `${month} ${d2}`);
  }
  return extra.length ? `${text} ${extra.join(' ')}` : text;
}

const MONTH_RE =
  '(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?' +
  '|Aug(?:ust)?|Sep(?:t)?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';

/**
 * Cut a page into the blocks a reader would call rows.
 *
 * Grounding originally searched the whole page flattened into one string,
 * which answers "is this date printed somewhere on this site" -- and on a page
 * like Florida's limited-entry table, which lists 34 hunts and their phases,
 * that is nearly free to satisfy. Measured on 2026-11-21: all 34 proposed
 * closing dates appeared on the page, and only 8 appeared anywhere near the
 * hunt they were attached to. The check could not tell a correctly read table
 * from a shuffled one.
 *
 * Splitting on the tags that close a row keeps each hunt with its own dates.
 * `</td>` is deliberately NOT a split point: a table row holds the name in one
 * cell and the dates in another, and splitting cells apart would throw away
 * the exact adjacency this is for.
 */
export function textBlocks(html: string): string[] {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .split(/<\/(?:tr|li|p|h[1-6]|section|article|dd|dt)>/i)
    .map((b) => b.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((b) => b.length > 0)
    .slice(0, 5000)
    .map((b) => b.slice(0, 2000));
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'hunt', 'hunts',
  'permit', 'permits', 'season', 'seasons', 'application', 'applications',
]);

/**
 * How much of a proposed window's name this block actually says, 0 to 1.
 *
 * Fuzzy on purpose. A name is often assembled by the model rather than copied
 * ("Statewide Alligator Harvest Permits Phase I"), so requiring it verbatim
 * fails on 19 of Florida's 34 rows while the underlying read is fine. Matching
 * on distinctive words, by prefix so "hunt" finds "hunts", asks the question
 * that matters: is this row about this thing?
 *
 * Generic hunting words are dropped, or every row on a hunting page would look
 * like every name.
 */
/**
 * A phase, period or unit marker: "Phase I", "Period B", "Unit 3".
 *
 * These are the whole difference between one row and the next, and they are
 * one or two characters long -- so an earlier version of this check, which
 * dropped short words and averaged the rest, could not tell Phase I from
 * Phase II at all. Measured on Florida's page: with the marker merely averaged
 * in, 18% of deliberately shuffled name/date pairs still passed; with it
 * required, 1%.
 */
const QUALIFIER = /^(?:i|ii|iii|iv|v|vi|vii|viii|ix|x|[a-f]|\d{1,2})$/;

function words(s: string): string[] {
  return s.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

/** Every word of a name that carries meaning, markers included. */
export function usefulNameTokens(name: string | null): string[] {
  return words(name ?? '').filter((t) => !STOPWORDS.has(t));
}

/**
 * The words that say what the hunt IS, excluding markers.
 *
 * A name with fewer than two of these -- a bare "Phase I" -- matches almost
 * any row of a page, so a match on it means nothing. Two of Florida's
 * proposals are named exactly that, and under row matching alone they were the
 * ONLY two that passed: a perfect score earned by being too vague to fail.
 */
export function distinctiveNameTokens(name: string | null): string[] {
  return usefulNameTokens(name).filter((t) => t.length >= 3 && !QUALIFIER.test(t));
}

/**
 * How much of a proposed window's name this block actually says, 0 to 1.
 *
 * Fuzzy on the descriptive words, strict on the markers:
 *   - a descriptive word matches by prefix, so "hunt" finds "hunts" and a name
 *     the model assembled rather than copied still matches its own row;
 *   - a marker must appear as its own word, or the block scores zero. Averaging
 *     it in would let a four-word name outvote the one character that says
 *     which phase this is.
 *
 * Generic hunting words are dropped, or every row on a hunting page would look
 * like every name.
 */
export function nameMatchScore(block: string, name: string | null): number {
  const parts = usefulNameTokens(name);
  if (parts.length === 0) return 0;
  const main = distinctiveNameTokens(name);
  const quals = parts.filter((t) => QUALIFIER.test(t));
  const hay = words(block);
  const set = new Set(hay);
  if (quals.some((q) => !set.has(q))) return 0;
  if (main.length === 0) return quals.length > 0 ? 1 : 0;
  return main.filter((t) => hay.some((w) => w.startsWith(t))).length / main.length;
}

/** Does this block state a date? Used to tell a heading from a data row. */
export function looksLikeDateRow(block: string): boolean {
  return /\d{1,2}\s*\/\s*\d{1,2}\s*\/\s*\d{2,4}/.test(block) ||
    new RegExp(MONTH_RE + '\\.?\\s*\\d{1,2}', 'i').test(block);
}

/**
 * The heading a row sits under.
 *
 * Florida's page -- and most agency pages -- name the hunt once, in a heading,
 * and then list its phases beneath:
 *
 *     Statewide Alligator Harvest Permits         <- the name
 *     Phase I Applications: 5/8/2026 - 5/18/2026  <- the row with the date
 *
 * Matching a proposal's name against the row alone therefore failed on 32 of
 * Florida's 34 windows, and the only two that passed did so because their
 * names ("Phase I", "Phase II") are too vague to fail. Walking back to the
 * nearest block that carries no date gives the row the name it belongs to.
 */
export function headingFor(blocks: string[], i: number): string {
  for (let k = i - 1; k >= 0 && k >= i - 8; k--) {
    const b = blocks[k];
    if (b && b.length <= 160 && !looksLikeDateRow(b)) return b;
  }
  return '';
}

/** A row has to say most of the name before it counts as that row. */
export const ROW_NAME_THRESHOLD = 0.6;

export type Grounding = {
  /** 'document' = checked against the page we fetched; 'quote' = only against
   *  the model's own evidence quote; 'none' = could not check at all. */
  basis: 'document' | 'quote' | 'none';
  found: string[];
  missing: string[];
  quote: string | null;
  /** Best name-match of any block that also carries the closing date, or null
   *  when the page was never cut into blocks (a PDF, or a quote-only check).
   *  This is the difference between "printed on this page" and "printed on
   *  this row", and it is the one that says the table was read correctly. */
  rowMatch: number | null;
  /** The row that matched, for a human checking the card. */
  rowText: string | null;
  /** How many words the proposed name has that say what the hunt IS, markers
   *  like "Phase I" excluded. Fewer than two and a row match means nothing,
   *  because almost any row would match. */
  nameTokens: number;
};

/**
 * Does the page actually SAY these dates?
 *
 * This is the check the seasons path never had. Season confidence is the
 * model's opinion of itself, lowered a little for things we can see are wrong;
 * a model that misreads a table and is sure about it scores 0.95 and
 * publishes. Grounding asks a different and much harder question -- is this
 * string on the page -- and a date that is not there cannot pass at any
 * confidence the model cares to report.
 *
 * `text` is the normalised page the worker already fetched, so this costs
 * nothing. It is null for a PDF, which reaches the model as base64 and has no
 * text here to search; those fall back to checking the dates against the
 * model's own quote, which is weaker (it only catches the model contradicting
 * itself) and is scored as such.
 */
export function groundDates(
  text: string | null,
  quote: string | null,
  dates: (string | null)[],
): Grounding {
  const wanted = dates.filter((d): d is string => !!d);
  const haystack = text ?? quote ?? null;
  const basis: Grounding['basis'] = text ? 'document' : quote ? 'quote' : 'none';
  if (!haystack || wanted.length === 0) {
    return {
      basis: haystack ? basis : 'none',
      found: [], missing: wanted, quote: null, rowMatch: null, rowText: null,
      nameTokens: 0,
    };
  }

  // Collapse whitespace and drop the comma/period noise agencies vary on, so
  // "Nov. 23 , 2026" and "Nov 23 2026" compare equal.
  const norm = (s: string) => s.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ');
  // Expand "Feb. 3-24, 2027" into something that also says "Feb 24, 2027"
  // before searching, or the closing date of every compressed range reads as
  // absent from a page that plainly states it.
  const hay = norm(expandCompressedRanges(haystack));

  const found: string[] = [];
  const missing: string[] = [];
  let firstAt = -1;
  for (const iso of wanted) {
    const hit = dateRenderings(iso).map(norm).find((r) => hay.includes(r));
    if (hit) {
      found.push(iso);
      const at = hay.indexOf(hit);
      if (firstAt < 0 || at < firstAt) firstAt = at;
    } else {
      missing.push(iso);
    }
  }

  // A short span of the page around the first date we matched, so a human
  // checking the card can see what we read without opening the source.
  let snippet: string | null = null;
  if (firstAt >= 0) {
    const flat = haystack.replace(/\s+/g, ' ');
    const ratio = flat.length / Math.max(hay.length, 1);
    const at = Math.min(flat.length - 1, Math.max(0, Math.round(firstAt * ratio)));
    snippet = flat.slice(Math.max(0, at - 60), at + 120).trim();
  }

  return { basis, found, missing, quote: snippet, rowMatch: null, rowText: null, nameTokens: 0 };
}

/**
 * Ground one application window against the rows of its page.
 *
 * Two questions, not one:
 *   is the date printed on this page at all  -- groundDates, as before
 *   is it printed on the row for THIS hunt   -- the part that was missing
 *
 * The second is what distinguishes a table read correctly from a table read
 * sideways, and on a dense page it is the only one worth much.
 */
export function groundWindow(
  blocks: string[] | null,
  text: string | null,
  quote: string | null,
  name: string | null,
  dates: (string | null)[],
  closesAt: string | null,
): Grounding {
  const g = groundDates(text, quote, dates);
  if (!blocks || blocks.length === 0 || !closesAt) return g;

  // Only rows that carry the closing date can be this window's row.
  const renderings = dateRenderings(closesAt).map((r) =>
    r.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' '));
  let best = 0;
  let bestText: string | null = null;
  for (let i = 0; i < blocks.length; i++) {
    const raw = blocks[i];
    const flat = expandCompressedRanges(raw).toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ');
    if (!renderings.some((r) => flat.includes(r))) continue;
    // The row plus the heading it sits under: agency pages name the hunt once
    // and list its phases below, so the row by itself rarely says what it is.
    const context = `${headingFor(blocks, i)} ${raw}`;
    const m = nameMatchScore(context, name);
    if (m > best) {
      best = m;
      bestText = context.trim().slice(0, 300);
    }
  }
  return {
    ...g,
    rowMatch: best,
    rowText: bestText,
    nameTokens: distinctiveNameTokens(name).length,
  };
}

/**
 * Confidence for a draw deadline, led by grounding rather than by self-report.
 *
 * The tiers, and why each is where it is:
 *   date on the row that names
 *     this hunt (and the name
 *     is specific enough to
 *     mean anything)            -> up to 0.95, can auto-approve
 *   date on the page but not on
 *     that row                  -> capped 0.60, a person decides
 *   dates only in the model's
 *     own quote (PDF source)    -> capped 0.80, below the 0.85 gate on purpose:
 *                                  this only proves the model did not
 *                                  contradict itself, which is not evidence
 *   any date NOT found          -> capped 0.30, never auto-approves
 *   validation failed           -> capped 0.30
 */
export function scoreWindowConfidence(
  row: ExtractedWindow,
  v: WindowValidation,
  g: Grounding,
): number {
  let c = typeof row.confidence === 'number' && row.confidence >= 0 && row.confidence <= 1
    ? row.confidence
    : 0.5;

  if (g.missing.length > 0) {
    // A date the page does not contain. Nothing else matters.
    c = Math.min(c, 0.3);
  } else if (
    g.basis === 'document' && g.rowMatch !== null &&
    g.rowMatch >= ROW_NAME_THRESHOLD && g.nameTokens >= 2
  ) {
    // The date is on the row that names this hunt. This is the only case that
    // clears the gate on its own.
    c = Math.max(c, 0.9);
  } else if (g.basis === 'document' && g.rowMatch !== null) {
    // The date is on the page but not on a row that looks like this hunt.
    // Measured on Florida: 26 of 34 proposals land here, and the read may well
    // be right -- but "this date appears somewhere on a page listing 34 hunts"
    // does not show it belongs to this one, so a person decides.
    c = Math.min(c, 0.6);
  } else if (g.basis === 'document') {
    // Page text, but no rows to check against (no closing date to anchor on).
    c = Math.min(c, 0.6);
  } else if (g.basis === 'quote') {
    c = Math.min(c, 0.8);
  } else {
    c = Math.min(c, 0.5);
  }

  if (!v.ok) c = Math.min(c, 0.3);
  if (!row.evidence?.quote) c = Math.min(c, 0.6);

  return Math.max(0, Math.min(1, Math.round(c * 100) / 100));
}

// ---------------------------------------------------------------------------
// Accuracy report — grade an extraction against hand-verified data.
// ---------------------------------------------------------------------------

export type CurrentSeason = {
  id: string;
  species: string;
  zone: string | null;
  method: string;
  label: string | null;
  season_year: number;
  open_date: string | null;
  close_date: string | null;
};

export type AccuracyReport = {
  total_extracted: number;
  total_current: number;
  exact: number;
  date_mismatch: { identity: string; current: string; extracted: string }[];
  only_extracted: string[];
  only_current: string[];
  accuracy: number; // exact / total_current, 0..1
};

const range = (o: string | null, c: string | null) => `${o ?? '?'}..${c ?? '?'}`;

/**
 * Grade an extraction against hand-verified data.
 *
 * Matching runs in two passes, because a label is prose and prose varies:
 *   1. exact identity (group + normalized label)
 *   2. for whatever is left, same group AND identical dates — a season whose
 *      dates agree exactly is the same season even if one source calls it
 *      "firearms" and the other "firearms (one day)".
 * Only what survives both passes is reported as added or missing.
 */
export function accuracyReport(extracted: ExtractedSeason[], current: CurrentSeason[]): AccuracyReport {
  const exRows = extracted.map((r) => ({
    key: seasonIdentity(r),
    group: seasonGroup(r),
    open: normalizeExtractedDate(r.open_date),
    close: normalizeExtractedDate(r.close_date),
  }));
  const curRows = current.map((r) => ({
    key: seasonIdentity(r),
    group: seasonGroup(r),
    open: r.open_date,
    close: r.close_date,
  }));

  const exUsed = new Array(exRows.length).fill(false);
  const curUsed = new Array(curRows.length).fill(false);

  let exact = 0;
  const date_mismatch: AccuracyReport['date_mismatch'] = [];

  // Pass 1 — same group, same normalized label.
  for (let ci = 0; ci < curRows.length; ci++) {
    const c = curRows[ci];
    const ei = exRows.findIndex((e, i) => !exUsed[i] && e.key === c.key);
    if (ei === -1) continue;
    exUsed[ei] = true;
    curUsed[ci] = true;
    const e = exRows[ei];
    if (e.open === c.open && e.close === c.close) exact++;
    else date_mismatch.push({ identity: c.key, current: range(c.open, c.close), extracted: range(e.open, e.close) });
  }

  // Pass 2 — same group, identical dates, label wording ignored.
  for (let ci = 0; ci < curRows.length; ci++) {
    if (curUsed[ci]) continue;
    const c = curRows[ci];
    const ei = exRows.findIndex(
      (e, i) => !exUsed[i] && e.group === c.group && e.open === c.open && e.close === c.close,
    );
    if (ei === -1) continue;
    exUsed[ei] = true;
    curUsed[ci] = true;
    exact++;
  }

  const only_extracted = exRows.filter((_, i) => !exUsed[i]).map((e) => e.key);
  const only_current = curRows.filter((_, i) => !curUsed[i]).map((c) => c.key);

  return {
    total_extracted: exRows.length,
    total_current: curRows.length,
    exact,
    date_mismatch,
    only_extracted,
    only_current,
    accuracy: curRows.length === 0 ? 0 : Math.round((exact / curRows.length) * 1000) / 1000,
  };
}

// ---------------------------------------------------------------- fishing ---

export type ExtractedFishingRule = {
  species?: string[] | null;
  limit_basis?: string | null;
  water?: string | null;
  season_year?: number | null;
  size_rule?: string | null;
  min_length_inches?: number | null;
  max_length_inches?: number | null;
  daily_limit_kind?: string | null;
  daily_limit?: number | null;
  possession_limit?: number | null;
  trophy_allowance?: number | null;
  trophy_min_length_inches?: number | null;
  restrictions?: string[] | null;
  effective_from?: string | null;
  effective_to?: string | null;
  notes?: string | null;
  evidence?: { page?: number | null; quote?: string | null } | null;
};

export const FISHING_RESTRICTIONS = new Set([
  'artificial_only', 'flies_only', 'single_hook', 'barbless', 'no_live_bait',
  'one_pole_handheld', 'catch_and_release', 'reservation_required',
  'daylight_only', 'no_night_fishing', 'youth_senior_disabled_only',
  'trout_licence_required',
]);

/**
 * Check a proposed fishing rule against the shapes the database will enforce.
 *
 * Every one of these mirrors a CHECK constraint. Catching them here turns a
 * failed insert -- which surfaces as a stack trace a long way from the page
 * that caused it -- into a validation error on the review card, next to the
 * quote it came from.
 */
export function validateFishingRule(row: ExtractedFishingRule): WindowValidation {
  const errors: string[] = [];
  const species = row.species ?? [];
  if (species.length === 0) errors.push('names no species');
  if (row.limit_basis && !['aggregate', 'per_species'].includes(row.limit_basis)) {
    errors.push(`unknown limit_basis ${row.limit_basis}`);
  }

  const sizeRule = row.size_rule ?? 'none';
  const min = row.min_length_inches ?? null;
  const max = row.max_length_inches ?? null;
  if (sizeRule === 'minimum' && min === null) errors.push('minimum size rule with no minimum length');
  if (sizeRule === 'maximum' && max === null) errors.push('maximum size rule with no maximum length');
  if ((sizeRule === 'slot_release' || sizeRule === 'slot_keep') && (min === null || max === null)) {
    errors.push(`${sizeRule} needs both a minimum and a maximum length`);
  }
  if (min !== null && max !== null && max < min) {
    errors.push(`maximum length ${max} is below the minimum ${min}`);
  }
  for (const [label, v] of [['minimum', min], ['maximum', max]] as [string, number | null][]) {
    // A freshwater fish longer than eight feet is a misread table, not a fish.
    if (v !== null && (v <= 0 || v > 96)) errors.push(`implausible ${label} length ${v} inches`);
  }

  const kind = row.daily_limit_kind ?? 'unknown';
  const daily = row.daily_limit ?? null;
  if (kind === 'count' && daily === null) errors.push('daily limit kind is count but no number given');
  if (kind === 'no_limit' && daily !== null) errors.push('daily limit kind is no_limit but a number was given');
  if (kind === 'prohibited' && (daily ?? 0) !== 0) errors.push('prohibited but a non-zero limit was given');
  for (const [label, v] of [
    ['daily', daily], ['possession', row.possession_limit ?? null],
    ['trophy', row.trophy_allowance ?? null],
  ] as [string, number | null][]) {
    if (v !== null && (v < 0 || v > 1000)) errors.push(`implausible ${label} limit ${v}`);
  }

  // A trophy allowance without its length is half a rule, and the half that
  // is missing is the half that tells you which fish it is about.
  if ((row.trophy_allowance ?? null) !== null && (row.trophy_min_length_inches ?? null) === null) {
    errors.push('trophy allowance with no length to measure it against');
  }

  for (const r of row.restrictions ?? []) {
    if (!FISHING_RESTRICTIONS.has(r)) errors.push(`unknown restriction ${r}`);
  }

  const from = row.effective_from ?? null;
  const to = row.effective_to ?? null;
  if ((from === null) !== (to === null)) {
    errors.push('an effective window needs both dates or neither');
  }
  for (const [label, d] of [['effective_from', from], ['effective_to', to]] as [string, string | null][]) {
    if (d !== null && !/^\d{4}-\d{2}-\d{2}$/.test(d)) errors.push(`${label} is not an ISO date: ${d}`);
  }

  return { ok: errors.length === 0, errors };
}

/** How a number appears when a page prints it. */
export function numberToken(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n).replace(/0+$/, '').replace(/\.$/, '');
}

export type FishingGrounding = {
  basis: 'document' | 'quote' | 'none';
  /** How much of the rule's subject -- its water, or its species -- the row we
   *  matched actually names. Null when there were no blocks to check. */
  nameMatch: number | null;
  nameTokens: number;
  rowText: string | null;
  numbersFound: string[];
  numbersMissing: string[];
  datesFound: string[];
  datesMissing: string[];
};

/**
 * Ground a fishing rule, anchoring on its NAME and checking its numbers.
 *
 * This is the reverse of how a draw deadline is grounded, and the reason is
 * worth keeping. For an application window the date is the distinctive thing:
 * "2027-02-24" appears on a page a handful of times, so finding it and then
 * asking whether the row names the right hunt is a real test.
 *
 * A fishing rule's facts are small integers. "10" appears all over a
 * regulations page -- in limits, in highway numbers, in dates. Anchoring on
 * the number would be the page-level mistake again, in a worse form, because
 * every row would corroborate every other row's limit.
 *
 * So: find the row that names this water (or this species), then check the
 * numbers appear THERE. The name is the anchor and the number is the test.
 *
 * Dates are different again, and are checked against the whole document on
 * purpose. A state states a rule window once, in a paragraph -- "artificial
 * lures only with one single hook per lure from Nov. 1 - May 14" -- and then
 * lists the waters it applies to. Requiring those dates on each water's own
 * row would fail every correctly-read delayed-harvest stream in Georgia.
 */
export function groundFishingRule(
  blocks: string[] | null,
  text: string | null,
  quote: string | null,
  subject: string | null,
  numbers: (number | null)[],
  dates: (string | null)[],
): FishingGrounding {
  const wantNumbers = numbers.filter((n): n is number => n !== null && n !== undefined)
    .map(numberToken);
  const dateCheck = groundDates(text, quote, dates);

  const haystack = text ?? quote ?? null;
  const basis: FishingGrounding['basis'] = text ? 'document' : quote ? 'quote' : 'none';

  if (!blocks || blocks.length === 0 || !subject) {
    // Without rows we can still say whether the numbers appear at all, which
    // is weak and is scored as weak.
    const hay = haystack ? words(expandCompressedRanges(haystack)) : [];
    const set = new Set(hay);
    return {
      basis,
      nameMatch: null,
      nameTokens: distinctiveNameTokens(subject).length,
      rowText: null,
      numbersFound: wantNumbers.filter((n) => set.has(n)),
      numbersMissing: wantNumbers.filter((n) => !set.has(n)),
      datesFound: dateCheck.found,
      datesMissing: dateCheck.missing,
    };
  }

  // The row that names this subject, preferring one that also carries the
  // numbers -- so a page naming a water twice is judged on the mention that
  // actually states the rule.
  let best = 0;
  let bestText: string | null = null;
  let bestFound: string[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const context = `${headingFor(blocks, i)} ${blocks[i]}`;
    const m = nameMatchScore(context, subject);
    if (m < ROW_NAME_THRESHOLD) continue;
    const set = new Set(words(context));
    const found = wantNumbers.filter((n) => set.has(n));
    if (m > best || (m === best && found.length > bestFound.length)) {
      best = m;
      bestFound = found;
      bestText = context.trim().slice(0, 300);
    }
  }

  if (bestText === null) {
    // Nothing on the page looks like this subject at all.
    return {
      basis,
      nameMatch: 0,
      nameTokens: distinctiveNameTokens(subject).length,
      rowText: null,
      numbersFound: [],
      numbersMissing: wantNumbers,
      datesFound: dateCheck.found,
      datesMissing: dateCheck.missing,
    };
  }

  return {
    basis,
    nameMatch: best,
    nameTokens: distinctiveNameTokens(subject).length,
    rowText: bestText,
    numbersFound: bestFound,
    numbersMissing: wantNumbers.filter((n) => !bestFound.includes(n)),
    datesFound: dateCheck.found,
    datesMissing: dateCheck.missing,
  };
}

/**
 * Score a fishing rule, 0 to 1. 0.85 is the auto-approve gate.
 *
 *   named row carries every
 *     number, dates on page    -> up to 0.90
 *   a rule that asserts no
 *     numbers at all (gear or
 *     access only)             -> up to 0.90 if the row is named
 *   row found but a number
 *     is not on it             -> capped 0.30: the number is the rule
 *   no row names this subject  -> capped 0.40
 *   subject too vague to match -> capped 0.60
 *   quote only (a PDF)         -> capped 0.80
 *   a date not on the page     -> capped 0.30
 *   validation failed          -> capped 0.30
 */
export function scoreFishingRuleConfidence(
  row: ExtractedFishingRule,
  v: WindowValidation,
  g: FishingGrounding,
): number {
  let c = typeof (row as { confidence?: number }).confidence === 'number'
    ? Math.max(0, Math.min(1, (row as { confidence: number }).confidence))
    : 0.5;

  if (g.datesMissing.length > 0) {
    c = Math.min(c, 0.3);
  } else if (g.numbersMissing.length > 0) {
    // The number IS the rule. A limit we cannot find beside the thing it
    // limits is not a limit we can publish.
    c = Math.min(c, 0.3);
  } else if (g.basis === 'quote') {
    c = Math.min(c, 0.8);
  } else if (g.nameMatch === null) {
    c = Math.min(c, 0.5);
  } else if (g.nameMatch === 0) {
    c = Math.min(c, 0.4);
  } else if (g.nameTokens < 2) {
    c = Math.min(c, 0.6);
  } else if (g.basis === 'document' && g.nameMatch >= ROW_NAME_THRESHOLD) {
    c = Math.max(c, 0.9);
  } else {
    c = Math.min(c, 0.6);
  }

  if (!v.ok) c = Math.min(c, 0.3);
  if (!row.evidence?.quote) c = Math.min(c, 0.6);
  return Math.round(c * 100) / 100;
}
