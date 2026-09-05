import { Stack } from 'expo-router';
import { View } from 'react-native';
import { Rule, Screen, Sentence, Serif } from '@/components/system';
import { Disclaimer } from '@/components/Provenance';
import { lang } from '@/theme/tokens';

const { space } = lang;

const STEPS = [
  {
    title: 'Pick your hunts.',
    body: 'On the Home screen, choose your states and the animals you hunt. Everything in the app flows from what you pick here — tap a state to change it anytime.',
  },
  {
    title: 'Watch the countdowns.',
    body: 'Your soonest season openers and tag deadlines show on Home and under Seasons, counting down the days so nothing sneaks up on you.',
  },
  {
    title: 'Get reminded.',
    body: 'In Profile → Reminders, choose how far ahead you want a heads-up — from a year out down to the day of. We push a notification when it lands.',
  },
  {
    title: 'Track your applications.',
    body: 'Under Tags, log what you applied for: the portal link, your username, dates, and results. We never store your passwords — keep those in your phone.',
  },
  {
    title: 'Apply and buy tags.',
    body: 'Season and deadline screens link straight to the official state website, so you can apply for a draw or buy your license in a tap.',
  },
];

export default function HowTo() {
  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: true, title: 'How it works' }} />

      <Sentence style={{ marginTop: space.x16 }}>Five steps to opening day.</Sentence>

      {STEPS.map((s, i) => (
        <View key={s.title}>
          <Rule />
          <View style={{ flexDirection: 'row', gap: space.x16 }}>
            <Serif size={26} style={{ width: 24, textAlign: 'center' }}>
              {i + 1}
            </Serif>
            <View style={{ flex: 1, gap: space.x4 }}>
              <Sentence tone="bone">{s.title}</Sentence>
              <Sentence>{s.body}</Sentence>
            </View>
          </View>
        </View>
      ))}

      <View style={{ marginTop: space.section }}>
        <Disclaimer />
      </View>
    </Screen>
  );
}
