import { Platform } from 'react-native';

/**
 * Typography — editorial. A refined serif for display/headings, a clean sans
 * for body. Tight tracking on large serif, open tracking on small overlines.
 *
 * V1 uses platform system fonts (no extra dependency). To go fully bespoke,
 * load a serif like "Canela", "Fraunces", or "Playfair Display" via expo-font
 * and swap `serif` below (adding @expo-google-fonts/* is a new dep — confirm).
 */

export const fontFamily = {
  serif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
  sans: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }),
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 23,
  xxl: 30,
  display: 52, // the countdown number — the hero
} as const;

export const type = {
  display: {
    fontFamily: fontFamily.serif,
    fontSize: fontSize.display,
    fontWeight: '600' as const,
    letterSpacing: -1.5,
    lineHeight: 54,
  },
  h1: { fontFamily: fontFamily.serif, fontSize: fontSize.xxl, fontWeight: '600' as const, letterSpacing: -0.6, lineHeight: 36 },
  h2: { fontFamily: fontFamily.serif, fontSize: fontSize.xl, fontWeight: '600' as const, letterSpacing: -0.3, lineHeight: 29 },
  h3: { fontFamily: fontFamily.serif, fontSize: fontSize.lg, fontWeight: '600' as const, letterSpacing: -0.2, lineHeight: 24 },
  body: { fontFamily: fontFamily.sans, fontSize: fontSize.md, fontWeight: '400' as const, lineHeight: 22 },
  bodyStrong: { fontFamily: fontFamily.sans, fontSize: fontSize.md, fontWeight: '600' as const, lineHeight: 22 },
  caption: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, fontWeight: '400' as const, lineHeight: 18 },
  overline: { fontFamily: fontFamily.sans, fontSize: fontSize.xs, fontWeight: '600' as const, letterSpacing: 1.6 },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 40,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
} as const;
