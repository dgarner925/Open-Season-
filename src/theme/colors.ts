/**
 * Open Season — "Ember" palette.
 * Warm charcoal (brown-black) base that leans into the copper accent — no green.
 * Cards are a subtle warm-dark gradient with a copper-tinted hairline; species
 * read as copper monograms. Status: Open = copper, Closed/Soon = muted white.
 */

export const palette = {
  // Warm charcoal ink scale (no green tint)
  ink900: '#100e0c', // app background
  ink800: '#15120f',
  ink700: '#17130f', // card surface (darker gradient stop)
  ink600: '#241e17', // elevated surface (lighter gradient stop)
  ink500: '#2a251f', // solid hairline-ish

  // Warm off-white text
  bone100: '#f4f1ea', // primary text

  // Accent — copper
  copper300: '#e6b79b', // light copper (text on copper glass)
  copper400: '#d99e7f', // primary accent
  copper500: '#c98a6a', // pressed / deeper copper

  overlay: 'rgba(0,0,0,0.62)',
  transparent: 'transparent',
} as const;

/**
 * Species colors — earthy copper family so any small dot/monogram sits in the
 * Midnight mood. The SpeciesBadge renders a solid copper monogram; these are for
 * incidental accents only.
 */
export const speciesColors = {
  deer: '#d99e7f',
  elk: '#c98a6a',
  bear: '#a97a5c',
  duck: '#8fa39a',
  default: '#d99e7f',
} as const;

export type SpeciesKey = keyof typeof speciesColors;

export const theme = {
  color: {
    background: palette.ink900,
    surface: palette.ink700,
    surfaceElevated: palette.ink600,
    border: 'rgba(217,158,127,0.20)', // copper-tinted border (featured/gradient card)
    surfaceFlat: 'rgba(255,255,255,0.03)', // inactive rows, stat tiles, peek cards
    borderFlat: 'rgba(255,255,255,0.07)', // border on flat surfaces
    hairline: 'rgba(255,255,255,0.08)', // list dividers
    textPrimary: palette.bone100,
    textSecondary: 'rgba(244,241,234,0.80)', // raised for outdoor/sunlight legibility
    textMuted: 'rgba(244,241,234,0.62)', // raised from .50 — dim greys were hard to read in bright light
    accent: palette.copper400,
    accentStrong: palette.copper500,
    accentSoft: palette.copper300, // light copper — text on translucent/glass
    accentFill: 'rgba(217,158,127,0.18)', // soft copper fill behind "Open" pills
    onAccent: '#161a17', // near-black — legible on solid copper
    danger: '#d9776a',
    warning: '#d9a86a',
    success: palette.copper400, // "open / plenty of time" reads copper in Midnight
  },
  gradient: {
    card: ['#241e17', '#17130f'] as [string, string],
  },
  species: speciesColors,
  /**
   * Ambient contour-line texture on chrome surfaces (TextureBackground).
   * `opacity` is THE tuning knob — keep within 0.03–0.06. Single hue from the
   * palette; no new colors.
   */
  texture: {
    color: palette.copper400,
    opacity: 0.045,
    scale: 1,
  },
  /** Light-mode variant, ready for a future light theme (app is dark-only today). */
  textureLight: {
    color: palette.copper500,
    opacity: 0.05,
    scale: 1,
  },
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
