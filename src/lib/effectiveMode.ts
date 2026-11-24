/**
 * Which half of the app a reader should be in — the decision, with nothing
 * else in the file.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS NOT IN useEffectiveMode.ts
 *
 * It was, and the test could not import it. Anything reaching
 * ModeProvider, browseState or the query layer pulls in react-native, whose
 * index.js uses Flow's `import typeof` and fails to parse under vitest. That
 * is why every test in this project covers a module with no react-native in
 * its import graph — so this module has none, and takes the state list as a
 * plain shape rather than importing StateRow.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT DECIDES
 *
 * On the Water has launched in six states: GA, AL, FL, TN, MS, SC (see
 * states.otw_launched and migration 20261222000000). The stored mode knows
 * nothing about that — it is one AsyncStorage key written by a toggle, and
 * it outlives the reader changing which state they browse. So someone who
 * chose Water in Georgia and then switched to Ohio has mode === 'otw' and
 * no fishing rules to show for it.
 *
 * Fishing is the effective mode only when it is BOTH chosen and available.
 * Otherwise the woods, which every state has.
 *
 * ---------------------------------------------------------------------------
 * WHY ONE FUNCTION AND NOT A CONDITION IN EACH LAYOUT
 *
 * app/(tabs)/_layout.tsx redirects when the mode IS 'otw' and
 * app/(otw)/_layout.tsx redirects when it is NOT. Those conditions are exact
 * opposites on purpose: that is what stops a reader ping-ponging between the
 * two groups forever. Writing "...and the state has launched" into each by
 * hand would be two chances to get the negation wrong, and the result is an
 * infinite redirect on a phone rather than a failing test.
 */

/** The two halves of the app. The canonical definition; ModeProvider re-exports it. */
export type Mode = 'hunt' | 'otw';

/**
 * Just enough of a state row to answer the question.
 *
 * `id` is here because the reader's state is not simply the one they are
 * browsing -- see viewerStateCode.
 */
export type ModeStateRow = { id: string; code: string; otw_launched: boolean };

/**
 * WHICH STATE THE READER IS IN. The bug that shipped in 1.4.8 (build 115).
 *
 * There are two ways the app knows a reader's state and they are not
 * interchangeable:
 *
 *   profiles.resident_state_id   where they said they live, set at onboarding
 *   browseStateCode              a device-local browsing convenience, and
 *                                explicitly NOT a statement about where they
 *                                hunt (see lib/browseState.ts)
 *
 * Both Home screens resolve resident FIRST and fall back to browse. The mode
 * gate read browseStateCode on its own -- so for every reader who finished
 * onboarding and never picked a browse state, the code was null, no state
 * matched, otwAvailable was false, and ModeToggle returned null. On the Water
 * was in the binary and unreachable by exactly the users who had completed
 * setup. It looked like the feature had not shipped.
 *
 * One resolution, shared, so the gate and the screens cannot drift again.
 */
export function viewerStateCode(input: {
  residentStateId: string | null | undefined;
  browseCode: string | null;
  states: readonly ModeStateRow[] | undefined;
}): string | null {
  const resident = input.residentStateId
    ? (input.states?.find((s) => s.id === input.residentStateId)?.code ?? null)
    : null;
  return resident ?? input.browseCode ?? null;
}

export function resolveEffectiveMode(input: {
  stored: Mode;
  residentStateId: string | null | undefined;
  browseCode: string | null;
  states: readonly ModeStateRow[] | undefined;
}): { mode: Mode; otwAvailable: boolean; code: string | null } {
  const code = viewerStateCode(input);

  // No state chosen yet means nothing to look up, which is NOT the same as a
  // state that has not launched -- but either way there is no fishing to
  // offer, so the effective mode is the woods. The sign-in and state-picker
  // redirects in useAppGate run first for that reader anyway.
  //
  // `states` undefined is the query still in flight, and it resolves to
  // unavailable. That is why callers gate on `ready` rather than on this: a
  // Georgia angler judged un-launched for the one frame before the query
  // lands would be bounced out of the water on every cold start. Treating
  // "not loaded yet" as "not launched" is the swallowed-failure shape -- a
  // default standing in for an answer -- and `ready` is what keeps it from
  // reaching the reader.
  const otwAvailable = !!code && !!input.states?.some((s) => s.code === code && s.otw_launched);

  return {
    mode: input.stored === 'otw' && otwAvailable ? 'otw' : 'hunt',
    otwAvailable,
    code,
  };
}
