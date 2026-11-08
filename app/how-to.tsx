import { Stack } from 'expo-router';
import { View } from 'react-native';
import { Rule, Screen, Sentence } from '@/components/system';
import { HowItWorksList } from '@/components/HowItWorksList';
import { HOW_IT_WORKS, HOW_IT_WORKS_MORE } from '@/content/howItWorks';
import { Disclaimer } from '@/components/Provenance';
import { lang } from '@/theme/tokens';

const { space } = lang;

/**
 * The spine a new account meets during setup, and then everything else the
 * app does. Both lists live in src/content/howItWorks, so this page and the
 * setup step cannot drift.
 */
export default function HowTo() {
  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: true, title: 'How it works' }} />

      <Sentence style={{ marginTop: space.x16 }}>Three things, in this order.</Sentence>

      <HowItWorksList />

      <View style={{ marginTop: space.x32 }}>
        <Rule />
        <Sentence style={{ marginTop: space.x16 }}>And once you are set up:</Sentence>
      </View>

      <HowItWorksList steps={HOW_IT_WORKS_MORE} startAt={HOW_IT_WORKS.length + 1} />

      <View style={{ marginTop: space.x32 }}>
        <Disclaimer />
      </View>
    </Screen>
  );
}
