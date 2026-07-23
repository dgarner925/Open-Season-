import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { AppState, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/ui';
import { radius, spacing, theme } from '@/theme';

/**
 * The app's whole promise is "we'll remind you" — if the user declined the push
 * permission, every reminder silently never arrives. This banner surfaces that
 * state with a one-tap jump to the system settings. Renders nothing while
 * permission is granted/undetermined (undetermined means we haven't asked yet),
 * and re-checks whenever the app returns to the foreground (i.e. right after
 * the user comes back from Settings).
 */
export function NotificationsOffBanner() {
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
    <Pressable onPress={() => Linking.openSettings()} style={({ pressed }) => [styles.banner, pressed && { opacity: 0.8 }]}>
      <Ionicons name="notifications-off-outline" size={18} color={theme.color.warning} />
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong" style={{ fontSize: 13 }}>
          Notifications are off
        </AppText>
        <AppText variant="caption" color={theme.color.textSecondary}>
          You won't get opener or deadline reminders. Tap to turn them on in Settings.
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.color.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(217,168,106,0.10)', // warm warning tint on Ember
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(217,168,106,0.35)',
  },
});
