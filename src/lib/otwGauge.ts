/**
 * Which gauge On the Water is reading, stored on the device.
 *
 * The same shape as browseState.ts, for the same reasons: one value, a
 * listener set so every mounted screen updates together, and writes that can
 * fail without the UI lying about what it is showing. AsyncStorage throws on
 * devices with no writable storage, and a storage failure must never be why
 * someone cannot see a river's flow -- the in-memory value carries the
 * session and the app simply forgets by the next launch.
 *
 * Device-local on purpose, like the browse state. It is a note about what
 * this phone is looking at, not a fact about the account. When fishing gets a
 * follow model (Phase 3's `user_waters`) the followed water becomes the real
 * statement and this stays a convenience.
 *
 * A stored site number is validated against GAUGES on read. A build that
 * drops a gauge would otherwise leave a phone pinned to a site number nothing
 * can resolve, and the card would show an empty gauge forever with no way
 * back; an unrecognised value falls back to the default instead.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { DEFAULT_SITE_NO, gaugeFor } from '@/features/otw/gauges';

const KEY = 'os.otw.gauge.v1';

/** undefined = not read from disk yet. */
let cached: string | undefined;
const listeners = new Set<(siteNo: string) => void>();

export async function loadGaugeSiteNo(): Promise<string> {
  if (cached !== undefined) return cached;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cached = raw && gaugeFor(raw) ? raw : DEFAULT_SITE_NO;
  } catch {
    cached = DEFAULT_SITE_NO;
  }
  return cached;
}

export async function setGaugeSiteNo(siteNo: string): Promise<void> {
  if (!gaugeFor(siteNo)) return;
  cached = siteNo;
  // Screens first; persistence can fail without the card showing the wrong
  // gauge for the rest of the session.
  for (const listener of listeners) listener(siteNo);
  try {
    await AsyncStorage.setItem(KEY, siteNo);
  } catch {
    /* session-only, by design */
  }
}

/**
 * `loading` is true only for the first tick of the first screen that asks.
 * The default is returned meanwhile, so the card has a gauge to draw rather
 * than a hole -- and because the default is also what an empty store means.
 */
export function useGaugeSiteNo(): { siteNo: string; loading: boolean } {
  const [siteNo, setSiteNo] = useState<string>(cached ?? DEFAULT_SITE_NO);
  const [loading, setLoading] = useState(cached === undefined);

  useEffect(() => {
    let active = true;
    if (cached === undefined) {
      loadGaugeSiteNo().then((value) => {
        if (!active) return;
        setSiteNo(value);
        setLoading(false);
      });
    }
    listeners.add(setSiteNo);
    return () => {
      active = false;
      listeners.delete(setSiteNo);
    };
  }, []);

  return { siteNo, loading };
}
