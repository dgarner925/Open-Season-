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
  const species = r.species_id ?? r.species ?? '';
  const zone = (r.zone_id ?? r.zone ?? 'Statewide') || 'Statewide';
  const label = (r.label ?? '').trim().toLowerCase();
  return [species, String(zone).trim().toLowerCase(), r.method, r.season_year, label].join('|');
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

export function accuracyReport(extracted: ExtractedSeason[], current: CurrentSeason[]): AccuracyReport {
  const ex = new Map<string, ExtractedSeason>();
  for (const r of extracted) ex.set(seasonIdentity(r), r);
  const cur = new Map<string, CurrentSeason>();
  for (const r of current) cur.set(seasonIdentity(r), r);

  let exact = 0;
  const date_mismatch: AccuracyReport['date_mismatch'] = [];
  const only_current: string[] = [];

  for (const [key, c] of cur) {
    const e = ex.get(key);
    if (!e) {
      only_current.push(key);
      continue;
    }
    const eo = normalizeExtractedDate(e.open_date);
    const ec = normalizeExtractedDate(e.close_date);
    if (eo === c.open_date && ec === c.close_date) exact++;
    else date_mismatch.push({ identity: key, current: range(c.open_date, c.close_date), extracted: range(eo, ec) });
  }

  const only_extracted = [...ex.keys()].filter((k) => !cur.has(k));

  return {
    total_extracted: ex.size,
    total_current: cur.size,
    exact,
    date_mismatch,
    only_extracted,
    only_current,
    accuracy: cur.size === 0 ? 0 : Math.round((exact / cur.size) * 1000) / 1000,
  };
}
