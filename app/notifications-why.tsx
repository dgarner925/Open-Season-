import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Headline, Micro, Rule, Screen, Sentence, Serif } from '@/components/system';
import { useAuth } from '@/providers/AuthProvider';
import { askForPush, pushPermissionState, type PushState } from '@/lib/push';
import { lang } from '@/theme/tokens';

const { color, space, type } = lang;

/**
 * Why notifications, said once, properly.
 *
 * This screen exists because of a number: of 91 people who told the app what
 * they hunt, 50 could not be told anything back. They had all been asked — in
 * the first seconds of their first session, by an OS prompt with no reason
 * attached. On iOS that prompt comes once.
 *
 * So this is the reason, and it goes first. Three rules it holds itself to:
 *
 * 1. Be specific. "Stay updated" earns nothing. An hour and a date that will
 *    be gone by lunchtime earns the tap.
 * 2. Say what does NOT arrive. People decline because they expect to be sold
 *    to, and nothing reassures like a short, checkable list.
 * 3. Never pretend. Once iOS has a refusal on file the app cannot ask again,
 *    so a user who has already said no is told the truth and handed Settings.
 */
export default function NotificationsWhy() {
  const router = useRouter();
  const { user } = useAuth();
  const [state, setState] = useState<PushState | null>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    let active = true;
    pushPermissionState().then((s) => {
      if (active) setState(s);
    });
    return () => {
      active = false;
    };
  }, []);

  async function onAllow() {
    if (!user) return;
    setAsking(true);
    const result = await askForPush(user.id);
    setAsking(false);
    setState(result);
    if (result === 'granted') router.back();
  }

  const alreadyDenied = state === 'denied';
  const granted = state === 'granted';

  // Same rule as every other pushed screen: the native header already sits in
  // the top inset, so Screen claims left/right/bottom only. Taking 'top' here
  // too inset the content twice and left a hole above the headline.
  return (
    <Screen scroll>
      <Stack.Screen options={{ title: 'Reminders' }} />
      <View style={styles.header}>
        <Headline>A date you miss{'\n'}is a season you miss.</Headline>
        <Sentence style={{ marginTop: space.x16 }}>
          Oregon's leftover tags go on sale at 10 a.m. Pacific on the first of July. The good
          units are gone before lunch. Nobody announces it twice, and the page that holds the
          date is not a page anyone visits twice.
        </Sentence>
        <Sentence style={{ marginTop: space.x12 }}>
          That is the whole job here. Not a feed to check — a tap on the shoulder, on the days
          it would cost you something not to know.
        </Sentence>
      </View>

      <View style={styles.section}>
        <Micro>What arrives</Micro>
        {ARRIVES.map((a) => (
          <View key={a.when} style={styles.row}>
            <Serif style={styles.mark}>{a.mark}</Serif>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{a.when}</Text>
              <Text style={styles.rowBody}>{a.what}</Text>
            </View>
          </View>
        ))}
      </View>

      <Rule space={space.section} />

      <View>
        <Micro>What never arrives</Micro>
        {NEVER.map((n) => (
          <View key={n} style={styles.neverRow}>
            <Text style={styles.neverMark}>·</Text>
            <Text style={styles.neverText}>{n}</Text>
          </View>
        ))}
        <Sentence style={{ marginTop: space.x16, color: color.muted }}>
          Every reminder is one you asked for by following something, and you can change which
          ones arrive, or switch any of them off, whenever you like.
        </Sentence>
      </View>

      {granted ? (
        <View style={styles.action}>
          <Sentence>Reminders are on. Nothing else to do.</Sentence>
        </View>
      ) : alreadyDenied ? (
        <View style={styles.action}>
          <Sentence>
            Notifications are switched off for Open Season at the system level, and an app
            cannot ask twice — iOS only offers that choice once. It takes two taps in Settings
            to undo.
          </Sentence>
          <Pressable
            onPress={() => Linking.openSettings()}
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            <Text style={styles.buttonText}>Open Settings</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.action}>
          <Pressable
            onPress={onAllow}
            disabled={asking || !user}
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, pressed && styles.pressed, asking && styles.pressed]}
          >
            <Text style={styles.buttonText}>{asking ? 'One moment…' : 'Turn reminders on'}</Text>
          </Pressable>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryText}>Not now</Text>
          </Pressable>
          <Text style={styles.fineprint}>
            Your phone will ask next. It only asks once, so if you are not sure, "Not now" keeps
            the question open — this screen is here whenever you want it.
          </Text>
        </View>
      )}
    </Screen>
  );
}

/** The three offsets alert_preferences ships with, in the words they deserve. */
const ARRIVES = [
  {
    mark: '−7',
    when: 'A week before',
    what: 'Time to decide which unit you actually want, and to find your licence number before you need it.',
  },
  {
    mark: '−1',
    when: 'The day before',
    what: 'Licence account logged in, card to hand. The evening before is when this gets won.',
  },
  {
    mark: '0',
    when: 'The morning of',
    what: 'Hours before the sale opens, not after. For a 10 a.m. Mountain sale that is four hours of warning.',
  },
];

const NEVER = [
  'No marketing, ever. Not one.',
  'No "we miss you", no streaks, no badges.',
  'Nothing about a state or a species you have not followed.',
  'No more than one reminder a day, even in the busiest week of the season.',
];

const styles = StyleSheet.create({
  header: { marginTop: space.x16 },
  section: { marginTop: space.section },

  row: { flexDirection: 'row', gap: space.x12, alignItems: 'flex-start', marginTop: space.x16 },
  mark: {
    fontFamily: type.display,
    fontSize: 24,
    color: color.copper,
    width: 46,
    fontVariant: ['tabular-nums'],
  },
  rowTitle: { fontFamily: type.uiMedium, fontSize: 15, color: color.bone },
  rowBody: { fontFamily: type.ui, fontSize: 13.5, lineHeight: 20, color: color.muted, marginTop: 3 },

  neverRow: { flexDirection: 'row', gap: space.x8, marginTop: 8 },
  neverMark: { fontFamily: type.ui, fontSize: 14, color: color.dim },
  neverText: { flex: 1, fontFamily: type.ui, fontSize: 14, lineHeight: 21, color: color.bone },

  action: { marginTop: space.section },
  button: {
    marginTop: space.x16,
    minHeight: 50,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.copper,
  },
  buttonText: { fontFamily: type.uiMedium, fontSize: 15.5, color: color.bg },
  secondary: { marginTop: space.x8, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontFamily: type.ui, fontSize: 14.5, color: color.muted },
  fineprint: {
    fontFamily: type.ui,
    fontSize: 12.5,
    lineHeight: 19,
    color: color.dim,
    marginTop: space.x12,
    textAlign: 'center',
  },

  pressed: { opacity: 0.7 },
});
