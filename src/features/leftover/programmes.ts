/**
 * What happens, and when, in each state that runs a leftover tag sale.
 *
 * This is editorial content, not data. A leftover sale is not one mechanism
 * repeated eleven times -- Montana's is a sign-up list with a deadline,
 * Oregon's is a statutory hour, Utah's runs until the tags are gone -- and a
 * hunter who turns up expecting the wrong one misses the hunt. No column in
 * `leftover_tag_sales` can say "online only, and you must buy it by the day
 * before the hunt opens".
 *
 * Every claim here was read off the agency's own page on 10-11 November 2026,
 * mostly by watching what the ingest function extracted and discarded. Where
 * a date is given as a month rather than a day it is because the agency moves
 * it year to year; where it is given exactly it is because a regulation fixes
 * it. If you cannot tell which, say the vaguer thing -- a specific wrong hour
 * is worse than an honest "early July".
 *
 * The server's own list lives in supabase/functions/ingest-leftover-tags/
 * registry.ts. These two must agree about which states are automated; the
 * registry is the one that decides.
 */

export type DateSource =
  /** Fixed by regulation. The date does not move, so it needs confirming, not watching. */
  | 'rule'
  /** Printed on a page we read every night. */
  | 'page'
  /** Announced in a news release, so a human enters it. */
  | 'announcement';

export type Mechanic =
  /** First come, first served, at a published hour. Popular units go in minutes. */
  | 'first_come'
  /** A sign-up window with a deadline, drawn afterwards. Turning up early buys nothing. */
  | 'sign_up'
  /** On sale until they are gone, with no closing date. */
  | 'until_gone';

export type Programme = {
  code: string;
  state: string;
  /** What the state itself calls them. "Leftover" is not universal. */
  calls_them: string;
  date_source: DateSource;
  mechanic: Mechanic;
  /** When it happens, in the plainest true words available. */
  when: string;
  /** Things that cost people a tag. Short, concrete, each one load-bearing. */
  watch_out?: string[];
  url: string;
};

export const MECHANIC_LABEL: Record<Mechanic, string> = {
  first_come: 'First come, first served',
  sign_up: 'Sign-up list with a deadline',
  until_gone: 'On sale until they are gone',
};

export const MECHANIC_LINE: Record<Mechanic, string> = {
  first_come:
    'Sales open at a published hour and the best units are gone within minutes. Being ready matters more than being early in the day.',
  sign_up:
    'You are joining a list, not buying a tag. Turning up at the opening hour buys nothing — meeting the deadline is the whole job.',
  until_gone:
    'No closing date. Tags stay on sale until they sell out, so the opening hour matters less and the first week matters a lot.',
};

export const PROGRAMMES: Programme[] = [
  {
    code: 'OR',
    state: 'Oregon',
    calls_them: 'Leftover controlled hunt tags',
    date_source: 'rule',
    mechanic: 'first_come',
    when: '10 a.m. Pacific on 1 July for deer, elk and pronghorn. 15 March for spring bear.',
    watch_out: [
      'Online only — not at ODFW offices and not at licence vendors.',
      'One tag per person per hunt series.',
      'It must be bought by the day before the hunt opens, which is a second deadline.',
      'Sheep and mountain goat hunts are never in the leftover pool.',
    ],
    url: 'https://myodfw.com/articles/how-check-and-earn-preference-points',
  },
  {
    code: 'CO',
    state: 'Colorado',
    calls_them: 'Leftover, remaining and reissued licences',
    date_source: 'page',
    mechanic: 'first_come',
    when: 'Spring turkey in early March. Big game in early August. CPW posts the exact days each year.',
    watch_out: [
      'Reissued licences keep appearing through the season as hunters hand tags back, so one August date is not the end of it.',
      'CPW has printed two different start dates for the same reissue sale in one year. Where the page disagrees with itself we show you both.',
    ],
    url: 'https://cpw.state.co.us/hunting/big-game/leftover-remaining-and-reissued-licenses',
  },
  {
    code: 'ID',
    state: 'Idaho',
    calls_them: 'Unsold controlled hunt tags',
    date_source: 'page',
    mechanic: 'first_come',
    when: '10 a.m. Mountain. Deer and elk in late August, fall turkey in mid-July.',
    watch_out: [
      'Nonresident hound hunter permits run on their own schedule and are not tied to a species.',
    ],
    url: 'https://idfg.idaho.gov/licenses/tag/unsold-controlled-hunts',
  },
  {
    code: 'UT',
    state: 'Utah',
    calls_them: 'Remaining permits',
    date_source: 'page',
    mechanic: 'until_gone',
    when: 'Early July, and different hunts open on different days — buck deer and bull elk first, antlerless elk three weeks later.',
    watch_out: [
      'Four separate opening days inside one month. One date will not cover everything you want.',
    ],
    url: 'https://wildlife.utah.gov/remainingpermits',
  },
  {
    code: 'MT',
    state: 'Montana',
    calls_them: 'Surplus licence list',
    date_source: 'page',
    mechanic: 'sign_up',
    when: 'Sign-up closes in mid-July. The 2026 list closed on 15 July.',
    watch_out: [
      'This is the one that catches people. It is a list you join by a deadline, not a sale you show up to.',
    ],
    url: 'https://fwp.mt.gov/buyandapply/hunting-licenses/surplus-licenses',
  },
  {
    code: 'WY',
    state: 'Wyoming',
    calls_them: 'Leftover licences',
    date_source: 'announcement',
    mechanic: 'first_come',
    when: 'Announced in a news release each year rather than on a fixed page, so the date is entered by hand once Game and Fish publish it.',
    watch_out: [
      'Wyoming runs a second draw before the first-come sale, so there are two dates and only one of them is a sale.',
    ],
    url: 'https://wgfd.wyo.gov/licenses-applications/leftover-licenses',
  },
];

/** The offsets a notification goes out on, as the default preference ships them. */
export const DEFAULT_OFFSETS = [7, 1, 0] as const;

export function offsetLine(off: number): string {
  if (off === 0) return 'the morning of the sale';
  if (off === 1) return 'the day before';
  return `${off} days before`;
}

/**
 * States believed to run a programme that nobody has automated yet.
 *
 * Kept short and honest. Three of them cannot be read by a machine at all:
 * Arizona refuses automated requests outright, North Dakota puts availability
 * behind a signed-in account, and South Dakota publishes a PDF it replaces
 * rather than versions each year.
 */
export const RESEARCHING = [
  'AZ', 'NM', 'NV', 'WA', 'AK', 'SD', 'ND', 'NE', 'KS',
  'OK', 'TX', 'CA', 'MN', 'IA', 'MO', 'WI', 'MI',
] as const;
