import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Sentence } from '@/components/system';
import { coverageLine, type Coverage } from '@/features/coverage/gaps';
import { openExternalUrl } from '@/lib/openUrl';
import { lang } from '@/theme/tokens';

const { color, space, type } = lang;

/**
 * What we don't have, said where the dates would have been.
 *
 * Undecorated on purpose: a gap is a warning, and warnings earn their weight
 * by position, not by a tinted box (rule 10). It sits exactly where the reader
 * went looking for a date, which is the whole point — an empty list in the
 * same spot says "no season", and that is a different and usually false claim.
 *
 * The agency link is not a courtesy. It is the app admitting it is not the
 * authority and handing over the one that is, which no competitor in this
 * category does, because none of them will say they are missing anything.
 */
export function GapNote({
  coverage,
  species,
  state,
  agency,
  sourceUrl,
  followed,
  style,
}: {
  coverage: Coverage;
  species: string;
  state: string;
  agency?: string | null;
  sourceUrl?: string | null;
  followed?: boolean;
  style?: object;
}) {
  const line = coverageLine(coverage, { species, state, agency, followed });
  if (!line) return null;

  return (
    <View style={style}>
      <Sentence>{line}</Sentence>
      {sourceUrl ? (
        <Pressable
          onPress={() => openExternalUrl(sourceUrl)}
          hitSlop={6}
          accessibilityRole="link"
          accessibilityLabel={`Check ${agency ?? 'the agency'} yourself`}
          style={styles.link}
        >
          <Text style={styles.linkText}>
            Check {agency ?? 'the agency'} yourself <Text style={{ color: color.copperDim }}>›</Text>
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  link: { minHeight: 32, justifyContent: 'center', marginTop: space.x4 },
  linkText: { fontFamily: type.uiMedium, fontSize: 13.5, color: color.copper },
});
