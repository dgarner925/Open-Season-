/**
 * The gauges On the Water can read, and what counts as wadeable on each.
 *
 * ---------------------------------------------------------------------------
 * TWO KINDS OF NUMBER LIVE IN THIS FILE, AND THEY ARE NOT EQUALLY TRUE
 *
 * `siteNo`, `name`, `lat`, `lng`, `reportsWaterTemp`
 *   VERIFIED. Every one was read back from the USGS site and instantaneous
 *   values services on 2026-11-21 -- not copied from a document, not
 *   remembered. `reportsWaterTemp` records whether that gauge actually
 *   returned parameter 00010, because four of these eight do not and the card
 *   must not print "water -°F" as though it were a reading.
 *
 * `wadeableMax`
 *   EDITORIAL AND UNVERIFIED. A flow below which that gauge is *usually*
 *   wadeable, which is a fishing opinion and not a safety ruling. Nobody has
 *   checked these against Georgia DNR, the Corps, or a person standing in the
 *   river. They are the input to the word "fishable", so they are the most
 *   consequential guesses in the feature.
 *
 *   `null` is a legitimate and preferred value. conditionSentence() and
 *   flowStatus() both treat a null threshold as "no verdict available" and
 *   report the bare flow instead -- see sentences.ts, which tests that. A
 *   gauge with no defensible threshold gets null rather than a plausible
 *   number, because a plausible number is indistinguishable from a checked
 *   one once it is on screen.
 *
 * WHAT IS DELIBERATELY ABSENT
 *
 *   The Toccoa River delayed-harvest water. Its DH stretch is the tailwater
 *   below Blue Ridge Dam, and there is no USGS gauge on it: 03558000 sits
 *   ABOVE Blue Ridge Lake and 03559500 is the Ocoee at Copperhill, well
 *   downstream in Tennessee. Either one would be a number from the wrong
 *   river presented as that river's flow, so the water gets no gauge at all.
 *
 *   Smith Creek below Unicoi Dam, for the same reason -- no gauge exists.
 *
 * `servesWaters` holds `waters.slug` values from the published Georgia set so
 * a gauge can later be offered on the water's own screen. It is not a claim
 * that the gauge sits inside the regulated stretch; `note` says where it
 * actually is.
 *
 * Every slug below was read back from the published `waters` rows on
 * 2026-11-21. The first draft of this file guessed one from memory --
 * "chattahoochee-river-buford-dam-tailwater" -- and the real slug has no
 * "dam" in it, so the mapping pointed at a row that does not exist. Nothing
 * consumed it yet, which is the only reason it cost nothing.
 *
 * Deliberately empty where the right gauge is a judgement call rather than a
 * fact: the Chattahoochee delayed-harvest reach runs from Sope Creek to US
 * 41, with Morgan Falls (02335815) immediately above it and Atlanta
 * (02336000) at its downstream end. Either is defensible and neither is
 * correct, so the stretch gets no gauge until David picks one.
 *
 * ---------------------------------------------------------------------------
 * THE MAPPING NOW ALSO EXISTS IN THE DATABASE, AND THE TWO ARE NOT IN SYNC
 *
 * Migration 20261209000000 was applied on 2026-11-21. It added
 * `waters.usgs_site_no` and `waters.wadeable_cfs_max` and backfilled two
 * rows: buford-tailwater -> 02334430 / 1000.0, and
 * buford-dam-to-peachtree-creek -> 02335000 / null.
 *
 * So `servesWaters` and `wadeableMax` are duplicated in production for those
 * two waters, and this file is still the only place the other six gauges
 * exist at all. Nothing reads the columns yet.
 *
 * That is deliberate, not an oversight. Switching the picker to read the
 * database today would cut it from eight gauges to two, because the columns
 * hold only the mappings that are facts -- a water can have a gauge nearby
 * without that gauge being the right one for its regulated stretch, and this
 * file carries six such gauges with `wadeableMax: null` precisely so they can
 * be offered without a verdict attached.
 *
 * The ordering when it is time to reconcile: the DATABASE wins on the
 * water -> gauge mapping, because the column has a foreign key and this file
 * has a string that was already wrong once (see the slug above). This file
 * keeps the gauge catalogue -- site numbers, coordinates, reportsWaterTemp,
 * note -- until there is a gauges table to hold it, which the migration
 * deliberately did not create.
 */

/** A USGS instantaneous-values gauge the picker can offer. */
export type Gauge = {
  /** USGS site number. Verified against the site service. */
  siteNo: string;
  /** Short label for the card's top-right corner. */
  name: string;
  /** The water as the headline says it -- carries its own article. */
  waterName: string;
  lat: number;
  lng: number;
  /** Whether this gauge returned parameter 00010 when asked. */
  reportsWaterTemp: boolean;
  /** EDITORIAL. See the header. Null means "no verdict", not "zero". */
  wadeableMax: number | null;
  /** Where the gauge physically is, in plain words. Shown in the picker. */
  note: string;
  /** `waters.slug` values this gauge is the nearest reading for. */
  servesWaters: string[];
};

/**
 * Ordered as the picker shows them: the tailwater most people mean first,
 * then down the Chattahoochee, then the Lanier tributaries.
 */
export const GAUGES: Gauge[] = [
  {
    siteNo: '02334430',
    name: 'Buford Dam Tailwater',
    waterName: 'The Hooch',
    lat: 34.156667,
    lng: -84.078417,
    reportsWaterTemp: true,
    // The brief's own placeholder used 1000 for this gauge. Kept so the
    // number did not silently change meaning when the data became real.
    wadeableMax: 1000,
    note: 'Chattahoochee River at Buford Dam, below Lake Lanier',
    // Was 'chattahoochee-river-buford-tailwater', which no longer exists:
    // migration 20261210000000 merged it into the row below, because the two
    // were the same reach entered twice. This is the surviving slug, and this
    // gauge is the one the reach keeps -- on a tailwater the dam release is
    // what decides whether you can wade it.
    servesWaters: ['chattahoochee-river-buford-dam-to-peachtree-creek'],
  },
  {
    siteNo: '02335000',
    name: 'Hooch near Norcross',
    waterName: 'The Hooch',
    lat: 33.9972222,
    lng: -84.2019444,
    reportsWaterTemp: true,
    wadeableMax: null,
    note: 'Chattahoochee River near Norcross, inside the Buford Dam reach',
    // Deliberately serves no water now. Norcross sits INSIDE the Buford Dam
    // to Peachtree Creek reach -- the same reach 02334430 serves -- so this
    // gauge and that one were never two reaches, which is what the duplicate
    // water rows made it look like. It stays in the picker as a second
    // reading on the same water (someone fishing down by Norcross may want
    // it), but it is not the reach's canonical gauge: it is intermittent and
    // returned nothing on one of two probes on 2026-11-21.
    servesWaters: [],
  },
  {
    siteNo: '02335815',
    name: 'Below Morgan Falls',
    waterName: 'The Hooch',
    lat: 33.96775,
    lng: -84.3836667,
    reportsWaterTemp: false,
    wadeableMax: null,
    note: 'Chattahoochee River below Morgan Falls Dam, above the DH reach',
    servesWaters: [],
  },
  {
    siteNo: '02336000',
    name: 'Hooch at Atlanta',
    waterName: 'The Hooch',
    lat: 33.85916667,
    lng: -84.4544444,
    reportsWaterTemp: true,
    wadeableMax: null,
    note: 'Chattahoochee River at Atlanta, at the downstream end of the delayed-harvest reach',
    servesWaters: [],
  },
  {
    siteNo: '02330450',
    name: 'Hooch at Helen',
    waterName: 'The upper Hooch',
    lat: 34.7009722,
    lng: -83.72925,
    reportsWaterTemp: true,
    wadeableMax: null,
    note: 'Chattahoochee River at Helen, in the headwaters',
    servesWaters: [],
  },
  {
    siteNo: '02333500',
    name: 'Chestatee near Dahlonega',
    waterName: 'The Chestatee',
    lat: 34.52827778,
    lng: -83.9402222,
    reportsWaterTemp: false,
    wadeableMax: null,
    note: 'Chestatee River near Dahlonega, a Lake Lanier tributary',
    servesWaters: [],
  },
  {
    siteNo: '02331600',
    name: 'Hooch near Cornelia',
    waterName: 'The upper Hooch',
    lat: 34.5407222,
    lng: -83.622775,
    reportsWaterTemp: false,
    wadeableMax: null,
    note: 'Chattahoochee River near Cornelia, above Lake Lanier',
    servesWaters: [],
  },
  {
    siteNo: '03558000',
    name: 'Toccoa near Dial',
    waterName: 'The Toccoa',
    lat: 34.79,
    lng: -84.24,
    reportsWaterTemp: false,
    wadeableMax: null,
    // Said out loud because the obvious assumption is wrong and expensive.
    note: 'Toccoa River near Dial — ABOVE Blue Ridge Lake, not the delayed-harvest tailwater',
    servesWaters: [],
  },
];

/** The gauge shown before anyone picks one. */
export const DEFAULT_SITE_NO = '02334430';

export function gaugeFor(siteNo: string | null | undefined): Gauge | null {
  if (!siteNo) return null;
  return GAUGES.find((g) => g.siteNo === siteNo) ?? null;
}

/** The default, which is guaranteed to be in GAUGES. */
export function defaultGauge(): Gauge {
  const g = gaugeFor(DEFAULT_SITE_NO);
  if (!g) throw new Error(`DEFAULT_SITE_NO ${DEFAULT_SITE_NO} is not in GAUGES`);
  return g;
}
