// PLACEHOLDER DATA — not real regulations.
//
// What is left in this file after Phase 2, and what is now real:
//
//   conditions   GONE. The Today card reads a verified USGS gauge and the NWS
//                grid at that gauge's own coordinates. See gauges.ts,
//                usgs.ts, conditions.ts and useGaugeConditions.ts. Sunrise,
//                sunset and the moon are computed on-device from the gauge's
//                latitude and longitude.
//   seasons      REAL when the species gate is open -- the published
//                fishing_rules for Georgia, read by useFishingRules. The
//                ledger below is the fallback for when it is not.
//   licence      GONE. It reads `user_licenses` for the signed-in angler and
//                their own state, via useOtwLicence. The banner is absent
//                when no expiry has been recorded, which is everyone today
//                -- the honest answer, and the reason this entry could be
//                deleted rather than merely improved. The renewal link now
//                comes from states.license_url instead of being Georgia's
//                for all 50 states.
//   plates       STILL PLACEHOLDER. "Your species" implies a follow model.
//                `user_waters` exists in the schema as of 20261209000000 but
//                nothing can add a row to it yet, so the plates stay.
//
// Nothing remaining here has been checked against Georgia DNR, and nothing
// here may be presented as though it had been: the OTW Home names whichever
// of these is still its source in the marker under the header.
//
// What IS real, because it is a fact rather than a regulation: the Latin
// names on the species plates.

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
