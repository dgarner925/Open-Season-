/**
 * The state you're browsing, when you aren't following anything yet.
 *
 * A guest has no `follows` rows -- there is no account to hang them on -- so
 * every followed- query returns nothing and the Seasons, Tags and Regs tabs
 * come up empty. One state code, stored on the device, is enough to fill all
 * three: RLS already lets `anon` read every published season, window and
 * summary, so a state is the only thing the app is missing.
 *
 * Deliberately device-local and not a profile column. It is a browsing
 * convenience, not a statement about where you hunt -- `profiles
 * .resident_state_id` is that, it means resident rules and legal shooting
 * light, and it should only ever be set by someone answering the question.
 *
 * Reads and writes are wrapped: AsyncStorage can throw (and does, on a device
 * with no writable storage), and a storage failure must never be the reason
 * someone can't look up a season date. The in-memory value still holds for the
 * session, so the app stays usable and simply forgets by the next launch.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const KEY = 'os.browseStateCode';

/** undefined = not read from disk yet; null = read, nothing stored. */
let cached: string | null | undefined;
const listeners = new Set<(code: string | null) => void>();

export async function loadBrowseStateCode(): Promise<string | null> {
  if (cached !== undefined) return cached;
  try {
    cached = (await AsyncStorage.getItem(KEY)) ?? null;
  } catch {
    cached = null;
  }
  return cached;
}

export async function setBrowseStateCode(code: string | null): Promise<void> {
  cached = code;
  // Tell every mounted screen first; persistence can fail without the UI lying.
  for (const listener of listeners) listener(code);
  try {
    if (code) await AsyncStorage.setItem(KEY, code);
    else await AsyncStorage.removeItem(KEY);
  } catch {
    /* session-only, by design */
  }
}

/**
 * `loading` is true only for the first tick of the first screen that asks --
 * after that the value is in memory. Screens should hold their list behind it
 * rather than flashing an empty state.
 */
export function useBrowseStateCode(): { code: string | null; loading: boolean } {
  const [code, setCode] = useState<string | null>(cached ?? null);
  const [loading, setLoading] = useState(cached === undefined);

  useEffect(() => {
    let active = true;
    if (cached === undefined) {
      loadBrowseStateCode().then((value) => {
        if (!active) return;
        setCode(value);
        setLoading(false);
      });
    }
    listeners.add(setCode);
    return () => {
      active = false;
      listeners.delete(setCode);
    };
  }, []);

  return { code, loading };
}
