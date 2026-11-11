import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Show a banner + play a sound when a notification arrives while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Push permission, and the one thing this file exists to get right.
 *
 * On 2026-11-11 the numbers said it plainly: 97 users, 91 of whom set up
 * follows, and only 41 reachable by any notification at all. 39 premium users,
 * 17 reachable. Four premium users follow Colorado turkey and not one of them
 * could be told when the tags go on sale.
 *
 * Nobody was being missed by accident. This file asked every signed-in user,
 * from `(tabs)/_layout` — in the first seconds of their first session, before
 * the app had shown them a single date. "OpenSeason would like to send you
 * notifications", no reason attached, from something they installed a moment
 * ago. On iOS that prompt comes once in the app's life, and more than half of
 * them spent it on "no".
 *
 * So the prompt is no longer fired on sight. `syncPushToken` runs on launch and
 * registers the device only if permission is ALREADY granted; it never asks.
 * `askForPush` is the only thing that prompts, and it is called from the
 * explainer screen, after someone has told us what they hunt — the one moment
 * when "we will tell you seven days before your tags go on sale" is a sentence
 * about them.
 */
export type PushState = 'granted' | 'denied' | 'undetermined' | 'unavailable';

/** What the OS currently thinks, without asking the user anything. */
export async function pushPermissionState(): Promise<PushState> {
  if (Platform.OS === 'web') return 'unavailable';
  try {
    const { status, canAskAgain } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return 'granted';
    // A 'denied' we can still ask about is really an un-asked prompt on
    // Android; only an unaskable denial is a decision the user has made.
    if (status === 'denied' && !canAskAgain) return 'denied';
    return 'undetermined';
  } catch {
    return 'unavailable';
  }
}

/**
 * Record what the OS said, so the next person asking "why can't we reach
 * these users" gets an answer instead of a theory.
 *
 * The old version of this file caught its own failures into `console.warn` and
 * dropped them, which is why the question took a day of guessing. Non-fatal
 * here too -- a failed write must never cost someone their notifications --
 * but it is written down where it can be read.
 */
async function recordState(userId: string, state: PushState): Promise<void> {
  if (state === 'unavailable') return;
  const { error } = await supabase
    .from('profiles')
    .update({ push_permission: state, push_permission_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) console.warn('[push] could not record permission state:', error.message);
}

async function storeToken(userId: string): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const { error } = await supabase
      .from('device_push_tokens')
      .upsert({ user_id: userId, token, platform: Platform.OS }, { onConflict: 'token' });
    if (error) {
      console.warn('[push] token upsert failed:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[push] could not get a token:', e);
    return false;
  }
}

/**
 * Launch-time housekeeping. Registers this device when permission is already
 * granted, and NEVER prompts.
 *
 * It still matters on every launch: a reinstall or an OS update issues a new
 * token, and an already-granted user whose token went stale is invisible to
 * the send job without ever having said no to anything.
 */
export async function syncPushToken(userId: string): Promise<void> {
  const state = await pushPermissionState();
  await recordState(userId, state);
  if (state !== 'granted') return;
  await storeToken(userId);
}

/**
 * Ask. The only place in the app that fires the OS prompt.
 *
 * Returns what happened so the caller can say something true afterwards:
 * on iOS a refusal is the last word the app gets, and pretending otherwise
 * ("we'll ask again later") would be a lie.
 */
export async function askForPush(userId: string): Promise<PushState> {
  if (Platform.OS === 'web') return 'unavailable';
  try {
    const before = await pushPermissionState();
    if (before === 'granted') {
      await storeToken(userId);
      return 'granted';
    }
    // Already refused for good: the OS will not show the prompt again, and
    // only Settings can undo it. Say so rather than appearing to do nothing.
    if (before === 'denied') {
      await recordState(userId, 'denied');
      return 'denied';
    }
    const { status } = await Notifications.requestPermissionsAsync();
    const after: PushState = status === 'granted' ? 'granted' : 'denied';
    await recordState(userId, after);
    if (after === 'granted') await storeToken(userId);
    return after;
  } catch (e) {
    console.warn('[push] asking failed:', e);
    return 'unavailable';
  }
}

/**
 * Kept so older call sites keep compiling, and deliberately the quiet one.
 * @deprecated Use `syncPushToken` on launch, or `askForPush` from the explainer.
 */
export const registerForPushNotifications = syncPushToken;
