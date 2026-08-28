/**
 * Shared primitives of the second-generation design language. Screens being
 * converted (Pass 3) import from here, not from ui.tsx. See tokens.ts for the
 * rules these encode.
 */
import { Ionicons } from '@expo/vector-icons';
import { type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Line, Path, Rect, Stop } from 'react-native-svg';
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
 * The sun's day-arc — only where legal light is the subject. `progress` places
 * the sun along the arc (0 = first light, 1 = last light).
 */
export function SunArc({ width, progress = 0.22 }: { width: number; progress?: number }) {
  const h = Math.round(width * 0.34);
  const rx = width / 2 - 4;
  const ry = h - 14;
  const cx = width / 2;
  const cy = h - 4;
  const theta = Math.PI * (1 - Math.max(0, Math.min(1, progress)));
  const sx = cx + rx * Math.cos(theta);
  const sy = cy - ry * Math.sin(theta);
  return (
    <Svg width={width} height={h} accessible={false}>
      <Path
        d={`M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 1 ${cx + rx} ${cy}`}
        fill="none"
        stroke={color.dim}
        strokeWidth={1.5}
        strokeDasharray="1 5.5"
        strokeLinecap="round"
      />
      <Line x1={0} y1={cy} x2={width} y2={cy} stroke={color.hair} strokeWidth={1} />
      <Circle cx={sx} cy={sy} r={5} fill={color.copper} />
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
