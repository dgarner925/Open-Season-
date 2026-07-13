import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius, spacing, theme, type } from '@/theme';

/** Screen wrapper with safe-area + ink background. */
export function Screen({
  children,
  scroll = false,
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const inner = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.screenContent, contentStyle]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.screenContent, styles.flex, contentStyle]}>{children}</View>
  );
  return <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>{inner}</SafeAreaView>;
}

type TextVariant = keyof typeof type;
export function AppText({
  children,
  variant = 'body',
  color,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  variant?: TextVariant;
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[type[variant], { color: color ?? theme.color.textPrimary }, style]}
    >
      {children}
    </Text>
  );
}

/** Elevated card — hairline border + soft surface. Refined, not loud. */
export function Card({
  children,
  onPress,
  style,
  accentColor,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accentColor?: string;
}) {
  const content = (
    <View style={[styles.card, style]}>
      {accentColor ? <View style={[styles.accentBar, { backgroundColor: accentColor }]} /> : null}
      {children}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
      {content}
    </Pressable>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  ...rest
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
} & Omit<PressableProps, 'style' | 'children'>) {
  const isDisabled = disabled || loading;
  const p = {
    primary: { bg: theme.color.accent, fg: theme.color.onAccent, border: 'transparent' },
    secondary: { bg: 'transparent', fg: theme.color.textPrimary, border: theme.color.border },
    ghost: { bg: 'transparent', fg: theme.color.textSecondary, border: 'transparent' },
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: p.bg, borderColor: p.border },
        variant !== 'primary' && styles.buttonBordered,
        (pressed || isDisabled) && { opacity: isDisabled ? 0.45 : 0.82 },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <Text style={[type.bodyStrong, styles.buttonLabel, { color: p.fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

/** Small label — subtle by default, or filled when `color` is given. */
export function Pill({ label, color, textColor }: { label: string; color?: string; textColor?: string }) {
  const filled = Boolean(color);
  return (
    <View
      style={[
        styles.pill,
        filled
          ? { backgroundColor: color }
          : { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.border },
      ]}
    >
      <Text style={[type.overline, { color: textColor ?? (filled ? theme.color.onAccent : theme.color.textSecondary) }]}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

/** Small species/status dot. */
export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

export function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.background },
  flex: { flex: 1 },
  screenContent: { padding: spacing.xl, gap: spacing.lg },
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.border,
    overflow: 'hidden',
  },
  accentBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.994 }] },
  button: {
    minHeight: 54,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  buttonBordered: { borderWidth: StyleSheet.hairlineWidth },
  buttonLabel: { letterSpacing: 0.3 },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.color.border, marginVertical: spacing.sm },
});
