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

/**
 * A sale date fixed by regulation rather than announced each year.
 *
 * Oregon is the case that proved this worth having: its leftover tags go on
 * sale at 10 a.m. Pacific on July 1 every year, and black bear on March 15,
 * stated as a standing rule rather than a 2026 date. A rule does not need
 * scraping -- it needs confirming once a year. That is strictly more reliable
 * than parsing a date out of prose, and it is the only mechanism here that
 * still works when an agency's page is down, paywalled or bot-blocked.
 *
 * A fixed schedule still produces a PROPOSAL, not a published row: if the
 * regulation changes and nobody notices, a human seeing the review item is
 * the thing that catches it.
 */
export type FixedSchedule = {
  month: number; // 1-12
  day: number;
  /** HH:MM:SS local, or null when the rule names a day but no hour. */
  time: string | null;
  /** IANA zone the rule is written in. */
  zone: string;
  /** species.key values this rule covers; omitted means every species the entry lists. */
  species?: string[];
  note: string;
};

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
  /** Sale dates set by regulation. Preferred over scraping when they exist. */
  fixed?: FixedSchedule[];
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

  {
    state_code: 'OR',
    verified: '2026-11-10',
    shape: 'first_come',
    species: ['mule_deer', 'elk', 'pronghorn', 'black_bear'],
    sources: [
      {
        url: 'https://myodfw.com/articles/how-check-and-earn-preference-points',
        role: 'dates',
        note:
          'An odd home for it -- the page is mostly about preference points -- but this ' +
          'is where ODFW states the leftover rule, with an hour and an explicit zone. ' +
          'If a better page is found, replace this; do not add a blog in the meantime.',
      },
    ],
    fixed: [
      {
        month: 7, day: 1, time: '10:00:00', zone: 'America/Los_Angeles',
        note: 'Big game leftover tags, online only, first come first served. Standing rule, not a 2026 date.',
      },
      {
        month: 3, day: 15, time: '10:00:00', zone: 'America/Los_Angeles',
        species: ['black_bear'],
        note: 'Spring black bear runs on its own fixed date.',
      },
    ],
    notes:
      'The best case in the registry: the date is set by rule, so it needs confirming ' +
      'once a year rather than scraping. Online only -- not at ODFW offices or vendors -- ' +
      'one tag per person per hunt series, and it must be bought by the day before the ' +
      'hunt opens, which is a second deadline worth surfacing. Sheep (500) and mountain ' +
      'goat (900) series are excluded and must never appear in a proposal.',
  },

  // -------------------------------------------------------------------------
  // LEADS, NOT SOURCES. These states are believed to run a leftover, surplus,
  // second-draw or OTC programme, but nobody has opened the page and confirmed
  // which URL survives into next season. The ingest function skips every entry
  // whose `verified` is null, so adding a state here is safe and changes
  // nothing until someone does the looking.
  // -------------------------------------------------------------------------
  { state_code: 'AZ', verified: null, shape: 'unknown', sources: [], notes: 'Leftover hunt permit-tags, sold by mail then OTC. CHECKED 2026-11-10: azgfd.com returns 403 to an automated fetch, so this state may be unscrapable without an agreement with the agency -- the fetch log will record it as blocked rather than failing silently. AZ is America/Phoenix; see zoneFromAbbrev.' },
  { state_code: 'NM', verified: null, shape: 'unknown', sources: [], notes: 'CHECKED 2026-11-10: like Wyoming, the dates live in press releases, not on a stable page. Also the hardest residency case found -- the sale is RESIDENT ONLY for its first 24 hours, then opens to everyone. That is two sale rows a day apart, not one row with two residency values, and the schema already separates them because start_date is part of the identity.' },
  { state_code: 'NV', verified: null, shape: 'unknown', sources: [], notes: 'CHECKED 2026-11-10: no official NDOW page located -- every result was a hunting blog, which is exactly what the registry test forbids. NV runs a second draw (application window) AND a separate first-come queue for what is left. Two programmes, neither sourced yet.' },
  { state_code: 'WA', verified: null, shape: 'unknown', sources: [], notes: 'Second draw; smaller programme.' },
  { state_code: 'AK', verified: null, shape: 'unknown', sources: [], notes: 'Mostly OTC registration hunts rather than leftovers.' },
  { state_code: 'SD', verified: null, shape: 'unknown', sources: [], notes: 'CHECKED 2026-11-10: no stable leftover page found; the facts live in per-season application PDFs that are replaced each year. Several drawing rounds then first-come leftovers, and nonresidents are locked out until after the fourth drawing -- so SD yields several rows per species with different residency.' },
  { state_code: 'ND', verified: null, shape: 'unknown', sources: [], notes: 'CHECKED 2026-11-10: gf.nd.gov/buy-apply/help/lottery explains the mechanism (FCFS licences after each lottery) but carries no dates, and availability sits behind a signed-in My Account page. Not scrapable as it stands.' },
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

/**
 * The sales a state's standing rules imply for a given licence year.
 *
 * Returns ISO days, not instants: the zone travels alongside so the database
 * trigger resolves the instant, exactly as it does for a scraped sale. Doing
 * the conversion here would bake today's daylight-saving offset into a date
 * months away.
 *
 * A rule is still only a proposal. If a state quietly moves its statutory
 * date, this keeps confidently producing the old one -- which is precisely
 * why these go through review_queue like everything else, and why the entry
 * should be re-confirmed each year.
 */
export function fixedSalesFor(
  entry: StateEntry,
  year: number,
): { date: string; time: string | null; zone: string; species: string[]; note: string }[] {
  if (!entry.fixed?.length) return [];
  return entry.fixed.map((f) => ({
    date: `${year}-${String(f.month).padStart(2, '0')}-${String(f.day).padStart(2, '0')}`,
    time: f.time,
    zone: f.zone,
    species: f.species ?? entry.species ?? [],
    note: f.note,
  }));
}

/** States whose dates are known from regulation rather than scraped. */
export function ruleDrivenStates(registry: StateEntry[] = REGISTRY): string[] {
  return registry.filter((e) => (e.fixed?.length ?? 0) > 0).map((e) => e.state_code);
}
