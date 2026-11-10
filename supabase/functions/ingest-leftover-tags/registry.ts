/**
 * Which page to read, per state, for leftover and over-the-counter tags.
 *
 * This file is the actual work in this feature. The code around it is
 * straightforward; knowing that Wyoming publishes its leftover list on one
 * page and its sale date on none of them is not.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE RESEARCH FOUND (2026-11-10, five states verified against live pages)
 * ---------------------------------------------------------------------------
 *
 * 1. THERE IS NO SINGLE SHAPE. A "leftover sale" is at least three things:
 *
 *      first_come         A date, often an hour, and it is a race.
 *                         Colorado, Utah.
 *      application_window Open for days or weeks, drawn afterwards, no hour.
 *                         Montana's surplus sign-up, Idaho's second draw.
 *      recurring          Colorado reissues on a weekly cycle all season:
 *                         preview list Tuesdays 11:00 MT, sale Wednesday,
 *                         nothing added after 13:00 MT Wednesday, list cleared
 *                         and repopulated the following Tuesday.
 *
 *    The `shape` field exists so the extractor is told which it is looking at
 *    rather than guessing from prose.
 *
 * 2. SOME STATES PUBLISH NO DATE ON ANY STABLE PAGE. Wyoming's leftover page
 *    describes the process and names no dates; its "Application Dates &
 *    Deadlines" table covers the initial draw and omits leftovers entirely.
 *    The sale date appears only in a news release. That is why a source has a
 *    `role` and why 'news' is one of them -- for these states the release feed
 *    IS the authoritative source, uncomfortable as that is.
 *
 * 3. AGENCY PAGES CONTRADICT THEMSELVES, ON THESE EXACT FIELDS. Colorado's
 *    page gives the spring turkey reissue start as "March 11th" in one section
 *    and "Tuesday, March 3" in another. Wyoming's deadline table closes the
 *    Super Tag raffle on "Feb 2" while its own footnote says February 1, 2027.
 *    This is the span-row failure class again: plausible, confidently worded,
 *    and wrong. It is the single strongest argument for sales going through
 *    review_queue rather than being upserted, and it is why conflicting dates
 *    on one page must lower confidence rather than pick a winner.
 *
 * 4. A PUBLISHED HOUR IS THE EXCEPTION. Colorado and Utah give one ("9:00 a.m.",
 *    "8 a.m."); Montana, Idaho and Wyoming give none anywhere. The schema's
 *    nullable time is the common case, not the edge case.
 *
 * ---------------------------------------------------------------------------
 * ADDING A STATE
 * ---------------------------------------------------------------------------
 * Open the agency's own site -- never a hunting blog, never a news aggregator,
 * both of which carry last year's dates indefinitely. Find the page that is
 * still the right page next July, not this year's announcement. Set
 * `verified` to the day you looked at it with your own eyes. An entry with
 * `verified: null` is a lead, not a source, and the ingest function skips it.
 */

export type SourceRole =
  /** The list of what is available. May or may not carry dates. */
  | 'list'
  /** A dates/deadlines page. */
  | 'dates'
  /** The agency's news or press feed, when the date lives nowhere else. */
  | 'news';

export type SaleShape = 'first_come' | 'application_window' | 'recurring' | 'unknown';

export type RegistrySource = {
  url: string;
  role: SourceRole;
  note?: string;
};

export type StateEntry = {
  state_code: string;
  /** ISO day a human or agent last confirmed these URLs load and are the right pages. Null = unverified lead. */
  verified: string | null;
  shape: SaleShape;
  sources: RegistrySource[];
  /** Species the programme covers, as species.key, when the state is specific about it. */
  species?: string[];
  notes?: string;
};

export const REGISTRY: StateEntry[] = [
  {
    state_code: 'CO',
    verified: '2026-11-10',
    shape: 'first_come',
    species: ['elk', 'mule_deer', 'pronghorn', 'black_bear', 'turkey'],
    sources: [
      {
        url: 'https://cpw.state.co.us/hunting/big-game/leftover-remaining-and-reissued-licenses',
        role: 'list',
        note: 'Carries dates, an hour and an explicit MT zone -- the best-documented state found.',
      },
    ],
    notes:
      'Two programmes on one page. The August leftover sale is first_come. The reissue ' +
      'list is recurring and weekly: preview Tuesdays 11:00 MT, sale Wednesday, cutoff ' +
      '13:00 MT Wednesday, cleared and repopulated weekly. The weekly cycle does not fit ' +
      'one-row-per-sale and is deliberately NOT modelled yet -- see the open question in ' +
      'the README. Spring turkey runs on its own earlier schedule. The page states the ' +
      'turkey reissue start as both "March 11th" and "Tuesday, March 3"; conflicting ' +
      'dates must lower confidence, not be resolved by picking one.',
  },
  {
    state_code: 'UT',
    verified: '2026-11-10',
    shape: 'first_come',
    species: ['mule_deer', 'elk'],
    sources: [
      {
        url: 'https://wildlife.utah.gov/remainingpermits',
        role: 'list',
        note: 'Publishes a date and an hour ("8 a.m."), though no zone -- UT is wholly America/Denver.',
      },
    ],
    notes:
      'Early-to-mid July, with some elk categories on a later day than deer, so one state ' +
      'yields several sale rows with different start dates. DWR states the page is not ' +
      'updated once sales open, so remaining counts go stale immediately: availability ' +
      'scraped after the sale starts must not be trusted as current.',
  },
  {
    state_code: 'MT',
    verified: '2026-11-10',
    shape: 'application_window',
    species: ['mule_deer', 'elk'],
    sources: [
      {
        url: 'https://fwp.mt.gov/buyandapply/hunting-licenses/surplus-licenses',
        role: 'list',
        note: 'Carries a dated "Surplus Schedule" table. No hour given, for any row.',
      },
    ],
    notes:
      'Not a race: a sign-up window (6/15-7/15 in 2026) through MyFWP, then a five-day ' +
      'window to finalise after being emailed. Anything still unsold afterwards goes ' +
      'over the counter at licence providers with no announced date, which is a second, ' +
      'currently unmodelled sale.',
  },
  {
    state_code: 'ID',
    verified: '2026-11-10',
    shape: 'application_window',
    species: ['mule_deer', 'elk', 'pronghorn', 'black_bear'],
    sources: [
      {
        url: 'https://idfg.idaho.gov/licenses/tag/unsold-controlled-hunts',
        role: 'list',
        note: 'Stable URL. The tag list itself reads "TBD" outside the season.',
      },
    ],
    notes:
      'Second controlled-hunt application period (Aug 5-15 in 2026), then whatever is ' +
      'left sells first-come afterwards with no date published in advance. So Idaho is ' +
      'really two sales a year and only the first has a knowable date.',
  },
  {
    state_code: 'WY',
    verified: '2026-11-10',
    shape: 'unknown',
    species: ['pronghorn', 'mule_deer', 'elk'],
    sources: [
      {
        url: 'https://wgfd.wyo.gov/licenses-applications/leftover-licenses',
        role: 'list',
        note: 'Live and describes the process, but names NO dates at all.',
      },
      {
        url: 'https://wgfd.wyo.gov/licenses-applications/application-dates-deadlines',
        role: 'dates',
        note: 'Checked: covers the initial draw only. Leftovers are absent. Kept so nobody re-checks it.',
      },
    ],
    notes:
      'The awkward one, and the reason the news role exists. Wyoming runs a leftover ' +
      'DRAW (a short application window) and then sells the remainder over the counter, ' +
      'and neither date appears on any stable page -- only in news releases. Until a ' +
      'news source is added and proven, Wyoming cannot be ingested automatically and ' +
      'should not be faked: better no Wyoming row than a wrong one.',
  },

  // -------------------------------------------------------------------------
  // LEADS, NOT SOURCES. These states are believed to run a leftover, surplus,
  // second-draw or OTC programme, but nobody has opened the page and confirmed
  // which URL survives into next season. The ingest function skips every entry
  // whose `verified` is null, so adding a state here is safe and changes
  // nothing until someone does the looking.
  // -------------------------------------------------------------------------
  { state_code: 'AZ', verified: null, shape: 'unknown', sources: [], notes: 'Leftover hunt permit-tags, sold by mail then OTC. AZ is America/Phoenix -- see zoneFromAbbrev.' },
  { state_code: 'NM', verified: null, shape: 'unknown', sources: [], notes: 'Second draw / leftover list.' },
  { state_code: 'NV', verified: null, shape: 'unknown', sources: [], notes: 'Second draw rather than a leftover list; confirm it is the same thing before modelling it.' },
  { state_code: 'OR', verified: null, shape: 'unknown', sources: [], notes: 'Leftover tags after the controlled hunt draw.' },
  { state_code: 'WA', verified: null, shape: 'unknown', sources: [], notes: 'Second draw; smaller programme.' },
  { state_code: 'AK', verified: null, shape: 'unknown', sources: [], notes: 'Mostly OTC registration hunts rather than leftovers.' },
  { state_code: 'SD', verified: null, shape: 'unknown', sources: [], notes: 'Multiple drawing rounds then first-come leftovers; nonresidents only after the fourth drawing. Likely several rows per species.' },
  { state_code: 'ND', verified: null, shape: 'unknown', sources: [], notes: 'Leftover licence rounds.' },
  { state_code: 'NE', verified: null, shape: 'unknown', sources: [], notes: 'Remaining/leftover permits.' },
  { state_code: 'KS', verified: null, shape: 'unknown', sources: [], notes: 'Leftover deer permits.' },
  { state_code: 'OK', verified: null, shape: 'unknown', sources: [], notes: 'Controlled hunt leftovers; confirm a programme exists before adding.' },
  { state_code: 'TX', verified: null, shape: 'unknown', sources: [], notes: 'Largely OTC; the drawn public-hunt leftovers are the part that matters.' },
  { state_code: 'CA', verified: null, shape: 'unknown', sources: [], notes: 'Second drawing then leftover tags.' },
  { state_code: 'MN', verified: null, shape: 'unknown', sources: [], notes: 'Surplus antlerless licences.' },
  { state_code: 'IA', verified: null, shape: 'unknown', sources: [], notes: 'Leftover antlerless quotas by county.' },
  { state_code: 'MO', verified: null, shape: 'unknown', sources: [], notes: 'Confirm a leftover programme exists; much of MO is OTC.' },
  { state_code: 'WI', verified: null, shape: 'unknown', sources: [], notes: 'Leftover antlerless tags sold by zone on staggered days.' },
  { state_code: 'MI', verified: null, shape: 'unknown', sources: [], notes: 'Leftover antlerless licences.' },
];

/** The entries the ingest function will actually fetch. */
export function liveEntries(registry: StateEntry[] = REGISTRY): StateEntry[] {
  return registry.filter((e) => e.verified !== null && e.sources.length > 0);
}

/** States named as leads but not yet verified -- what is left to research. */
export function pendingStates(registry: StateEntry[] = REGISTRY): string[] {
  return registry.filter((e) => e.verified === null || e.sources.length === 0).map((e) => e.state_code);
}
