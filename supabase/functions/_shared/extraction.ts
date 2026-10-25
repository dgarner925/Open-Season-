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
export function isLocalISODate(value: unknown): value is string {
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
