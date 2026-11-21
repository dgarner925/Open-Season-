// extract-source — automated refresh.
//
// Fetches an official source, asks Claude to extract structured seasons,
// application windows (draw deadlines), and regulation summaries, diffs each
// against the current rows, and enqueues proposed changes into review_queue.
// NOTHING is published — an admin approves each item in-app, which calls
// apply_review_item() (handles all three tables).
//
// Deploy:  supabase functions deploy extract-source
// Secrets: ANTHROPIC_API_KEY (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected)
// Invoke:
//   POST {}                    -> process the single stalest source (cron round-robin)
//   POST { "max": 20 }         -> process the 20 stalest sources this run
//   POST { "sourceId": "..." } -> process exactly that source
//   POST { "gaps": true }      -> process the sources coverage-watch blames for
//                                 actual holes, worst first (see coverage-watch)
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  accuracyReport,
  dropSummarySpans,
  LOW_CONFIDENCE,
  normalizeExtractedDate,
  normalizeLabel,
  scoreConfidence,
  validateSeason,
  groundWindow,
  ROW_NAME_THRESHOLD,
  scoreWindowConfidence,
  textBlocks,
  validateWindow,
} from '../_shared/extraction.ts';
import { staleProposal } from '../_shared/licence_year.ts';
import { orderDrawSources, orderGapSources, worstPriorityBySource } from '../_shared/gap_order.ts';
import { timeForAnother } from '../_shared/time_budget.ts';
import {
  extractionSchema,
  speciesCatalog,
  SYSTEM,
} from '../_shared/extract_prompt.ts';
import { normaliseForHash, sha256Hex } from '../_shared/leftover.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Sonnet 5: structured extraction from a document doesn't need Opus-tier
// reasoning, and Sonnet is roughly 5x cheaper per call — meaningful for an
// hourly cron over 13+ sources. Every extraction is still human-reviewed
// before publishing (review_queue), so this doesn't change the safety net.
const MODEL = Deno.env.get('EXTRACT_MODEL') ?? 'claude-sonnet-5-5';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

// This function spends money (each run calls Claude), and Supabase's gateway only
// checks that the caller presents *some* valid key — the app's anon/publishable
// key ships inside every build and is public, so without this guard anyone could
// trigger extraction and drain the Anthropic balance. Only privileged callers
// (i.e. our pg_cron job) may invoke it.
//
// This project is on Supabase's NEW API key system: legacy JWT keys are disabled
// (the gateway rejects them with UNAUTHORIZED_LEGACY_JWT), so the cron uses an
// `sb_secret_...` key. We accept, in order:
//   1. an exact match on the injected SUPABASE_SERVICE_ROLE_KEY,
//   2. an `sb_secret_...` key that appears in the injected SUPABASE_SECRET_KEYS
//      (substring match keeps this agnostic to that var's encoding), or
//   3. a legacy JWT whose role claim is service_role (for projects still on it).
const SECRET_KEYS_RAW = Deno.env.get('SUPABASE_SECRET_KEYS') ?? '';

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


// ~9 MB cap — beyond this the in-worker base64 + model upload risks the edge
// function's memory/CPU limits. Oversized PDFs are skipped (isolated per-source).
const MAX_PDF_BYTES = 9_000_000;

// Chunked base64 — spreading 32 KB slices into fromCharCode instead of looping
// byte-by-byte keeps CPU well under the edge worker's limit on large PDFs.
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// Several agency sites block non-browser requests: michigan.gov 403s a bare UA,
// and Georgia's eRegulations (415) / Kansas's ksoutdoors.gov (403) fingerprint
// on the full header set. Send a realistic desktop-Chrome navigation. (No
// accept-encoding — let Deno negotiate one it can transparently decompress.)
const BROWSER_HEADERS: Record<string, string> = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf,image/avif,image/webp,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'none',
  'sec-fetch-user': '?1',
  'upgrade-insecure-requests': '1',
};

/**
 * `blocks` is the page cut into rows, used only for grounding -- what reaches
 * the model is unchanged, so this costs nothing and alters no extraction.
 * Null for a PDF, which has no markup to cut.
 */
async function fetchDocumentBlock(
  url: string,
): Promise<{ doc: any; hash: string | null; blocks: string[] | null }> {
  const res = await fetch(url, { headers: BROWSER_HEADERS });
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
  if (url.toLowerCase().endsWith('.pdf') || res.headers.get('content-type')?.includes('pdf')) {
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length > MAX_PDF_BYTES) {
      throw new Error(`PDF too large to extract in-worker (${(buf.length / 1e6).toFixed(1)} MB)`);
    }
    // A PDF is hashed over its raw bytes: there is no normalised text to
    // compare, and a regenerated-but-identical PDF is rare enough not to
    // chase.
    return {
      doc: { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: bytesToBase64(buf) } },
      hash: await sha256Hex(bytesToBase64(buf)),
      blocks: null,
    };
  }
  const html = await res.text();
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 120_000);
  // Hash the NORMALISED page, not the raw HTML: agency sites stamp a render
  // time into the markup, so a raw hash changes every night and would make
  // this check useless -- exactly the trap normaliseForHash exists for.
  return {
    doc: { type: 'text', text },
    hash: await sha256Hex(normaliseForHash(html)),
    blocks: textBlocks(html),
  };
}

/**
 * What that read actually cost.
 *
 * `ai_usage` had rows for the daily brief and Ask the Book and none at all for
 * extraction -- which is the one that spends real money, on 80-page PDFs, every
 * night. Asked how much a night costs, the only honest answer was an estimate,
 * and the estimate was wrong twice before measurement settled it.
 *
 * Never throws. A failure to write the meter must not lose the extraction the
 * meter is measuring -- but it is recorded, because a silently empty meter is
 * how this started.
 */
async function logUsage(
  agency: string,
  usage: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number } | null,
  ok: boolean,
  note: string | null,
): Promise<void> {
  try {
    const { error } = await admin.from('ai_usage').insert({
      user_id: null,
      feature: 'extraction',
      model: MODEL,
      input_tokens: usage?.input_tokens ?? 0,
      output_tokens: usage?.output_tokens ?? 0,
      cache_read_tokens: usage?.cache_read_input_tokens ?? 0,
      served_from_cache: false,
      ok,
      note: note ?? agency,
    });
    if (error) console.error('ai_usage insert failed:', error.message);
  } catch (e) {
    console.error('ai_usage insert threw:', e instanceof Error ? e.message : String(e));
  }
}

async function extract(doc: any, agency: string, catalog: string, schema: unknown): Promise<{ seasons: any[]; application_windows: any[]; regulation_summaries: any[] }> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM + catalog,
      output_config: { format: { type: 'json_schema', schema } },
      messages: [{
        role: 'user',
        content: [doc, { type: 'text', text: `This document is from ${agency}. Extract everything it lists.` }],
      }],
    }),
  });
  if (!res.ok) {
    await logUsage(agency, null, false, `anthropic ${res.status}`);
    throw new Error(`anthropic ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  await logUsage(agency, data.usage, true, null);
  const textBlock = (data.content ?? []).find((b: any) => b.type === 'text');
  if (!textBlock) throw new Error('no text block in model response');
  const parsed = JSON.parse(textBlock.text);
  return {
    seasons: parsed.seasons ?? [],
    application_windows: parsed.application_windows ?? [],
    regulation_summaries: parsed.regulation_summaries ?? [],
  };
}

// Resolve a zone by name within a state, creating it if missing. Returns null
// for statewide / unspecified (application_windows.zone_id is nullable).
async function resolveZoneId(stateId: string, zoneName: string | null, allowNull: boolean): Promise<string | null> {
  const name = (zoneName ?? '').trim();
  if (!name || /^statewide$/i.test(name)) {
    if (allowNull) return null;
  }
  const resolved = name || 'Statewide';
  const { data: existing } = await admin.from('zones').select('id').eq('state_id', stateId).eq('name', resolved).maybeSingle();
  if (existing) return existing.id;
  const type = /flyway|duck zone/i.test(resolved) ? 'flyway_zone'
    : /gmu|unit|hunt area/i.test(resolved) ? 'gmu'
    : resolved.toLowerCase() === 'statewide' ? 'statewide' : 'county_group';
  const { data: created, error } = await admin.from('zones').insert({ state_id: stateId, name: resolved, type }).select('id').single();
  if (error) throw error;
  return created.id;
}

// Is there already a pending review for this logical row? Keeps re-runs from
// piling up duplicate proposals while the admin hasn't approved yet.
async function pendingExists(targetTable: string, targetId: string | null, keys: Record<string, string | number | null>): Promise<boolean> {
  let q = admin.from('review_queue').select('id').eq('status', 'pending').eq('target_table', targetTable);
  if (targetId) {
    q = q.eq('target_id', targetId);
  } else {
    for (const [k, v] of Object.entries(keys)) {
      if (v === null || v === undefined) continue;
      q = q.eq(`proposed_payload->>${k}`, String(v));
    }
  }
  const { data } = await q.limit(1);
  return (data?.length ?? 0) > 0;
}

type Tally = {
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  /** Rows discarded because the page they came from is a licence year behind.
   *  Counted and named separately from `skipped`, which is a grab-bag: a run
   *  that reads a stale mirror should say so, not quietly return a low
   *  number. */
  stale: number;
  stale_reasons: string[];
  /** Proposals the database refused. Kept apart from `created` and `updated`
   *  because an insert that failed created nothing, and a run that counts it
   *  as created is a run that misreports its own work. */
  lost: number;
  lost_reasons: string[];
};
const emptyTally = (): Tally => ({
  created: 0, updated: 0, unchanged: 0, skipped: 0, stale: 0, stale_reasons: [],
  lost: 0, lost_reasons: [],
});

/**
 * Enqueue one proposal, and count it only if the database took the row.
 *
 * Six inserts here went unchecked and tallied `created` or `updated`
 * regardless. A refused insert is an extraction that fetched the page, read
 * the season off it, and dropped it -- while the run reported success and the
 * source got stamped as read. That is the worst shape a failure takes in this
 * pipeline: a default that reads as data. The draw sweep makes it sharper
 * still, since every window it finds reaches the app through exactly one of
 * these inserts.
 */
async function propose(
  tally: Tally,
  kind: 'created' | 'updated',
  row: Record<string, unknown>,
): Promise<void> {
  const { error } = await admin.from('review_queue').insert(row);
  if (!error) {
    tally[kind]++;
    return;
  }
  tally.lost++;
  const why = `${row.target_table} ${row.change_type}: ${error.message}`;
  // Capped and de-duplicated: one broken constraint can refuse every row on
  // the page, and a hundred copies of one message is not a hundred findings.
  if (tally.lost_reasons.length < 10 && !tally.lost_reasons.includes(why)) {
    tally.lost_reasons.push(why);
  }
  console.error('[extract] review_queue refused a proposal:', why);
}

async function processSource(
  source: any,
  runId: string,
  speciesByKey: Record<string, string>,
  catalog: string,
  schema: unknown,
  force = false,
) {
  // Stamp FIRST so the round-robin advances even if this source later kills the
  // worker (a huge PDF hitting the memory/CPU limit, or a slow site hitting the
  // 150s wall clock). Otherwise last_extracted_at stays null and the same poison
  // source gets re-picked forever, stalling the sweep.
  await admin.from('sources').update({ last_extracted_at: new Date().toISOString() }).eq('id', source.id);
  const { doc, hash, blocks } = await fetchDocumentBlock(source.url);

  // Do not pay to read a page that has not changed.
  //
  // Every run called the model on the full page whether or not a byte of it
  // had moved, and agency pages move a few times a year. That is most of the
  // extraction bill spent re-deriving yesterday's answer, and it is why one
  // source a night was all the budget would carry.
  //
  // Skipping is not just cheaper, it is more honest: identical bytes cannot
  // produce a different extraction, so re-reading them can never close a gap
  // that those same bytes already failed to close. A gap that survives an
  // unchanged page is a problem with our prompt or our species mapping, and
  // this makes it visible instead of burning a call a night hiding it.
  //
  // `force` is the escape hatch for when the prompt or the parser changes and
  // the same bytes really would read differently.
  if (!force && hash) {
    const { data: prev, error: prevErr } = await admin
      .from('source_fetch_log')
      .select('content_hash')
      .eq('purpose', 'seasons')
      .eq('url', source.url)
      .in('status', ['ok', 'unchanged'])
      .order('fetched_at', { ascending: false })
      .limit(1);
    // A failed lookup is not "the page is new". Read before deciding, or a
    // dropped connection silently pays for a call we did not need.
    if (prevErr) {
      console.warn('[extract] could not read the last hash, reading the page:', prevErr.message);
    } else if (prev?.[0]?.content_hash === hash) {
      // Check the write. If this row never lands, the next run finds no hash
      // to compare against, reads the page again, and the saving silently
      // never happens -- a bill that looks like a feature working.
      const { error: logErr } = await admin.from('source_fetch_log').insert({
        state_id: source.state_id, purpose: 'seasons', url: source.url,
        status: 'unchanged', content_hash: hash,
      });
      if (logErr) console.warn('[extract] could not log the unchanged read:', logErr.message);
      return {
        source: source.agency_name,
        url: source.url,
        unchanged_page: true,
        note: 'page byte-identical to the last read; no model call',
      };
    }
  }

  const extracted = await extract(doc, source.agency_name, catalog, schema);
  const { application_windows, regulation_summaries } = extracted;
  // An agency that splits a season prints a headline window above the detail
  // rows, and a faithful read transcribes both. The headline is not a season:
  // the only days it adds are the days the season is SHUT, and a high-confidence
  // one sails through the clean sweep and tells a hunter a closed season is
  // open. Thirteen were live across five states on 2026-11-02. The prompt asks
  // for one row per window; this is what guarantees it.
  const { kept: seasons, dropped: summaries } = dropSummarySpans(extracted.seasons);
  const t = emptyTally();
  const today = new Date().toISOString().slice(0, 10);
  t.skipped += summaries.length;
  // An existing row may be claimed by at most ONE proposal per run. Without
  // this, a season the document splits into four windows — all labelled
  // "Firearms" — produces four proposals that each try to update the same row
  // (GA accuracy run, 2026-10-31).
  const claimed = new Set<string>();

  // --- seasons ---
  for (const row of seasons) {
    const species_id = speciesByKey[row.species];
    if (!species_id) { t.skipped++; continue; }
    const zone_id = await resolveZoneId(source.state_id, row.zone, false);

    // Validate before matching: dates are taken literally, never parsed through
    // a Date (which would shift a calendar day westward), and a row that fails
    // still reaches the queue — flagged and low-confidence, never published.
    const v = validateSeason(row);
    const confidence = scoreConfidence(row, v);
    const open_date = v.dates.open;
    const close_date = v.dates.close;
    const label = row.label ?? null;

    // Is the SOURCE still current? Grounding only asks whether the page says
    // what we claim it says, and a mirror a year out of date answers yes to
    // that about last season's dates. Wisconsin put 42 such rows in the queue
    // at 0.90+ confidence before this check existed.
    const stale = staleProposal(
      {
        seasonYear: row.season_year,
        closeDate: close_date,
        quote: (row.evidence as { quote?: string } | null)?.quote ?? null,
      },
      today,
    );
    if (stale.stale) {
      t.stale++;
      if (t.stale_reasons.length < 10) {
        t.stale_reasons.push(`${row.species} ${label ?? ''} ${open_date ?? '?'}: ${stale.reason}`.trim());
      }
      continue;
    }

    // Identity INCLUDES the label. Georgia runs "Archery" and "Extended
    // Archery" for the same species, zone, method and year; matching without
    // the label made the second window look like an edit of the first — and
    // made maybeSingle() throw once both existed.
    // Fetch the whole group and match in code, two passes: normalized label
    // first, then identical dates. Comparing labels verbatim made "Firearms"
    // and "Firearms (one day)" look like different seasons and proposed a
    // duplicate (GA accuracy run, 2026-10-25).
    const { data: groupRows } = await admin.from('seasons').select('*')
      .eq('state_id', source.state_id).eq('species_id', species_id)
      .eq('zone_id', zone_id!).eq('method', row.method).eq('season_year', row.season_year)
      .limit(50);
    const group = (groupRows ?? []).filter((r: any) => !claimed.has(r.id));
    const wantedLabel = normalizeLabel(label);
    // Dates first when we have them: they identify a window exactly, where a
    // label may be shared across several. Fall back to the label for a season
    // whose dates moved.
    let current =
      (open_date ? group.find((r: any) => r.open_date === open_date && r.close_date === close_date) : null) ?? null;
    const sameLabel = group.filter((r: any) => normalizeLabel(r.label) === wantedLabel);
    if (!current && sameLabel.length === 1) current = sameLabel[0];
    if (current) claimed.add(current.id);
    const ambiguous = !current && sameLabel.length > 1;

    const payload = {
      state_id: source.state_id, species_id, zone_id, season_year: row.season_year,
      method: row.method, label, open_date, close_date,
      bag_limit_summary: row.bag_limit_summary, notes: row.notes, source_id: source.id,
    };
    const meta = {
      confidence,
      evidence: row.evidence ?? null,
      validation_errors: ambiguous ? [...v.errors, 'multiple existing rows share this identity'] : v.errors,
    };

    if (!current) {
      if (await pendingExists('seasons', null, { state_id: source.state_id, species_id, zone_id, method: row.method, season_year: row.season_year, label })) { t.skipped++; continue; }
      await propose(t, 'created', { target_table: 'seasons', change_type: 'create', proposed_payload: payload, source_id: source.id, extraction_run_id: runId, ...meta });
    } else if (current.open_date !== open_date || current.close_date !== close_date) {
      if (await pendingExists('seasons', current.id, {})) { t.skipped++; continue; }
      await propose(t, 'updated', { target_table: 'seasons', change_type: 'update', target_id: current.id, proposed_payload: payload, current_snapshot: current, source_id: source.id, extraction_run_id: runId, ...meta });
    } else { t.unchanged++; }
  }

  // --- application windows (draw deadlines) ---
  for (const row of application_windows) {
    const species_id = speciesByKey[row.species];
    if (!species_id) { t.skipped++; continue; }
    const zone_id = await resolveZoneId(source.state_id, row.zone, true);
    let match = admin.from('application_windows').select('*')
      .eq('state_id', source.state_id).eq('species_id', species_id).eq('season_year', row.season_year);
    match = zone_id ? match.eq('zone_id', zone_id) : match.is('zone_id', null);
    match = row.name ? match.eq('name', row.name) : match.is('name', null);
    const { data: windowMatches } = await match.limit(2);
    const current = (windowMatches ?? [])[0] ?? null;
    // Same literal-date rule as seasons: a deadline is a calendar day.
    const opens_at = normalizeExtractedDate(row.opens_at);
    const closes_at = normalizeExtractedDate(row.closes_at);
    const results_expected_at = normalizeExtractedDate(row.results_expected_at);
    const payload = {
      state_id: source.state_id, species_id, zone_id, season_year: row.season_year,
      name: row.name, opens_at, closes_at,
      results_expected_at, fee_summary: row.fee_summary,
      application_url: row.application_url ?? source.url, source_id: source.id,
    };

    // Grade the proposal, which until 2026-11-21 nothing did. A window arrived
    // with confidence NULL, and approve_clean_reviews only ever considers rows
    // that HAVE a confidence -- so no draw deadline could auto-approve, ever.
    //
    // Graded on grounding first: `doc` is the page this worker already
    // fetched, so asking whether it literally contains these dates costs
    // nothing and is a far harder test than the model's own certainty. A PDF
    // has no text here, so it falls back to the model's quote and is capped
    // below the auto-approve gate on purpose.
    const wv = validateWindow(row);
    const grounding = groundWindow(
      blocks,
      doc?.type === 'text' ? (doc.text as string) : null,
      (row.evidence as { quote?: string } | null)?.quote ?? null,
      row.name ?? null,
      [opens_at, closes_at, results_expected_at],
      closes_at,
    );
    const wConfidence = scoreWindowConfidence(row, wv, grounding);

    // Same stale guard the seasons path has: grounding only asks whether the
    // page says this, and a mirror a year out of date says yes about last
    // cycle's deadline.
    const wStale = staleProposal(
      { seasonYear: row.season_year, closeDate: closes_at,
        quote: (row.evidence as { quote?: string } | null)?.quote ?? null },
      today,
    );
    if (wStale.stale) {
      t.stale++;
      if (t.stale_reasons.length < 10) {
        t.stale_reasons.push(`${row.species} ${row.name ?? 'draw'} ${closes_at ?? '?'}: ${wStale.reason}`);
      }
      continue;
    }

    const wMeta = {
      confidence: wConfidence,
      evidence: {
        page: (row.evidence as { page?: number } | null)?.page ?? null,
        quote: (row.evidence as { quote?: string } | null)?.quote ?? null,
        grounded_in: grounding.basis,
        dates_found: grounding.found,
        dates_not_found: grounding.missing,
        page_snippet: grounding.quote,
        // How much of this window's name the row carrying its closing date
        // actually says. This is the number that separates a table read
        // correctly from one read sideways; null means there were no rows to
        // check (a PDF).
        row_name_match: grounding.rowMatch,
        row_text: grounding.rowText,
      },
      validation_errors: grounding.missing.length
        ? [...wv.errors, `not found on the page: ${grounding.missing.join(', ')}`]
        : grounding.rowMatch !== null && grounding.rowMatch < ROW_NAME_THRESHOLD
        ? [...wv.errors,
           `the date is on the page but not on a row naming this draw (${
             Math.round(grounding.rowMatch * 100)}% name match)`]
        : wv.errors,
    };

    if (!current) {
      if (await pendingExists('application_windows', null, { state_id: source.state_id, species_id, season_year: row.season_year, name: row.name })) { t.skipped++; continue; }
      await propose(t, 'created', { target_table: 'application_windows', change_type: 'create', proposed_payload: payload, source_id: source.id, extraction_run_id: runId, ...wMeta });
    } else if (current.closes_at !== closes_at || current.opens_at !== opens_at) {
      if (await pendingExists('application_windows', current.id, {})) { t.skipped++; continue; }
      await propose(t, 'updated', { target_table: 'application_windows', change_type: 'update', target_id: current.id, proposed_payload: payload, current_snapshot: current, source_id: source.id, extraction_run_id: runId, ...wMeta });
    } else { t.unchanged++; }
  }

  // --- regulation summaries (one per state+species) ---
  for (const row of regulation_summaries) {
    const species_id = speciesByKey[row.species];
    if (!species_id || !row.body) { t.skipped++; continue; }
    const { data: current } = await admin.from('regulation_summaries').select('*')
      .eq('state_id', source.state_id).eq('species_id', species_id).maybeSingle();
    const payload = { state_id: source.state_id, species_id, body: row.body, source_id: source.id };
    if (!current) {
      if (await pendingExists('regulation_summaries', null, { state_id: source.state_id, species_id })) { t.skipped++; continue; }
      await propose(t, 'created', { target_table: 'regulation_summaries', change_type: 'create', proposed_payload: payload, source_id: source.id, extraction_run_id: runId });
    } else if (current.body !== row.body) {
      if (await pendingExists('regulation_summaries', current.id, {})) { t.skipped++; continue; }
      await propose(t, 'updated', { target_table: 'regulation_summaries', change_type: 'update', target_id: current.id, proposed_payload: payload, current_snapshot: current, source_id: source.id, extraction_run_id: runId });
    } else { t.unchanged++; }
  }

  if (hash) {
    // Likewise: a dropped hash here means tomorrow pays for this page again.
    const { error: logErr } = await admin.from('source_fetch_log').insert({
      state_id: source.state_id, purpose: 'seasons', url: source.url,
      status: 'ok', content_hash: hash,
    });
    if (logErr) console.warn('[extract] could not log the read:', logErr.message);
  }

  return {
    source: source.agency_name,
    url: source.url,
    extracted: extracted.seasons.length + application_windows.length + regulation_summaries.length,
    summary_spans_dropped: summaries.length,
    ...t,
  };
}

Deno.serve(async (req) => {
  // The wall clock starts here, not at the top of the source loop: auth, the
  // body parse and the species read all spend from the same 150 seconds.
  const startedAt = Date.now();
  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!isServiceRole(token)) {
      return json({ error: 'forbidden: service role required' }, 403);
    }

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const { sourceId, max, accuracy, state_code, season_year, gaps, draws, force } = body as {
      sourceId?: string; max?: number; accuracy?: boolean; state_code?: string; season_year?: number;
      gaps?: boolean;
      /** Re-read only the application-deadline pages (sources.carries_draws). */
      draws?: boolean;
      /** Read a page again even if it has not changed -- for when the prompt
       *  or the parser changed and the same bytes would read differently. */
      force?: boolean;
    };

    // --- accuracy mode -----------------------------------------------------
    // Grade the extractor against hand-verified data for one state. Writes
    // NOTHING: no review_queue rows, no last_extracted_at stamps. This is the
    // gate a new state has to pass before we trust the pipeline on it.
    if (accuracy) {
      const code = String(state_code ?? '').trim().toUpperCase();
      if (!code) return json({ error: 'accuracy mode needs state_code' }, 400);
      const { data: state } = await admin.from('states').select('id,name').eq('code', code).maybeSingle();
      if (!state) return json({ error: `unknown state ${code}` }, 404);

      const { data: species } = await admin.from('species').select('id, key, name').order('sort_order');
      const catalog = speciesCatalog((species ?? []) as { key: string; name: string }[]);
      const schema = extractionSchema((species ?? []).map((s: any) => s.key));
      const keyById = Object.fromEntries((species ?? []).map((s: any) => [s.id, s.key]));

      const { data: srcs } = await admin.from('sources').select('*')
        .eq('state_id', (state as any).id).limit(Math.min(Math.max(max ?? 3, 1), 10));
      if (!srcs?.length) return json({ error: `no sources for ${code}` }, 404);

      const extracted: any[] = [];
      const errors: string[] = [];
      for (const source of srcs) {
        try {
          const { doc } = await fetchDocumentBlock(source.url);
          const out = await extract(doc, source.agency_name, catalog, schema);
          // Same guard as the live path, so a preview grades what would
          // actually be written rather than the raw read.
          for (const row of dropSummarySpans(out.seasons).kept) {
            const v = validateSeason(row);
            extracted.push({
              ...row,
              open_date: v.dates.open,
              close_date: v.dates.close,
              zone: row.zone ?? 'Statewide',
              _confidence: scoreConfidence(row, v),
              _errors: v.errors,
            });
          }
        } catch (e) {
          errors.push(`${source.url}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      let cur = admin.from('seasons')
        .select('id,method,label,season_year,open_date,close_date,species_id,zone:zones(name)')
        .eq('state_id', (state as any).id).eq('status', 'published');
      if (season_year) cur = cur.eq('season_year', season_year);
      const { data: currentRows } = await cur.limit(1000);

      const current = (currentRows ?? []).map((r: any) => ({
        id: r.id,
        species: keyById[r.species_id] ?? r.species_id,
        zone: r.zone?.name ?? 'Statewide',
        method: r.method,
        label: r.label,
        season_year: r.season_year,
        open_date: r.open_date,
        close_date: r.close_date,
      }));

      const report = accuracyReport(extracted, current);
      const lowConfidence = extracted.filter((r) => r._confidence < LOW_CONFIDENCE).length;

      return json({
        mode: 'accuracy',
        state: (state as any).name,
        season_year: season_year ?? 'all published',
        sources_read: srcs.length,
        source_errors: errors,
        low_confidence_rows: lowConfidence,
        ...report,
        wrote_nothing: true,
      });
    }

    // Pick the source(s) to process.
    let sources: any[] = [];
    if (sourceId) {
      const { data } = await admin.from('sources').select('*').eq('id', sourceId).single();
      if (data) sources = [data];
    } else if (gaps) {
      // Gap mode: go where the holes are instead of round-robin.
      //
      // Round-robin reads every source every ~2.5 weeks whether or not anything
      // is missing from it, which is why duck in WV could sit empty through the
      // whole season — its turn simply hadn't come up. coverage-watch has
      // already worked out which pairs are actually broken and which source
      // answers each one; this follows that list, worst first.
      const { data: rows, error: gapErr } = await admin.from('coverage_gaps')
        .select('source_id, priority')
        .in('kind', ['stale_in_season', 'never_covered'])
        .not('source_id', 'is', null);
      if (gapErr) return json({ error: `could not read coverage_gaps: ${gapErr.message}` }, 500);

      // Several gaps usually point at one source; read it once, at its worst.
      const prio = worstPriorityBySource(
        (rows ?? []) as { source_id?: string | null; priority?: number | null }[],
      );

      if (prio.size) {
        const { data, error: srcErr } = await admin.from('sources').select('*').in('id', [...prio.keys()]);
        if (srcErr) return json({ error: `could not read the gap sources: ${srcErr.message}` }, 500);
        // Worst gap first, then the stalest -- see _shared/gap_order.ts for why
        // priority on its own would re-read the same eight sources for ever.
        sources = orderGapSources(
          (data ?? []) as { id: string; last_extracted_at?: string | null }[],
          prio,
          max ?? 3,
        );
      }

      if (sources.length === 0) {
        return json({ ok: true, mode: 'gaps', sources: 0, results: [], note: 'no actionable gaps with a source' });
      }
    } else if (draws) {
      // --- draws mode ------------------------------------------------------
      // Re-read the application-deadline pages, stalest first.
      //
      // These pages cannot reach the queue any other way. Gap mode is driven by
      // coverage_gaps, which counts state × species SEASON rows; a state whose
      // seasons are all published carries no gap, so its draw page is never
      // picked however stale it is. The round-robin below would reach it, but
      // nothing runs the round-robin -- the only nightly cron asks for gaps.
      //
      // The result: every western deadline page sat unread since July 2026,
      // and the 2027 windows that the January draw season turns on were not in
      // the database at all.
      const { data, error: drawErr } = await admin.from('sources').select('*')
        .not('state_id', 'is', null)
        .eq('purpose', 'seasons')
        .eq('carries_draws', true);
      if (drawErr) return json({ error: `could not read the draw sources: ${drawErr.message}` }, 500);
      sources = orderDrawSources(
        (data ?? []) as { id: string; last_extracted_at?: string | null }[],
        max ?? 3,
      );
      if (sources.length === 0) {
        return json({ ok: true, mode: 'draws', sources: 0, results: [], note: 'no source flagged carries_draws' });
      }
    } else {
      // Round-robin: the stalest sources first, so hourly cron cycles through all.
      //
      // purpose='seasons' matters: `sources` also holds the agencies' leftover
      // and over-the-counter tag pages, which ingest-leftover-tags owns. Without
      // this filter the round-robin would hand a licence-sale page to the season
      // extractor and it would propose nonsense into review_queue every night.
      const { data } = await admin.from('sources').select('*')
        .not('state_id', 'is', null)
        .eq('purpose', 'seasons')
        .order('last_extracted_at', { ascending: true, nullsFirst: true })
        .limit(Math.min(Math.max(max ?? 1, 1), 25));
      sources = data ?? [];
    }
    if (sources.length === 0) return json({ error: 'no source with a state_id to process' }, 404);

    const runId = crypto.randomUUID();
    const { data: species } = await admin.from('species').select('id, key, name').order('sort_order');
    const speciesByKey = Object.fromEntries((species ?? []).map((s: any) => [s.key, s.id]));
const catalog = speciesCatalog((species ?? []) as { key: string; name: string }[]);
    const schema = extractionSchema((species ?? []).map((s: any) => s.key));

    // Process sequentially; isolate per-source errors so one bad source doesn't
    // abort the whole run.
    //
    // And stop before the wall clock stops us. `max` is what the caller wants,
    // not what the night can carry -- see _shared/time_budget.ts for the run
    // that asked for eight, read two, and recorded a third it never opened.
    const results = [];
    let longestMs: number | null = null;
    let stoppedForTime = 0;
    for (const source of sources) {
      if (!timeForAnother(Date.now() - startedAt, longestMs)) {
        stoppedForTime = sources.length - results.length;
        break;
      }
      const t0 = Date.now();
      try {
        results.push(await processSource(source, runId, speciesByKey, catalog, schema, force === true));
      } catch (e) {
        await admin.from('sources').update({ last_extracted_at: new Date().toISOString() }).eq('id', source.id);
        results.push({ source: source.agency_name, url: source.url, error: e instanceof Error ? e.message : String(e) });
      }
      const took = Date.now() - t0;
      longestMs = longestMs === null ? took : Math.max(longestMs, took);
    }

    return json({
      ok: true,
      run_id: runId,
      sources: results.length,
      // Never silently: a run that was asked for eight and did two says so.
      asked_for: sources.length,
      unread_out_of_time: stoppedForTime,
      // Hoisted out of the per-source tallies: a night that lost proposals has
      // to say so in the first line of the response, not the twelfth.
      proposals_lost: results.reduce((n, r) => n + Number((r as { lost?: number }).lost ?? 0), 0),
      elapsed_ms: Date.now() - startedAt,
      results,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
