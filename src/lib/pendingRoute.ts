/**
 * Where to put someone back after they sign in.
 *
 * A guest who taps Follow on a season page, signs in, and lands on a blank
 * Home has lost the thread -- they have to find that season again to do the
 * thing they already decided to do. `useRequireAccount` records the route they
 * were on before it sends them to sign-in, and the auth layout spends it once
 * the session settles.
 *
 * One slot, cleared on use, deliberately in memory rather than storage: it is
 * only meaningful for the few seconds between the tap and the session, and a
 * stale route surviving a relaunch would send someone somewhere they didn't
 * ask to go.
 *
 * It carries the route, not the action. Replaying the write itself would mean
 * a follow or a purchase firing with no screen in front of it; one more tap on
 * a page they recognise is the better trade.
 */
let pending: string | null = null;

export function setPendingRoute(route: string | null): void {
  pending = route;
}

/** Read and clear. Returns null when nothing is pending. */
export function takePendingRoute(): string | null {
  const route = pending;
  pending = null;
  return route;
}
