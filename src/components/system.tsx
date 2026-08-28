/**
 * Shared primitives of the second-generation design language. Screens being
 * converted (Pass 3) import from here, not from ui.tsx. See tokens.ts for the
 * rules these encode.
 */
import { Ionicons } from '@expo/vector-icons';
import { type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Line, Mask, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { lang } from '@/theme/tokens';

const { color, space, radius, type } = lang;

/** The 20pt gutter, background, and safe area. */
export function Screen({ children, scroll }: { children: ReactNode; scroll?: boolean }) {
  const body = scroll ? (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
      {children}
    </ScrollView>
  ) : (
    <View style={styles.scrollBody}>{children}</View>
  );
  return <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>{body}</SafeAreaView>;
}

/** Full-bleed hairline: runs to both screen edges while content keeps the gutter. */
export function Rule({ space: gap = space.section }: { space?: number }) {
  return <View style={[styles.rule, { marginVertical: gap }]} />;
}

/** Tappable list row: title, optional subtitle, chevron, hairline beneath. */
export function Row({
  title,
  subtitle,
  right,
  onPress,
  last,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
      {onPress ? <Ionicons name="chevron-forward" size={14} color={color.dim} /> : null}
      {!last ? <View style={styles.rowRule} /> : null}
    </Pressable>
  );
}

/** Action pill — the only pill there is. Never a container, never a status. */
export function Pill({
  label,
  onPress,
  variant = 'primary',
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.pill, primary ? styles.pillPrimary : styles.pillSecondary, pressed && { opacity: 0.8 }, style]}
    >
      <Text style={[styles.pillLabel, { color: primary ? color.copper : color.bone }]}>{label}</Text>
    </Pressable>
  );
}

/** Uppercase micro label — a value's unit or role, never a section header. */
export function Micro({ children, style, center }: { children: ReactNode; style?: StyleProp<TextStyle>; center?: boolean }) {
  return <Text style={[styles.micro, center && { textAlign: 'center' }, style]}>{String(children).toUpperCase()}</Text>;
}

/** The vertical copper thread — for detail screens that tell a sequence. */
export function Thread({ height }: { height: number }) {
  return (
    <Svg width={3} height={height} style={styles.thread} accessible={false}>
      <Defs>
        <LinearGradient id="thread" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color.copper} stopOpacity="0.9" />
          <Stop offset="0.75" stopColor={color.copperDim} stopOpacity="0.35" />
          <Stop offset="1" stopColor={color.copperDim} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={3} height={height} fill="url(#thread)" />
    </Svg>
  );
}

/**
 * The sun's day-path with the legal-light window LIT along it — only where
 * legal light is the subject. The x-axis is the 24-hour day; `startFrac` /
 * `endFrac` mark first and last legal light as fractions of the day, and
 * `nowFrac` places the glowing sun at the current hour. Design approved from
 * David's mock, 2026-08-27.
 */
export function SunArc({
  width,
  startFrac,
  endFrac,
  nowFrac,
}: {
  width: number;
  startFrac: number;
  endFrac: number;
  nowFrac: number;
}) {
  // Mock geometry: viewBox 300x92, horizon y=74, path M0 74 Q150 -6 300 74.
  const VW = 300;
  const VH = 92;
  const HOR = 74;
  const h = Math.round((width * VH) / VW);
  const clamp = (v: number) => Math.max(0.02, Math.min(0.98, v));
  const s = clamp(startFrac);
  const e = clamp(endFrac);
  const n = Math.max(0, Math.min(1, nowFrac));
  // Point on the quadratic at t: (1-t)²·74 + 2(1-t)t·(-6) + t²·74
  const arcY = (t: number) => (1 - t) * (1 - t) * HOR + 2 * (1 - t) * t * -6 + t * t * HOR;
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
  return (
    <Svg width={width} height={h} viewBox={`0 0 ${VW} ${VH}`} accessible={false}>
      <Defs>
        <LinearGradient id="sunRamp" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={VW} y2="0">
          <Stop offset={pct(s - 0.06)} stopColor={color.copper} stopOpacity="0" />
          <Stop offset={pct(s)} stopColor={color.copperDim} stopOpacity="0.55" />
          <Stop offset={pct(s + 0.15)} stopColor={color.copper} stopOpacity="1" />
          <Stop offset={pct(e - 0.2)} stopColor={color.copper} stopOpacity="0.95" />
          <Stop offset={pct(e)} stopColor={color.copperDim} stopOpacity="0.5" />
          <Stop offset={pct(e + 0.03)} stopColor={color.copper} stopOpacity="0" />
        </LinearGradient>
        <LinearGradient id="sunRampMask" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={VW} y2="0">
          <Stop offset={pct(s - 0.06)} stopColor="#fff" stopOpacity="0" />
          <Stop offset={pct(s + 0.04)} stopColor="#fff" stopOpacity="0.6" />
          <Stop offset={pct((s + e) / 2)} stopColor="#fff" stopOpacity="1" />
          <Stop offset={pct(e - 0.16)} stopColor="#fff" stopOpacity="0.85" />
          <Stop offset={pct(e + 0.03)} stopColor="#fff" stopOpacity="0" />
        </LinearGradient>
        <LinearGradient id="sunFall" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={HOR}>
          <Stop offset="0%" stopColor={color.copper} stopOpacity="0.05" />
          <Stop offset="100%" stopColor={color.copper} stopOpacity="0.26" />
        </LinearGradient>
        <RadialGradient id="sunGlow">
          <Stop offset="0%" stopColor={color.bone} stopOpacity="0.55" />
          <Stop offset="100%" stopColor={color.bone} stopOpacity="0" />
        </RadialGradient>
        <Mask id="sunLit">
          <Rect x="0" y="0" width={VW} height={VH} fill="url(#sunRampMask)" />
        </Mask>
      </Defs>

      {/* the wash under the arc, lit only inside the legal window */}
      <Path d={`M0 ${HOR} Q${VW / 2} -6 ${VW} ${HOR} Z`} fill="url(#sunFall)" mask="url(#sunLit)" />
      {/* horizon */}
      <Line x1={0} y1={HOR} x2={VW} y2={HOR} stroke="rgba(255,255,255,0.10)" strokeWidth={1} />
      {/* the full path of the sun, unlit */}
      <Path d={`M0 ${HOR} Q${VW / 2} -6 ${VW} ${HOR}`} fill="none" stroke="rgba(224,164,128,0.13)" strokeWidth={1.25} />
      {/* the lit portion */}
      <Path
        d={`M0 ${HOR} Q${VW / 2} -6 ${VW} ${HOR}`}
        fill="none"
        stroke="url(#sunRamp)"
        strokeWidth={1.75}
        strokeLinecap="round"
      />
      {/* first and last light ticks */}
      <Line x1={s * VW} y1={HOR} x2={s * VW} y2={arcY(s)} stroke="rgba(224,164,128,0.22)" strokeWidth={1} />
      <Line x1={e * VW} y1={HOR} x2={e * VW} y2={arcY(e)} stroke="rgba(224,164,128,0.22)" strokeWidth={1} />
      {/* the sun, now */}
      <Circle cx={n * VW} cy={arcY(n)} r={13} fill="url(#sunGlow)" />
      <Circle cx={n * VW} cy={arcY(n)} r={4} fill="#F7F3EE" />
    </Svg>
  );
}

/** Body sentence — the workhorse text. `tone` picks the ink. */
export function Sentence({
  children,
  tone = 'muted',
  style,
}: {
  children: ReactNode;
  tone?: 'bone' | 'muted' | 'dim';
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[styles.sentence, { color: color[tone] }, style]}>{children}</Text>;
}

/** Display serif inline — species names, dates, times, counts only. */
export function Serif({
  children,
  italic,
  copper,
  size = type.size.lede,
  style,
}: {
  children: ReactNode;
  italic?: boolean;
  copper?: boolean;
  size?: number;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      style={[
        { fontFamily: italic ? type.displayItalic : type.display, fontSize: size, color: copper ? color.copper : color.bone },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  scrollBody: { paddingHorizontal: space.gutter, paddingBottom: space.x38 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: color.hair, marginHorizontal: -space.gutter },
  row: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space.x12, paddingVertical: space.x12 },
  rowTitle: { fontFamily: type.ui, fontSize: type.size.body + 0.5, color: color.bone },
  rowSubtitle: { fontFamily: type.ui, fontSize: 13, color: color.muted },
  rowRule: {
    position: 'absolute',
    left: 0,
    right: -space.gutter,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.hair,
  },
  pill: { height: 50, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.section },
  pillPrimary: { backgroundColor: color.fill, borderWidth: 1, borderColor: color.copper },
  pillSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: color.hair },
  pillLabel: { fontFamily: type.uiSemiBold, fontSize: 14.5 },
  micro: { fontFamily: type.uiSemiBold, fontSize: type.size.micro, letterSpacing: type.microTracking, color: color.dim },
  thread: { position: 'absolute', left: 0, top: 0 },
  sentence: { fontFamily: type.ui, fontSize: type.size.body, lineHeight: 23 },
});
