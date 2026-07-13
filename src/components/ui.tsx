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

/** Screen wrapper with safe-area + forest background. */
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
    <View
      style={[
        styles.card,
        accentColor ? { borderLeftWidth: 4, borderLeftColor: accentColor } : null,
        style,
      ]}
    >
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
  const palette = {
    primary: { bg: theme.color.accent, fg: theme.color.onAccent, border: 'transparent' },
    secondary: { bg: 'transparent', fg: theme.color.accentStrong, border: theme.color.accentStrong },
    ghost: { bg: 'transparent', fg: theme.color.textSecondary, border: 'transparent' },
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, borderColor: palette.border },
        variant !== 'primary' && styles.buttonBordered,
        (pressed || isDisabled) && { opacity: isDisabled ? 0.5 : 0.8 },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <Text style={[type.bodyStrong, { color: palette.fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

/** Small colored pill — species tags, method labels, urgency chips. */
export function Pill({ label, color, textColor }: { label: string; color: string; textColor?: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: color }]}>
      <Text style={[type.overline, { color: textColor ?? theme.color.onAccent }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.background },
  flex: { flex: 1 },
  screenContent: { padding: spacing.lg, gap: spacing.lg },
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  pressed: { opacity: 0.85 },
  button: {
    minHeight: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  buttonBordered: { borderWidth: 1.5 },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.color.border, marginVertical: spacing.sm },
});
