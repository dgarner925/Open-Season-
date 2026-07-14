import { Stack } from 'expo-router';
import { View } from 'react-native';
import { AppText, Screen } from '@/components/ui';
import { HuntPicker } from '@/features/follows/HuntPicker';
import { spacing, theme } from '@/theme';

export default function ManageFollows() {
  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: true, title: 'What you follow' }} />
      <View style={{ gap: spacing.xs }}>
        <AppText variant="h1">What you follow</AppText>
        <AppText variant="body" color={theme.color.textSecondary}>
          Pick a state, then tap the animals you hunt. Your hunts show up top — tap one to drop it. Changes save
          instantly.
        </AppText>
      </View>
      <HuntPicker />
    </Screen>
  );
}
