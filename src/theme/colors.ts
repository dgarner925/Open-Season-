/**
 * OpenSeason palette — dark forest green / bone / brass.
 * Outdoorsy but modern. Not camo.
 *
 * The app is dark-first (a hunter checking the app pre-dawn). A light set is
 * defined so we can add a light mode later without re-plumbing components.
 */

export const palette = {
  // Forest greens (backgrounds, surfaces)
  forest900: '#0F1C15',
  forest800: '#14261C', // app background
  forest700: '#1C3226', // card / surface
  forest600: '#24402F', // elevated surface / pressed
  forest500: '#2F5240', // borders on dark

  // Bone / paper (text + light surfaces)
  bone100: '#FBF8F0',
  bone200: '#F5F0E3',
  bone300: '#EDE6D6', // primary text on dark
  bone400: '#CFC7B4', // secondary text on dark
  bone500: '#A79E88', // muted / captions

  // Brass (accent, CTAs, highlights)
  brass300: '#D9BA7E',
  brass400: '#C9A25A',
  brass500: '#B58A3E', // primary accent
  brass600: '#8F6B2C',

  // Urgency — deadlines are the highest-stakes data in the app
  danger: '#C4462F', // <= 7 days / passed-soon
  danger200: '#E88C79',
  warning: '#D98A2B', // 8–30 days
  success: '#4E8C5A', // open now / plenty of time

  // Utility
  overlay: 'rgba(0,0,0,0.5)',
  transparent: 'transparent',
} as const;

/**
 * Species colors — used to color-code seasons across calendar + cards.
 * Chosen for distinct hue separation while staying in the earthy family.
 */
export const speciesColors = {
  deer: '#C88A4A', // tan
  elk: '#A65A3C', // rust
  bear: '#6E5138', // dark brown
  duck: '#3E7C8C', // mallard teal
  default: palette.brass500,
} as const;

export type SpeciesKey = keyof typeof speciesColors;

export const theme = {
  color: {
    background: palette.forest800,
    surface: palette.forest700,
    surfaceElevated: palette.forest600,
    border: palette.forest500,
    textPrimary: palette.bone300,
    textSecondary: palette.bone400,
    textMuted: palette.bone500,
    accent: palette.brass500,
    accentStrong: palette.brass400,
    onAccent: palette.forest900,
    danger: palette.danger,
    warning: palette.warning,
    success: palette.success,
  },
  species: speciesColors,
} as const;

/** Map a days-until value to an urgency color. */
export function urgencyColor(daysUntil: number | null): string {
  if (daysUntil === null) return theme.color.textMuted;
  if (daysUntil <= 7) return theme.color.danger;
  if (daysUntil <= 30) return theme.color.warning;
  return theme.color.success;
}
