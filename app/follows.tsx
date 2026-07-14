import { Stack } from 'expo-router';
import { View } from 'react-native';
import { AppText, Screen } from '@/components/ui';
import { FollowSelector } from '@/features/follows/FollowSelector';
import { spacing, theme } from '@/theme';

export default function ManageFollows() {
  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: true, title: 'What you follow' }} />
      <View style={{ gap: spacing.xs }}>
        <AppText variant="h1">What you follow</AppText>
        <AppText variant="body" color={theme.color.textSecondary}>
          Tap a species under each state to follow or unfollow it. Changes save instantly.
        </AppText>
      </View>
      <FollowSelector />
    </Screen>
  );
}
