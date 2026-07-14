import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { AppText } from './ui';
import { spacing, theme } from '@/theme';

/**
 * Consistent back control for every stacked (non-tab) screen. Rendered as the
 * header's left item via the root Stack's screenOptions, so it shows up
 * automatically on season/window/regs details, follows, applications, alerts,
 * etc. Hidden when there's nothing to go back to.
 */
export function HeaderBack() {
  const router = useRouter();
  const navigation = useNavigation();
  if (!navigation.canGoBack()) return null;
  return (
    <Pressable
      onPress={() => router.back()}
      hitSlop={12}
      style={{ flexDirection: 'row', alignItems: 'center', paddingRight: spacing.md }}
    >
      <Ionicons name="chevron-back" size={24} color={theme.color.accent} />
      <AppText variant="body" color={theme.color.accent}>
        Back
      </AppText>
    </Pressable>
  );
}
