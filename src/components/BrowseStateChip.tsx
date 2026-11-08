/**
 * The header control for browse mode: which state you're reading, and a way to
 * change it. Only shown when the screen is browsing a state rather than
 * showing someone's follows, so a user with follows never sees it.
 *
 * Two shapes, same control: with a state it reads "Georgia · change"; with
 * none it is the invitation to pick one, which is the whole of a guest's
 * first-run flow.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui';
import { useActiveStates } from '@/features/reference/queries';
import { spacing, theme } from '@/theme';

export function BrowseStateChip({ stateCode }: { stateCode: string | null }) {
  const router = useRouter();
  const { data: states = [] } = useActiveStates();
  const name = stateCode ? (states.find((s) => s.code === stateCode)?.name ?? stateCode) : null;

  return (
    <Pressable
      onPress={() => router.push('/pick-state')}
      accessibilityRole="button"
      accessibilityLabel={name ? `Browsing ${name}. Change state.` : 'Pick a state to browse'}
      style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name="location-outline" size={14} color={theme.color.accentSoft} />
      <AppText variant="caption" color={theme.color.textSecondary}>
        {name ?? 'Pick a state'}
      </AppText>
      <View style={styles.sep} />
      <AppText variant="caption" color={theme.color.accentSoft}>
        change
      </AppText>
    </Pressable>
  );
}

/**
 * The empty state for a browsing screen with no state chosen yet. Deliberately
 * not an error and not a nag -- there is simply nothing to show until a state
 * is picked, and picking one is one tap away.
 */
export function BrowseStatePrompt({ line }: { line: string }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push('/pick-state')}
      accessibilityRole="button"
      style={({ pressed }) => [styles.prompt, pressed && { opacity: 0.8 }]}
    >
      <AppText variant="h3">Pick a state</AppText>
      <AppText variant="caption" color={theme.color.textSecondary}>
        {line}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: theme.color.surfaceFlat,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.borderFlat,
  },
  sep: { width: StyleSheet.hairlineWidth, height: 11, backgroundColor: theme.color.borderFlat },
  prompt: {
    marginTop: spacing.xl,
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: 16,
    backgroundColor: theme.color.surfaceFlat,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.borderFlat,
  },
});
