import { Stack, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Share,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { Unreachable } from '@/components/GapNote';
import { Headline, LinkSentence, Pill, Screen, Sentence } from '@/components/system';
import { CARD_RATIO, CARD_W, SeasonCard } from '@/components/SeasonCard';
import { buildSeasonCard } from '@/features/card/season';
import { useSeasonsFeed } from '@/features/reference/queries';
import { lang } from '@/theme/tokens';

const { color, space } = lang;

const SITE_URL = 'https://osdatesanddraws.com';

/** The captured image, in pixels. 1080 wide is the share-sheet standard. */
const EXPORT_W = 1080;

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Your season, as a plate you can send to somebody.
 *
 * The card is laid out at its true on-screen size (no transform — see
 * SeasonCard) so what gets captured is exactly what the reader is looking at.
 */
export default function SeasonCardScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { data: seasons, isLoading, isError } = useSeasonsFeed();
  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const iso = todayISO();

  const card = useMemo(() => buildSeasonCard(seasons, iso), [seasons, iso]);

  // Never wider than the reference: upscaling the layout would thin the
  // hairlines and leave the type looking stretched on a tablet.
  const cardWidth = Math.min(CARD_W, width - space.gutter * 2);

  const blurb =
    `My ${card.year}–${String((card.year + 1) % 100).padStart(2, '0')} season: ` +
    `${card.openers.length} opener${card.openers.length === 1 ? '' : 's'} across ` +
    `${card.states.length} state${card.states.length === 1 ? '' : 's'}.` +
    (card.openers[0] ? ` ${card.openers[0].speciesName} opens ${card.openers[0].date}.` : '') +
    ` Tracking them with Open Season. ${SITE_URL}`;

  /**
   * Capture the card and hand it to the share sheet.
   *
   * Falls back to the text blurb rather than failing: on a device with no
   * share targets, or if the snapshot cannot be taken, the reader still gets
   * to send something. A share button that does nothing is worse than a
   * plainer share.
   */
  async function onShareImage() {
    if (busy) return;
    setBusy(true);
    try {
      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
        width: EXPORT_W,
        height: Math.round(EXPORT_W * CARD_RATIO),
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          // iOS needs the UTI to offer Messages, Mail and Photos.
          UTI: 'public.png',
          dialogTitle: 'Your season',
        });
      } else {
        await Share.share({ message: blurb });
      }
    } catch (e) {
      // A cancelled share sheet throws on some platforms; that is not an
      // error worth a dialog. Anything else falls back to text.
      const msg = e instanceof Error ? e.message : '';
      if (!/cancel/i.test(msg)) {
        await Share.share({ message: blurb }).catch(() =>
          Alert.alert('Could not share', 'Try again in a moment.'),
        );
      }
    } finally {
      // Deliberately not releaseCapture()-ing the snapshot. Some share
      // targets read the file after the sheet has already resolved, and a
      // deleted temp file means a broken share; the file dies with the app
      // either way, so holding it costs nothing worth having.
      setBusy(false);
    }
  }

  async function onShareText() {
    await Share.share({ message: blurb }).catch(() => {});
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

          <View style={styles.stage}>
            <SeasonCard ref={cardRef} card={card} width={cardWidth} />
          </View>

          <Pill
            label={busy ? 'Making the image…' : 'Share your season'}
            onPress={onShareImage}
            disabled={busy}
            style={{ marginTop: space.section }}
          />

          <LinkSentence size={13.5} onPress={onShareText} style={{ marginTop: space.x16 }}>
            Send it as text instead
          </LinkSentence>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stage: { alignItems: 'center', marginTop: space.section },
});
