/**
 * Does this launch owe the user the setup flow?
 *
 * Two conditions, both of them things the app can actually check:
 *
 *   · the account has never finished setup (`profiles.onboarded_at` is null)
 *   · this device has not already shown setup to this account, so "Skip for
 *     now" stays skipped and the tabs never bounce anyone back into it
 *
 * The first cut also demanded the account be under a day old, as a guard
 * against dragging long-standing users into a wizard on an app update. That
 * guard was a heuristic that could only ever fail silently, and the flow it
 * was guarding did not run at all for David's new account on build 101. It is
 * gone: an account with no `onboarded_at` genuinely has not been set up, the
 * first screen asks nothing, and one tap skips the rest.
 *
 * Guests are never caught — with no session there is nothing to set up, and
 * every date in the app reads without an account.
 */
import { useEffect, useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { hasSeenOnboarding, seenOnboardingSync } from '@/lib/onboardingSeen';

export function useNeedsSetup(): { needsSetup: boolean; loading: boolean } {
  const { session, user, profile, isOnboarded, isGuest } = useAuth();
  const userId = user?.id ?? null;
  const [seen, setSeen] = useState<boolean | undefined>(seenOnboardingSync(userId));

  useEffect(() => {
    let active = true;
    setSeen(seenOnboardingSync(userId));
    hasSeenOnboarding(userId).then((v) => {
      if (active) setSeen(v);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  if (!session || isGuest || isOnboarded) return { needsSetup: false, loading: false };

  // The profile carries `onboarded_at`. Until it lands, "not onboarded" is a
  // guess, and guessing wrong here throws someone into setup they finished
  // months ago — so hold the screen rather than redirect on a null.
  if (!profile) return { needsSetup: false, loading: true };
  if (seen === undefined) return { needsSetup: false, loading: true };

  return { needsSetup: !seen, loading: false };
}
