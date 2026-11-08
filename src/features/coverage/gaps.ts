/**
 * What we know, and what we don't — said out loud.
 *
 * Coverage rots with the calendar. A season row that was right in August is
 * last year's date by February, and the count of holes moved from 7 to 106 in
 * ten weeks without anyone touching the data. Every other app in this category
 * answers that by showing an empty list, which reads as "there is no season"
 * when the truth is "the agency hasn't posted it yet" or "we haven't got to it".
 *
 * Those are three different facts and a hunter deserves to know which one he
 * is looking at:
 *
 *   current   — we hold dates for the season now running or the one coming.
 *   awaiting  — we hold an older season year. The agency has not published the
 *               next one anywhere yet, so neither have we. Expected, and the
 *               single most common case between February and July.
 *   absent    — we have nothing for this pair at all. That is our hole, not
 *               the agency's, and the copy says so.
 *
 * Deliberately NOT a fourth kind for "this state does not offer this season".
 * A missing state_species mapping looks identical from here, and that mapping
 * has been wrong before — an orphaned pair hides every season behind it. The
 * app must never tell someone a hunt doesn't exist on the strength of a row we
 * failed to write. "We don't have it" is always true; "there is no season" may
 * not be.
 */
import type { SeasonWithRefs } from '@/features/reference/types';

export type Coverage =
  | { kind: 'current' }
  | { kind: 'awaiting'; throughYear: number; lastOpen: string | null }
  | { kind: 'absent' };

/**
 * The hunting year an ISO date falls in. Seasons run across New Year — spring
 * turkey in March 2027 belongs to the 2026 season — so the year turns in July,
 * between the close of the spring hunts and the first of the fall openers.
 */
export function huntYear(iso: string): number {
  const [y, m] = iso.split('-').map(Number);
  return (m ?? 1) >= 7 ? y : y - 1;
}

/** What we hold for one (state, species) pair, given every season row for it. */
export function coverageOf(seasons: SeasonWithRefs[], iso: string): Coverage {
  if (seasons.length === 0) return { kind: 'absent' };

  // A row counts as live if it opens in the future, or it has opened and has
  // not closed.
  //
  // The third arm is the awkward one: a row with an open date behind us and no
  // close date at all. That is missing data, not a stale year — a handful of
  // agencies publish year-round hunts that way, and the extractor also drops
  // the close date now and then. We must not call it open (claiming a season
  // is open when it is shut is the worst error this app can make, and the rest
  // of the app already requires both dates before it says "Open"), but we must
  // not print "they haven't published next year" about a row that belongs to
  // THIS year either. So it suppresses the gap note and says nothing, and the
  // screen's own conservative open/closed logic governs the wording.
  const hy = huntYear(iso);
  const live = seasons.some(
    (s) =>
      s.open_date &&
      (s.open_date >= iso ||
        (s.close_date ? iso <= s.close_date : (s.season_year ?? 0) >= hy)),
  );
  if (live) return { kind: 'current' };

  // Nothing current. Say which year we do hold, and when it last opened, so
  // the sentence can be specific instead of apologetic.
  const throughYear = seasons.reduce((max, s) => Math.max(max, s.season_year ?? 0), 0);
  const lastOpen =
    seasons
      .map((s) => s.open_date)
      .filter((d): d is string => Boolean(d))
      .sort()
      .pop() ?? null;

  return { kind: 'awaiting', throughYear, lastOpen };
}

/**
 * The sentence to put on the screen, or null when there is nothing to admit.
 *
 * `followed` decides whether we may promise anything. Telling someone "you'll
 * hear the day we add it" when they aren't following the pair would be a
 * promise with no delivery path behind it, so it is only offered to people the
 * alert pipeline can actually reach.
 */
export function coverageLine(
  cov: Coverage,
  opts: { species: string; state: string; agency?: string | null; followed?: boolean },
): string | null {
  if (cov.kind === 'current') return null;

  const species = opts.species.toLowerCase();
  const promise = opts.followed ? " You'll hear from us the day it lands." : '';

  if (cov.kind === 'awaiting') {
    const agency = opts.agency ?? opts.state;
    const next = cov.throughYear > 0 ? cov.throughYear + 1 : null;
    const held = cov.throughYear > 0 ? ` Ours run through the ${cov.throughYear} season.` : '';
    return next
      ? `${agency} hasn't published the ${next} ${species} dates yet.${held}${promise}`
      : `${agency} hasn't published the next ${species} dates yet.${promise}`;
  }

  return `We don't have ${opts.state} ${species} yet — that's our gap, not the state's.${promise}`;
}

/**
 * The short word for a status column, where a sentence won't fit.
 *
 * "Our gap" is deliberate. The row it replaces said "No dates yet", which
 * reads as the state's fault and tells the reader nothing he can act on.
 * Naming it as ours is the one label no competitor will copy, and tapping the
 * row gets the full sentence and the agency's own link.
 */
export function coverageWord(cov: Coverage): string | null {
  if (cov.kind === 'current') return null;
  return cov.kind === 'awaiting' ? 'Awaiting' : 'Our gap';
}
