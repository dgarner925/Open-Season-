/**
 * What the app does.
 *
 * Two lists, because the two places that show this want different things.
 *
 * `HOW_IT_WORKS` is the spine — pick, watch, be told — and it is what a new
 * account meets during setup. Three beats in the order they actually happen,
 * each one short enough to read on the way past. It used to be five dense
 * paragraphs, which read as a wall rather than a sequence (David, 2026-11-08:
 * "It needs to flow logically. Not just have a plate of information").
 *
 * `HOW_IT_WORKS_MORE` is the rest of what the app can do. It belongs on
 * Profile → How it works, where somebody has gone looking for detail, and not
 * in front of a person who has not picked a state yet.
 */
export type HowItWorksStep = { title: string; body: string };

/** The spine. Shown during setup, and first on the reference page. */
export const HOW_IT_WORKS: HowItWorksStep[] = [
  {
    title: 'You pick what you hunt.',
    body: 'Your states, then the animals. Two taps from here.',
  },
  {
    title: 'We watch the dates.',
    body: 'Every opener, closer and draw deadline for those states, kept current as the agencies publish them.',
  },
  {
    title: 'You hear about it first.',
    body: "Your phone buzzes before a season opens and before a deadline closes — a year out, or the day before, however far ahead you want it.",
  },
];

/** The rest, for the reference page only. */
export const HOW_IT_WORKS_MORE: HowItWorksStep[] = [
  {
    title: 'Track your applications.',
    body: 'Under Tags, log what you applied for: the portal link, your username, dates and results. We never store your passwords — keep those in your phone.',
  },
  {
    title: 'Apply and buy tags.',
    body: 'Season and deadline screens link straight to the official state website, so you can enter a draw or buy a license in a tap.',
  },
];
