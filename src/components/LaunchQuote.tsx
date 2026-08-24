/**
 * Cold-start quote moment: a line from the sporting canon fades in over the
 * Midnight background, holds, then hands off to "Welcome to Open Season"
 * before revealing the app. Tap anywhere to skip. First-ever launch always
 * opens with Jack Elrod; after that the rotation is a curated subset of the
 * species quotes.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import quotes from '@/assets/quotes.json';
import { fontFamily, spacing, theme } from '@/theme';

const FIRST_LAUNCH_KEY = 'launch-quote-shown';
const LAST_SHOWN_KEY = 'launch-quote-last';
// Every line that stands on its own out of species context. Excluded on purpose:
// the clause-fragments (marten, fisher, muskox, sage/sharptail) that need their page.
const ROTATION = [
  'bobcat', 'elk', 'goose', 'bear', 'deer', 'duck', 'moose', 'coyote', 'alligator',
  'ruffed-grouse', 'pheasant', 'fox', 'wolf', 'turkey', 'dove', 'bison', 'pronghorn',
  'bighorn-sheep', 'caribou', 'squirrel', 'rabbit', 'snowshoe-hare', 'woodcock',
  'snipe', 'prairie-chicken', 'ptarmigan', 'wolverine', 'sandhill-crane',
  'mountain-lion', 'crow', 'tundra-swan', 'spruce-grouse', 'bobwhite',
];

const QUOTE_FADE_IN = 900;
const QUOTE_HOLD = 4000;
const QUOTE_FADE_OUT = 700;
const WELCOME_FADE_IN = 900;
const WELCOME_HOLD = 1400;
const WELCOME_FADE_OUT = 500;

type Q = { text: string; attr: string };
const all = quotes as Record<string, Q>;

/** "Jack Elrod, Outdoor Artist & Conservationist" → name + descriptor. */
export function attrName(attr: string): string {
  return attr.split(',')[0].trim().toUpperCase();
}
export function attrTitle(attr: string): string {
  const i = attr.indexOf(',');
  return i === -1 ? '' : attr.slice(i + 1).trim().toUpperCase();
}

export function LaunchQuote({ onDone }: { onDone: () => void }) {
  const [q, setQ] = useState<Q | null>(null);
  const quoteOpacity = useRef(new Animated.Value(0)).current;
  const welcomeOpacity = useRef(new Animated.Value(0)).current;
  const finished = useRef(false);

  function finish() {
    if (finished.current) return;
    finished.current = true;
    onDone();
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let key = ROTATION[Math.floor(Math.random() * ROTATION.length)];
      try {
        const [seen, last] = await Promise.all([
          AsyncStorage.getItem(FIRST_LAUNCH_KEY),
          AsyncStorage.getItem(LAST_SHOWN_KEY),
        ]);
        if (!seen) {
          key = 'bobcat';
          AsyncStorage.setItem(FIRST_LAUNCH_KEY, '1').catch(() => {});
        } else if (last && ROTATION.length > 1) {
          const fresh = ROTATION.filter((k) => k !== last);
          key = fresh[Math.floor(Math.random() * fresh.length)];
        }
        AsyncStorage.setItem(LAST_SHOWN_KEY, key).catch(() => {});
      } catch {}
      if (cancelled) return;
      setQ(all[key] ?? all.elk);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!q) return;
    const seq = Animated.sequence([
      Animated.timing(quoteOpacity, { toValue: 1, duration: QUOTE_FADE_IN, useNativeDriver: true }),
      Animated.delay(QUOTE_HOLD),
      Animated.timing(quoteOpacity, { toValue: 0, duration: QUOTE_FADE_OUT, useNativeDriver: true }),
      Animated.timing(welcomeOpacity, { toValue: 1, duration: WELCOME_FADE_IN, useNativeDriver: true }),
      Animated.delay(WELCOME_HOLD),
      Animated.timing(welcomeOpacity, { toValue: 0, duration: WELCOME_FADE_OUT, useNativeDriver: true }),
    ]);
    seq.start(({ finished: ok }) => {
      if (ok) finish();
    });
    return () => seq.stop();
  }, [q]);

  return (
    <Pressable style={styles.fill} onPress={finish}>
      {q ? (
        <Animated.View style={[styles.center, { opacity: quoteOpacity }]}>
          <Text style={styles.quote}>{`“${q.text}”`}</Text>
          <Text style={styles.attrName}>{attrName(q.attr)}</Text>
          {attrTitle(q.attr) ? <Text style={styles.attrTitle}>{attrTitle(q.attr)}</Text> : null}
        </Animated.View>
      ) : null}
      <Animated.View style={[styles.center, { opacity: welcomeOpacity }]} pointerEvents="none">
        <Text style={styles.welcomeEyebrow}>WELCOME TO</Text>
        <View style={{ height: spacing.md }} />
        <Text style={styles.welcomeTitle}>
          Open <Text style={styles.welcomeAccent}>Season</Text>
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.color.background,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  quote: {
    fontFamily: fontFamily.serifItalic,
    fontSize: 24,
    lineHeight: 37,
    color: '#cfc4b4',
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  attrName: {
    fontFamily: fontFamily.sansSemiBold,
    fontSize: 12,
    letterSpacing: 2.2,
    color: '#d9a97e',
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  attrTitle: {
    fontFamily: fontFamily.sansSemiBold,
    fontSize: 9.5,
    letterSpacing: 1.8,
    color: '#8d8377',
    marginTop: 6,
    textAlign: 'center',
  },
  welcomeEyebrow: { fontFamily: fontFamily.serif, fontSize: 15, letterSpacing: 3, color: theme.color.textMuted },
  welcomeTitle: { fontFamily: fontFamily.serif, fontSize: 40, color: theme.color.textPrimary },
  welcomeAccent: { fontFamily: fontFamily.serifItalic, color: theme.color.accent },
});
