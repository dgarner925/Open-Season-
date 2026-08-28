import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { DISCLAIMER } from '@/theme';
import { verifiedAgo } from '@/lib/date';
import { lang } from '@/theme/tokens';

/**
 * The trust trio, in the field-journal language. Brief rule: "Every screen
 * showing dates must show last-verified + source link + the disclaimer."
 * The v2 form is the one the reference screen proved: a single dim sentence
 * ("Verified against Georgia DNR, 3 days ago. ›") and the disclaimer as the
 * page's last word after a hairline — weight by position, not decoration.
 */

const { color, space, type } = lang;

export function VerifiedStamp({ verifiedAt }: { verifiedAt: string | null }) {
  return <Text style={styles.dim}>{verifiedAgo(verifiedAt)}</Text>;
}

export function SourceLink({ agencyName, url }: { agencyName: string | null; url: string | null }) {
  if (!url) {
    return <Text style={styles.dim}>Official source pending verification.</Text>;
  }
  return (
    <Pressable onPress={() => Linking.openURL(url)} accessibilityRole="link">
      <Text style={styles.dim}>
        Official source: {agencyName ?? 'state agency'} <Text style={{ color: color.muted }}>›</Text>
      </Text>
    </Pressable>
  );
}

export function Disclaimer() {
  return (
    <View style={styles.disclaimerBlock}>
      <View style={styles.rule} />
      <Text style={styles.dim}>{DISCLAIMER}</Text>
    </View>
  );
}

/** The full provenance block for a detail screen: one sentence, then the last word. */
export function ProvenanceBlock({
  verifiedAt,
  agencyName,
  url,
}: {
  verifiedAt: string | null;
  agencyName: string | null;
  url: string | null;
}) {
  const line = url ? (
    <Pressable onPress={() => Linking.openURL(url)} accessibilityRole="link">
      <Text style={styles.dim}>
        Verified against {agencyName ?? 'the state agency'}, {verifiedAgo(verifiedAt).toLowerCase()}.{' '}
        <Text style={{ color: color.muted }}>›</Text>
      </Text>
    </Pressable>
  ) : (
    <Text style={styles.dim}>
      Verified against {agencyName ?? 'the state agency'}, {verifiedAgo(verifiedAt).toLowerCase()}.
    </Text>
  );
  return (
    <View style={{ gap: space.x12, marginTop: space.section }}>
      {line}
      <Disclaimer />
    </View>
  );
}

const styles = StyleSheet.create({
  dim: { fontFamily: type.ui, fontSize: 13, lineHeight: 19, color: color.dim },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: color.hair, marginHorizontal: -space.gutter, marginBottom: space.x12 },
  disclaimerBlock: { marginTop: space.x8 },
});
