// diff-regulation-year — what changed between two license years.
//
// Compares a state's published seasons for two season_years, record by record,
// in code. The model is handed the finished diffs and asked only to phrase
// them; any note that mentions a date its own diff doesn't contain is thrown
// away in favour of the deterministic sentence. Notes land in
// regulation_changes for the app to read.
//
// Deploy:  supabase functions deploy diff-regulation-year
// Secrets: ANTHROPIC_API_KEY (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY injected)
// Invoke (admin or service role):
//   POST { "state_code": "GA" }                      -> newest year vs the one before
//   POST { "state_code": "GA", "from_year": 2025, "to_year": 2026 }
//   POST { "state_code": "GA", "dry_run": true }     -> diff only, writes nothing
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@1';
import { checkGrounding } from '../_shared/grounding.ts';
import {
  composeChangeNote,
  diffSeasonYears,
  isNoteworthy,
  type RegChange,
  type SeasonRow,
} from '../_shared/regdiff.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MODEL = Deno.env.get('REG_DIFF_MODEL') ?? 'claude-haiku-5-5';
const MAX_TOKENS = Number(Deno.env.get('REG_DIFF_MAX_TOKENS') ?? 2000);
const MAX_CHANGES = Number(Deno.env.get('REG_DIFF_MAX_CHANGES') ?? 40);

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const SELECT =
  'id,species_id,zone_id,method,label,open_date,close_date,bag_limit_summary,notes,season_year,' +
  'species:species(name),zone:zones(name)';

const SYSTEM = `You rewrite regulation changes as single plain sentences for hunters.

You are given CHANGES as JSON, each with the facts of one change and a plainly
worded version of it. Rewrite each one so it reads naturally, and nothing more.

Hard rules:
- Never state a date, count, or limit that isn't in that change's own data.
- Never explain why a state made a change, or what it means for hunting.
- One sentence each. Numerals, not spelled-out numbers. No bullet characters.
- Keep the state name and the season's name as given.

Return every change you were given, by index, via submit_notes.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'submit_notes',
    description: 'Deliver one rewritten sentence per change. Call once, covering every index.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        notes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              index: { type: 'integer' },
              note: { type: 'string' },
            },
            required: ['index', 'note'],
            additionalProperties: false,
          },
        },
      },
      required: ['notes'],
      additionalProperties: false,
    },
  },
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function toSeasonRow(r: any): SeasonRow {
  return {
    id: r.id,
    species_id: r.species_id,
    species_name: r.species?.name ?? 'Season',
    zone_id: r.zone_id ?? null,
    zone_name: r.zone?.name ?? null,
    method: r.method,
    label: r.label ?? null,
    open_date: r.open_date ?? null,
    close_date: r.close_date ?? null,
    bag_limit_summary: r.bag_limit_summary ?? null,
    notes: r.notes ?? null,
    season_year: r.season_year,
  };
}

function dedupeKey(stateCode: string, c: RegChange): string {
  return [stateCode, c.change_type, c.old_id ?? '-', c.new_id ?? '-'].join('|');
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

    // Admin-only: this spends money and writes reference content.
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'unauthorized' }, 401);
    if (token !== SERVICE_ROLE) {
      const { data: userRes } = await admin.auth.getUser(token);
      const uid = userRes?.user?.id;
      if (!uid) return json({ error: 'unauthorized' }, 401);
      const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', uid).maybeSingle();
      if (!(profile as any)?.is_admin) return json({ error: 'admin only' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const stateCode = String(body.state_code ?? '').trim().toUpperCase();
    const dryRun = Boolean(body.dry_run);
    if (!stateCode) return json({ error: 'state_code required' }, 400);

    const { data: state } = await admin
      .from('states')
      .select('id,name')
      .eq('code', stateCode)
      .maybeSingle();
    if (!state) return json({ error: 'unknown state' }, 404);
    const stateId = (state as any).id;
    const stateName = (state as any).name;

    // Work out which years to compare when not told.
    let toYear = body.to_year ? Number(body.to_year) : null;
    let fromYear = body.from_year ? Number(body.from_year) : null;
    if (!toYear || !fromYear) {
      const { data: years } = await admin
        .from('seasons')
        .select('season_year')
        .eq('state_id', stateId)
        .eq('status', 'published')
        .order('season_year', { ascending: false })
        .limit(500);
      const distinct = [...new Set((years ?? []).map((r: any) => r.season_year))].sort((a, b) => b - a);
      if (distinct.length < 2) {
        return json({ state: stateName, changes: 0, note: 'only one license year on file — nothing to compare' });
      }
      toYear = toYear ?? distinct[0];
      fromYear = fromYear ?? distinct[1];
    }

    const [{ data: oldRows }, { data: newRows }] = await Promise.all([
      admin.from('seasons').select(SELECT).eq('state_id', stateId).eq('status', 'published').eq('season_year', fromYear),
      admin.from('seasons').select(SELECT).eq('state_id', stateId).eq('status', 'published').eq('season_year', toYear),
    ]);

    const all = diffSeasonYears((oldRows ?? []).map(toSeasonRow), (newRows ?? []).map(toSeasonRow));
    const changes = all.filter(isNoteworthy).slice(0, MAX_CHANGES);

    if (changes.length === 0) {
      return json({ state: stateName, from_year: fromYear, to_year: toYear, changes: 0 });
    }

    // Deterministic notes first — these ship if the model adds nothing safe.
    const notes = changes.map((c) => composeChangeNote(c, stateName));
    const phrased = new Array<boolean>(changes.length).fill(false);

    if (!dryRun || body.phrase !== false) {
      try {
        const res = await anthropic.messages.create({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: SYSTEM,
          tools: TOOLS,
          output_config: { effort: 'low' },
          messages: [
            {
              role: 'user',
              content:
                `State: ${stateName}\nCHANGES:\n` +
                JSON.stringify(
                  changes.map((c, i) => ({ index: i, plain: notes[i], data: c })),
                ),
            },
          ],
        });

        if (res.stop_reason !== 'refusal') {
          const call = res.content.find(
            (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'submit_notes',
          );
          for (const item of ((call?.input as any)?.notes ?? []) as { index: number; note: string }[]) {
            const i = Number(item.index);
            const candidate = String(item.note ?? '').trim();
            if (!changes[i] || !candidate || candidate.length > 300) continue;
            // Each note is checked against its OWN change — a sentence may not
            // borrow a date from a neighbouring one.
            if (checkGrounding(candidate, changes[i]).ok) {
              notes[i] = candidate;
              phrased[i] = true;
            }
          }
        }

        await admin.from('ai_usage').insert({
          feature: 'reg_diff',
          model: MODEL,
          input_tokens: res.usage.input_tokens ?? 0,
          output_tokens: res.usage.output_tokens ?? 0,
          ok: true,
          note: `${stateCode} ${fromYear}->${toYear}, ${changes.length} changes`,
        });
      } catch (e) {
        // Deterministic notes are already in hand; phrasing is a nicety.
        await admin.from('ai_usage').insert({
          feature: 'reg_diff',
          model: MODEL,
          ok: false,
          note: `phrasing failed: ${e instanceof Error ? e.message : 'unknown'}`,
        });
      }
    }

    const rows = changes.map((c, i) => ({
      state_id: stateId,
      species_id: (newRows ?? []).find((r: any) => r.id === c.new_id)?.species_id ??
        (oldRows ?? []).find((r: any) => r.id === c.old_id)?.species_id ?? null,
      target_table: 'seasons',
      change_type: c.change_type,
      old_id: c.old_id,
      new_id: c.new_id,
      old_year: c.old_year,
      new_year: c.new_year,
      field_diffs: c.field_diffs,
      note: notes[i],
      note_phrased: phrased[i],
      note_model: phrased[i] ? MODEL : null,
      dedupe_key: dedupeKey(stateCode, c),
    }));

    if (dryRun) {
      return json({ state: stateName, from_year: fromYear, to_year: toYear, changes: rows.length, preview: rows });
    }

    const { error } = await admin
      .from('regulation_changes')
      .upsert(rows, { onConflict: 'dedupe_key' });
    if (error) throw error;

    return json({
      state: stateName,
      from_year: fromYear,
      to_year: toYear,
      changes: rows.length,
      phrased: phrased.filter(Boolean).length,
    });
  } catch (e) {
    console.error('diff-regulation-year failed', e);
    return json({ error: 'diff failed' }, 500);
  }
});
