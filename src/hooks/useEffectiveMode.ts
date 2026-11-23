/**
 * The mode the app should actually be in, as opposed to the one stored.
 *
 * ---------------------------------------------------------------------------
 * WHY THE STORED MODE IS NOT ENOUGH
 *
 * On the Water has launched in six states (see states.otw_launched and
 * migration 20261222000000). The stored mode knows nothing about that: it is
 * one AsyncStorage key, written by a toggle, and it survives the reader
 * changing state. So an angler who switches to Water in Georgia and then
 * changes their browse state to Ohio has `mode === 'otw'` and no fishing
 * data to show for it.
 *
 * This resolves the two into one answer. Fishing is only the effective mode
 * when it is BOTH chosen and available; otherwise the woods, which every
 * state has.
 *
 * ---------------------------------------------------------------------------
 * WHY IT MUST BE ONE ANSWER AND NOT A CONDITION IN EACH LAYOUT
 *
 * app/(tabs)/_layout.tsx redirects when the mode IS 'otw' and
 * app/(otw)/_layout.tsx redirects when it is NOT. Those two conditions are
 * exact opposites on purpose -- that is what stops them ping-ponging a
 * reader between two groups forever. Adding "...and the state has launched"
 * to each by hand would be two chances to write the negation wrong, and the
 * bug it produces is an infinite redirect loop on a phone, not a failing
 * test.
 *
 * So both call this, and the opposition is preserved by construction. The
 * same hook decides whether the toggle renders at all, so the control and
 * the routing cannot disagree either.
 *
 * ---------------------------------------------------------------------------
 * READY, AND WHY IT MATTERS MORE THAN IT LOOKS
 *
 * `ready` folds in the states query. Without it, a reader in Georgia whose
 * stored mode is 'otw' would be judged un-launched for the frame before the
 * states arrive, get redirected to the woods, and have to toggle back every
 * cold start. Treating "not loaded yet" as "not launched" is the same
 * swallowed-failure shape as treating an absent rule as permission: a
 * default standing in for an answer.
 */
import { useActiveStates } from '@/features/reference/queries';
import { resolveEffectiveMode, type Mode } from '@/lib/effectiveMode';
import { useBrowseStateCode } from '@/lib/browseState';
import { useMode } from '@/providers/ModeProvider';

export type EffectiveMode = {
  /** What the app should render. 'hunt' whenever fishing is unavailable. */
  mode: Mode;
  /** The stored preference, regardless of availability. */
  stored: Mode;
  /** Has On the Water launched in the state being browsed. */
  otwAvailable: boolean;
  /** False until the stored mode AND the states list have both landed. */
  ready: boolean;
};

export function useEffectiveMode(): EffectiveMode {
  const { mode: stored, ready: modeReady } = useMode();
  const { code, loading: codeLoading } = useBrowseStateCode();
  const { data: states, isPending: statesPending } = useActiveStates();

  const { mode, otwAvailable } = resolveEffectiveMode({ stored, code, states });

  return {
    mode,
    stored,
    otwAvailable,
    ready: modeReady && !codeLoading && !statesPending,
  };
}
