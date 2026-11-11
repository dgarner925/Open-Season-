import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { lang } from '@/theme/tokens';

const { color, space, type } = lang;

/**
 * The app's whole promise is "we'll remind you" — if the user declined the push
 * permission, every reminder silently never arrives. Renders nothing while
 * permission is granted/undetermined, and re-checks whenever the app returns to
 * the foreground (i.e. right after the user comes back from Settings).
 *
 * v2 form: an undecorated warning sentence placed above the content it
 * invalidates — weight by position, not by a tinted box (rule 10).
 */
export function NotificationsOffBanner() {
  const router = useRouter();
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let active = true;

    async function check() {
      try {
        const { status, canAskAgain } = await Notifications.getPermissionsAsync();
        // Only warn when the user has actually said no — not before first ask.
        if (active) setDenied(status === 'denied' && !canAskAgain);
      } catch {
        /* leave banner hidden if the check fails */
      }
    }

    check();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  if (!denied) return null;

  return (
    <Pressable
      // Goes to the explainer, not straight to Settings. For the users who
      // already declined, Settings IS the only way back -- but dropping
      // somebody into iOS Settings without first saying what they would be
      // turning on is how they got here in the first place.
      onPress={() => router.push('/notifications-why')}
      accessibilityRole="button"
      accessibilityLabel="Notifications are off — see what you are missing"
      style={({ pressed }) => [styles.block, pressed && { opacity: 0.75 }]}
    >
      <Text style={styles.line}>
        Notifications are off, so no reminder will reach you — not a season opener, not a tag
        sale, nothing you follow.{' '}
        <Text style={{ color: color.dim }}>›</Text>
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: space.x16, minHeight: 44, justifyContent: 'center' },
  line: { fontFamily: type.ui, fontSize: type.size.body, lineHeight: 23, color: color.bone },
});
