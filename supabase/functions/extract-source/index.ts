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
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Sonnet 5: structured extraction from a document doesn't need Opus-tier
// reasoning, and Sonnet is roughly 5x cheaper per call — meaningful for an
// hourly cron over 13+ sources. Every extraction is still human-reviewed
// before publishing (review_queue), so this doesn't change the safety net.
const MODEL = 'claude-sonnet-5';

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

// Structured-output schema. Constraints: additionalProperties:false, every key
// in `required`, no min/max/length (unsupported by structured outputs).
const SEASON_ITEM = {
  type: 'object',
  additionalProperties: false,
  properties: {
    species: { type: 'string', enum: ['deer', 'elk', 'bear', 'duck'] },
    method: { type: 'string', enum: ['archery', 'muzzleloader', 'firearm', 'general'] },
    zone: { type: 'string' },
    label: { type: ['string', 'null'] },
    season_year: { type: 'integer' },
    open_date: { type: ['string', 'null'] },
    close_date: { type: ['string', 'null'] },
    bag_limit_summary: { type: ['string', 'null'] },
    notes: { type: ['string', 'null'] },
  },
  required: ['species', 'method', 'zone', 'label', 'season_year', 'open_date', 'close_date', 'bag_limit_summary', 'notes'],
};

const WINDOW_ITEM = {
  type: 'object',
  additionalProperties: false,
  properties: {
    species: { type: 'string', enum: ['deer', 'elk', 'bear', 'duck'] },
    zone: { type: ['string', 'null'] },
    season_year: { type: 'integer' },
    name: { type: ['string', 'null'] },
    opens_at: { type: ['string', 'null'] },
    closes_at: { type: ['string', 'null'] },
    results_expected_at: { type: ['string', 'null'] },
    fee_summary: { type: ['string', 'null'] },
    application_url: { type: ['string', 'null'] },
  },
  required: ['species', 'zone', 'season_year', 'name', 'opens_at', 'closes_at', 'results_expected_at', 'fee_summary', 'application_url'],
};

const REG_ITEM = {
  type: 'object',
  additionalProperties: false,
  properties: {
    species: { type: 'string', enum: ['deer', 'elk', 'bear', 'duck'] },
    body: { type: 'string' },
  },
  required: ['species', 'body'],
};

const EXTRACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    seasons: { type: 'array', items: SEASON_ITEM },
    application_windows: { type: 'array', items: WINDOW_ITEM },
    regulation_summaries: { type: 'array', items: REG_ITEM },
  },
  required: ['seasons', 'application_windows', 'regulation_summaries'],
};

const SYSTEM = `You extract U.S. hunting data from official state wildlife-agency documents.
Rules:
- Only report data you can read directly in the document. NEVER guess. If a document
  is a season-dates chart with no draw/application info, return application_windows: [].
  If it has no season tables, return seasons: []. Same for regulation_summaries.
- Dates must be ISO YYYY-MM-DD, or null if the document does not state an exact date.
- NEVER write editorial notes, placeholders, or "TODO" text in any field. If a value
  (results date, fee, bag limit, etc.) is not stated in the document, use null — never a
  sentence describing what is missing. Fields are for facts from the document only.
- seasons: method one of archery, muzzleloader, firearm, general. zone is the geographic
  zone name ("Statewide" if statewide). season_year is the license year (2026 for a
  2026-27 season). label is a concise variant name ("1st Rifle", "Primitive Weapons").
- application_windows are tag/permit DRAW deadlines. closes_at is THE application deadline.
  name is the draw's name and must NOT repeat the species — use "Primary Draw", not "Elk
  Primary Draw" (the species is a separate field). zone null if not zone-specific.
  application_url is the page where hunters apply, if the document states one.
- regulation_summaries: a short markdown summary of the key rules for that species in
  this state (bag limits, legal weapons, license requirements). Keep it factual and brief.`;

// The set of valid species keys is injected per-run from the DB (see handler), so
// the model can extract every huntable species — not a hardcoded few. Maps common
// document synonyms onto our keys and tells the model to drop anything unlisted.
function speciesCatalog(species: { key: string; name: string }[]): string {
  const list = species.map((s) => `${s.key} (${s.name})`).join(', ');
  return `\n- species MUST be one of these keys — output the KEY (left), not the name: ${list}.
  Map document terms to the closest key: "antelope"->pronghorn, "cougar"/"puma"/"mountain lion"->mountain-lion,
  "whitetail"/"white-tailed deer"/"mule deer"/"blacktail"->deer, "ducks"->duck, "geese"->goose,
  "grizzly"->brown-bear, "black bear"->bear, "wild boar"/"feral hog"/"wild pig"->wild-hog,
  "cottontail"/"jackrabbit"->rabbit, "gray/Hungarian partridge"->gray-partridge. If an animal
  in the document has no matching key, OMIT it — never invent a key.`;
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

async function fetchDocumentBlock(url: string): Promise<any> {
  const res = await fetch(url, { headers: BROWSER_HEADERS });
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
  if (url.toLowerCase().endsWith('.pdf') || res.headers.get('content-type')?.includes('pdf')) {
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length > MAX_PDF_BYTES) {
      throw new Error(`PDF too large to extract in-worker (${(buf.length / 1e6).toFixed(1)} MB)`);
    }
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: bytesToBase64(buf) } };
  }
  const html = await res.text();
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 120_000);
  return { type: 'text', text };
}

async function extract(doc: any, agency: string, catalog: string): Promise<{ seasons: any[]; application_windows: any[]; regulation_summaries: any[] }> {
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
      output_config: { format: { type: 'json_schema', schema: EXTRACTION_SCHEMA } },
      messages: [{
        role: 'user',
        content: [doc, { type: 'text', text: `This document is from ${agency}. Extract everything it lists.` }],
      }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
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

type Tally = { created: number; updated: number; unchanged: number; skipped: number };
const emptyTally = (): Tally => ({ created: 0, updated: 0, unchanged: 0, skipped: 0 });

async function processSource(source: any, runId: string, speciesByKey: Record<string, string>, catalog: string) {
  // Stamp FIRST so the round-robin advances even if this source later kills the
  // worker (a huge PDF hitting the memory/CPU limit, or a slow site hitting the
  // 150s wall clock). Otherwise last_extracted_at stays null and the same poison
  // source gets re-picked forever, stalling the sweep.
  await admin.from('sources').update({ last_extracted_at: new Date().toISOString() }).eq('id', source.id);
  const doc = await fetchDocumentBlock(source.url);
  const { seasons, application_windows, regulation_summaries } = await extract(doc, source.agency_name, catalog);
  const t = emptyTally();

  // --- seasons ---
  for (const row of seasons) {
    const species_id = speciesByKey[row.species];
    if (!species_id) { t.skipped++; continue; }
    const zone_id = await resolveZoneId(source.state_id, row.zone, false);
    const { data: current } = await admin.from('seasons').select('*')
      .eq('state_id', source.state_id).eq('species_id', species_id)
      .eq('zone_id', zone_id!).eq('method', row.method).eq('season_year', row.season_year)
      .maybeSingle();
    const payload = {
      state_id: source.state_id, species_id, zone_id, season_year: row.season_year,
      method: row.method, label: row.label, open_date: row.open_date, close_date: row.close_date,
      bag_limit_summary: row.bag_limit_summary, notes: row.notes, source_id: source.id,
    };
    if (!current) {
      if (await pendingExists('seasons', null, { state_id: source.state_id, species_id, zone_id, method: row.method, season_year: row.season_year })) { t.skipped++; continue; }
      await admin.from('review_queue').insert({ target_table: 'seasons', change_type: 'create', proposed_payload: payload, source_id: source.id, extraction_run_id: runId });
      t.created++;
    } else if (current.open_date !== row.open_date || current.close_date !== row.close_date) {
      if (await pendingExists('seasons', current.id, {})) { t.skipped++; continue; }
      await admin.from('review_queue').insert({ target_table: 'seasons', change_type: 'update', target_id: current.id, proposed_payload: payload, current_snapshot: current, source_id: source.id, extraction_run_id: runId });
      t.updated++;
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
    const { data: current } = await match.maybeSingle();
    const payload = {
      state_id: source.state_id, species_id, zone_id, season_year: row.season_year,
      name: row.name, opens_at: row.opens_at, closes_at: row.closes_at,
      results_expected_at: row.results_expected_at, fee_summary: row.fee_summary,
      application_url: row.application_url ?? source.url, source_id: source.id,
    };
    if (!current) {
      if (await pendingExists('application_windows', null, { state_id: source.state_id, species_id, season_year: row.season_year, name: row.name })) { t.skipped++; continue; }
      await admin.from('review_queue').insert({ target_table: 'application_windows', change_type: 'create', proposed_payload: payload, source_id: source.id, extraction_run_id: runId });
      t.created++;
    } else if (current.closes_at !== row.closes_at || current.opens_at !== row.opens_at) {
      if (await pendingExists('application_windows', current.id, {})) { t.skipped++; continue; }
      await admin.from('review_queue').insert({ target_table: 'application_windows', change_type: 'update', target_id: current.id, proposed_payload: payload, current_snapshot: current, source_id: source.id, extraction_run_id: runId });
      t.updated++;
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
      await admin.from('review_queue').insert({ target_table: 'regulation_summaries', change_type: 'create', proposed_payload: payload, source_id: source.id, extraction_run_id: runId });
      t.created++;
    } else if (current.body !== row.body) {
      if (await pendingExists('regulation_summaries', current.id, {})) { t.skipped++; continue; }
      await admin.from('review_queue').insert({ target_table: 'regulation_summaries', change_type: 'update', target_id: current.id, proposed_payload: payload, current_snapshot: current, source_id: source.id, extraction_run_id: runId });
      t.updated++;
    } else { t.unchanged++; }
  }

  return { source: source.agency_name, url: source.url, extracted: seasons.length + application_windows.length + regulation_summaries.length, ...t };
}

Deno.serve(async (req) => {
  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!isServiceRole(token)) {
      return json({ error: 'forbidden: service role required' }, 403);
    }

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const { sourceId, max } = body as { sourceId?: string; max?: number };

    // Pick the source(s) to process.
    let sources: any[] = [];
    if (sourceId) {
      const { data } = await admin.from('sources').select('*').eq('id', sourceId).single();
      if (data) sources = [data];
    } else {
      // Round-robin: the stalest sources first, so hourly cron cycles through all.
      const { data } = await admin.from('sources').select('*')
        .not('state_id', 'is', null)
        .order('last_extracted_at', { ascending: true, nullsFirst: true })
        .limit(Math.min(Math.max(max ?? 1, 1), 25));
      sources = data ?? [];
    }
    if (sources.length === 0) return json({ error: 'no source with a state_id to process' }, 404);

    const runId = crypto.randomUUID();
    const { data: species } = await admin.from('species').select('id, key, name').order('sort_order');
    const speciesByKey = Object.fromEntries((species ?? []).map((s: any) => [s.key, s.id]));
    const catalog = speciesCatalog((species ?? []) as { key: string; name: string }[]);

    // Process sequentially; isolate per-source errors so one bad source doesn't
    // abort the whole run.
    const results = [];
    for (const source of sources) {
      try {
        results.push(await processSource(source, runId, speciesByKey, catalog));
      } catch (e) {
        await admin.from('sources').update({ last_extracted_at: new Date().toISOString() }).eq('id', source.id);
        results.push({ source: source.agency_name, url: source.url, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return json({ ok: true, run_id: runId, sources: results.length, results });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
