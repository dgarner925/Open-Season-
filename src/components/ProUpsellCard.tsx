import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText, Card } from '@/components/ui';
import { usePremium } from '@/providers/PremiumProvider';
import { spacing, theme } from '@/theme';

/**
 * Quiet one-line upsell for free users — shown where the missing value is
 * felt (Home, Alerts). Renders nothing for Pro/grandfathered users.
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
    <Card variant="flat" onPress={() => router.push('/paywall')} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <Ionicons name="notifications-off-outline" size={20} color={theme.color.accent} />
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong">Open Season Pro</AppText>
        <AppText variant="caption" color={theme.color.textSecondary}>
          {copy}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.color.textMuted} />
    </Card>
  );
}
