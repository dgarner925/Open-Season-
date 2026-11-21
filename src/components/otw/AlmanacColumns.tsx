/**
 * The four-column almanac on the Today card: air, sunrise, sunset, moon.
 *
 * Its own component rather than a reuse of src/components/AlmanacRow.tsx.
 * That one reads from BOTH token systems -- theme.color.textMuted,
 * theme.color.borderFlat, fontFamily.serif, lang.color.bone, lang.color.dim
 * -- so making it mode-aware meant four colour overrides threaded through
 * every hunting call site, to produce a row that sits on a solid river card
 * rather than on the page. The shared thing was the layout, which is nine
 * lines, and the hunting row keeps working untouched.
 *
 * The values are Instrument Serif in both modes, which is the family tie.
 */
import { StyleSheet, Text, View } from 'react-native';
import type { PlaceholderAlmanac } from '@/features/otw/placeholder';
import { otwLang } from '@/theme/otwTokens';

const { color, type } = otwLang;

function Col({ value, label, first }: { value: string; label: string; first?: boolean }) {
  return (
    <View style={[styles.col, !first && styles.divider]}>
      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function AlmanacColumns({ almanac }: { almanac: PlaceholderAlmanac }) {
  const { airTempF, sky, sunrise, sunset, moonPct, moonWaxing } = almanac;
  return (
    <View style={styles.row}>
      <Col first value={`${airTempF}°`} label={`AIR · ${sky.toUpperCase()}`} />
      <Col value={sunrise} label="SUNRISE" />
      <Col value={sunset} label="SUNSET" />
      <Col value={`${moonPct}%`} label={`MOON · ${moonWaxing ? 'WAX' : 'WANE'}`} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginTop: 10 },
  col: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 2 },
  // A hairline vanishes on a saturated fill, so this is a full pixel at low
  // opacity instead.
  divider: { borderLeftWidth: 1, borderLeftColor: 'rgba(243,237,224,0.16)' },
  value: { fontFamily: type.display, fontSize: 19, color: color.riverText },
  label: {
    fontFamily: type.ui,
    fontSize: 8.5,
    letterSpacing: 1,
    textAlign: 'center',
    color: color.riverTextDim,
  },
});
