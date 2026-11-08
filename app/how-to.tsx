import { Stack } from 'expo-router';
import { View } from 'react-native';
import { Screen, Sentence } from '@/components/system';
import { HowItWorksList } from '@/components/HowItWorksList';
import { HOW_IT_WORKS_LEDE } from '@/content/howItWorks';
import { Disclaimer } from '@/components/Provenance';
import { lang } from '@/theme/tokens';

const { space } = lang;

/**
 * The same five beats a new account meets as the first step of onboarding —
 * this is where anyone goes back to them. Both read from src/content/howItWorks.
 */
export default function HowTo() {
  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: true, title: 'How it works' }} />

      <Sentence style={{ marginTop: space.x16 }}>{HOW_IT_WORKS_LEDE}</Sentence>

      <HowItWorksList />

      <View style={{ marginTop: space.section }}>
        <Disclaimer />
      </View>
    </Screen>
  );
}
