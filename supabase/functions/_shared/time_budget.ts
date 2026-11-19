/**
 * Will another source fit before the wall clock kills us?
 *
 * On 2026-11-19 the first gap-mode run was told to read eight sources. It read
 * two, stamped a third, and died 145 seconds in -- five short of the 150s edge
 * function wall clock. West Virginia took 62s, Colorado's big-game PDF took 83s.
 * There was never time for eight.
 *
 * Dying is not the expensive part. `last_extracted_at` is stamped BEFORE a
 * source is read, deliberately, so a poison page cannot stall the sweep for
 * ever -- which means the source we die on is recorded as read when nothing
 * read it. South Carolina's alligator and bear seasons were marked visited on
 * a night no request was ever made for them. The gap stays open and the ledger
 * says we looked. That is the worst shape a failure can take here: a default
 * that reads as data.
 *
 * So stop on purpose instead. Before starting another source, ask whether the
 * slowest one so far would still fit. If it would not, end the run and say so.
 * A short night that reports two is worth more than a long one that claims
 * three.
 *
 * Pure TypeScript on purpose -- no Deno or Node APIs -- so the Edge Function
 * and the Vitest suite can both import it.
 */

/** Supabase's wall clock for an Edge Function request. */
export const WALL_CLOCK_MS = 150_000;

/** Held back so the run can still write its response after the last source. */
export const RESPONSE_RESERVE_MS = 5_000;

export const DEFAULT_BUDGET_MS = WALL_CLOCK_MS - RESPONSE_RESERVE_MS;

/**
 * Whether to start another source.
 *
 * `longestMs` is the slowest source this run has finished, or null before any
 * has. The first source always runs: refusing to start it would mean a run
 * that does nothing at all, and we cannot know what a source costs without
 * reading one. After that the slowest so far is the estimate -- not the mean,
 * because being wrong low gets the worker killed and being wrong high only
 * costs us a source we can pick up tomorrow.
 */
export function timeForAnother(
  elapsedMs: number,
  longestMs: number | null,
  budgetMs: number = DEFAULT_BUDGET_MS,
): boolean {
  if (!Number.isFinite(elapsedMs)) return false;
  if (longestMs === null || !Number.isFinite(longestMs)) return true;
  // A negative duration means the clock is not to be trusted. Clamping it to
  // zero would read as a free source and buy one more read than we have time
  // for, which is the exact failure this module exists to stop.
  if (longestMs < 0) return false;
  if (elapsedMs >= budgetMs) return false;
  return elapsedMs + longestMs <= budgetMs;
}
