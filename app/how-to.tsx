import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText, Card, Screen } from '@/components/ui';
import { DISCLAIMER, radius, spacing, theme } from '@/theme';

const STEPS = [
  {
    title: 'Pick your hunts',
    body: 'On the Home screen, choose your states and the animals you hunt. Everything in the app flows from what you pick here — tap a state to change it anytime.',
  },
  {
    title: 'Watch the countdowns',
    body: 'Your soonest season openers and tag deadlines show on Home and under Seasons, counting down the days so nothing sneaks up on you.',
  },
  {
    title: 'Get reminded',
    body: 'In Profile → Alerts, choose how far ahead you want a heads-up — from a year out down to the day of. We push a notification when it lands.',
  },
  {
    title: 'Track your applications',
    body: 'Under Tags, log what you applied for: the portal link, your username, dates, and results. We never store your passwords — keep those in your phone.',
  },
  {
    title: 'Apply & buy tags',
    body: 'Season and deadline screens link straight to the official state website, so you can apply for a draw or buy your license in a tap.',
  },
];

export default function HowTo() {
  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: true, title: 'How it works' }} />

      <View style={{ gap: spacing.xs }}>
        <AppText variant="h1">How Open Season works</AppText>
        <AppText variant="body" color={theme.color.textSecondary}>
          Five steps from setup to opening day.
        </AppText>
      </View>

      {STEPS.map((s, i) => (
        <Card key={s.title} style={styles.step}>
          <View style={styles.num}>
            <AppText variant="bodyStrong" color={theme.color.onAccent}>
              {i + 1}
            </AppText>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <AppText variant="h3">{s.title}</AppText>
            <AppText variant="body" color={theme.color.textSecondary}>
              {s.body}
            </AppText>
          </View>
        </Card>
      ))}

      <AppText variant="caption" color={theme.color.textMuted} style={{ marginTop: spacing.sm }}>
        {DISCLAIMER}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  num: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: theme.color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
});
