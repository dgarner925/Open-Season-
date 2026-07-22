/**
 * Typography — "Midnight". Instrument Serif (regular + italic) for page titles
 * and countdown/stat numerals; Archivo (400–700) for all UI text. Page titles are
 * large serif with one italic-copper accent word (see PageTitle).
 *
 * Font families are the @expo-google-fonts export names; they're loaded in
 * app/_layout.tsx via useFonts before the tree renders. On iOS, RN won't
 * synthesize weight, so each Archivo weight is its own family.
 */

export const fontFamily = {
  serif: 'InstrumentSerif_400Regular',
  serifItalic: 'InstrumentSerif_400Regular_Italic',
  sans: 'Archivo_400Regular',
  sansMedium: 'Archivo_500Medium',
  sansSemiBold: 'Archivo_600SemiBold',
  sansBold: 'Archivo_700Bold',
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 20,
  xl: 28,
  xxl: 40,
  display: 56, // countdown / stat numeral — the hero
} as const;

export const type = {
  // Instrument Serif display — italic accent words use fontFamily.serifItalic inline.
  // Line-heights sit comfortably above the font size so the tall serif caps
  // aren't clipped at the top (a tight lineHeight shaves the ascenders on iOS).
  display: { fontFamily: fontFamily.serif, fontSize: fontSize.display, letterSpacing: -1, lineHeight: 64 },
  h1: { fontFamily: fontFamily.serif, fontSize: fontSize.xxl, letterSpacing: -0.5, lineHeight: 48 },
  h2: { fontFamily: fontFamily.serif, fontSize: fontSize.xl, letterSpacing: -0.3, lineHeight: 34 },
  h3: { fontFamily: fontFamily.serif, fontSize: fontSize.lg, letterSpacing: -0.2, lineHeight: 27 },

  // Archivo UI
  body: { fontFamily: fontFamily.sans, fontSize: fontSize.md, lineHeight: 22 },
  bodyStrong: { fontFamily: fontFamily.sansSemiBold, fontSize: fontSize.md, lineHeight: 22 },
  caption: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, lineHeight: 18 },
  overline: { fontFamily: fontFamily.sansSemiBold, fontSize: fontSize.xs, letterSpacing: 1.6 },
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
  sm: 12,
  md: 16,
  lg: 22, // card radius (design: 18–24)
  pill: 999,
} as const;
