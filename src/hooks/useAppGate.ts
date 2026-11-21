/**
 * Who is allowed into a tab group, and where they go instead.
 *
 * Lifted out of app/(tabs)/_layout.tsx unchanged when On the Water got its
 * own tab group, so the two groups cannot drift into two different answers
 * about whether you are signed in. The decision is here; what each group
 * RENDERS while it waits stays in that group, because the spinner is copper
 * in the woods and river on the water.
 *
 * What did NOT move: the push-token sync and the one-time notifications
 * explainer. They are side effects that must happen exactly once, and the
 * explainer writes its "already shown" key to AsyncStorage BEFORE navigating.
 * Copied into a second mounted layout, whichever group mounted first would
 * consume the key -- and the explainer would be shown on the water, or burned
 * without ever being shown at all. They stay in (tabs) alone, which is also
 * the only place they make sense: they are about hunting reminders.
 */
import { useAuth } from '@/providers/AuthProvider';
import { useBrowseStateCode } from '@/lib/browseState';
import { useNeedsSetup } from '@/hooks/useNeedsSetup';

export type AppGate =
  | { status: 'loading' }
  | { status: 'redirect'; href: '/(auth)/sign-in' | '/onboarding' }
  | { status: 'ready' };

export function useAppGate(): AppGate {
  const { loading, session } = useAuth();
  const { code: browseCode, loading: browseLoading } = useBrowseStateCode();
  const { needsSetup, loading: setupLoading } = useNeedsSetup();

  if (loading || browseLoading || setupLoading) return { status: 'loading' };

  // The tabs used to redirect to sign-in with no session, and to onboarding
  // with no `onboarded_at`. Both are gone: RLS already lets `anon` read every
  // published season, window and regulation summary, so the gate was purely
  // client-side and cost us every install that wasn't ready to make an account
  // first. Onboarding is now entered on purpose (Profile -> Set up your hunts),
  // not by redirect.
  //
  // A fresh install now opens on sign-in (David, 2026-11-08) rather than the
  // state picker. The door stays unlocked: "Look around first" on that screen
  // goes to the picker, and from there everything reads without an account.
  // It must not point back at the tabs, or this redirect bounces it straight
  // back to sign-in.
  if (!session && !browseCode) return { status: 'redirect', href: '/(auth)/sign-in' };

  // A brand-new account goes through setup once, so the how-it-works steps
  // are the first thing it meets rather than an empty Home (David,
  // 2026-11-08). Only ever once, and only for an account made in the last
  // day: see useNeedsSetup for why each condition is there, and why "Skip
  // for now" does not land straight back here.
  if (needsSetup) return { status: 'redirect', href: '/onboarding' };

  return { status: 'ready' };
}
