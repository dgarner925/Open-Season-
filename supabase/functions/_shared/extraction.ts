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

export type Grounding = {
  /** 'document' = checked against the page we fetched; 'quote' = only against
   *  the model's own evidence quote; 'none' = could not check at all. */
  basis: 'document' | 'quote' | 'none';
  found: string[];
  missing: string[];
  quote: string | null;
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
    return { basis: haystack ? basis : 'none', found: [], missing: wanted, quote: null };
  }

  // Collapse whitespace and drop the comma/period noise agencies vary on, so
  // "Nov. 23 , 2026" and "Nov 23 2026" compare equal.
  const norm = (s: string) => s.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ');
  const hay = norm(haystack);

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

  return { basis, found, missing, quote: snippet };
}

/**
 * Confidence for a draw deadline, led by grounding rather than by self-report.
 *
 * The tiers, and why each is where it is:
 *   every date on the page      -> up to 0.95, can auto-approve
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

  if (g.basis === 'document' && g.missing.length === 0 && g.found.length > 0) {
    c = Math.max(c, 0.9);
  } else if (g.missing.length > 0) {
    c = Math.min(c, 0.3);
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
