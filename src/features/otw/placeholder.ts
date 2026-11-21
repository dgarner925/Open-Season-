// PLACEHOLDER DATA — not real conditions or regulations.
//
// Everything On the Water shows in Phase 1 comes from this file, so there is
// exactly one thing to delete when the real sources land. Nothing here has
// been checked against Georgia DNR or against a gauge, and nothing here may
// be presented to a user as though it had been: the OTW Home renders an
// "EXAMPLE DATA" marker for as long as this module is its source.
//
// What is deliberately NOT in here:
//
//   A USGS site number. Phase 2 needs verified ones, and a plausible-looking
//   identifier sitting in placeholder data is exactly the sort of thing that
//   gets copied into real code because it looks checked. There is no site
//   number here to copy.
//
// What IS real, because it is a fact rather than a regulation: the Latin
// names on the species plates.
//
// Replaced by:
//   conditions  -> useGaugeConditions (Phase 2, USGS + NWS)
//   ledger/regs -> the fishing_rules and stockings already loaded for Georgia
//                  (Phase 3)

import type { FlowReading } from './sentences';

/** The marker the Home renders while this module is its source. */
export const PLACEHOLDER_NOTICE = 'EXAMPLE DATA';

export type PlaceholderGauge = {
  /** The gauge's own name, shown top-right of the Today card. */
  gaugeName: string;
  /** The water, as the headline says it -- carries its own article. */
  waterName: string;
  reading: FlowReading;
  waterTempF: number | null;
  sky: string;
  /** Dam release window. Static in Phase 1; USACE schedules are out of scope. */
  releaseLabel: string | null;
  /**
   * The last 24 hours of discharge, oldest first, for the sparkline. The last
   * point is "now".
   */
  history: number[];
  /** The scheduled release, drawn as the dashed tail after "now". */
  projection: number[];
};

export const PLACEHOLDER_GAUGE: PlaceholderGauge = {
  gaugeName: 'Buford Dam Tailwater',
  waterName: 'The Hooch',
  reading: { cfs: 650, wadeableMax: 1000, trend: 'steady' },
  waterTempF: 51,
  sky: 'clear',
  releaseLabel: 'Release 2:00 – 6:00 PM',
  // Flat overnight, a morning bump, back down to the current reading.
  history: [
    420, 420, 415, 418, 420, 422, 430, 520, 690, 710, 715, 712,
    700, 660, 650, 648, 650, 652, 650, 650, 648, 650, 651, 650,
  ],
  // The afternoon generation run, which has not happened yet.
  projection: [650, 900, 1450, 1480, 1460, 1200, 820],
};

export type PlaceholderAlmanac = {
  airTempF: number;
  sky: string;
  sunrise: string;
  sunset: string;
  moonPct: number;
  moonWaxing: boolean;
};

/**
 * Phase 1 only. Sunrise, sunset and the moon need no network -- src/lib/sun.ts
 * and the moon maths in useDawnConditions already compute them -- so Phase 2
 * takes these from there rather than from a feed. They are frozen here only
 * so the whole card has one source while it is being built.
 */
export const PLACEHOLDER_ALMANAC: PlaceholderAlmanac = {
  airTempF: 48,
  sky: 'P.Cloudy',
  sunrise: '7:13',
  sunset: '5:31',
  moonPct: 62,
  moonWaxing: true,
};

export type PlaceholderLicense = {
  /** Days until it expires. The banner hides itself above 60. */
  daysLeft: number;
  /** Where "Renew" goes. The states table already carries a licence URL. */
  renewUrl: string;
};

export const PLACEHOLDER_LICENSE: PlaceholderLicense = {
  daysLeft: 23,
  renewUrl: 'https://georgiawildlife.com/licenses-permits-passes',
};

export type LedgerKind = 'rule' | 'stocking' | 'season';

export type PlaceholderLedgerRow = {
  id: string;
  kind: LedgerKind;
  title: string;
  subtitle: string;
  /** Moss when the water is open, brass when it is a date. */
  status: { text: string; tone: 'open' | 'date' };
};

export const PLACEHOLDER_LEDGER: PlaceholderLedgerRow[] = [
  {
    id: 'hooch-dh',
    kind: 'rule',
    title: 'Chattahoochee · Delayed Harvest',
    subtitle: 'Catch & release · single-hook artificials',
    status: { text: 'Open', tone: 'open' },
  },
  {
    id: 'stocked',
    kind: 'stocking',
    title: 'Stocked this week',
    subtitle: 'Rainbows · Hooch DH · Smith Creek DH',
    status: { text: 'Tue 18', tone: 'date' },
  },
  {
    id: 'lanier-stripers',
    kind: 'season',
    title: 'Lake Lanier · stripers',
    subtitle: 'Year-round · 15/day, 2 over 22"',
    status: { text: 'Open', tone: 'open' },
  },
];

export type PlaceholderPlate = {
  /** The art key, so a real engraving can replace the line drawing later. */
  artKey: 'rainbow-trout' | 'striped-bass' | 'spotted-bass';
  plate: string;
  commonName: string;
  /** Real taxonomy. A fact, not a regulation. */
  latinName: string;
};

export const PLACEHOLDER_PLATES: PlaceholderPlate[] = [
  { artKey: 'rainbow-trout', plate: 'Plate I', commonName: 'Rainbow Trout', latinName: 'Oncorhynchus mykiss' },
  { artKey: 'striped-bass', plate: 'Plate II', commonName: 'Striped Bass', latinName: 'Morone saxatilis' },
  { artKey: 'spotted-bass', plate: 'Plate III', commonName: 'Spotted Bass', latinName: 'Micropterus punctulatus' },
];

/** The sub-line under the headline. Static while releases are out of scope. */
export const PLACEHOLDER_SUBLINE = 'Wade it till the 2 PM release · Buford Dam';
