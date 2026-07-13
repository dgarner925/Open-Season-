import { Redirect } from 'expo-router';
import { AppText, Card, Screen } from '@/components/ui';
import { useAuth } from '@/providers/AuthProvider';
import { theme } from '@/theme';

/**
 * Admin review queue — full approve/reject workflow lands in the "Admin review
 * screen + extraction Edge Function" step. This is the gated shell.
 */
export default function Admin() {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Redirect href="/(tabs)" />;

  return (
    <Screen scroll>
      <AppText variant="h1">Review Queue</AppText>
      <Card>
        <AppText variant="body" color={theme.color.textSecondary}>
          Proposed changes from the automated extraction pipeline will appear here for approval before anything is
          published. Nothing auto-publishes.
        </AppText>
      </Card>
    </Screen>
  );
}
