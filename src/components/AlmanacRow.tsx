/**
 * The almanac column — a serif value over a micro label, with the copper
 * trend arrow for pressure. Shared by the Daily Outlook card, the Weekend
 * Brief card, and the outlook page.
 */
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { AppText } from '@/components/ui';
import { fontFamily, theme } from '@/theme';
import { lang } from '@/theme/tokens';

export function AlmanacCol({
  value,
  label,
  trend,
  first,
}: {
  value: string;
  label: string;
  trend?: 'falling' | 'rising' | 'steady' | null;
  first?: boolean;
}) {
  return (
    <View style={[almanacStyles.col, !first && almanacStyles.colDivider]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
        <Text style={almanacStyles.value}>{value}</Text>
        {trend === 'falling' ? <Ionicons name="arrow-down" size={13} color={lang.color.copper} /> : null}
        {trend === 'rising' ? <Ionicons name="arrow-up" size={13} color={lang.color.copper} /> : null}
      </View>
      <AppText variant="caption" color={theme.color.textMuted} style={almanacStyles.label} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

export const almanacStyles = StyleSheet.create({
  head: { fontFamily: fontFamily.sansSemiBold, fontSize: 10, letterSpacing: 1.8, color: lang.color.dim, marginTop: 4 },
  row: { flexDirection: 'row', marginTop: 6, marginBottom: 2 },
  col: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 2 },
  colDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.color.borderFlat },
  value: { fontFamily: fontFamily.serif, fontSize: 19, color: lang.color.bone },
  label: { fontSize: 8.5, letterSpacing: 1, textAlign: 'center' },
});
