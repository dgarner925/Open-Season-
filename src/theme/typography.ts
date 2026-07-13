import { Platform } from 'react-native';

/**
 * Typography scale. Headers use a strong serif; body uses a clean sans.
 *
 * V1 uses platform system fonts (no extra dependency) so the app runs and
 * builds immediately:
 *   - serif: Georgia (iOS) / serif (Android)
 *   - sans:  system default
 *
 * To upgrade to a branded serif (e.g. Playfair Display / Lora) load it via
 * expo-font in src/theme/useAppFonts.ts and swap the family strings below.
 * Adding @expo-google-fonts/* is a new dependency — confirm before adding.
 */

export const fontFamily = {
  serif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
  sans: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }),
  // Set to loaded font names once custom fonts are wired up:
  serifBrand: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  display: 40, // countdown "days" number on hero cards
} as const;

export const type = {
  display: { fontFamily: fontFamily.serifBrand, fontSize: fontSize.display, fontWeight: '700' as const },
  h1: { fontFamily: fontFamily.serifBrand, fontSize: fontSize.xxl, fontWeight: '700' as const },
  h2: { fontFamily: fontFamily.serifBrand, fontSize: fontSize.xl, fontWeight: '600' as const },
  h3: { fontFamily: fontFamily.serifBrand, fontSize: fontSize.lg, fontWeight: '600' as const },
  body: { fontFamily: fontFamily.sans, fontSize: fontSize.md, fontWeight: '400' as const },
  bodyStrong: { fontFamily: fontFamily.sans, fontSize: fontSize.md, fontWeight: '600' as const },
  caption: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, fontWeight: '400' as const },
  overline: { fontFamily: fontFamily.sans, fontSize: fontSize.xs, fontWeight: '600' as const, letterSpacing: 1 },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;
