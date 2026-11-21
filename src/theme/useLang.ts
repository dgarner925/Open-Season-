/**
 * The design language for the mode the app is currently in.
 *
 * ---------------------------------------------------------------------------
 * WHEN TO USE THIS, AND WHEN NOT TO -- the rule that keeps hunting safe
 *
 * Hunting components import `lang` STATICALLY and must keep doing so. That is
 * not laziness: a static import means a hunting screen physically cannot react
 * to the mode, so "hunting is unchanged" is true by construction rather than
 * something to re-verify by eye after every commit. Most of those screens put
 * their colours in a module-level StyleSheet.create(), which captures the
 * value once at import time -- they could not react even if asked.
 *
 * OTW-only components mirror that: they import `otwLang` statically, and get
 * the OTW-native names (river, brass, moss, plateBorder) with no union types
 * in the way.
 *
 * This hook is for the narrow middle: a component that genuinely renders in
 * BOTH modes. Convert one only when an OTW screen actually needs it, and only
 * if its hunting output stays pixel-identical -- which means moving colours
 * out of the module-level StyleSheet and into inline style objects, since a
 * StyleSheet built at import time cannot follow the mode.
 *
 * What you get is the ROLES both modes guarantee (`color.bone` is "primary
 * text" in both, holding #F2EFEC in the woods and #1B2B36 on the water), not
 * the OTW-native aliases. Reach for `otwLang` directly if you want those, and
 * if you want those you are probably writing an OTW-only component.
 */
import { useMemo } from 'react';
import { useModeSafe } from '@/providers/ModeProvider';
import { theme } from './colors';
import { lang } from './tokens';
import { otwLang, otwTheme } from './otwTokens';

/**
 * The roles every mode promises. Deliberately widened to `string`: the point
 * is the role, and a union of two hex literals per key would make every style
 * prop a puzzle at the call site.
 */
export type ModeLang = {
  readonly color: { readonly [K in keyof typeof lang.color]: string };
  readonly space: typeof lang.space;
  readonly radius: typeof lang.radius;
  readonly type: {
    readonly display: string;
    readonly displayItalic: string;
    readonly ui: string;
    readonly uiMedium: string;
    readonly uiSemiBold: string;
    readonly uiBold: string;
    readonly size: typeof lang.type.size;
    readonly microTracking: number;
    readonly headlineTracking: number;
  };
};

/** The legacy "Midnight" names, for shared components that still read them. */
export type ModeTheme = {
  readonly color: { readonly [K in keyof typeof theme.color]: string };
  readonly gradient: { readonly card: readonly [string, string] };
};

/** The current mode's tokens. See the header for when this is the right tool. */
export function useLang(): ModeLang {
  const mode = useModeSafe();
  return mode === 'otw' ? otwLang : lang;
}

/** The current mode's legacy token names. */
export function useModeTheme(): ModeTheme {
  const mode = useModeSafe();
  return mode === 'otw' ? otwTheme : theme;
}

/**
 * Both, memoised together, for a component that needs each of them. Saves
 * threading two hooks and keeps the pair consistent within one render.
 */
export function useModeTokens(): { lang: ModeLang; theme: ModeTheme; isWater: boolean } {
  const mode = useModeSafe();
  return useMemo(
    () => ({
      lang: mode === 'otw' ? otwLang : lang,
      theme: mode === 'otw' ? otwTheme : theme,
      isWater: mode === 'otw',
    }),
    [mode],
  );
}
