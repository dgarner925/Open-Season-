/**
 * The design language, second generation ("the field journal") — approved
 * 2026-08-27 from the season-detail rendering, set in Instrument Serif.
 *
 * Rules that travel with these tokens:
 *   one 20pt gutter · hairlines not cards · pills are for actions only ·
 *   one 24pt rhythm · display serif reserved for species/dates/times/counts ·
 *   no uppercase section headers (micro labels name a value's role only) ·
 *   copper is scarce (one per region) · sentences over field labels ·
 *   state the thing before the number · warnings earn weight by position.
 *
 * Legacy Midnight tokens live in src/theme/{colors,typography}.ts until every
 * screen is converted (Pass 3); do not add new usages of them.
 */
export const lang = {
  color: {
    bg: '#0A0A0A',
    /** Only where content is genuinely a separate actionable object. */
    surface: '#141110',
    bone: '#F2EFEC',
    muted: '#8A8279',
    dim: '#5C564F',
    copper: '#E0A480',
    copperDim: '#B87A5A',
    fill: '#3A241A',
    hair: 'rgba(255,255,255,0.09)',
    /** Section rules — copper-tinted and a full pixel, so the page's structure
     * is legible at a glance (hair was too faint for the big dividers). */
    rule: 'rgba(217,158,127,0.22)',
  },
  /** The single spacing scale. Sections are separated by `section` (24). */
  space: { x4: 4, x8: 8, x12: 12, x16: 16, gutter: 20, section: 24, x32: 32, x38: 38 },
  radius: { pill: 100, card: 20, none: 0 },
  type: {
    display: 'InstrumentSerif_400Regular',
    displayItalic: 'InstrumentSerif_400Regular_Italic',
    ui: 'Archivo_400Regular',
    uiMedium: 'Archivo_500Medium',
    uiSemiBold: 'Archivo_600SemiBold',
    size: { hero: 52, title: 33, lede: 24, body: 15.5, micro: 10.5 },
    microTracking: 1.5, // ≈0.14em at 10.5pt
  },
} as const;
