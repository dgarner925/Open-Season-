import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

const COUNT_KEY = 'rate_open_count';
const DONE_KEY = 'rate_prompted';
const PROMPT_AT_OPEN = 5;

/**
 * Ask for an App Store rating at a moment of demonstrated value: the user's
 * 5th session with at least one followed hunt. Fires the native in-app rating
 * sheet (no navigation, dismissible), at most once ever from our side — iOS
 * additionally rate-limits to 3 prompts/year system-wide.
 */
export async function maybeRequestReview(hasFollows: boolean): Promise<void> {
  try {
    if (!hasFollows) return;
    if (await AsyncStorage.getItem(DONE_KEY)) return;
    const count = Number((await AsyncStorage.getItem(COUNT_KEY)) ?? '0') + 1;
    await AsyncStorage.setItem(COUNT_KEY, String(count));
    if (count < PROMPT_AT_OPEN) return;
    if (!(await StoreReview.hasAction())) return;
    await AsyncStorage.setItem(DONE_KEY, '1');
    await StoreReview.requestReview();
  } catch {
    // Rating is a nice-to-have; never let it break the app.
  }
}
