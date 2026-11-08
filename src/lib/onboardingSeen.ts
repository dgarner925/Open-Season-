/**
 * Which accounts have already been shown setup on this device.
 *
 * Keyed by user id, not by device. The first cut stored a single flag for the
 * whole phone, so signing out and creating a second account found the flag
 * already set and skipped setup entirely — which is exactly what David hit on
 * build 101 ("I signed in with a new account and it went straight to the home
 * page").
 *
 * Device-local on purpose. It is a note about what this phone has displayed,
 * not a fact about the account; `profiles.onboarded_at` is that, and it is
 * only written when someone actually finishes. Marking here is also how "Skip
 * for now" stays skipped without claiming setup was completed.
 *
 * Storage can throw. A failure here must never block the app: the in-memory
 * set carries the session, and at worst setup is offered once more next
 * launch.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'os.onboardingSeen.v2';

/** undefined = not read from disk yet. */
let cached: Set<string> | undefined;

async function load(): Promise<Set<string>> {
  if (cached) return cached;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const ids = raw ? (JSON.parse(raw) as unknown) : [];
    cached = new Set(Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    cached = new Set();
  }
  return cached;
}

export async function hasSeenOnboarding(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  return (await load()).has(userId);
}

export async function markOnboardingSeen(userId: string | null | undefined): Promise<void> {
  if (!userId) return;
  const set = await load();
  if (set.has(userId)) return;
  set.add(userId);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify([...set]));
  } catch {
    /* session-only, by design */
  }
}

/** Synchronous read for a render pass; undefined until the first load lands. */
export function seenOnboardingSync(userId: string | null | undefined): boolean | undefined {
  if (!userId) return false;
  return cached ? cached.has(userId) : undefined;
}
