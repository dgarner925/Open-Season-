import { Stack, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Share, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Unreachable } from '@/components/GapNote';
import { Headline, Pill, Screen, Sentence } from '@/components/system';
import { CARD_H, CARD_W, SeasonCard } from '@/components/SeasonCard';
import { buildSeasonCard } from '@/features/card/season';
import { useSeasonsFeed } from '@/features/reference/queries';
import { lang } from '@/theme/tokens';

const { color, space } = lang;

const SITE_URL = 'https://osdatesanddraws.com';

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Your season, as a plate you can send to somebody.
 *
 * The card is laid out at a fixed 540 × 675 (see SeasonCard) and scaled to fit
 * whatever phone is holding it, so the composition never reflows — this is an
 * image, and an image that reflows is one whose typography you cannot trust.
 */
export default function SeasonCardScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { data: seasons, isLoading, isError } = useSeasonsFeed();
  const iso = todayISO();

  const card = useMemo(() => buildSeasonCard(seasons, iso), [seasons, iso]);

  // The card's own gutters plus the screen's, so it never touches the edge.
  const scale = Math.min(1, (width - space.gutter * 2) / CARD_W);

  async function onShare() {
    const first = card.openers[0];
    const opener = first ? ` ${first.speciesName} opens ${first.date}.` : '';
    await Share.share({
      message:
        `My ${card.year}–${String((card.year + 1) % 100).padStart(2, '0')} season: ` +
        `${card.openers.length} opener${card.openers.length === 1 ? '' : 's'} across ` +
        `${card.states.length} state${card.states.length === 1 ? '' : 's'}.${opener} ` +
        `Tracking them with Open Season. ${SITE_URL}`,
    }).catch(() => {});
  }

  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: true, title: 'Your season' }} />

      {isLoading ? (
        <ActivityIndicator color={color.copper} style={{ marginTop: space.x38 }} />
      ) : isError ? (
        <Unreachable what="your openers" style={{ marginTop: space.section }} />
      ) : card.openers.length === 0 ? (
        <>
          <Headline style={{ marginTop: space.x16 }}>Nothing to put on it yet.</Headline>
          <Sentence style={{ marginTop: space.x8 }}>
            The card is built from the openers still ahead of you. Follow a hunt or two and it fills
            itself in.
          </Sentence>
          <Pill
            label="Add your hunts"
            variant="secondary"
            onPress={() => router.push('/(tabs)')}
            style={{ marginTop: space.section }}
          />
        </>
      ) : (
        <>
          <Sentence style={{ marginTop: space.x16 }}>
            Every opener still ahead of you, on one plate. Send it to whoever you hunt with.
          </Sentence>

          {/* A fixed-size card scaled down: the wrapper takes the scaled
              height so the layout below it does not sit under the card. */}
          <View style={[styles.stage, { height: CARD_H * scale + space.section }]}>
            <View style={{ transform: [{ scale }], transformOrigin: 'top center' }}>
              <SeasonCard card={card} />
            </View>
          </View>

          <Pill label="Share your season" onPress={onShare} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stage: { alignItems: 'center', marginTop: space.section },
});
