import { Linking, StyleSheet, View } from 'react-native';
import { DISCLAIMER, radius, spacing, theme } from '@/theme';
import { verifiedAgo } from '@/lib/date';
import { AppText, Button } from './ui';

/**
 * The trust trio. Brief rule: "Every screen showing dates must show
 * last-verified + source link + the disclaimer." Compose these on every
 * season / window / regs detail view.
 */

export function VerifiedStamp({ verifiedAt }: { verifiedAt: string | null }) {
  const fresh = verifiedAt !== null;
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: fresh ? theme.color.success : theme.color.warning }]} />
      <AppText variant="caption" color={theme.color.textSecondary}>
        {verifiedAgo(verifiedAt)}
      </AppText>
    </View>
  );
}

export function SourceLink({ agencyName, url }: { agencyName: string | null; url: string | null }) {
  if (!url) {
    return (
      <AppText variant="caption" color={theme.color.textMuted}>
        Official source pending verification
      </AppText>
    );
  }
  return (
    <Button
      variant="secondary"
      title={agencyName ? `Official source: ${agencyName}` : 'View official source'}
      onPress={() => Linking.openURL(url)}
    />
  );
}

export function Disclaimer() {
  return (
    <View style={styles.disclaimer}>
      <AppText variant="caption" color={theme.color.textMuted}>
        {DISCLAIMER}
      </AppText>
    </View>
  );
}

/** Convenience: the full provenance block for a detail screen. */
export function ProvenanceBlock({
  verifiedAt,
  agencyName,
  url,
}: {
  verifiedAt: string | null;
  agencyName: string | null;
  url: string | null;
}) {
  return (
    <View style={styles.block}>
      <VerifiedStamp verifiedAt={verifiedAt} />
      <SourceLink agencyName={agencyName} url={url} />
      <Disclaimer />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  disclaimer: {
    backgroundColor: theme.color.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: theme.color.warning,
  },
});
