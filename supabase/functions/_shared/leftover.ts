/**
 * Leftover and over-the-counter tag sales: the parts worth testing.
 *
 * Everything here is pure. The edge function does the fetching, the model call
 * and the database writes; this file holds the decisions that can be wrong in
 * ways nobody notices for a season -- which time zone an agency meant by "MT",
 * whether a page actually changed, and whether a proposal is worth putting in
 * front of a human.
 *
 * Nothing here imports Deno, so the vitest suite can reach all of it.
 */

export type SaleType = 'leftover' | 'otc' | 'reissue';
export type Residency = 'resident' | 'nonresident';

export type ProposedSale = {
  state_code: string;
  species_key: string;
  zone_code?: string | null;
  season_year: number;
  sale_type: SaleType;
  name: string;
  sale_start_date: string; // ISO yyyy-mm-dd
  sale_start_time?: string | null; // HH:MM:SS local, or null when unpublished
  sale_end_date?: string | null;
  sale_end_time?: string | null;
  time_zone?: string | null;
  residency?: Residency[];
  purchase_url?: string | null;
  notes?: string | null;
};

// ---------------------------------------------------------------------------
// Time zones
// ---------------------------------------------------------------------------

/**
 * What an agency means by "9:00 a.m. MT".
 *
 * Abbreviations are ambiguous on their own, so the state decides. Two traps
 * this exists to avoid:
 *
 *  - Arizona writes MST and means America/Phoenix, which does not observe
 *    daylight saving. Mapping it to America/Denver puts every Arizona sale an
 *    hour early for two thirds of the year.
 *  - The daylight/standard pair (MDT vs MST) is not a different zone, it is the
 *    same zone in a different season. Mapping both to the IANA zone and letting
 *    Postgres work out the offset for that date is the only thing that stays
 *    right across the switch -- which matters here, because leftover sales
 *    cluster in late summer and autumn, either side of it.
 */
const ABBREV: Record<string, string> = {
  ET: 'America/New_York', EST: 'America/New_York', EDT: 'America/New_York',
  CT: 'America/Chicago', CST: 'America/Chicago', CDT: 'America/Chicago',
  MT: 'America/Denver', MST: 'America/Denver', MDT: 'America/Denver',
  PT: 'America/Los_Angeles', PST: 'America/Los_Angeles', PDT: 'America/Los_Angeles',
  AKT: 'America/Anchorage', AKST: 'America/Anchorage', AKDT: 'America/Anchorage',
  HT: 'Pacific/Honolulu', HST: 'Pacific/Honolulu', HAST: 'Pacific/Honolulu',
};

/** States whose own clock overrides whatever abbreviation the page used. */
const STATE_OVERRIDE: Record<string, string> = {
  AZ: 'America/Phoenix', // no daylight saving, despite writing "MST"
  HI: 'Pacific/Honolulu',
  AK: 'America/Anchorage',
};

export function zoneFromAbbrev(abbrev: string | null | undefined, stateCode?: string | null): string | null {
  const st = (stateCode ?? '').trim().toUpperCase();
  if (st && STATE_OVERRIDE[st]) return STATE_OVERRIDE[st];
  const a = (abbrev ?? '').trim().toUpperCase().replace(/[^A-Z]/g, '');
  return ABBREV[a] ?? null;
}

// ---------------------------------------------------------------------------
// Times
// ---------------------------------------------------------------------------

/**
 * "9:00 a.m. MT" -> { time: '09:00:00', zone: 'America/Denver' }
 * "Tuesday"      -> { time: null,       zone: null }
 *
 * A null time is a real answer and the common one: most agency pages name a
 * day and no hour. It must stay null rather than becoming midnight, because
 * the app renders a date alone differently from a date and a time, and a
 * guessed midnight would read as the previous evening to anyone east of the
 * agency.
 */
export function parseSaleTime(
  raw: string | null | undefined,
  stateCode?: string | null,
): { time: string | null; zone: string | null } {
  const s = (raw ?? '').trim();
  if (!s) return { time: null, zone: null };

  // 9 am | 9:00am | 9:00 a.m. | 09:00 | 9.00 am
  const m = s.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*([ap])\.?\s*m\.?\b/i)
    ?? s.match(/\b(\d{1,2}):(\d{2})\b/);
  let time: string | null = null;
  if (m) {
    let h = Number(m[1]);
    const min = Number(m[2] ?? '0');
    const ap = (m[3] ?? '').toLowerCase();
    if (ap === 'p' && h < 12) h += 12;
    if (ap === 'a' && h === 12) h = 0;
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) {
      time = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
    }
  }

  // "noon" and "midnight" are written out often enough to be worth reading.
  if (!time && /\bnoon\b/i.test(s)) time = '12:00:00';
  if (!time && /\bmidnight\b/i.test(s)) time = '00:00:00';

  const zm = s.match(/\b(A[KH]|[EMCPH])[SD]?T\b/i);
  const zone = zoneFromAbbrev(zm ? zm[0] : null, stateCode);
  return { time, zone };
}

// ---------------------------------------------------------------------------
// Residency
// ---------------------------------------------------------------------------

/**
 * Who may buy. The default is both, because a sale that says nothing about
 * residency is open to everyone -- and because the failure modes are not
 * symmetric: telling a nonresident about a resident-only sale wastes a click,
 * while hiding an open sale from them loses them the tag.
 */
export function parseResidency(raw: string | null | undefined): Residency[] {
  const s = (raw ?? '').toLowerCase();
  if (!s.trim()) return ['resident', 'nonresident'];
  const nonres = /\bnon-?residents?\b/.test(s);
  // "resident" matches inside "nonresident", so only count it where it is not
  // part of that word.
  const res = /(^|[^-\w])residents?\b/.test(s.replace(/non-?residents?/g, ' '));
  if (res && !nonres) return ['resident'];
  if (nonres && !res) return ['nonresident'];
  return ['resident', 'nonresident'];
}

// ---------------------------------------------------------------------------
// Change detection
// ---------------------------------------------------------------------------

/**
 * Reduce a fetched page to the part whose change should mean something.
 *
 * Agency pages carry a render timestamp, a CSRF token, a session id or a
 * rotating banner, any of which makes a byte-for-byte hash differ on every
 * fetch -- which would mean re-extracting all fifty states every night and
 * paying for a model call each time to learn nothing.
 */
export function normaliseForHash(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    // Volatile bits that change without the content changing.
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, ' ')
    .replace(/\b\d{1,2}:\d{2}(:\d{2})?\s*(a\.?m\.?|p\.?m\.?)?\s*(ET|CT|MT|PT|EST|EDT|CST|CDT|MST|MDT|PST|PDT|UTC|GMT)\b/gi, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Fields whose change is worth a human's attention. */
const WATCHED: (keyof ProposedSale)[] = [
  'sale_start_date',
  'sale_start_time',
  'sale_end_date',
  'sale_end_time',
  'time_zone',
  'purchase_url',
  'name',
];

export type CurrentSale = Partial<Record<keyof ProposedSale, unknown>>;

/**
 * What changed between what we published and what the page now says.
 *
 * An empty list means no review item: an agency page that still says the same
 * thing should not put a card in front of a human just because it was fetched
 * again.
 *
 * A proposal that has gone SILENT on a field is not a change. Agency pages
 * drop the hour from a sale all the time once it is close, and treating that
 * as "the time is now unknown" would erase a verified 9 a.m. and leave hunters
 * with a bare date.
 */
export function diffSale(current: CurrentSale, proposed: ProposedSale): string[] {
  const changed: string[] = [];
  for (const k of WATCHED) {
    const next = proposed[k];
    if (next === undefined || next === null || next === '') continue;
    const now = current[k];
    const a = now === null || now === undefined ? '' : String(now);
    const b = String(next);
    if (a !== b) changed.push(k);
  }
  return changed;
}

/**
 * How much to trust a proposal, on the same 0..1 scale approve_clean_reviews
 * sweeps at 0.85.
 *
 * Deliberately pessimistic about the two things that bite: a sale whose hour
 * we could not read, and a sale we could not tie to a known zone. Both stay
 * under the sweep threshold so a human sees them.
 */
export function confidenceFor(p: ProposedSale, opts: { zoneMatched?: boolean } = {}): number {
  let c = 0.95;
  if (!p.sale_start_time) c -= 0.1; // a date with no hour is still useful, just vaguer
  if (p.zone_code && !opts.zoneMatched) c -= 0.25; // named a unit we do not know
  if (!p.purchase_url) c -= 0.05;
  if (!p.sale_end_date) c -= 0.02;
  if (p.sale_type === 'reissue') c -= 0.05; // rarest and least consistently worded
  return Math.max(0, Math.min(1, Number(c.toFixed(2))));
}

/**
 * The identity a proposal dedupes on, matching the unique index on
 * leftover_tag_sales. Kept here so the function and the schema cannot drift
 * apart silently.
 */
export function saleIdentity(p: ProposedSale): string {
  return [
    p.state_code.toUpperCase(),
    p.species_key,
    p.zone_code ?? '-',
    p.sale_type,
    p.season_year,
    p.sale_start_date,
  ].join('|');
}

/**
 * The season year a sale belongs to, given the day it opens.
 *
 * A sale in January is selling tags for the licence year that began the
 * previous autumn, so calendar year alone would file it under the wrong
 * season and hide it from a hunter looking at this year's hunts.
 */
export function seasonYearFor(saleStartISO: string): number {
  const [y, m] = saleStartISO.split('-').map(Number);
  if (!y || !m) return new Date().getFullYear();
  return m <= 3 ? y - 1 : y;
}

// ---------------------------------------------------------------------------
// robots.txt
// ---------------------------------------------------------------------------

/**
 * Whether robots.txt permits fetching a path.
 *
 * Deliberately strict in our disfavour. A state agency's site is public
 * infrastructure and we are a guest on it: where the file is ambiguous or
 * unparseable this answers "no" and the state goes to the manual path, which
 * costs ten minutes a year. Guessing "yes" costs the agency's goodwill.
 *
 * Implements the parts of the standard that actually appear on agency sites:
 * the most specific matching user-agent group wins, the longest matching rule
 * within it wins, Allow beats Disallow at equal length, and an empty Disallow
 * means allow everything.
 */
export function isAllowedByRobots(
  robotsTxt: string,
  path: string,
  userAgent: string,
): boolean {
  if (!robotsTxt.trim()) return true; // no file, or empty: nothing forbidden

  const ua = userAgent.toLowerCase();
  type Group = { agents: string[]; rules: { allow: boolean; path: string }[] };
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;

  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.split('#')[0].trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === 'user-agent') {
      // Consecutive User-agent lines share one group.
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (field === 'allow' || field === 'disallow') {
      current.rules.push({ allow: field === 'allow', path: value });
    }
  }

  // Most specific matching group: an exact-ish agent match beats the wildcard.
  const named = groups.filter((g) => g.agents.some((a) => a !== '*' && ua.includes(a)));
  const wild = groups.filter((g) => g.agents.includes('*'));
  const applicable = named.length ? named : wild;
  if (!applicable.length) return true;

  const rules = applicable.flatMap((g) => g.rules);
  // "Disallow:" with an empty value means allow everything; it matches nothing.
  let best: { allow: boolean; len: number } | null = null;
  for (const r of rules) {
    if (r.path === '') {
      if (!r.allow && !best) best = { allow: true, len: 0 };
      continue;
    }
    if (!matchesRobotsPattern(path, r.path)) continue;
    const len = r.path.length;
    if (!best || len > best.len || (len === best.len && r.allow)) {
      best = { allow: r.allow, len };
    }
  }
  return best ? best.allow : true;
}

/** robots.txt path matching: prefix, with * and $ as the standard allows. */
function matchesRobotsPattern(path: string, pattern: string): boolean {
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const escaped = body.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  const re = new RegExp(`^${escaped}${anchored ? '$' : ''}`);
  return re.test(path);
}

/** How this project identifies itself to an agency's server. */
export const USER_AGENT =
  'OpenSeasonBot/1.0 (+https://osdatesanddraws.com/bot; hunting season dates for hunters)';
