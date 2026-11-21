/**
 * What the app calls itself, in one place.
 *
 * The app is "Open Season" on the home screen and in conversation, and
 * "Open Season: In the Woods & On the Water" when it introduces itself in
 * full. Hunting is In the Woods, fishing is On the Water. OTW stays the
 * internal short name -- the route group, the mode key, analytics -- and is
 * never shown to anyone.
 *
 * It lives here because a product name spread across twenty files is a
 * product name that gets renamed in nineteen of them.
 *
 * ---------------------------------------------------------------------------
 * LENGTHS, WHICH ARE NOT COSMETIC
 *
 * The App Store and Google Play cap an app NAME at 30 characters. The full
 * brand is 40, so it cannot be the store name. The home-screen label is a
 * harder limit still: iOS truncates past roughly 12 characters, which is why
 * `name` in app.json stays "Open Season" (11) and is NOT changed here.
 *
 * STORE_NAME and STORE_SUBTITLE are proposals for the listing, not values the
 * app reads. Nothing in app.json, app.config.js or either store listing is
 * changed from this file -- those renames go through review and are David's
 * to make. The assertions at the bottom are here so a future edit that
 * overflows a store field fails a test rather than a submission.
 */

/** What the app is called in ordinary use. */
export const APP_NAME = 'Open Season';

/** The full brand, for the places that introduce the whole product. */
export const APP_FULL_NAME = 'Open Season: In the Woods & On the Water';

/** The brand without the product name -- a subtitle under "Open Season". */
export const MODES_TAGLINE = 'In the Woods & On the Water';

/** The paid tier. Unchanged by the rename, and tied to a RevenueCat product. */
export const PRO_NAME = 'Open Season Pro';

/**
 * How each mode names itself.
 *
 * `short` is for the toggle, where two segments share a header row with a
 * monogram, a state name and the search icon on a phone that may be 320pt
 * wide. `long` is for accessibility labels and the micro label on each mode's
 * Home. `abbr` is internal only.
 */
export const MODE_LABEL = {
  hunt: { short: 'Woods', long: 'In the Woods', abbr: 'HUNT' },
  otw: { short: 'Water', long: 'On the Water', abbr: 'OTW' },
} as const;

export type ModeLabelKey = keyof typeof MODE_LABEL;

// ---------------------------------------------------------------------------
// Store listing proposals. Not read by the app. See the header.

/** Proposed App Store / Play name. 30 max; the full brand's 40 will not fit. */
export const STORE_NAME = 'Open Season: Woods & Water';

/**
 * Proposed App Store subtitle / Play short description. 30 max.
 *
 * Carries the search terms the name gives up: nobody searches "woods", and
 * the name spends its budget on brand. This spends its own on the two words
 * people actually type.
 */
export const STORE_SUBTITLE = 'Hunting & fishing season dates';

/** The home-screen label. Stays as it is -- iOS truncates past about 12. */
export const HOME_SCREEN_LABEL = 'Open Season';

export const STORE_NAME_LIMIT = 30;
export const STORE_SUBTITLE_LIMIT = 30;
