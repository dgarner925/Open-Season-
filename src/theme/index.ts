export { theme, palette, speciesColors, urgencyColor, withAlpha } from './colors';
export type { SpeciesKey } from './colors';
export { fontFamily, fontSize, type, spacing, radius } from './typography';

/**
 * Standard disclaimer shown on every screen that presents dates or rules.
 *
 * THE FIRST SENTENCE IS A COMPLIANCE REQUIREMENT, not a nicety. Google Play's
 * Misleading Claims policy requires an app presenting government information
 * to state plainly that it does not represent a government entity; Play
 * rejected the 2026-11-24 submission for its absence. "Confirm with the
 * official state regulations" was the whole disclaimer before, and it implies
 * a relationship with the agency rather than denying one.
 *
 * Changing it is a policy decision, not a copy edit. The store listing
 * carries the same claim and the two must not drift.
 */
export const DISCLAIMER =
  'Open Season is not a government agency and is not affiliated with any state wildlife agency. Informational only — always confirm dates and rules with the official state regulations before hunting.';
