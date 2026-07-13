// extract-source — Phase 2 automated refresh (proof of concept).
//
// Fetches one official source, asks Claude to extract structured season data,
// diffs it against the current rows, and enqueues proposed changes into
// review_queue. NOTHING is published — an admin approves each item in-app.
//
// Deploy:  supabase functions deploy extract-source
// Secrets: ANTHROPIC_API_KEY (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected)
// Invoke:  POST { "sourceId": "<uuid>" }   (defaults to the GA deer source)
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MODEL = 'claude-opus-4-8';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

// Structured-output schema. Constraints: additionalProperties:false, every key
// in `required`, no min/max/length (unsupported by structured outputs).
const EXTRACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    seasons: {
      type: 'array',
      items: {
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
      },
    },
  },
  required: ['seasons'],
};

const SYSTEM = `You extract U.S. hunting season data from official state wildlife-agency documents.
Rules:
- Only report seasons you can read directly in the document. Never guess.
- Dates must be ISO format YYYY-MM-DD, or null if the document does not state an exact date.
- species must be one of: deer, elk, bear, duck. method one of: archery, muzzleloader, firearm, general.
- zone is the geographic zone name (use "Statewide" if the season applies statewide).
- season_year is the license/season year the dates belong to (e.g. 2026 for a 2026-27 season).
- Prefer a concise label for the specific season variant (e.g. "1st Rifle", "Primitive Weapons").`;

async function fetchDocumentBlock(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
  if (url.toLowerCase().endsWith('.pdf') || res.headers.get('content-type')?.includes('pdf')) {
    const buf = new Uint8Array(await res.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: btoa(bin) } };
  }
  // HTML → crude text strip (good enough for extraction; the model tolerates noise).
  const html = await res.text();
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 120_000);
  return { type: 'text', text };
}

async function extractSeasons(doc: any, agency: string): Promise<any[]> {
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
      system: SYSTEM,
      output_config: { format: { type: 'json_schema', schema: EXTRACTION_SCHEMA } },
      messages: [{
        role: 'user',
        content: [doc, { type: 'text', text: `This document is from ${agency}. Extract every hunting season it lists.` }],
      }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const textBlock = (data.content ?? []).find((b: any) => b.type === 'text');
  if (!textBlock) throw new Error('no text block in model response');
  return JSON.parse(textBlock.text).seasons ?? [];
}

// Resolve a zone by name within a state, creating it if missing (service role).
async function resolveZoneId(stateId: string, zoneName: string): Promise<string> {
  const name = zoneName?.trim() || 'Statewide';
  const { data: existing } = await admin.from('zones').select('id').eq('state_id', stateId).eq('name', name).maybeSingle();
  if (existing) return existing.id;
  const type = /flyway|duck zone/i.test(name) ? 'flyway_zone' : /gmu|unit|hunt area/i.test(name) ? 'gmu' : name.toLowerCase() === 'statewide' ? 'statewide' : 'county_group';
  const { data: created, error } = await admin.from('zones').insert({ state_id: stateId, name, type }).select('id').single();
  if (error) throw error;
  return created.id;
}

Deno.serve(async (req) => {
  try {
    const { sourceId } = req.method === 'POST' ? await req.json().catch(() => ({})) : {};

    // Default to a Georgia deer source for the PoC.
    let source;
    if (sourceId) {
      ({ data: source } = await admin.from('sources').select('*').eq('id', sourceId).single());
    } else {
      ({ data: source } = await admin.from('sources').select('*').ilike('url', '%Season%Dates%').limit(1).single());
    }
    if (!source) return json({ error: 'source not found' }, 404);
    if (!source.state_id) return json({ error: 'source has no state_id; set it first' }, 400);

    const runId = crypto.randomUUID();
    const doc = await fetchDocumentBlock(source.url);
    const extracted = await extractSeasons(doc, source.agency_name);

    const { data: species } = await admin.from('species').select('id, key');
    const speciesByKey = Object.fromEntries((species ?? []).map((s: any) => [s.key, s.id]));

    let created = 0, updated = 0, unchanged = 0;
    for (const row of extracted) {
      const species_id = speciesByKey[row.species];
      if (!species_id) continue;
      const zone_id = await resolveZoneId(source.state_id, row.zone);

      // Find the current row for this exact (state, species, zone, method, year).
      const { data: current } = await admin.from('seasons').select('*')
        .eq('state_id', source.state_id).eq('species_id', species_id)
        .eq('zone_id', zone_id).eq('method', row.method).eq('season_year', row.season_year)
        .maybeSingle();

      const payload = {
        state_id: source.state_id, species_id, zone_id, season_year: row.season_year,
        method: row.method, label: row.label, open_date: row.open_date, close_date: row.close_date,
        bag_limit_summary: row.bag_limit_summary, notes: row.notes, source_id: source.id,
      };

      if (!current) {
        await admin.from('review_queue').insert({
          target_table: 'seasons', change_type: 'create', proposed_payload: payload,
          source_id: source.id, extraction_run_id: runId,
        });
        created++;
      } else if (current.open_date !== row.open_date || current.close_date !== row.close_date) {
        await admin.from('review_queue').insert({
          target_table: 'seasons', change_type: 'update', target_id: current.id,
          proposed_payload: payload, current_snapshot: current, source_id: source.id, extraction_run_id: runId,
        });
        updated++;
      } else {
        unchanged++;
      }
    }

    return json({ ok: true, source: source.agency_name, run_id: runId, extracted: extracted.length, created, updated, unchanged });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
