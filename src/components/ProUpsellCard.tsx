import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePremium } from '@/providers/PremiumProvider';
import { lang } from '@/theme/tokens';

const { color, space, type } = lang;

/**
 * Quiet one-line upsell for free users — shown where the missing value is
 * felt (Home, Alerts). Renders nothing for Pro/grandfathered users.
 * v2 form: a hairline row, not a card — position over decoration.
 */
export function ProUpsellCard({ context = 'home' }: { context?: 'home' | 'alerts' }) {
  const router = useRouter();
  const { isPro, loading } = usePremium();
  if (isPro || loading) return null;
  const copy =
    context === 'alerts'
      ? 'Reminders are paused on the free plan. Go Pro and every alert below starts working.'
      : 'You’re browsing free. Go Pro to get opener and deadline reminders for everything you follow.';
  return (
    <Pressable
      onPress={() => router.push('/paywall')}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.title}>Open Season Pro</Text>
        <Text style={styles.copy}>{copy}</Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color={color.dim} />
      <View style={styles.rule} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.x12, paddingVertical: space.x12, minHeight: 44 },
  title: { fontFamily: type.uiSemiBold, fontSize: type.size.body, color: color.bone },
  copy: { fontFamily: type.ui, fontSize: 13, lineHeight: 19, color: color.muted },
  rule: {
    position: 'absolute',
    left: 0,
    right: -space.gutter,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.hair,
  },
});
