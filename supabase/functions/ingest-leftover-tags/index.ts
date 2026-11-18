// ingest-leftover-tags — leftover and over-the-counter tag sales.
//
// Reads the agency pages in registry.ts, proposes what it finds into
// review_queue, and logs every fetch to source_fetch_log. It publishes
// nothing: apply_review_item does that, once a human has looked.
//
// Three things it deliberately will not do:
//
//   1. Fetch a page nobody has verified. An entry with verified:null is a
//      lead, not a source.
//   2. Fetch a page robots.txt forbids. Where the file is ambiguous the
//      answer is no, and the state goes to the manual path.
//   3. Re-extract a page that has not changed. The content hash is the whole
//      economy of this function: fifty states fetched nightly is fine, fifty
//      model calls nightly to learn nothing is not.
//
// States whose dates come from regulation (Oregon so far) are proposed
// WITHOUT a fetch, from the rule itself, which keeps working when the agency
// site is down, redesigned, or blocking us.
//
// Deploy:  supabase functions deploy ingest-leftover-tags
// Secrets: ANTHROPIC_API_KEY (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY injected)
// Invoke:
//   POST {}                  -> every live entry
//   POST { state: "CO" }     -> one state
//   POST { dry: true }       -> fetch, extract, write NOTHING but the fetch log
//   POST { force: true }     -> ignore the hash and re-extract
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  confidenceFor,
  diffSale,
  isAllowedByRobots,
  normaliseForHash,
  normaliseForQuote,
  parseResidency,
  quoteSupportsDate,
  resolveSaleYear,
  saleIdentity,
  parseSaleTime,
  seasonYearFor,
  textForReading,
  USER_AGENT,
  type ProposedSale,
} from '../_shared/leftover.ts';
import { REGISTRY, dueFixedSales, liveEntries, type StateEntry } from './registry.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MODEL = Deno.env.get('EXTRACT_MODEL') ?? 'claude-sonnet-5-5';
const SECRET_KEYS_RAW = Deno.env.get('SUPABASE_SECRET_KEYS') ?? '';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

/** A page bigger than this is a document dump, not a sale page. */
const MAX_BYTES = 2_000_000;
/** Per-request ceiling. extract-source has hit the 150s wall on big PDFs. */
const FETCH_TIMEOUT_MS = 20_000;
/** One request at a time, with a pause. We are a guest on these servers. */
const POLITE_PAUSE_MS = 1_500;

// Same guard as extract-source and coverage-watch: this spends money and the
// app's publishable key ships in every build. See extract-source for why each
// branch exists.
function isServiceRole(token: string): boolean {
  if (!token) return false;
  if (SERVICE_ROLE && token === SERVICE_ROLE) return true;
  if (token.startsWith('sb_secret_') && SECRET_KEYS_RAW.includes(token)) return true;
  try {
    const part = token.split('.')[1];
    if (!part) return false;
    const payload = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
    return payload?.role === 'service_role';
  } catch {
    return false;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// robots.txt, once per host
// ---------------------------------------------------------------------------

const robotsCache = new Map<string, string>();

async function robotsFor(origin: string): Promise<string> {
  const hit = robotsCache.get(origin);
  if (hit !== undefined) return hit;
  let txt = '';
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });
    // 404 means no file, which means nothing is forbidden. A 5xx is the
    // server having a bad day and is NOT consent, so it reads as a blanket
    // disallow and the state waits for the next run.
    if (res.ok) txt = await res.text();
    else if (res.status >= 500) txt = 'User-agent: *\nDisallow: /';
  } catch {
    txt = 'User-agent: *\nDisallow: /'; // could not ask, so do not assume yes
  }
  robotsCache.set(origin, txt);
  return txt;
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

const SYSTEM = `You read a US state wildlife agency page and report the leftover,
over-the-counter and reissued hunting tag SALES it announces.

Rules that matter more than completeness:

- Report only what the page states. Never infer a date from a previous year,
  from a pattern, or from what is usual for that state.
- If the page gives a day but no hour, return null for the time. Do NOT
  return midnight, 00:00, or a guess. A missing hour is a correct answer and
  the common one.
- Report the month and day the page gives. Report the year ONLY if the page
  prints one for that sale; otherwise return null for the year. A page that
  says "March 3" without a year is normal, and null is the right answer --
  the calendar arithmetic is done afterwards, not by you. Never borrow a year
  from a different sentence on the page.
- If two parts of the page give DIFFERENT dates for the same sale, report the
  sale once, use the date that appears closest to the heading naming that
  sale, and say so in "conflict". Conflicting pages are common and your note
  is what stops a wrong date being published.
- A sale that is an APPLICATION WINDOW (apply between two dates, drawn after)
  is not a first-come sale. Set shape accordingly.
- Residency: say which hunters may buy, only if the page says.
- Ignore anything that is not a tag sale: season dates, bag limits, fees,
  regulations, news unrelated to leftovers.

Return JSON only, matching the schema given. An empty array is a perfectly
good answer when the page announces no sale.`;

type Extracted = {
  /** The model's raw reply, so a parse failure never looks like an empty page. */
  raw?: string;
  parsed?: boolean;
  /** Which block types came back, and why the model stopped. */
  blocks?: string;
  stop?: string | null;
  sales: {
    // One sale usually covers several species: CPW's August list is "bear,
    // deer, elk, and pronghorn" in one sentence. Letting the model say that
    // once, instead of repeating a near-identical object per species, is what
    // keeps the reply inside its token budget -- and it matches the page.
    species: string | string[];
    unit_code?: string | null;
    sale_type: 'leftover' | 'otc' | 'reissue';
    name: string;
    shape?: 'first_come' | 'application_window' | 'recurring';
    // Month and day, with the year ONLY when the page prints one. Agency
    // pages mostly do not: Colorado says "March 3" and "August 5" and carries
    // a year on two lines, both about the past. Demanding YYYY-MM-DD here is
    // what made a correct answer impossible to express. resolveSaleYear does
    // the calendar arithmetic instead.
    start_month: number;
    start_day: number;
    start_year?: number | null;
    start_time_text?: string | null;
    end_month?: number | null;
    end_day?: number | null;
    end_year?: number | null;
    residency_text?: string | null;
    purchase_url?: string | null;
    conflict?: string | null;
    quote: string;
  }[];
};

async function extract(text: string, entry: StateEntry, speciesKeys: string[]): Promise<Extracted> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content:
            `State: ${entry.state_code}\n` +
            `Species keys you may use: ${speciesKeys.join(', ')}\n` +
            `Known shape of this state's programme: ${entry.shape}\n\n` +
            `Today is ${new Date().toISOString().slice(0, 10)}.\n\n` +
            `Return JSON: {"sales":[{"species","unit_code","sale_type","name","shape",` +
            `  (species is an ARRAY of keys: one sale that covers bear, deer and elk is ONE ` +
            `entry with three keys, not three entries. Be brief; do not repeat a sale.)
` +
            `"start_month":M,"start_day":D,"start_year":YYYY or null,"start_time_text",` +
            `"end_month","end_day","end_year","residency_text",` +
            `"purchase_url","conflict","quote"}]}\n` +
            `Give start_year ONLY if the page prints a year for that sale. Most pages ` +
            `do not, and null is the correct answer then -- we work the year out from ` +
            `the calendar. Never carry a year over from a different sentence.\n` +
            `"quote" must be the sentence from the page that states the date, copied exactly. ` +
            `A sale without a supporting quote will be discarded.\n\n` +
            `PAGE:\n${text.slice(0, 120_000)}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = await res.json();
  // FIND the text block; never assume it is content[0]. A reply can lead with
  // a non-text block, and reading content[0].text then yields undefined --
  // which this code turned into '' and reported as "the page announces no
  // sale". extract-source has always done it this way; I did not copy it.
  const raw = (body?.content ?? [])
    .filter((b: any) => b?.type === 'text' && typeof b.text === 'string')
    .map((b: any) => b.text)
    .join('\n');
  const blockTypes = (body?.content ?? []).map((b: any) => b?.type).join(',');
  const stopReason = body?.stop_reason ?? null;
  const match = raw.match(/\{[\s\S]*\}/);
  const parsed = match ? tryParse(match[0]) : null;
  if (parsed) {
    return {
      sales: Array.isArray(parsed?.sales) ? parsed.sales : [],
      raw,
      parsed: true,
      blocks: blockTypes,
      stop: stopReason,
    };
  }
  // The third time this feature dressed a failure up as a finding. A reply
  // that did not parse -- truncated at max_tokens, or not JSON at all -- is
  // NOT a page with no sale on it. Say so, loudly, and let the caller log an
  // error instead of reporting zero proposals about a page full of dates.
  throw new Error(
    stopReason === 'max_tokens'
      ? `model reply truncated at max_tokens (blocks: ${blockTypes})`
      : `model reply did not parse (stop: ${stopReason}, blocks: ${blockTypes}): ${raw.slice(0, 200)}`,
  );
}

function tryParse(s: string): any | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Queueing a proposal
// ---------------------------------------------------------------------------

type Proposal = { payload: ProposedSale; confidence: number; evidence: unknown };

type QueueCtx = {
  stateId: string;
  speciesByKey: Record<string, string>;
  zonesByCode: Record<string, string>;
  runId: string;
  /**
   * Identities already waiting for a human, so a second run does not ask the
   * same question twice. Oregon makes this necessary rather than tidy: its
   * July sale is proposed both by its regulation and by the page that
   * restates it, and the rule is proposed on every run whether or not any
   * page changed.
   */
  pending: Set<string>;
  /** The page a proposal came from, or null when a regulation is the source. */
  sourceUrl: string | null;
};

/**
 * Both paths -- a page the model read, and a date set by regulation -- end
 * here, because the decisions are the same either way: is this already
 * published and unchanged, is it already queued, and did the insert work.
 */
async function queueProposals(
  proposals: Proposal[],
  ctx: QueueCtx,
): Promise<{ queued: number; skipped: string[] }> {
  let queued = 0;
  const skipped: string[] = [];

  for (const p of proposals) {
    // An hour with no zone is worse than no hour at all. The app renders a
    // bare time as a time, and the reader supplies their own zone -- so a
    // Georgia hunter reads Oregon's 10:00 as Eastern and arrives three hours
    // after the good units are gone. zoneFromAbbrev now falls back to the
    // agency's own clock, so reaching here means the state is missing from
    // that map: fail loudly rather than publish a number nobody can act on.
    if (p.payload.sale_start_time && !p.payload.time_zone) {
      skipped.push(
        `${p.payload.species_key} ${p.payload.sale_start_date}: ` +
          `has an hour (${p.payload.sale_start_time}) and no time zone -- ` +
          `add ${p.payload.state_code} to STATE_ZONE in _shared/leftover.ts`,
      );
      continue;
    }

    const identity = saleIdentity(p.payload);
    if (ctx.pending.has(identity)) {
      skipped.push(`${p.payload.species_key} ${p.payload.sale_start_date}: already waiting in the queue`);
      continue;
    }

    const { data: current, error: currentErr } = await admin
      .from('leftover_tag_sales')
      .select('id, name, sale_start_date, sale_start_time, sale_end_date, sale_end_time, time_zone, purchase_url')
      .eq('state_id', ctx.stateId)
      .eq('species_id', ctx.speciesByKey[p.payload.species_key])
      .eq('sale_type', p.payload.sale_type)
      .eq('season_year', p.payload.season_year)
      .limit(1);
    // A failed lookup is not "nothing is published yet". Read before writing,
    // or a dropped connection silently reproposes a row that already exists.
    if (currentErr) {
      skipped.push(`${p.payload.species_key} ${p.payload.sale_start_date}: could not read what is published -- ${currentErr.message}`);
      continue;
    }
    const existing = current?.[0] ?? null;
    const changed = diffSale(existing ?? {}, p.payload);
    if (existing && changed.length === 0) continue;

    const ins = await admin.from('review_queue').insert({
      target_table: 'leftover_tag_sales',
      target_id: existing?.id ?? null,
      change_type: existing ? 'update' : 'create',
      proposed_payload: {
        ...p.payload,
        state_id: ctx.stateId,
        species_id: ctx.speciesByKey[p.payload.species_key],
        zone_id: p.payload.zone_code ? ctx.zonesByCode[p.payload.zone_code] ?? null : null,
        source_url: ctx.sourceUrl,
      },
      current_snapshot: existing,
      diff: { changed },
      confidence: p.confidence,
      evidence: p.evidence,
      extraction_run_id: ctx.runId,
    });
    // The fourth swallowed failure in this feature, and the most embarrassing:
    // the run reported nine rows queued and the queue held none. review_queue
    // has a CHECK on target_table, the migration taught apply_review_item
    // about leftover_tag_sales but never opened that gate, and an unchecked
    // insert counted every rejection as a success. Never count a write you
    // have not looked at.
    if (ins.error) {
      skipped.push(`${p.payload.species_key} ${p.payload.sale_start_date}: queue rejected it -- ${ins.error.message}`);
      continue;
    }
    ctx.pending.add(identity);
    queued += 1;
  }

  return { queued, skipped };
}

/**
 * Sales a regulation fixes, for the next time each one comes round.
 *
 * This used to be four lines that computed the dates, reported them, and
 * queued nothing -- under a comment claiming they were "proposed even when
 * the agency's site is unreachable". The README calls a rule strictly better
 * than scraping, and it is; it just was not implemented.
 *
 * Confidence is capped below the auto-approval sweep on purpose. The registry
 * says it plainly: a rule keeps confidently producing last year's date if a
 * state quietly moves it, and the human looking at the review card is the
 * only thing that catches that.
 */
function ruleProposals(
  entry: StateEntry,
  today: string,
  speciesByKey: Record<string, string>,
  runId: string,
): { proposals: Proposal[]; unknown: string[]; dates: string[] } {
  // The next time each rule comes round. The arithmetic lives in the registry,
  // where it is tested: asking for year + 1, as this did, skips a March sale
  // all the way through January and February of the year it falls in -- the
  // one stretch where a hunter most wants the warning.
  const due = dueFixedSales(entry, today);

  const proposals: Proposal[] = [];
  const unknown: string[] = [];
  for (const f of due) {
    for (const key of f.species) {
      if (!speciesByKey[key]) {
        unknown.push(`${entry.state_code} rule ${f.date}: unknown species "${key}"`);
        continue;
      }
      const payload: ProposedSale = {
        state_code: entry.state_code,
        species_key: key,
        zone_code: null,
        season_year: seasonYearFor(f.date),
        sale_type: 'leftover',
        name: f.name,
        sale_start_date: f.date,
        sale_start_time: f.time,
        sale_end_date: null,
        time_zone: f.zone,
        residency: parseResidency(null),
        purchase_url: null,
        notes: f.note,
      };
      proposals.push({
        payload,
        confidence: Math.min(
          confidenceFor(payload, { zoneMatched: true, yearInferred: false }),
          0.8,
        ),
        evidence: {
          source: 'regulation',
          rule: f.note,
          state_notes: entry.notes ?? null,
          verified_in_registry: entry.verified,
          run: runId,
        },
      });
    }
  }
  return { proposals, unknown, dates: due.map((f) => f.date) };
}

// ---------------------------------------------------------------------------
// One source
// ---------------------------------------------------------------------------

async function processSource(
  entry: StateEntry,
  url: string,
  ctx: {
    dry: boolean;
    force: boolean;
    stateId: string;
    speciesByKey: Record<string, string>;
    zonesByCode: Record<string, string>;
    runId: string;
    /** Today, once, so every source in a run agrees on what "past" means. */
    today: string;
    /** Identities already waiting for review; see queueProposals. */
    pending: Set<string>;
  },
) {
  const started = Date.now();
  const origin = new URL(url).origin;
  const path = new URL(url).pathname + new URL(url).search;

  const log = async (fields: Record<string, unknown>) => {
    if (ctx.dry) return;
    await admin.from('source_fetch_log').insert({
      state_id: ctx.stateId,
      purpose: 'leftover_tags',
      url,
      duration_ms: Date.now() - started,
      ...fields,
    });
  };

  // 1. May we?
  const robots = await robotsFor(origin);
  if (!isAllowedByRobots(robots, path, USER_AGENT)) {
    await log({ status: 'blocked', error: 'robots.txt disallows this path' });
    return { state: entry.state_code, url, status: 'blocked' as const };
  }

  // 2. Fetch.
  let text: string;
  let httpStatus = 0;
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    httpStatus = res.status;
    if (!res.ok) {
      await log({ status: 'error', http_status: res.status, error: `HTTP ${res.status}` });
      return { state: entry.state_code, url, status: 'error' as const, http_status: res.status };
    }
    const body = await res.text();
    if (body.length > MAX_BYTES) {
      await log({ status: 'error', http_status: httpStatus, bytes: body.length, error: 'page too large' });
      return { state: entry.state_code, url, status: 'error' as const, note: 'too large' };
    }
    text = body;
  } catch (e) {
    await log({ status: 'error', http_status: httpStatus, error: e instanceof Error ? e.message : String(e) });
    return { state: entry.state_code, url, status: 'error' as const };
  }

  // 3. Has it changed?
  // Two different normalisers on purpose. The hash has to ignore a clock in
  // a footer; the model has to SEE one in the body. Using the hashing
  // normaliser for both handed the model a page with every zoned time already
  // deleted, and it correctly reported no sales.
  const hash = await sha256Hex(normaliseForHash(text));
  const readable = textForReading(text);
  const haystack = normaliseForQuote(readable);
  const { data: prev } = await admin
    .from('source_fetch_log')
    .select('content_hash')
    .eq('purpose', 'leftover_tags')
    .eq('url', url)
    .in('status', ['ok', 'unchanged'])
    .order('fetched_at', { ascending: false })
    .limit(1);
  const lastHash = prev?.[0]?.content_hash ?? null;
  if (!ctx.force && lastHash && lastHash === hash) {
    await log({ status: 'unchanged', http_status: httpStatus, content_hash: hash, bytes: text.length });
    return { state: entry.state_code, url, status: 'unchanged' as const };
  }

  // 4. Read it.
  let found: Extracted;
  try {
    found = await extract(readable, entry, Object.keys(ctx.speciesByKey));
  } catch (e) {
    await log({ status: 'error', http_status: httpStatus, content_hash: hash, error: e instanceof Error ? e.message : String(e) });
    return { state: entry.state_code, url, status: 'error' as const };
  }

  // 5. Propose what survives.
  const proposals: { payload: ProposedSale; confidence: number; evidence: unknown }[] = [];
  const discarded: string[] = [];

  for (const s of found.sales) {
    if (!s?.quote) {
      discarded.push(`${s?.name ?? 'unnamed'}: no supporting quote`);
      continue;
    }
    const start = resolveSaleYear(s.start_month, s.start_day, s.start_year, ctx.today);
    if (!start) {
      discarded.push(`${s.name}: no usable start date (month ${s.start_month}, day ${s.start_day})`);
      continue;
    }
    // CPW's page says "Leftover license sales started on August 4, 2026" --
    // past tense, about a sale that is finished. With a year printed on the
    // page resolveSaleYear honours it, so these resolve into the past and
    // would queue proposals for sales nobody can buy. A sale whose start is
    // behind us is only news while it is still open.
    if (start.date < ctx.today && !(s.end_month && s.end_day)) {
      discarded.push(`${s.name}: already started (${start.date}) and the page gives no end`);
      continue;
    }
    // A sale that ends without a stated year ends in the year it started,
    // unless that would put the end before the start (a December-to-January
    // window), in which case it is the year after.
    const end = (() => {
      if (!s.end_month || !s.end_day) return null;
      if (s.end_year) return resolveSaleYear(s.end_month, s.end_day, s.end_year, ctx.today);
      const startYear = Number(start.date.slice(0, 4));
      const same = resolveSaleYear(s.end_month, s.end_day, startYear, ctx.today);
      if (same && same.date >= start.date) return same;
      return resolveSaleYear(s.end_month, s.end_day, startYear + 1, ctx.today);
    })();
    // The quote must actually be on the page. The model is not trusted to
    // tell us what it read; this is the same grounding discipline the season
    // extractor uses, and it is what catches a confident invention.
    const quoteNorm = normaliseForQuote(s.quote);
    if (quoteNorm.length < 12 || !haystack.includes(quoteNorm.slice(0, Math.min(60, quoteNorm.length)))) {
      discarded.push(`${s.name}: quote not found on the page`);
      continue;
    }
    // On the page is not the same as about the date. Oregon's four proposals
    // all cited a sentence explaining that leftover tags are sold first come,
    // first served -- true, on the page, and silent about the first of July.
    if (!quoteSupportsDate(s.quote, s.start_month, s.start_day)) {
      discarded.push(
        `${s.name}: the quote does not name ${s.start_month}/${s.start_day} -- "${s.quote.slice(0, 70)}"`,
      );
      continue;
    }
    if (end && end.date < ctx.today) {
      discarded.push(`${s.name}: closed on ${end.date}`);
      continue;
    }
    const zoneId = s.unit_code ? ctx.zonesByCode[s.unit_code] ?? null : null;
    const { time, zone } = parseSaleTime(s.start_time_text, entry.state_code);

    // One sale, one row per species. The page says "bear, deer, elk and
    // pronghorn" in a single sentence and the model now answers in kind; the
    // fan-out belongs here, where the species keys are checked against the
    // database rather than taken on trust.
    const keys = (Array.isArray(s.species) ? s.species : [s.species]).filter(Boolean);
    if (keys.length === 0) {
      discarded.push(`${s.name}: no species`);
      continue;
    }
    for (const key of keys) {
      const speciesId = ctx.speciesByKey[key];
      if (!speciesId) {
        discarded.push(`${s.name}: unknown species "${key}"`);
        continue;
      }

      const payload: ProposedSale = {
        state_code: entry.state_code,
        species_key: key,
        zone_code: s.unit_code ?? null,
        season_year: seasonYearFor(start.date),
        sale_type: s.sale_type ?? 'leftover',
        name: s.name,
        sale_start_date: start.date,
        sale_start_time: time,
        sale_end_date: end?.date ?? null,
        time_zone: zone,
        residency: parseResidency(s.residency_text),
        purchase_url: s.purchase_url ?? null,
        notes: s.conflict ? `Page gives conflicting dates: ${s.conflict}` : null,
      };

      let confidence = confidenceFor(payload, {
        zoneMatched: !s.unit_code || Boolean(zoneId),
        yearInferred: start.yearInferred,
      });
      // A page that contradicts itself never sweeps automatically, whatever
      // else is right about it.
      if (s.conflict) confidence = Math.min(confidence, 0.5);

      proposals.push({
        payload,
        confidence,
        evidence: {
          quote: s.quote,
          url,
          shape: s.shape ?? entry.shape,
          year_inferred: start.yearInferred,
          run: ctx.runId,
        },
      });
    }
  }

  if (ctx.dry) {
    // Zero proposals and zero discards used to be indistinguishable from a
    // model reply that did not parse. Never again: say what was read and what
    // came back.
    return {
      state: entry.state_code,
      url,
      status: 'dry' as const,
      proposals: proposals.length,
      discarded,
      read: {
        bytes: text.length,
        readable: readable.length,
        model_parsed: found.parsed ?? null,
        model_blocks: found.blocks ?? null,
        model_stop: found.stop ?? null,
      },
      sales_seen: found.sales.length,
      model_said: found.sales.length === 0 ? (found.raw ?? '').slice(0, 600) : undefined,
    };
  }

  // 6. Hand them to the shared queue step, which decides what is new.
  const { queued, skipped } = await queueProposals(proposals, {
    stateId: ctx.stateId,
    speciesByKey: ctx.speciesByKey,
    zonesByCode: ctx.zonesByCode,
    runId: ctx.runId,
    pending: ctx.pending,
    sourceUrl: url,
  });
  discarded.push(...skipped);

  await log({ status: 'ok', http_status: httpStatus, content_hash: hash, bytes: text.length });
  return { state: entry.state_code, url, status: 'ok' as const, proposals: proposals.length, queued, discarded };
}

// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!isServiceRole(token)) return json({ error: 'forbidden' }, 403);

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is the normal cron call */
  }
  const dry = Boolean(body?.dry);
  const force = Boolean(body?.force);
  const only = typeof body?.state === 'string' ? body.state.toUpperCase() : null;
  const runId = crypto.randomUUID();
  // Read the clock once. A run that straddles midnight should not change its
  // mind about which sales are over.
  const today = new Date().toISOString().slice(0, 10);

  try {
    // Retried, because the failure that sent us looking was "JWT issued at
    // future" -- a few seconds of clock skew between the edge runtime and
    // the database, which came and went inside one evening. coverage-watch
    // ran clean eight minutes later, so this is a window to ride out rather
    // than a fault to report. Three cheap reads, two seconds apart; if it is
    // still failing after that, the error is real and gets surfaced.
    let stateRes, speciesRes, zoneRes;
    for (let attempt = 1; ; attempt += 1) {
      [stateRes, speciesRes, zoneRes] = await Promise.all([
        admin.from('states').select('id, code'),
        admin.from('species').select('id, key'),
        admin.from('zones').select('id, code, state_id'),
      ]);
      const failed =
        stateRes.error || speciesRes.error || zoneRes.error || (stateRes.data ?? []).length === 0;
      if (!failed || attempt === 3) break;
      await sleep(2000);
    }

    // These three errors used to be discarded. When the states select came
    // back empty the run reported "state not in the database" for every
    // entry -- a confident, specific, wrong answer about the data, when the
    // truth was that the query had failed and nobody asked why.
    //
    // Reference data is never legitimately empty. Fifty states do not go
    // missing. So an empty result is an outage, not a finding, and the run
    // stops rather than inventing a diagnosis.
    const refErr =
      stateRes.error?.message ?? speciesRes.error?.message ?? zoneRes.error?.message ?? null;
    if (refErr) return json({ error: `reference data unavailable: ${refErr}` }, 503);
    const states = stateRes.data ?? [];
    const species = speciesRes.data ?? [];
    const zones = zoneRes.data ?? [];
    if (states.length === 0 || species.length === 0) {
      return json(
        { error: 'reference data came back empty', states: states.length, species: species.length },
        503,
      );
    }
    // What is already waiting for a human. Loaded once: the rule path proposes
    // on every run regardless of whether any page changed, so without this the
    // queue would grow a duplicate Oregon card every night.
    const pendingRes = await admin
      .from('review_queue')
      .select('proposed_payload')
      .eq('target_table', 'leftover_tag_sales')
      .eq('status', 'pending');
    if (pendingRes.error) {
      return json({ error: `review queue unavailable: ${pendingRes.error.message}` }, 503);
    }
    const pending = new Set(
      (pendingRes.data ?? [])
        .map((r: any) => (r?.proposed_payload ? saleIdentity(r.proposed_payload) : null))
        .filter((x: string | null): x is string => Boolean(x)),
    );

    const stateIdByCode = Object.fromEntries(states.map((s: any) => [s.code, s.id]));
    const speciesByKey = Object.fromEntries(species.map((s: any) => [s.key, s.id]));

    let entries = liveEntries();
    if (only) entries = entries.filter((e) => e.state_code === only);
    if (entries.length === 0) {
      return json({ ok: true, run_id: runId, note: only ? `no verified entry for ${only}` : 'no verified entries' });
    }

    const results: unknown[] = [];
    for (const entry of entries) {
      const stateId = stateIdByCode[entry.state_code];
      if (!stateId) {
        results.push({ state: entry.state_code, status: 'error', error: 'state not in the database' });
        continue;
      }
      const zonesByCode = Object.fromEntries(
        zones.filter((z: any) => z.state_id === stateId && z.code).map((z: any) => [z.code, z.id]),
      );

      // Rule-driven dates need no page, so they are proposed even when the
      // agency's site is unreachable -- which is what this said while queueing
      // nothing at all.
      const rules = ruleProposals(entry, today, speciesByKey, runId);
      if (rules.proposals.length || rules.unknown.length) {
        const ruleQueue = await queueProposals(rules.proposals, {
          stateId,
          speciesByKey,
          zonesByCode,
          runId,
          pending,
          sourceUrl: null,
        });
        results.push({
          state: entry.state_code,
          status: 'rule',
          dates: rules.dates,
          proposals: rules.proposals.length,
          queued: ruleQueue.queued,
          discarded: [...rules.unknown, ...ruleQueue.skipped],
        });
      }

      for (const src of entry.sources) {
        if (src.role === 'news') continue; // not built yet; see the registry
        results.push(
          await processSource(entry, src.url, {
            dry,
            force,
            stateId,
            speciesByKey,
            zonesByCode,
            runId,
            today,
            pending,
          }),
        );
        await sleep(POLITE_PAUSE_MS);
      }
    }

    return json({
      ok: true,
      run_id: runId,
      dry,
      states: entries.length,
      results,
      not_automated: REGISTRY.filter((e) => e.verified === null).map((e) => e.state_code),
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
