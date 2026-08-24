import { Stack } from 'expo-router';
import { AppText, Screen } from '@/components/ui';
import { PageTitle } from '@/components/midnight';
import { HuntPicker } from '@/features/follows/HuntPicker';
import { spacing, theme } from '@/theme';

export default function ManageFollows() {
  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: true, title: '' }} />
      <PageTitle lead="What you " accent="follow." />
      <AppText variant="body" color={theme.color.textSecondary} style={{ marginTop: spacing.sm }}>
        Your hunts, state by state. Changes save instantly.
      </AppText>
      <HuntPicker />
    </Screen>
  );
}
