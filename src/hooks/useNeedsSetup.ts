/**
 * Does this launch owe the user the setup flow?
 *
 * True only for an account that was created in the last day, has never
 * finished setup, and has not already been shown it on this device. All three
 * conditions matter:
 *
 *   · the age window keeps every existing account out of it. Plenty of people
 *     signed up before setup existed, or skipped it deliberately; shoving them
 *     into a wizard on an app update would be a worse bug than the one this
 *     fixes.
 *   · `onboarded_at` means they finished.
 *   · the device flag means they have seen it and chosen to skip, so the tabs
 *     never bounce them back into it.
 *
 * Guests are never caught: with no session there is nothing to set up, and
 * every date in the app reads without an account.
 */
import { useEffect, useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { hasSeenOnboarding, seenOnboardingSync } from '@/lib/onboardingSeen';

/** An account older than this is not new, whatever its onboarding column says. */
const NEW_ACCOUNT_MS = 24 * 60 * 60 * 1000;

export function useNeedsSetup(): { needsSetup: boolean; loading: boolean } {
  const { session, user, isOnboarded, isGuest } = useAuth();
  const [seen, setSeen] = useState<boolean | undefined>(seenOnboardingSync());

  useEffect(() => {
    let active = true;
    if (seen === undefined) {
      hasSeenOnboarding().then((v) => {
        if (active) setSeen(v);
      });
    }
    return () => {
      active = false;
    };
  }, [seen]);

  if (!session || isGuest || isOnboarded) return { needsSetup: false, loading: false };
  if (seen === undefined) return { needsSetup: false, loading: true };

  const createdAt = user?.created_at ? Date.parse(user.created_at) : NaN;
  const isNew = Number.isFinite(createdAt) && Date.now() - createdAt < NEW_ACCOUNT_MS;
  return { needsSetup: isNew && !seen, loading: false };
}
