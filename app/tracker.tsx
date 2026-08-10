import { Stack, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppText, Button, Card, Pill, Screen } from '@/components/ui';
import { useApplications, type ApplicationWithRefs } from '@/features/applications/queries';
import { useRequirePro } from '@/hooks/useRequirePro';
import { formatDate } from '@/lib/date';
import { openExternalUrl } from '@/lib/openUrl';
import { spacing, theme } from '@/theme';
import type { ApplicationStatus } from '@/lib/database.types';

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  planned: 'Planned',
  applied: 'Applied',
  successful: 'Drawn',
  unsuccessful: 'Unsuccessful',
  purchased: 'Purchased',
};
function statusColor(s: ApplicationStatus): string {
  if (s === 'successful' || s === 'purchased') return theme.color.success;
  if (s === 'unsuccessful') return theme.color.danger;
  if (s === 'applied') return theme.color.accent;
  return theme.color.surfaceElevated;
}

export default function Applications() {
  const router = useRouter();
  const { data: apps = [], isLoading } = useApplications();
  const requirePro = useRequirePro();

  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: true, title: 'My Applications' }} />
      <View style={{ gap: spacing.xs }}>
        <AppText variant="h1">My Applications</AppText>
        <AppText variant="body" color={theme.color.textSecondary}>
          Your record of what you've applied for. Your password isn't stored here — keep it in your phone's password manager.
        </AppText>
      </View>

      <Button title="+ Add an application" onPress={() => requirePro() && router.push('/application-edit')} />

      {isLoading ? (
        <ActivityIndicator color={theme.color.accent} style={{ marginTop: spacing.lg }} />
      ) : apps.length === 0 ? (
        <Card>
          <AppText variant="body" color={theme.color.textSecondary}>
            Nothing tracked yet. Add one above, or tap "Track this application" on a tag deadline.
          </AppText>
        </Card>
      ) : (
        apps.map((a) => <AppRow key={a.id} app={a} onPress={() => router.push(`/application-edit?id=${a.id}`)} />)
      )}
    </Screen>
  );
}

function AppRow({ app, onPress }: { app: ApplicationWithRefs; onPress: () => void }) {
  return (
    <Card onPress={onPress}>
      <View style={styles.header}>
        <AppText variant="h3" numberOfLines={2} style={{ flex: 1 }}>
          {app.title}
        </AppText>
        <Pill label={STATUS_LABEL[app.status]} color={statusColor(app.status)} textColor={theme.color.textPrimary} />
      </View>

      <AppText variant="caption" color={theme.color.textSecondary}>
        {[app.state?.name, app.species?.name].filter(Boolean).join(' · ') || 'No state/species set'}
      </AppText>

      <View style={styles.meta}>
        {app.applied_on ? (
          <AppText variant="caption" color={theme.color.textMuted}>
            Applied {formatDate(app.applied_on)}
          </AppText>
        ) : null}
        {app.results_on ? (
          <AppText variant="caption" color={theme.color.textMuted}>
            Results {formatDate(app.results_on)}
          </AppText>
        ) : null}
        {app.portal_username ? (
          <AppText variant="caption" color={theme.color.textMuted}>
            @{app.portal_username}
          </AppText>
        ) : null}
      </View>

      {app.application_url ? (
        <Button
          variant="secondary"
          title="Open the portal"
          onPress={() => openExternalUrl(app.application_url)}
          style={{ marginTop: spacing.sm }}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xs },
});
