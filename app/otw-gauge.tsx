/**
 * Choosing which gauge On the Water reads.
 *
 * Eight gauges, all verified against the USGS site service, so this is a list
 * rather than a search. A search box over eight rows would be furniture; when
 * the list outgrows the screen (other states, Phase 3's `waters.usgs_site_no`)
 * it earns one.
 *
 * ---------------------------------------------------------------------------
 * THE ROWS SAY WHAT EACH GAUGE CANNOT DO
 *
 * Two of the eight facts about a gauge change what the Today card is able to
 * tell you, and both are invisible until you have already picked it:
 *
 *   No temperature sensor  -> the "water 52°F" clause disappears. Four of the
 *                             eight are like this.
 *   No wadeable threshold  -> the headline will never say "fishable". It
 *                             reports the flow and stops, because a verdict
 *                             needs a number to judge against and nobody has
 *                             set one for that gauge. Seven of the eight.
 *
 * Saying so here is the difference between a feature that looks broken on
 * seven of its eight options and one that is honest about what it knows. The
 * alternative -- inventing thresholds so every row produces a confident word
 * -- is the defect this whole feature is written against.
 */
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WavyRule } from '@/components/otw/WavyRule';
import { GAUGES, type Gauge } from '@/features/otw/gauges';
import { setGaugeSiteNo, useGaugeSiteNo } from '@/lib/otwGauge';
import { otwLang } from '@/theme/otwTokens';

const { color, radius, space, type } = otwLang;

/** The limits worth knowing before you pick, or null when there are none. */
function caveat(gauge: Gauge): string | null {
  const parts: string[] = [];
  if (!gauge.reportsWaterTemp) parts.push('no water temperature');
  if (gauge.wadeableMax === null) parts.push('flow only, no wadeable guidance set');
  return parts.length ? parts.join(' · ') : null;
}

function GaugeRow({
  gauge,
  selected,
  onPress,
}: {
  gauge: Gauge;
  selected: boolean;
  onPress: () => void;
}) {
  const note = caveat(gauge);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${gauge.name}. ${gauge.note}.${note ? ` ${note}.` : ''}`}
      style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.rowPressed]}
    >
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, selected && styles.rowTitleSelected]}>{gauge.name}</Text>
        <Text style={styles.rowNote}>{gauge.note}</Text>
        {note ? <Text style={styles.rowCaveat}>{note}</Text> : null}
      </View>
      {selected ? <Text style={styles.check}>✓</Text> : null}
    </Pressable>
  );
}

export default function OtwGaugePicker() {
  const router = useRouter();
  const { siteNo } = useGaugeSiteNo();

  const pick = (gauge: Gauge) => {
    // Written before navigating: the listener set updates the Home's card in
    // the same tick, so going back shows the new gauge already chosen rather
    // than the old one for a frame.
    void setGaugeSiteNo(gauge.siteNo);
    router.back();
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.label}>ON THE WATER</Text>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button">
            <Text style={styles.close}>Done</Text>
          </Pressable>
        </View>

        <Text style={styles.title}>Choose a gauge</Text>
        <Text style={styles.blurb}>
          Readings come from the U.S. Geological Survey, updated about every fifteen minutes.
        </Text>

        <WavyRule tone="brass" style={styles.rule} />

        {GAUGES.map((gauge) => (
          <GaugeRow
            key={gauge.siteNo}
            gauge={gauge}
            selected={gauge.siteNo === siteNo}
            onPress={() => pick(gauge)}
          />
        ))}

        <Text style={styles.footnote}>
          Wadeable guidance is editorial, not a safety ruling. Judge the water in front of you.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  content: { paddingHorizontal: space.gutter, paddingTop: space.gutter, paddingBottom: space.x38 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: {
    fontFamily: type.uiMedium,
    fontSize: type.size.micro,
    letterSpacing: type.microTracking,
    color: color.dim,
  },
  close: { fontFamily: type.uiMedium, fontSize: 15, color: color.brassText },

  title: { fontFamily: type.otwDisplay, fontSize: 33, color: color.ink, marginTop: space.x8 },
  blurb: {
    fontFamily: type.ui,
    fontSize: type.size.body,
    lineHeight: 23,
    color: color.muted,
    marginTop: space.x8,
  },
  rule: { marginTop: space.x16, marginBottom: space.x8 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.x12,
    paddingVertical: space.x12,
    paddingHorizontal: space.x12,
    borderRadius: 12,
    borderBottomWidth: 1,
    borderBottomColor: color.hair,
  },
  // The chosen row takes the faint river tile rather than a border, so the
  // list keeps one rhythm and the selection is a surface and not an outline.
  rowSelected: { backgroundColor: color.tile, borderBottomColor: 'transparent' },
  rowPressed: { opacity: 0.65 },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: type.uiSemiBold, fontSize: 15.5, color: color.ink },
  rowTitleSelected: { color: color.river },
  rowNote: { fontFamily: type.ui, fontSize: 13, lineHeight: 18, color: color.muted },
  rowCaveat: {
    fontFamily: type.uiMedium,
    fontSize: 11.5,
    lineHeight: 16,
    color: color.brassText,
    marginTop: 1,
  },
  check: { fontFamily: type.uiSemiBold, fontSize: 17, color: color.river },

  footnote: {
    fontFamily: type.ui,
    fontSize: 12.5,
    lineHeight: 18,
    color: color.dim,
    marginTop: space.section,
  },
});
