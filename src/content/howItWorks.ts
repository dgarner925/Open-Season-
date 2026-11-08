/**
 * What the app does, in five beats.
 *
 * One source for two places: the first step of onboarding, where a new account
 * meets it, and Profile → How it works, where anyone can go back to it. They
 * used to be one screen nobody saw — onboarding was reachable only from
 * Profile, so a new account landed on an empty Home with no idea what the app
 * was for (David, 2026-11-08: "we need to introduce How it works as an
 * onboarding").
 *
 * Keep these in the order a season actually happens: pick, watch, be told,
 * log, apply. Each body says what the user does and what the app does back —
 * never a feature name on its own.
 */
export type HowItWorksStep = { title: string; body: string };

export const HOW_IT_WORKS: HowItWorksStep[] = [
  {
    title: 'Pick your hunts.',
    body: 'Choose your states and the animals you hunt. Everything in the app flows from what you pick here — change it any time from Profile.',
  },
  {
    title: 'Watch the countdowns.',
    body: 'Your soonest opener and your next tag deadline sit at the top of Home, counting down the days so nothing sneaks up on you.',
  },
  {
    title: 'Get told before it opens.',
    body: 'Choose how far ahead you want a heads-up — from a year out down to the day before. Your phone buzzes each of those mornings, and Home names the exact times it will.',
  },
  {
    title: 'Track your applications.',
    body: 'Under Tags, log what you applied for: the portal link, your username, dates and results. We never store your passwords — keep those in your phone.',
  },
  {
    title: 'Apply and buy tags.',
    body: 'Season and deadline screens link straight to the official state website, so you can enter a draw or buy a license in a tap.',
  },
];

/** "Five steps to opening day." — the count stays true if a step is added. */
const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'];
export const HOW_IT_WORKS_LEDE = `${WORDS[HOW_IT_WORKS.length] ?? HOW_IT_WORKS.length} steps to opening day.`;
