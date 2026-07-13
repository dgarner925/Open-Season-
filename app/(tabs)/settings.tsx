import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText, Button, Card, Screen } from '@/components/ui';
import { useAuth } from '@/providers/AuthProvider';
import { spacing, theme } from '@/theme';

export default function Settings() {
  const router = useRouter();
  const { user, isAdmin, signOut } = useAuth();

  return (
    <Screen scroll>
      <AppText variant="h1">Settings</AppText>

      <Card>
        <AppText variant="overline" color={theme.color.textMuted}>
          ACCOUNT
        </AppText>
        <AppText variant="body">{user?.email ?? 'Signed in'}</AppText>
        {isAdmin && (
          <AppText variant="caption" color={theme.color.accent}>
            Admin
          </AppText>
        )}
      </Card>

      <Card onPress={() => router.push('/onboarding')}>
        <AppText variant="h3">What you follow</AppText>
        <AppText variant="body" color={theme.color.textSecondary}>
          Change your states and species.
        </AppText>
      </Card>

      <Card onPress={() => router.push('/alerts')}>
        <AppText variant="h3">Alerts</AppText>
        <AppText variant="body" color={theme.color.textSecondary}>
          Choose when to be notified before openers and deadlines.
        </AppText>
      </Card>

      <View style={{ marginTop: spacing.lg }}>
        <Button variant="ghost" title="Sign out" onPress={signOut} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({});
