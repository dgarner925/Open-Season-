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

/**
 * The clock an agency keeps, for when the page names an hour and no zone.
 *
 * Most agency pages write "10 a.m." and nothing else, because everyone they
 * are writing for is already in the state. Before this map existed that
 * produced a sale with an hour and `time_zone: null` -- which is worse than
 * no hour at all, because the app renders it as a confident time and the
 * reader supplies their own zone. Oregon's 1 July sale reached the queue that
 * way: a Georgia hunter would have read 10:00 as Eastern and been three hours
 * late for a sale that is gone inside one.
 *
 * A straddling state resolves to the AGENCY's clock, not its geographic
 * majority: the sale is an online transaction that opens on the licence
 * system's clock, wherever the hunter happens to be. Idaho is the example --
 * the panhandle is Pacific, but Fish and Game sells from Boise, so Boise's
 * clock is the one a sale opens on.
 */
const STATE_ZONE: Record<string, string> = {
  AL: 'America/Chicago', AK: 'America/Anchorage', AZ: 'America/Phoenix',
  AR: 'America/Chicago', CA: 'America/Los_Angeles', CO: 'America/Denver',
  CT: 'America/New_York', DE: 'America/New_York', FL: 'America/New_York',
  GA: 'America/New_York', HI: 'Pacific/Honolulu', ID: 'America/Boise',
  IL: 'America/Chicago', IN: 'America/Indiana/Indianapolis', IA: 'America/Chicago',
  KS: 'America/Chicago', KY: 'America/New_York', LA: 'America/Chicago',
  ME: 'America/New_York', MD: 'America/New_York', MA: 'America/New_York',
  MI: 'America/Detroit', MN: 'America/Chicago', MS: 'America/Chicago',
  MO: 'America/Chicago', MT: 'America/Denver', NE: 'America/Chicago',
  NV: 'America/Los_Angeles', NH: 'America/New_York', NJ: 'America/New_York',
  NM: 'America/Denver', NY: 'America/New_York', NC: 'America/New_York',
  ND: 'America/Chicago', OH: 'America/New_York', OK: 'America/Chicago',
  OR: 'America/Los_Angeles', PA: 'America/New_York', RI: 'America/New_York',
  SC: 'America/New_York', SD: 'America/Chicago', TN: 'America/Chicago',
  TX: 'America/Chicago', UT: 'America/Denver', VT: 'America/New_York',
  VA: 'America/New_York', WA: 'America/Los_Angeles', WV: 'America/New_York',
  WI: 'America/Chicago', WY: 'America/Denver',
};

/** The agency's own clock, with no page to read it off. */
export function zoneForState(stateCode: string | null | undefined): string | null {
  const st = (stateCode ?? '').trim().toUpperCase();
  return STATE_OVERRIDE[st] ?? STATE_ZONE[st] ?? null;
}

export function zoneFromAbbrev(abbrev: string | null | undefined, stateCode?: string | null): string | null {
  const st = (stateCode ?? '').trim().toUpperCase();
  if (st && STATE_OVERRIDE[st]) return STATE_OVERRIDE[st];
  const a = (abbrev ?? '').trim().toUpperCase().replace(/[^A-Z]/g, '');
  // An abbreviation the page states wins: an agency that bothers to write
  // "9 a.m. CT" for a Mountain state means it. Only when the page is silent
  // does the state's own clock stand in.
  return ABBREV[a] ?? zoneForState(st);
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
/**
 * The page as something to READ.
 *
 * Not the same thing as normaliseForHash, and the difference cost a day.
 * normaliseForHash deletes every time that carries a zone -- "11 am MT" --
 * because a clock in a page footer changes hourly without the content
 * changing, and hashing has to ignore it. Feeding that same text to the model
 * handed it a page with the one field this feature exists to capture already
 * deleted, and it dutifully reported no sales.
 *
 * So: hashing gets its own aggressive normaliser, reading gets this one.
 * This keeps case, keeps times, and keeps block boundaries as newlines so a
 * heading does not glue itself to the paragraph under it -- "March 3: Spring
 * turkey licenses" is a date and its subject, and they have to stay together.
 */
const BLOCK_TAGS =
  /<\/?(p|div|br|li|tr|h[1-6]|section|article|header|footer|table|ul|ol|dl|dt|dd|blockquote)\b[^>]*>/gi;

export function textForReading(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    // Block tags become newlines; inline tags become nothing, so
    // "<b>March 3</b>:" does not turn into "March 3 :".
    .replace(BLOCK_TAGS, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    // Every horizontal run of whitespace, but never a newline.
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Flattened for comparing a model's quote against the page.
 *
 * Case and whitespace only. It must NOT strip times, or a quote naming the
 * hour would fail to match the page it came from -- which is the one quote
 * worth checking hardest.
 */
export function normaliseForQuote(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * SHA-256 as hex. Always paired with normaliseForHash: hashing raw markup
 * catches a render timestamp and reports a change every single night, which
 * makes an "unchanged?" check worse than useless -- it costs a model call AND
 * claims the page moved.
 */
export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

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
export function confidenceFor(
  p: ProposedSale,
  opts: { zoneMatched?: boolean; yearInferred?: boolean } = {},
): number {
  let c = 0.95;
  // We supplied the year the page did not print. Reasonable to do; not
  // reasonable to publish without a human glancing at it.
  if (opts.yearInferred) c -= 0.2;
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

export type ResolvedDate = { date: string; yearInferred: boolean };

/**
 * Turn a month and day into a real date, supplying the year when the page did
 * not give one.
 *
 * Agency pages mostly do not give one. Colorado's leftover page says "March 3:
 * Spring turkey licenses will be available for purchase on the leftover list"
 * and "August 5" and "August 11th", and carries a year on exactly two lines,
 * both about the past. A hunter reading it in November knows perfectly well
 * that March 3 means the coming March. The extractor did not, because the
 * schema demanded YYYY-MM-DD and the prompt forbade inferring a year -- so the
 * model obeyed, returned nothing, and the correct answer had nowhere to go.
 *
 * The split that fixes it is the one the rest of this pipeline already uses:
 * the model reports what the page SAYS, and code does the arithmetic. The
 * model now returns a month and a day, and a year only when the page prints
 * one. Here we resolve the rest, deterministically, to the next occurrence on
 * or after today -- which is what a forward-looking app wants, and is a
 * calendar fact rather than a guess about the agency.
 *
 * yearInferred rides along so confidenceFor can keep an inferred sale under
 * the auto-approval threshold. Supplying a year is reasonable; publishing one
 * without a human glancing at it is not.
 */
export function resolveSaleYear(
  month: number,
  day: number,
  year: number | null | undefined,
  todayISO?: string,
): ResolvedDate | null {
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;

  const iso = (y: number) =>
    `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  // A real calendar day, not the 31st of February.
  const real = (y: number) => {
    const d = new Date(Date.UTC(y, month - 1, day));
    return d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
  };

  if (year && Number.isInteger(year) && year > 1900) {
    return real(year) ? { date: iso(year), yearInferred: false } : null;
  }

  const today = todayISO ?? new Date().toISOString().slice(0, 10);
  const thisYear = Number(today.slice(0, 4));
  for (const y of [thisYear, thisYear + 1, thisYear + 2]) {
    if (real(y) && iso(y) >= today) return { date: iso(y), yearInferred: true };
  }
  return null;
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

/**
 * Does this quote actually support the date it was cited for?
 *
 * The grounding check used to ask only whether the quote appeared on the page.
 * Oregon slipped straight through it: all four proposals cited "Leftover tags
 * for hunts with fewer applicants than there are tags will be sold on a
 * first-come, first-served basis", which is on the page, is about the
 * mechanism, and says nothing whatever about the first of July.
 *
 * A quote that does not name the date is not evidence for the date. It is a
 * citation that looks like one, which the registry already warns is worse than
 * saying nothing.
 *
 * Accepted: a month by name or abbreviation with the day beside it ("March 3",
 * "August 11th", "Jul 1"), or a numeric form ("7/1", "07-01", "2027-07-01").
 */
const MONTH_PATTERNS = [
  'jan(uary)?',
  'feb(ruary)?',
  'mar(ch)?',
  'apr(il)?',
  'may',
  'jun(e)?',
  'jul(y)?',
  'aug(ust)?',
  'sep(t|tember)?',
  'oct(ober)?',
  'nov(ember)?',
  'dec(ember)?',
];

export function quoteSupportsDate(quote: string, month: number, day: number): boolean {
  if (!quote) return false;
  if (!Number.isInteger(month) || month < 1 || month > 12) return false;
  if (!Number.isInteger(day) || day < 1 || day > 31) return false;
  const q = quote.toLowerCase();

  // "7/1", "07-01", "2027-07-01". The separator does the work, so a bare
  // "1" in a sentence about July cannot pass as a numeric date.
  const numeric = new RegExp(`(^|[^0-9])0?${month}\\s?[/.-]\\s?0?${day}([^0-9]|$)`);
  if (numeric.test(q)) return true;

  // A month by name needs its day nearby. "sold in July" is the mechanism
  // again; "July 1" is the date.
  const named = new RegExp(`\\b${MONTH_PATTERNS[month - 1]}\\b`);
  if (!named.test(q)) return false;
  const dayShown = new RegExp(`(^|[^0-9])0?${day}(st|nd|rd|th)?([^0-9]|$)`);
  return dayShown.test(q);
}
