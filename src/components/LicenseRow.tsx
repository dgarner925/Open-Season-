import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { openExternalUrl } from '@/lib/openUrl';
import { lang } from '@/theme/tokens';

const { color, space, type, radius } = lang;

/**
 * ActionRow — the "noticeable, not focal" tile for page-level actions (David,
 * 2026-08-28; generalized 2026-09-06: anything tappable gets accentuated).
 * Icon in a copper-filled mark, semibold title, muted sub, copper chevron.
 */
export function ActionRow({
  icon,
  title,
  sub,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
    >
      <View style={styles.mark}>
        <Ionicons name={icon} size={17} color={color.copper} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={14} color={color.copper} />
    </Pressable>
  );
}

/** The license call-out — sits after the page's main content on season,
 * window, and regs details. */
export function LicenseRow({ stateName, url }: { stateName: string | null | undefined; url: string | null | undefined }) {
  if (!url) return null;
  return (
    <ActionRow
      icon="ticket-outline"
      title={`Buy your ${stateName ?? ''} license before you go.`}
      sub="Straight to the official licensing site."
      onPress={() => openExternalUrl(url)}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.x12,
    backgroundColor: color.surface,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hair,
    padding: space.x16,
    marginTop: space.section,
  },
  mark: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: color.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: type.uiSemiBold, fontSize: type.size.body, color: color.bone },
  sub: { fontFamily: type.ui, fontSize: 12.5, color: color.muted, marginTop: 2 },
});
