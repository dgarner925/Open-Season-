// ask-book — natural-language questions against OUR data, never the model's memory.
//
// The hunter types a question into the search field; Claude is given four tools
// that run real queries, and is told in the plainest terms that anything it
// cannot read from a tool result does not exist. It ends by calling
// submit_answer, whose strict schema gives us the JSON the UI renders.
//
// Two independent guards sit between the model and the user:
//   1. The system prompt forbids answering from prior knowledge.
//   2. checkGrounding() rejects any answer stating a date no tool returned.
// A rejected answer degrades to "not covered" plus the official regs link —
// never a guess.
//
// Deploy:  supabase functions deploy ask-book
// Secrets: ANTHROPIC_API_KEY (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY injected)
//          ASK_BOOK_MODEL (optional, defaults below)
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@1';
import { checkGrounding, normalizeQuestion } from '../_shared/grounding.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Haiku: user-facing search wants latency and a price that survives being free
// to try. Model ID lives in config, never hardcoded in a prompt or the client.
const MODEL = Deno.env.get('ASK_BOOK_MODEL') ?? 'claude-haiku-5-5';
const MAX_TOKENS = Number(Deno.env.get('ASK_BOOK_MAX_TOKENS') ?? 1200);
const FREE_TRIAL_QUESTIONS = Number(Deno.env.get('ASK_BOOK_FREE_TRIAL') ?? 3);
const PRO_DAILY_LIMIT = Number(Deno.env.get('ASK_BOOK_DAILY_LIMIT') ?? 25);
const MAX_TOOL_ROUNDS = 5;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const DISCLAIMER = 'Always confirm with official state regulations.';

// ---------------------------------------------------------------------------
// Tools — each one is a real query. Descriptions are written for the model.
// ---------------------------------------------------------------------------
const TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_seasons',
    description:
      'Published hunting seasons. Filter by state (2-letter code), and optionally species name, ' +
      'method, or a date range the season must overlap. Returns season_id for each row — cite it.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        state_code: { type: 'string', description: 'Two-letter state code, e.g. GA' },
        species: { type: 'string', description: 'Species name as hunters say it, e.g. Deer, Elk, Geese' },
        method: {
          type: 'string',
          description: 'Weapon/method if the question names one',
          enum: ['archery', 'muzzleloader', 'firearm', 'general'],
        },
        overlaps_from: { type: 'string', description: 'ISO date; season must still be open on/after this' },
        overlaps_to: { type: 'string', description: 'ISO date; season must open on/before this' },
      },
      required: ['state_code'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_season_detail',
    description: 'Everything on one season: dates, bag limit, notes, zone, and when it was last verified.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { season_id: { type: 'string' } },
      required: ['season_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_draw_deadlines',
    description: 'Published tag/draw application windows for a state, with the closing date for each.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        state_code: { type: 'string' },
        species: { type: 'string' },
        closes_before: { type: 'string', description: 'ISO date' },
      },
      required: ['state_code'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_official_regs_link',
    description: 'The official agency name and regulation URLs for a state. Use this whenever you cannot answer.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { state_code: { type: 'string' } },
      required: ['state_code'],
      additionalProperties: false,
    },
  },
  {
    name: 'submit_answer',
    description:
      'Deliver the final answer. Call this exactly once, last. Every date in `answer` must have come ' +
      'from a tool result in this conversation. If the data does not cover the question, set ' +
      'not_covered true and say so plainly in one sentence.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        answer: { type: 'string', description: 'One to three plain sentences. Numerals, not spelled-out numbers.' },
        season_ids: { type: 'array', items: { type: 'string' }, description: 'Season ids the answer rests on' },
        citations: {
          type: 'array',
          description: 'One per source record the answer used',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string', description: 'e.g. "GA 2026-27 season dates"' },
              state_code: { type: 'string' },
              season_year: { type: 'integer' },
              record_id: { type: 'string' },
            },
            required: ['label', 'state_code'],
            additionalProperties: false,
          },
        },
        not_covered: { type: 'boolean' },
      },
      required: ['answer', 'season_ids', 'citations', 'not_covered'],
      additionalProperties: false,
    },
  },
];

const SYSTEM = `You answer hunting-season questions for the Open Season app.

ABSOLUTE RULE: you have no knowledge of hunting regulations. Everything you say
must come from a tool result in this conversation. You may not recall, infer,
estimate, or "remember" a date, bag limit, zone, or rule. If the tools do not
return what the question needs, call get_official_regs_link and answer with
not_covered = true, saying plainly that the app does not have it and pointing to
the state's official regulations.

How to work:
- Resolve the state first. If the question names no state, use the user's state
  given below. If there is none, ask for one via not_covered.
- Call the tools you need, then call submit_answer exactly once.
- Keep the answer to 1-3 sentences, in plain words a hunter would use.
- Use numerals for dates and counts.
- Never mention tools, databases, queries, or yourself.
- Cite every record the answer rests on.

You are answering on ${new Date().toISOString().slice(0, 10)}.`;

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------
async function stateIdOf(code: string): Promise<{ id: string; name: string } | null> {
  const { data } = await admin
    .from('states')
    .select('id,name')
    .eq('code', code.trim().toUpperCase())
    .maybeSingle();
  return (data as any) ?? null;
}

async function runTool(name: string, input: any): Promise<unknown> {
  if (name === 'get_seasons') {
    const st = await stateIdOf(input.state_code);
    if (!st) return { error: 'unknown state' };
    let q = admin
      .from('seasons')
      .select('id,open_date,close_date,method,label,season_year,bag_limit_summary,species:species(name),zone:zones(name)')
      .eq('state_id', st.id)
      .eq('status', 'published')
      .order('open_date', { ascending: true })
      .limit(25);
    if (input.method) q = q.eq('method', input.method);
    if (input.overlaps_from) q = q.or(`close_date.gte.${input.overlaps_from},close_date.is.null`);
    if (input.overlaps_to) q = q.lte('open_date', input.overlaps_to);
    const { data, error } = await q;
    if (error) return { error: error.message };
    let rows = (data ?? []) as any[];
    if (input.species) {
      const want = String(input.species).toLowerCase();
      rows = rows.filter((r) => (r.species?.name ?? '').toLowerCase().includes(want));
    }
    return {
      state: st.name,
      seasons: rows.map((r) => ({
        season_id: r.id,
        species: r.species?.name,
        method: r.method,
        label: r.label,
        zone: r.zone?.name,
        season_year: r.season_year,
        open_date: r.open_date,
        close_date: r.close_date,
        bag_limit: r.bag_limit_summary,
      })),
    };
  }

  if (name === 'get_season_detail') {
    const { data, error } = await admin
      .from('seasons')
      .select(
        'id,open_date,close_date,method,label,season_year,bag_limit_summary,notes,last_verified_at,' +
          'species:species(name),zone:zones(name),state:states(code,name)',
      )
      .eq('id', input.season_id)
      .eq('status', 'published')
      .maybeSingle();
    if (error) return { error: error.message };
    if (!data) return { error: 'not found' };
    const r = data as any;
    return {
      season_id: r.id,
      state: r.state?.name,
      state_code: r.state?.code,
      species: r.species?.name,
      method: r.method,
      label: r.label,
      zone: r.zone?.name,
      season_year: r.season_year,
      open_date: r.open_date,
      close_date: r.close_date,
      bag_limit: r.bag_limit_summary,
      notes: r.notes,
      last_verified_at: r.last_verified_at,
    };
  }

  if (name === 'get_draw_deadlines') {
    const st = await stateIdOf(input.state_code);
    if (!st) return { error: 'unknown state' };
    let q = admin
      .from('application_windows')
      .select('id,name,opens_at,closes_at,results_expected_at,fee_summary,season_year,species:species(name)')
      .eq('state_id', st.id)
      .eq('status', 'published')
      .order('closes_at', { ascending: true })
      .limit(25);
    if (input.closes_before) q = q.lte('closes_at', input.closes_before);
    const { data, error } = await q;
    if (error) return { error: error.message };
    let rows = (data ?? []) as any[];
    if (input.species) {
      const want = String(input.species).toLowerCase();
      rows = rows.filter((r) => (r.species?.name ?? '').toLowerCase().includes(want));
    }
    return {
      state: st.name,
      draws: rows.map((r) => ({
        window_id: r.id,
        species: r.species?.name,
        name: r.name,
        opens_at: r.opens_at,
        closes_at: r.closes_at,
        results_expected_at: r.results_expected_at,
        fee: r.fee_summary,
        season_year: r.season_year,
      })),
    };
  }

  if (name === 'get_official_regs_link') {
    const code = String(input.state_code ?? '').trim().toUpperCase();
    const { data: st } = await admin
      .from('states')
      .select('id,name,agency_name,license_url')
      .eq('code', code)
      .maybeSingle();
    if (!st) return { error: 'unknown state' };
    const { data: srcs } = await admin
      .from('sources')
      .select('url,agency_name')
      .eq('state_id', (st as any).id)
      .limit(5);
    return {
      state: (st as any).name,
      agency: (st as any).agency_name,
      license_url: (st as any).license_url,
      regulation_urls: (srcs ?? []).map((s: any) => s.url),
    };
  }

  return { error: `unknown tool ${name}` };
}

// ---------------------------------------------------------------------------
// Entitlement + rate limiting
// ---------------------------------------------------------------------------
async function usageCount(userId: string, since?: string): Promise<number> {
  let q = admin
    .from('ai_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('feature', 'ask_book')
    .eq('served_from_cache', false)
    .eq('ok', true);
  if (since) q = q.gte('created_at', since);
  const { count } = await q;
  return count ?? 0;
}

async function logUsage(row: Record<string, unknown>) {
  await admin.from('ai_usage').insert({ feature: 'ask_book', model: MODEL, ...row });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'not signed in' }, 401);
    const { data: userRes } = await admin.auth.getUser(jwt);
    const user = userRes?.user;
    if (!user) return json({ error: 'not signed in' }, 401);

    const body = await req.json().catch(() => ({}));
    const question = String(body.question ?? '').trim();
    const stateCode = body.state_code ? String(body.state_code).toUpperCase() : null;
    if (question.length < 5) return json({ error: 'ask a question' }, 400);
    if (question.length > 300) return json({ error: 'question too long' }, 400);

    // --- entitlement -------------------------------------------------------
    const { data: profile } = await admin
      .from('profiles')
      .select('is_premium')
      .eq('id', user.id)
      .maybeSingle();
    const isPro = Boolean((profile as any)?.is_premium);

    if (!isPro) {
      const used = await usageCount(user.id);
      if (used >= FREE_TRIAL_QUESTIONS) {
        return json({ paywall: true, trial_used: used, trial_total: FREE_TRIAL_QUESTIONS });
      }
    } else {
      const since = new Date(Date.now() - 24 * 3600_000).toISOString();
      if ((await usageCount(user.id, since)) >= PRO_DAILY_LIMIT) {
        return json({ rate_limited: true, retry_after_hours: 24 }, 429);
      }
    }

    // --- cache -------------------------------------------------------------
    const today = new Date().toISOString().slice(0, 10);
    const cacheKey = await sha256(`${normalizeQuestion(question)}|${stateCode ?? ''}|${today}`);
    const { data: cached } = await admin
      .from('ai_answer_cache')
      .select('id,payload,hit_count')
      .eq('cache_key', cacheKey)
      .maybeSingle();
    if (cached) {
      await admin
        .from('ai_answer_cache')
        .update({ hit_count: ((cached as any).hit_count ?? 0) + 1, last_hit_at: new Date().toISOString() })
        .eq('id', (cached as any).id);
      await logUsage({ user_id: user.id, served_from_cache: true, note: 'cache hit' });
      return json({ ...(cached as any).payload, cached: true });
    }

    // --- the model ---------------------------------------------------------
    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: stateCode
          ? `${question}\n\n(The user's state is ${stateCode} unless the question names another.)`
          : question,
      },
    ];

    const toolResults: unknown[] = [];
    let submitted: any = null;
    let inTok = 0;
    let outTok = 0;

    for (let round = 0; round < MAX_TOOL_ROUNDS && !submitted; round++) {
      const res = await anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM,
        tools: TOOLS,
        output_config: { effort: 'low' },
        messages,
      });
      inTok += res.usage.input_tokens ?? 0;
      outTok += res.usage.output_tokens ?? 0;

      if (res.stop_reason === 'refusal') {
        await logUsage({ user_id: user.id, input_tokens: inTok, output_tokens: outTok, ok: false, note: 'refusal' });
        return json({ error: 'cannot answer that' }, 422);
      }

      messages.push({ role: 'assistant', content: res.content });

      const calls = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
      if (calls.length === 0) break;

      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const call of calls) {
        if (call.name === 'submit_answer') {
          submitted = call.input;
          results.push({ type: 'tool_result', tool_use_id: call.id, content: 'delivered' });
          continue;
        }
        const out = await runTool(call.name, call.input);
        toolResults.push(out);
        results.push({ type: 'tool_result', tool_use_id: call.id, content: JSON.stringify(out) });
      }
      messages.push({ role: 'user', content: results });
    }

    if (!submitted) {
      await logUsage({ user_id: user.id, input_tokens: inTok, output_tokens: outTok, ok: false, note: 'no submit_answer' });
      return json({ not_covered: true, answer: "I couldn't work that one out. Try rephrasing it.", citations: [], season_ids: [], disclaimer: DISCLAIMER });
    }

    // --- grounding guard ---------------------------------------------------
    const grounding = checkGrounding(String(submitted.answer ?? ''), toolResults);
    if (!grounding.ok) {
      await logUsage({
        user_id: user.id,
        input_tokens: inTok,
        output_tokens: outTok,
        ok: false,
        note: `ungrounded: ${grounding.unsupported.join(', ')}`,
      });
      const link = (await runTool('get_official_regs_link', { state_code: stateCode ?? 'GA' })) as any;
      return json({
        not_covered: true,
        answer: "I can't confirm that from our records — check the state's official regulations.",
        citations: [],
        season_ids: [],
        official_url: link?.license_url ?? null,
        disclaimer: DISCLAIMER,
      });
    }

    const payload = {
      answer: String(submitted.answer ?? '').trim(),
      citations: Array.isArray(submitted.citations) ? submitted.citations : [],
      season_ids: Array.isArray(submitted.season_ids) ? submitted.season_ids : [],
      not_covered: Boolean(submitted.not_covered),
      disclaimer: DISCLAIMER,
    };

    await admin.from('ai_answer_cache').insert({
      cache_key: cacheKey,
      question,
      state_code: stateCode,
      asked_on: today,
      payload,
    });
    await logUsage({ user_id: user.id, input_tokens: inTok, output_tokens: outTok, ok: true });

    return json(payload);
  } catch (e) {
    console.error('ask-book failed', e);
    return json({ error: 'ask-book failed' }, 500);
  }
});
