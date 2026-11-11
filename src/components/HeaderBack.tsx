import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Monogram } from './system';
import { spacing, theme } from '@/theme';

/**
 * The top-left of every stacked (non-tab) screen: the back control, and the
 * mark beside it.
 *
 * Rendered as the header's left item via the root Stack's screenOptions, so
 * it shows up automatically on season/window/regs details, follows,
 * applications, alerts, and the rest.
 *
 * Two deliberate choices:
 *
 * - The mark is here rather than in each screen's body because a stacked
 *   screen's top-left belongs to a native header the screen cannot reach.
 *   This is the only place it can sit in the corner (David, 2026-11-10:
 *   "add OS to all the pages... top left hand corner").
 * - The word "Back" is gone, leaving the chevron. It was what made room for
 *   the mark, and a lone chevron in the top-left is the one navigation
 *   gesture every phone owner already knows. The accessibility label still
 *   says Back, so nothing is lost to a screen reader.
 *
 * The mark shows even with nowhere to go back to, which is why this no longer
 * returns null -- a root stacked screen should still say which app it is.
 */
export function HeaderBack() {
  const router = useRouter();
  const navigation = useNavigation();
  const canGoBack = navigation.canGoBack();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingRight: spacing.md,
      }}
    >
      {canGoBack ? (
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color={theme.color.accent} />
        </Pressable>
      ) : null}
      <Monogram size={18} />
    </View>
  );
}
