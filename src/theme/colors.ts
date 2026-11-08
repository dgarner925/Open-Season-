/**
 * Open Season — the legacy "Ember" palette, now a shim.
 *
 * The app's colours live in theme/tokens.ts (`lang`). This file stays only
 * because a handful of older components still import `theme` from '@/theme':
 * the admin and diagnostics screens, AlmanacRow, BrowseStateChip, HeaderBack,
 * LaunchQuote, LightCountdown, MiniMarkdown, Provenance, ui.tsx and
 * midnight.tsx.
 *
 * Every user-visible value below now reads from `lang`, so those components
 * render the field-journal palette rather than Ember's. Before this they drew
 * the old copper (#d99e7f) next to the new one (#E0A480) on the same screen —
 * the almanac row on Home and the provenance footnotes were both doing it.
 *
 * Do not add to this file. Convert the component instead and delete its
 * import; when the list above is empty, this goes with it.
 */
import { lang } from './tokens';

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
  deer: lang.color.copper,
  elk: lang.color.copperDim,
  bear: '#a97a5c',
  duck: '#8fa39a',
  default: lang.color.copper,
} as const;

export type SpeciesKey = keyof typeof speciesColors;

/**
 * The old names, pointed at the current tokens. Names are kept so the
 * remaining importers need no edit; values are not, so nothing renders a
 * second palette beside the real one.
 */
export const theme = {
  color: {
    background: lang.color.bg,
    surface: lang.color.surface,
    surfaceElevated: lang.color.surface,
    border: lang.color.rule,
    surfaceFlat: lang.color.tile,
    borderFlat: lang.color.hair,
    hairline: lang.color.hair,
    textPrimary: lang.color.bone,
    textSecondary: lang.color.muted,
    textMuted: lang.color.dim,
    accent: lang.color.copper,
    accentStrong: lang.color.copperDim,
    accentSoft: lang.color.copper,
    accentFill: lang.color.tileWarm,
    onAccent: lang.color.bg, // legible on solid copper
    danger: '#d9776a',
    warning: '#d9a86a',
    // "open / plenty of time" reads copper, same as everywhere else.
    success: lang.color.copper,
  },
  gradient: {
    card: [lang.color.surface, lang.color.bg] as [string, string],
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
