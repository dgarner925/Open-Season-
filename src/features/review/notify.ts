import type { ReviewQueueRow } from '@/lib/database.types';

/**
 * How many of these proposals would actually tell somebody something.
 *
 * The sweep's "alert followers" switch used to be a guess: approving 300 clean
 * items either sent nothing or sent an unknown number of pushes, and the only
 * safe answer was to leave it off. Leaving it off is why three published
 * openers moved on 2026-11-02 and nobody was told.
 *
 * A date change reaches a follower only under the watchdog's conditions, so
 * this mirrors them exactly (20260731210100, 20261101120000):
 *
 *   - the item is an update, not a create — a new row logs nothing
 *   - its table carries dates the watchdog watches
 *   - the existing row is PUBLISHED — a draft is not yet a promise
 *   - the field moves between two KNOWN dates; a backfill (null → date) and a
 *     retraction (date → null) are deliberately silent, so loading data never
 *     spams anyone
 *
 * Keep this in step with log_season_date_change() and log_window_date_change().
 * If they diverge, the number on the screen becomes a lie, which is worse than
 * no number at all.
 */
const WATCHED_DATE_FIELDS: Record<string, readonly string[]> = {
  seasons: ['open_date', 'close_date'],
  application_windows: ['closes_at', 'results_expected_at'],
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** The date fields this proposal would announce. Empty means it is silent. */
export function notifyingFields(r: ReviewQueueRow): string[] {
  if (r.change_type !== 'update') return [];

  const fields = WATCHED_DATE_FIELDS[r.target_table];
  if (!fields) return [];

  const before = asRecord(r.current_snapshot);
  const after = asRecord(r.proposed_payload);
  if (!before || !after) return [];

  // The extractor's payload carries no status, so an update preserves it:
  // the snapshot is the authority on whether this row is published.
  if (before.status !== 'published') return [];

  return fields.filter((f) => {
    const a = before[f];
    const b = after[f];
    return typeof a === 'string' && typeof b === 'string' && a !== b;
  });
}

export function wouldNotify(r: ReviewQueueRow): boolean {
  return notifyingFields(r).length > 0;
}

/** How many separate pushes a sweep of these items would generate per follower. */
export function notifyCount(reviews: ReviewQueueRow[]): number {
  return reviews.reduce((n, r) => n + notifyingFields(r).length, 0);
}

/**
 * What to tell the admin before they sweep.
 *
 * States the thing before the number, and says plainly when the answer is
 * none — "no alerts" is the reassurance that makes the switch safe to leave
 * on, and an empty count is the common case.
 */
export function notifySentence(n: number): string {
  if (n === 0) return 'None of these move a published date, so no alerts go out either way.';
  if (n === 1) return 'One of these moves a published date. Followers of that hunt will be told.';
  return `${n} of these move a published date. Followers of those hunts will be told.`;
}
