/**
 * Today on the Water — the one block on the OTW Home that outranks the rest.
 *
 * The woods' equivalent is the Daily Outlook card, and this keeps its
 * structure deliberately: a micro label, one big serif value, supporting
 * detail, then the four-column almanac. Somebody who knows one card can read
 * the other. What changes is the subject -- hunting leads with time, fishing
 * leads with flow.
 *
 * The status pill is driven by flowStatus(), which returns null on exactly
 * the readings that give the headline no verdict. A missing gauge shows no
 * pill rather than an encouraging one.
 */
import { StyleSheet, Text, View } from 'react-native';
import { AlmanacColumns } from './AlmanacColumns';
import { Sparkline } from './Sparkline';
import { flowStatus, formatCfs, type FlowReading } from '@/features/otw/sentences';
import type { PlaceholderAlmanac } from '@/features/otw/placeholder';
import { otwLang } from '@/theme/otwTokens';

const { color, radius, space, type } = otwLang;

export function TodayOnTheWaterCard({
  gaugeName,
  reading,
  waterTempF,
  sky,
  releaseLabel,
  history,
  projection,
  almanac,
}: {
  gaugeName: string;
  reading: FlowReading;
  waterTempF: number | null;
  sky: string;
  releaseLabel: string | null;
  history: number[];
  projection: number[];
  almanac: PlaceholderAlmanac;
}) {
  const status = flowStatus(reading);
  const cfs = reading.cfs !== null && Number.isFinite(reading.cfs) && reading.cfs >= 0 ? reading.cfs : null;

  // Each absent part drops out rather than printing a placeholder dash that
  // reads as a measurement. "water —°F" looks like a reading of nothing.
  const detail = ['USGS gauge', waterTempF !== null ? `water ${waterTempF}°F` : null, sky || null]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.card}>
      {/* The inner keyline, inset so it reads as engraving rather than border. */}
      <View pointerEvents="none" style={styles.keyline} />

      <View style={styles.topRow}>
        <Text style={styles.micro}>TODAY ON THE WATER</Text>
        <Text style={styles.gauge} numberOfLines={1}>
          {gaugeName} ›
        </Text>
      </View>

      <View style={styles.valueRow}>
        <View style={styles.valueLeft}>
          {cfs !== null ? (
            <View style={styles.valueLine}>
              <Text style={styles.value}>{formatCfs(cfs)}</Text>
              <Text style={styles.unit}>cfs</Text>
            </View>
          ) : (
            <Text style={styles.noReading}>No reading</Text>
          )}
          {detail ? <Text style={styles.detail}>{detail}</Text> : null}
        </View>

        <View style={styles.valueRight}>
          {status ? (
            <View style={styles.pill}>
              <View style={styles.pillDot} />
              <Text style={styles.pillText}>{status}</Text>
            </View>
          ) : null}
          {releaseLabel ? <Text style={styles.release}>{releaseLabel}</Text> : null}
        </View>
      </View>

      <Sparkline
        history={history}
        projection={projection}
        lineColor={color.riverTextDim}
        nowColor={color.riverText}
        projectionColor={color.brassOnRiver}
        style={styles.spark}
      />

      <AlmanacColumns almanac={almanac} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.river,
    borderRadius: 18,
    padding: space.x16,
    marginTop: space.x16,
    shadowColor: '#1B2B36',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  keyline: {
    position: 'absolute',
    top: 5,
    left: 5,
    right: 5,
    bottom: 5,
    borderWidth: 1,
    borderColor: color.keyline,
    borderRadius: 14,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.x8 },
  micro: {
    fontFamily: type.uiMedium,
    fontSize: type.size.micro,
    letterSpacing: type.microTracking,
    color: color.brassOnRiver,
  },
  gauge: {
    fontFamily: type.uiMedium,
    fontSize: type.size.micro,
    letterSpacing: 0.6,
    color: color.riverTextDim,
    flexShrink: 1,
  },

  valueRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: space.x8 },
  valueLeft: { flexShrink: 1 },
  valueLine: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  value: { fontFamily: type.display, fontSize: 40, lineHeight: 46, color: color.riverText },
  unit: { fontFamily: type.ui, fontSize: 15, color: color.riverTextDim },
  noReading: { fontFamily: type.display, fontSize: 28, lineHeight: 36, color: color.riverTextDim },
  detail: { fontFamily: type.ui, fontSize: 12.5, color: color.riverTextDim, marginTop: 1 },

  valueRight: { alignItems: 'flex-end', gap: space.x8, flexShrink: 0 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: color.mossText,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  pillDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: color.riverText },
  pillText: { fontFamily: type.uiSemiBold, fontSize: 11.5, color: color.riverText },
  release: { fontFamily: type.ui, fontSize: 12.5, color: color.riverTextDim },

  spark: { marginTop: space.x12 },
});
