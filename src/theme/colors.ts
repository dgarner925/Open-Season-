/**
 * OpenSeason — "Slate & Ember" palette.
 * Cool graphite base with a single warm ember-orange accent (a nod to hunter
 * blaze). Species get one small muted dot, never a full fill.
 */

export const palette = {
  // Cool graphite ink scale (backgrounds, surfaces, hairlines)
  ink900: '#0D0D14', // app background
  ink800: '#101018',
  ink700: '#16161F', // card surface
  ink600: '#1E1E29', // elevated surface / pressed
  ink500: '#2A2A36', // hairline border
  ink400: '#3A3A48',

  // Cool off-white text
  mist100: '#F7F7FB',
  mist200: '#EDEEF4', // primary text
  mist300: '#CFD1DC',
  mist400: '#A3A7B5', // secondary text
  mist500: '#797E8C', // muted / captions

  // Accent — ember orange (hunter blaze, dialed to "refined")
  ember300: '#F0B08A', // light — text on glass/translucent ember
  ember400: '#EA9068',
  ember500: '#E0794A', // primary accent
  ember600: '#B85E34',

  // Status — kept distinct so urgency still reads at a glance
  danger: '#DE5F55',
  warning: '#E3A24A',
  calm: '#6E9B99', // muted teal — "open now" / plenty of time

  overlay: 'rgba(0,0,0,0.62)',
  transparent: 'transparent',
} as const;

/** Species colors — muted, used ONLY as a small dot. */
export const speciesColors = {
  deer: '#C39A73',
  elk: '#B87A57',
  bear: '#8C7059',
  duck: '#6E9B99',
  default: palette.ember500,
} as const;

export type SpeciesKey = keyof typeof speciesColors;

export const theme = {
  color: {
    background: palette.ink900,
    surface: palette.ink700,
    surfaceElevated: palette.ink600,
    border: palette.ink500,
    textPrimary: palette.mist200,
    textSecondary: palette.mist400,
    textMuted: palette.mist500,
    accent: palette.ember500,
    accentStrong: palette.ember400,
    accentSoft: palette.ember300, // light ember for text on translucent/glass
    onAccent: '#2A1206', // dark brown — legible on ember fills
    danger: palette.danger,
    warning: palette.warning,
    success: palette.calm,
  },
  species: speciesColors,
} as const;

/** hex (#RRGGBB) -> rgba string with the given alpha. For translucent "glass" fills. */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Map a days-until value to an urgency color. */
export function urgencyColor(daysUntil: number | null): string {
  if (daysUntil === null) return theme.color.textMuted;
  if (daysUntil <= 7) return theme.color.danger;
  if (daysUntil <= 30) return theme.color.warning;
  return theme.color.success;
}
