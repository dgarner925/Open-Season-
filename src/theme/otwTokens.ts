/**
 * "On the Water" (OTW) — the fishing mode's design language.
 *
 * The sister of `lang` in src/theme/tokens.ts: an old angler's notebook to
 * that one's 1880s hunting journal. Warm creek paper instead of near-black,
 * river teal instead of copper, IM Fell English for the headline and the
 * plates. Instrument Serif still sets every VALUE and Archivo still sets
 * every piece of UI text, which is what keeps the two modes recognisably the
 * same family rather than two apps in a trenchcoat.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE MIRRORS `lang`'s KEYS EXACTLY
 *
 * Every key in `lang.color` exists here with the same name and the equivalent
 * ROLE, so a component written against `useLang()` renders correctly in both
 * modes without knowing which one it is in. That is why `bone` — a name that
 * means nothing on cream paper — is here holding the dark ink: `bone` is the
 * "primary text" role, and renaming it would break that contract.
 *
 * The OTW-native names (`ink`, `river`, `brass`, `moss`, …) are aliases of the
 * same values, for components that only ever run in OTW and read better
 * saying what they mean. `otwLang.color.ink === otwLang.color.bone`.
 *
 * `space` and `radius` are `lang`'s, re-exported unchanged: the 20pt gutter
 * and the 24pt section rhythm are the app's skeleton, not the mode's mood.
 *
 * ---------------------------------------------------------------------------
 * CONTRAST
 *
 * Dark text on paper is the easy direction; coloured text on paper is not.
 * Five values here differ from the ones in the design brief because the
 * brief's values fail WCAG AA (4.5:1) at the sizes they are actually used.
 * Each one is marked. The measured ratios are in otwTokens.test.ts, which
 * fails if any of them regresses — a palette is the kind of thing that gets
 * "tidied" back to the prettier number a year from now.
 */
import { lang } from './tokens';

export const otwLang = {
  color: {
    // -- roles shared with `lang` -------------------------------------------
    /** Creek paper. The mockup shows a faint tooth; a flat fill is honest
     *  until there is a texture asset worth shipping. */
    bg: '#F3EDE0',
    /** Plates and genuinely separate objects — the fly-plate cards. */
    surface: '#FAF6EC',
    /** The "primary text" role. Dark slate-blue ink, not black: black on warm
     *  paper reads as a hole punched in it. 12.45:1. */
    bone: '#1B2B36',
    /** Supporting text — a sentence someone has to read. 6.16:1. */
    muted: '#4A5A60',
    /** Micro labels and inactive icons, never a sentence. 4.76:1. */
    dim: '#5B6B70',
    /** The "primary accent" role: river teal. 7.78:1 on paper. */
    copper: '#1F4E5F',
    /** The accent, deeper — pressed states and `accentStrong`. */
    copperDim: '#173D4B',
    /** Unused in `lang` today, mirrored so the shape stays whole. */
    fill: '#DDE6E4',
    /** Row dividers. */
    hair: 'rgba(31,78,95,0.12)',
    /** The few places a real section rule is still right — brass-tinted here,
     *  though OTW mostly uses WavyRule instead. */
    rule: 'rgba(168,130,63,0.30)',
    /** A group of related lines sits on one of these. On paper a tile has to
     *  DARKEN; the near-white lift that works on #0A0A0A is invisible here. */
    tile: 'rgba(31,78,95,0.045)',
    /** The one block on a screen that outranks the rest. */
    tileWarm: 'rgba(168,130,63,0.09)',

    // -- OTW-native aliases and additions -----------------------------------
    /** Alias of `bone`. */
    ink: '#1B2B36',
    /** Alias of `copper`. The Today card fill, the active toggle and tab. */
    river: '#1F4E5F',
    /** Alias of `copperDim`. */
    riverDeep: '#173D4B',
    /** Text on the river card. */
    riverText: '#F3EDE0',
    /** Secondary text on the river card. 5.68:1 on river. */
    riverTextDim: '#BFD0CF',

    /** Brass, for things that are not text: keylines, icon rings, the wavy
     *  rule, borders. Not legible enough to carry words on paper. */
    brass: '#A8823F',
    /**
     * Brass TEXT on paper — "All waters ›", "Tue 18".
     * BRIEF SAID #8C6A2E, which is 4.27:1 and fails AA. 4% darker: 4.67:1.
     */
    brassText: '#856428',
    /**
     * Brass FILL under cream text — the "Renew" pill.
     * BRIEF SAID #A8823F, which is 3.28:1 under #FBF6EA and fails AA. 4.54:1.
     */
    brassDeep: '#8B6C34',
    /** Micro labels on the river card. 4.55:1 on river. */
    brassOnRiver: '#D9B26A',

    /** Moss, for the status DOT only — a 6pt dot carries no text, so the
     *  brief's value stands where it is just a dot. */
    moss: '#6B8A3E',
    /**
     * Moss TEXT on paper ("● Open"), and the FILL of the "● Wadeable" pill
     * under cream text.
     * BRIEF SAID the pill is #6B8A3E, which is 3.38:1 under cream and 3.69:1
     * under ink — it fails AA both ways round, so there was no text colour
     * that rescued it. 4.69:1 in both uses.
     */
    mossText: '#55722F',

    /** The tab bar, which sits a step deeper than the page. */
    tabBar: '#EDE5D3',
    tabBarBorder: '#CDBB93',
    /**
     * Inactive tab label.
     * BRIEF SAID #6E7B7E, which is 3.49:1 on the tab bar and fails AA.
     *
     * Not `dim`, though it is the same role and nearly the same colour: the
     * tab bar is a step darker than the page, so `dim` measures 4.43:1 HERE
     * while passing at 4.76:1 on the page. Three hundredths of a hex apart
     * and one of them fails -- which is why the ratios are a test and not a
     * comment. 4.53:1.
     */
    tabInactive: '#5D696B',

    /** The fly plate's double border. */
    plateBorder: '#B9A57A',
    plateBorderInner: '#CDBB93',
    /** The 1px keyline inset inside the Today card. */
    keyline: 'rgba(201,163,92,0.45)',
    /** The track the inactive ModeToggle segment sits on. Hunting's own track
     *  lives in ModeToggle.tsx, because `lang` is not ours to add keys to. */
    toggleTrack: 'rgba(31,78,95,0.09)',
  },

  /** The app's skeleton, not the mode's mood — `lang`'s, unchanged. */
  space: lang.space,
  radius: lang.radius,

  type: {
    /** Values stay Instrument Serif in both modes. This is the family tie. */
    display: lang.type.display,
    displayItalic: lang.type.displayItalic,
    /** UI text stays Archivo in both modes. */
    ui: lang.type.ui,
    uiMedium: lang.type.uiMedium,
    uiSemiBold: lang.type.uiSemiBold,
    uiBold: lang.type.uiBold,

    /** OTW only: the headline, section titles and plate names. */
    otwDisplay: 'IMFellEnglish_400Regular',
    otwDisplayItalic: 'IMFellEnglish_400Regular_Italic',
    /** OTW only: "PLATE I". The SC face has no italic. */
    otwSmallCaps: 'IMFellEnglishSC_400Regular',

    /**
     * Sizes are `lang`'s, so a shared component laid out against one mode is
     * laid out against both. IM Fell English runs smaller on the body than
     * Archivo at the same point size, so OTW's headline passes its own size
     * explicitly (see the mockup's ~37pt) rather than taking `headline`.
     */
    size: lang.type.size,
    microTracking: lang.type.microTracking,
    headlineTracking: lang.type.headlineTracking,
  },
} as const;

/**
 * The legacy "Midnight" names, pointed at OTW's tokens.
 *
 * A deliberate copy of the projection in src/theme/colors.ts rather than a
 * shared helper, because building one would mean editing colors.ts — and the
 * rule for this work is that the hunting theme files are not touched at all.
 * The two must stay in step: if a key is added there, add it here.
 *
 * This exists so shared components that still read `theme.color.*` (AlmanacCol
 * and friends) can be handed OTW values without inventing a second mapping at
 * each call site.
 */
export const otwTheme = {
  color: {
    background: otwLang.color.bg,
    surface: otwLang.color.surface,
    surfaceElevated: otwLang.color.surface,
    border: otwLang.color.rule,
    surfaceFlat: otwLang.color.tile,
    borderFlat: otwLang.color.hair,
    hairline: otwLang.color.hair,
    textPrimary: otwLang.color.bone,
    textSecondary: otwLang.color.muted,
    textMuted: otwLang.color.dim,
    accent: otwLang.color.copper,
    accentStrong: otwLang.color.copperDim,
    accentSoft: otwLang.color.copper,
    accentFill: otwLang.color.tileWarm,
    /** Legible on solid river. */
    onAccent: otwLang.color.riverText,
    danger: '#A33C2E',
    warning: otwLang.color.brassText,
    /** "open / plenty of time" reads moss here, as copper does in the woods. */
    success: otwLang.color.mossText,
  },
  gradient: {
    card: [otwLang.color.surface, otwLang.color.bg] as [string, string],
  },
} as const;

/**
 * The fishing mode's disclaimer, matching DISCLAIMER in src/theme/index.ts --
 * including its first sentence, which is there to satisfy Google Play's
 * Misleading Claims policy. See the note on DISCLAIMER before editing either.
 */
export const OTW_DISCLAIMER =
  'Open Season is not a government agency and is not affiliated with any state wildlife agency. Informational only — always confirm seasons, limits and special regulations with the official state regulations before fishing.';

export type OtwLang = typeof otwLang;
