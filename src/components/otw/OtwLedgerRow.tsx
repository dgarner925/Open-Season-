/**
 * A row in "Seasons & stocking": a brass-ringed icon, what it is, and where
 * it stands.
 *
 * The status is the whole reason the row exists, so it sits on the right
 * where the eye finishes. Moss for a water that is open, brass for a date --
 * the same division hunting makes between "open now" and "opens then".
 */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
/**
 * Moved here from features/otw/placeholder.ts when that file was deleted --
 * it was never placeholder, it is this component's own prop type.
 */
export type LedgerKind = 'rule' | 'stocking' | 'season';
import { otwLang } from '@/theme/otwTokens';

const { color, space, type } = otwLang;

const ICON: Record<LedgerKind, keyof typeof MaterialCommunityIcons.glyphMap> = {
  rule: 'fish',
  stocking: 'bucket-outline',
  season: 'waves',
};

export function OtwLedgerRow({
  kind,
  title,
  subtitle,
  status,
  first,
  onPress,
}: {
  kind: LedgerKind;
  title: string;
  subtitle: string;
  status: { text: string; tone: 'open' | 'date' };
  first?: boolean;
  onPress?: () => void;
}) {
  const open = status.tone === 'open';
  const body = (
    <View style={[styles.row, !first && styles.divider]}>
      <View style={styles.ring}>
        <MaterialCommunityIcons name={ICON[kind]} size={16} color={color.brassText} />
      </View>
      <View style={styles.middle}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {/* TWO LINES. The subtitle carries the water AND the rule, and a
            long water name ate both on one line -- see the Home row below. */}
        <Text style={styles.subtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      <View style={styles.status}>
        {open ? <View style={styles.dot} /> : null}
        <Text style={[styles.statusText, { color: open ? color.mossText : color.brassText }]}>{status.text}</Text>
      </View>
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => (pressed ? { opacity: 0.6 } : null)}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.x12, paddingVertical: 11 },
  divider: { borderTopWidth: 1, borderTopColor: color.hair },
  ring: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: color.brass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: { flex: 1, gap: 1 },
  title: { fontFamily: type.uiSemiBold, fontSize: 14.5, color: color.ink },
  subtitle: { fontFamily: type.ui, fontSize: 12.5, color: color.muted },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.moss },
  statusText: { fontFamily: type.uiSemiBold, fontSize: 13 },
});
