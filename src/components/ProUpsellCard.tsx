import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePremium } from '@/providers/PremiumProvider';
import { lang } from '@/theme/tokens';

const { color, space, type, radius } = lang;

/**
 * Quiet one-line upsell for free users — shown where the missing value is
 * felt (Home, Alerts). Renders nothing for Pro/grandfathered users.
 * Tile form, uniform with Home's other tiles (David, 2026-08-28).
 */
export function ProUpsellCard({ context = 'home' }: { context?: 'home' | 'alerts' }) {
  const router = useRouter();
  const { isPro, loading } = usePremium();
  if (isPro || loading) return null;
  const copy =
    context === 'alerts'
      ? 'These are set up but paused — Pro turns them on.'
      : 'Reminders are off on the free plan. Pro turns them on.';
  return (
    <Pressable
      onPress={() => router.push('/paywall')}
      accessibilityRole="button"
      style={({ pressed }) => [styles.tile, pressed && { opacity: 0.8 }]}
    >
      <Ionicons name="notifications-off-outline" size={20} color={color.copper} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.title}>Open Season Pro</Text>
        <Text style={styles.copy}>{copy}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={color.dim} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.x12,
    backgroundColor: color.surface,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hair,
    padding: space.x16,
    marginTop: space.x16,
  },
  title: { fontFamily: type.uiSemiBold, fontSize: type.size.body, color: color.bone },
  copy: { fontFamily: type.ui, fontSize: 13, lineHeight: 19, color: color.muted },
});
