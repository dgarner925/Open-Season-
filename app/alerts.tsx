import { Stack } from 'expo-router';
import { AppText, Card, Screen } from '@/components/ui';
import { theme } from '@/theme';

/**
 * Alert preferences editor — per-follow 30/7/1-day toggles for openers and
 * deadlines. Wired up in the "Alerts: prefs + pg_cron + Expo Push" step.
 */
export default function Alerts() {
  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: true, title: 'Alerts' }} />
      <AppText variant="h1">Alerts</AppText>
      <Card>
        <AppText variant="body" color={theme.color.textSecondary}>
          Choose how many days before each opener and tag deadline you want a push notification. Deadline alerts are on
          by default. (Coming in the notifications step.)
        </AppText>
      </Card>
    </Screen>
  );
}
