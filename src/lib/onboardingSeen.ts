/**
 * Whether this device has already shown setup to this account.
 *
 * A brand-new account is sent to /onboarding once, so the how-it-works steps
 * are the first thing it meets (David, 2026-11-08). Without a record of having
 * shown it, "Skip for now" would land back on the tabs, the same check would
 * fire, and the user would be trapped in setup — which is exactly the forced
 * onboarding that was removed for costing installs.
 *
 * Device-local on purpose. It is a note about what this phone has displayed,
 * not a fact about the account; `profiles.onboarded_at` is that, and it is
 * only written when someone actually finishes. Marking here is also how
 * "Skip for now" stays skipped without lying about having completed setup.
 *
 * Storage can throw. A failure here must never block the app: the in-memory
 * value carries the session, and at worst setup is offered once more on the
 * next launch.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'os.onboardingSeen';

/** undefined = not read from disk yet. */
let cached: boolean | undefined;

export async function hasSeenOnboarding(): Promise<boolean> {
  if (cached !== undefined) return cached;
  try {
    cached = (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    cached = false;
  }
  return cached;
}

export async function markOnboardingSeen(): Promise<void> {
  cached = true;
  try {
    await AsyncStorage.setItem(KEY, '1');
  } catch {
    /* session-only, by design */
  }
}

/** Synchronous read for a render pass; undefined until the first load lands. */
export function seenOnboardingSync(): boolean | undefined {
  return cached;
}
