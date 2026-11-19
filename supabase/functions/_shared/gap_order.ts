/**
 * Which gap-carrying sources to read tonight, and in what order.
 *
 * Priority on its own is not an order. On 2026-11-18, 55 of the 56 sources
 * behind an actionable coverage gap sat at priority 100. Postgres hands a tie
 * like that back in the same sequence every night, and now that a page whose
 * bytes have not moved costs no model call, ordering by priority alone would
 * re-pick the same eight sources every night, skip all eight on the content
 * hash, spend nothing, and fill nothing. A cheap night is not a saving if it
 * reads nothing.
 *
 * `last_extracted_at` is stamped on every source before it is read for exactly
 * this reason, and the round-robin sweep already orders by it. Gap mode is the
 * query that forgot to.
 *
 * Priority is also not a licence to re-read. West Virginia's gap sits at 106
 * (`150 - daysOut`: a season opens in 44 days and is not published), which is
 * genuinely more urgent than the 100s -- so strict priority order handed it
 * slot one on 2026-11-19 and would have handed it slot one every night after,
 * hours after it was last read, while the content hash skipped it. That is the
 * deadlock above in miniature: urgency says *this gap matters most*, not *read
 * this page again today*. A source read within the last day therefore goes to
 * the back whatever its priority, for the same reason the hash check exists --
 * identical bytes cannot close a gap those same bytes already failed to close.
 *
 * Pure TypeScript on purpose -- no Deno or Node APIs -- so the Edge Function
 * and the Vitest suite can both import it.
 */

export type GapSource = {
  id: string;
  last_extracted_at?: string | null;
};

/**
 * A source read this recently has nothing new to give tonight. Twenty hours,
 * not twenty-four: the nightly run drifts, and a cooldown that outlasts the
 * gap between two runs would demote every source on the second one.
 */
export const RECENTLY_READ_MS = 20 * 60 * 60 * 1000;

function readRecently(at: string | null | undefined, nowMs: number): boolean {
  if (!at) return false;
  const t = Date.parse(at);
  if (!Number.isFinite(t)) return false;
  // A stamp in the future is a clock we cannot trust; treat it as just-read
  // rather than as infinitely stale.
  return nowMs - t < RECENTLY_READ_MS;
}

/**
 * Not-just-read first; then worst gap; then the stalest; then by id so the
 * order is deterministic rather than merely usually-stable.
 *
 * A source with no `last_extracted_at` has never been read, which makes it the
 * stalest there is.
 *
 * The cooldown demotes rather than excludes. If every gap-carrying source was
 * read today -- a second run an hour after the cron, say -- they all land in
 * the same bucket and the order is exactly what priority and staleness say it
 * is. Returning nothing would be a run that does nothing, which is worse.
 */
export function orderGapSources<T extends GapSource>(
  sources: readonly T[],
  priorityById: Map<string, number>,
  want: number,
  nowMs: number = Date.now(),
): T[] {
  const take = Math.min(Math.max(Math.trunc(want) || 0, 1), 25);
  return sources
    .slice()
    .sort((a, b) => {
      const byCooldown =
        Number(readRecently(a.last_extracted_at, nowMs)) -
        Number(readRecently(b.last_extracted_at, nowMs));
      if (byCooldown !== 0) return byCooldown;
      const byPrio = (priorityById.get(b.id) ?? 0) - (priorityById.get(a.id) ?? 0);
      if (byPrio !== 0) return byPrio;
      const at = a.last_extracted_at ?? '';
      const bt = b.last_extracted_at ?? '';
      if (at !== bt) return at < bt ? -1 : 1;
      return String(a.id) < String(b.id) ? -1 : 1;
    })
    .slice(0, take);
}

/**
 * The worst priority each source carries, from the raw `coverage_gaps` rows.
 * Several gaps usually point at one source; it is read once, at its worst.
 */
export function worstPriorityBySource(
  rows: readonly { source_id?: string | null; priority?: number | null }[],
): Map<string, number> {
  const prio = new Map<string, number>();
  for (const r of rows) {
    const id = r.source_id;
    if (!id) continue;
    const p = Number(r.priority ?? 0);
    prio.set(id, Math.max(prio.get(id) ?? 0, Number.isFinite(p) ? p : 0));
  }
  return prio;
}
