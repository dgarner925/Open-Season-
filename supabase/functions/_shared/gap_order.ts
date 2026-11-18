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
 * Pure TypeScript on purpose -- no Deno or Node APIs -- so the Edge Function
 * and the Vitest suite can both import it.
 */

export type GapSource = {
  id: string;
  last_extracted_at?: string | null;
};

/**
 * Worst gap first; among sources of equal priority, the stalest first; then by
 * id so the order is deterministic rather than merely usually-stable.
 *
 * A source with no `last_extracted_at` has never been read, which makes it the
 * stalest there is.
 */
export function orderGapSources<T extends GapSource>(
  sources: readonly T[],
  priorityById: Map<string, number>,
  want: number,
): T[] {
  const take = Math.min(Math.max(Math.trunc(want) || 0, 1), 25);
  return sources
    .slice()
    .sort((a, b) => {
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
