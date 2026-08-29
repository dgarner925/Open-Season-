import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { openExternalUrl } from '@/lib/openUrl';
import { lang } from '@/theme/tokens';

const { color, space, type, radius } = lang;

/**
 * The license call-out — noticeable but not the focus of the page (David,
 * 2026-08-28). A quiet surface tile with a copper ticket mark; sits after the
 * page's main content on season, window, and regs details.
 */
export function LicenseRow({ stateName, url }: { stateName: string | null | undefined; url: string | null | undefined }) {
  if (!url) return null;
  return (
    <Pressable
      onPress={() => openExternalUrl(url)}
      accessibilityRole="link"
      accessibilityLabel={`Buy your ${stateName ?? ''} license`}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
    >
      <View style={styles.mark}>
        <Ionicons name="ticket-outline" size={17} color={color.copper} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Buy your {stateName ?? ''} license before you go.</Text>
        <Text style={styles.sub}>Straight to the official licensing site.</Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color={color.dim} />
    </Pressable>
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
