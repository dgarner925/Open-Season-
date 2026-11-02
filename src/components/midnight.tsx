/**
 * Midnight design primitives — the reusable pieces every screen shares.
 * PageTitle (serif + one italic-copper accent word), SpeciesBadge (engraved
 * animal, tinted copper), StatusPill, and Metric (the italic-serif copper
 * numeral used for countdowns and stats).
 */
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Engraving, engravingFor } from '@/components/Engraving';
import { MedallionBadge, medallionFor } from '@/components/Medallion';
import { fontFamily, radius, spacing, theme, type } from '@/theme';

export type SpeciesStatus = 'open' | 'soon' | 'closed';

/** Large Instrument Serif title with a single italic-copper accent word. */
export function PageTitle({
  lead,
  accent,
  style,
}: {
  lead: string;
  accent?: string;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text style={[type.h1, { color: theme.color.textPrimary }, style]}>
      {lead}
      {accent ? (
        <Text style={{ fontFamily: fontFamily.serifItalic, color: theme.color.accent }}>{accent}</Text>
      ) : null}
    </Text>
  );
}

/**
 * Species art, best cut first: the engraved plate for the seven big-game
 * species, the SVG engraving for everything else, a copper monogram when we
 * have neither. The plate is set larger because its art is cropped to the
 * animal, where the SVGs carry their own margin inside the viewBox.
 */
export function SpeciesBadge({
  name,
  size = 44,
  muted = false,
  round = false,
}: {
  name: string | null | undefined;
  size?: number;
  muted?: boolean;
  round?: boolean;
}) {
  const letter = (name ?? '?').trim().charAt(0).toUpperCase() || '?';
  const plate = medallionFor(name);
  const art = plate ? null : engravingFor(name);
  const ink = muted ? theme.color.textMuted : theme.color.accent;
  return (
    <View
      style={[
        styles.badgeBase,
        {
          width: size,
          height: size,
          borderRadius: round ? size / 2 : size * 0.32,
          backgroundColor: muted ? theme.color.surfaceFlat : theme.color.accentFill,
          borderWidth: muted ? StyleSheet.hairlineWidth : 0,
          borderColor: theme.color.borderFlat,
        },
      ]}
    >
      {plate ? (
        <MedallionBadge species={name} size={size * 0.86} color={ink} />
      ) : art ? (
        <Engraving data={art} size={size * 0.72} color={ink} />
      ) : (
        <Text
          style={{
            fontFamily: fontFamily.sansBold,
            fontSize: size * 0.4,
            color: ink,
          }}
        >
          {letter}
        </Text>
      )}
    </View>
  );
}

/** Copper-on-soft-copper for Open; muted white outline for Soon/Closed. */
export function StatusPill({ status, style }: { status: SpeciesStatus; style?: StyleProp<ViewStyle> }) {
  const open = status === 'open';
  const label = open ? 'Open' : status === 'soon' ? 'Soon' : 'Closed';
  return (
    <View
      style={[
        styles.statusPill,
        open
          ? { backgroundColor: theme.color.accentFill }
          : { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.hairline },
        style,
      ]}
    >
      <Text style={[type.overline, { color: open ? theme.color.accent : theme.color.textMuted }]}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

/**
 * Section header set like a rule in a field ledger: hairline — label — hairline.
 * The Midnight way to break a page into chapters (Profile, Follows).
 */
export function SectionRule({ label }: { label: string }) {
  return (
    <View style={styles.sectionRule}>
      <View style={styles.ruleLine} />
      <Text style={[type.overline, { color: theme.color.textMuted }]}>{label.toUpperCase()}</Text>
      <View style={styles.ruleLine} />
    </View>
  );
}

/**
 * The editorial metric — an italic-serif copper numeral with a small unit
 * ("12" + "d"). Used for countdowns in lists and the stat cards.
 */
export function Metric({
  value,
  unit,
  size = 30,
  color = theme.color.accent,
}: {
  value: number | string;
  unit?: string;
  size?: number;
  color?: string;
}) {
  return (
    <View style={styles.metric}>
      <Text style={{ fontFamily: fontFamily.serifItalic, fontSize: size, lineHeight: size * 1.02, color }}>
        {value}
      </Text>
      {unit ? (
        <Text style={[type.caption, { color: theme.color.textMuted, marginLeft: 2, marginBottom: size * 0.12 }]}>
          {unit}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionRule: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl },
  ruleLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: theme.color.border },
  badgeBase: { alignItems: 'center', justifyContent: 'center' },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  metric: { flexDirection: 'row', alignItems: 'flex-end' },
});
