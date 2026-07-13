/**
 * OpenSeason — "Nocturne" palette.
 * Quiet-luxury, editorial dark: warm near-black, ivory, and a single restrained
 * copper accent. No rainbow of species colors in the chrome — species get one
 * small, muted dot, never a full fill. Beauty through restraint, type, and space.
 */

export const palette = {
  // Warm near-black ink scale (backgrounds, surfaces, hairlines)
  ink900: '#0B0B0C', // app background
  ink800: '#121213',
  ink700: '#161618', // card surface
  ink600: '#1E1E21', // elevated surface / pressed
  ink500: '#2A2A2E', // hairline border
  ink400: '#3A3A40',

  // Ivory / paper (text)
  ivory100: '#FBFAF6',
  ivory200: '#F1EEE7', // primary text
  ivory300: '#D8D4CB',
  ivory400: '#A6A29A', // secondary text
  ivory500: '#76736C', // muted / captions

  // Single accent — warm copper. Refined, not gold.
  copper300: '#E4A585',
  copper400: '#D68C68',
  copper500: '#C4744E', // primary accent
  copper600: '#9E5738',

  // Status — used sparingly, tuned to sit in the palette
  danger: '#D65C4E',
  warning: '#CD955C',
  calm: '#7E9B8C', // muted sage-teal, only for "open now" / relaxed timing

  overlay: 'rgba(0,0,0,0.62)',
  transparent: 'transparent',
} as const;

/**
 * Species colors — muted, harmonious. Used ONLY as a small dot/marker, never a
 * full fill. Desaturated so they read as one family.
 */
export const speciesColors = {
  deer: '#C39A73', // warm sand
  elk: '#B87A57', // clay
  bear: '#8C7059', // taupe
  duck: '#6E9B99', // muted teal
  default: palette.copper500,
} as const;

export type SpeciesKey = keyof typeof speciesColors;

export const theme = {
  color: {
    background: palette.ink900,
    surface: palette.ink700,
    surfaceElevated: palette.ink600,
    border: palette.ink500,
    textPrimary: palette.ivory200,
    textSecondary: palette.ivory400,
    textMuted: palette.ivory500,
    accent: palette.copper500,
    accentStrong: palette.copper400,
    onAccent: palette.ink900,
    danger: palette.danger,
    warning: palette.warning,
    success: palette.calm,
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
