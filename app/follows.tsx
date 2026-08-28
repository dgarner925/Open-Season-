import { Stack } from 'expo-router';
import { Screen, Sentence } from '@/components/system';
import { HuntPicker } from '@/features/follows/HuntPicker';
import { lang } from '@/theme/tokens';

export default function ManageFollows() {
  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: true, title: 'What you follow' }} />
      <Sentence style={{ marginTop: lang.space.x16 }}>
        Your hunts, state by state. Changes save instantly.
      </Sentence>
      <HuntPicker />
    </Screen>
  );
}
