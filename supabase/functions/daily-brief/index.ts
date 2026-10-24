// daily-brief — one or two sentences about the hunter's own day.
//
// SQL decides what is true (daily_brief_facts). The model only puts those
// facts into a sentence, and if it adds a number our facts don't contain, we
// throw its version away and ship the deterministic one instead. The brief is
// therefore never wrong — at worst it is plainly worded.
//
// On demand, not cron: a per-user cron spends tokens on everyone who never
// opens the app, and this app has been bitten twice by crons dying quietly.
// One model call per user per day, cached; the app asks when Home mounts.
//
// Deploy:  supabase functions deploy daily-brief
// Secrets: ANTHROPIC_API_KEY (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY injected)
//          DAILY_BRIEF_PRO_ONLY ('true' to gate behind Pro; default free)
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@1';
import { checkBriefNumbers, composeBrief, hasSomethingToSay, type BriefFacts } from '../_shared/brief.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MODEL = Deno.env.get('DAILY_BRIEF_MODEL') ?? 'claude-haiku-5-5';
const MAX_TOKENS = Number(Deno.env.get('DAILY_BRIEF_MAX_TOKENS') ?? 200);
// Free by default: the brief is the taste of Pro, not the product. Flip to
// 'true' to gate it.
const PRO_ONLY = (Deno.env.get('DAILY_BRIEF_PRO_ONLY') ?? 'false').toLowerCase() === 'true';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const SYSTEM = `You write one short line for a hunting app's home screen.

You are given FACTS as JSON. Put them into at most 2 short sentences. You may
not add, infer, or embellish anything — no weather, no advice, no species,
states, dates or counts beyond what the FACTS contain. If a fact isn't there,
it doesn't exist.

Voice: plain, unhurried, the way a hunting buddy mentions something in passing.
Use numerals (3, not three). No greeting, no sign-off, no emoji, no quotes.
Never mention facts, data, JSON, or yourself.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'submit_brief',
    description: 'Deliver the finished line. Call this exactly once.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { brief: { type: 'string', description: 'At most 2 short sentences.' } },
      required: ['brief'],
      additionalProperties: false,
    },
  },
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'not signed in' }, 401);
    const { data: userRes } = await admin.auth.getUser(jwt);
    const user = userRes?.user;
    if (!user) return json({ error: 'not signed in' }, 401);

    if (PRO_ONLY) {
      const { data: profile } = await admin
        .from('profiles')
        .select('is_premium')
        .eq('id', user.id)
        .maybeSingle();
      if (!(profile as any)?.is_premium) return json({ brief: null, locked: true });
    }

    // --- facts first ------------------------------------------------------
    const { data: factsRaw, error: factsErr } = await admin.rpc('daily_brief_facts', { p_user_id: user.id });
    if (factsErr) throw factsErr;
    const facts = factsRaw as BriefFacts | null;
    if (!hasSomethingToSay(facts)) return json({ brief: null });

    const deterministic = composeBrief(facts!);
    const today = facts!.today;
    const cacheKey = `brief|${user.id}|${today}`;

    // --- cache ------------------------------------------------------------
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
      await admin.from('ai_usage').insert({
        user_id: user.id, feature: 'daily_brief', model: MODEL, served_from_cache: true, note: 'cache hit',
      });
      return json({ ...(cached as any).payload, cached: true });
    }

    // --- the model phrases it --------------------------------------------
    let brief = deterministic;
    let phrased = false;
    let inTok = 0;
    let outTok = 0;
    let note: string | null = null;

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
              `FACTS:\n${JSON.stringify(facts)}\n\n` +
              `For reference, these same facts stated plainly: "${deterministic}"\n` +
              'Write the line and call submit_brief.',
          },
        ],
      });
      inTok = res.usage.input_tokens ?? 0;
      outTok = res.usage.output_tokens ?? 0;

      if (res.stop_reason !== 'refusal') {
        const call = res.content.find(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'submit_brief',
        );
        const text = call
          ? String((call.input as any)?.brief ?? '')
          : res.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join(' ');

        const candidate = text.trim().replace(/^["']|["']$/g, '');
        const check = checkBriefNumbers(candidate, facts!);
        if (candidate && check.ok && candidate.length <= 240) {
          brief = candidate;
          phrased = true;
        } else {
          note = candidate ? `fell back: ${check.unsupported.join(', ') || 'too long'}` : 'fell back: empty';
        }
      } else {
        note = 'refusal';
      }
    } catch (e) {
      // The brief must never be the reason Home fails to render.
      note = `model error: ${e instanceof Error ? e.message : 'unknown'}`;
    }

    const payload = {
      brief,
      phrased,
      disclaimer: 'Always confirm with official state regulations.',
    };

    await admin.from('ai_answer_cache').insert({
      cache_key: cacheKey,
      question: 'daily_brief',
      state_code: null,
      asked_on: today,
      payload,
    });
    await admin.from('ai_usage').insert({
      user_id: user.id,
      feature: 'daily_brief',
      model: MODEL,
      input_tokens: inTok,
      output_tokens: outTok,
      ok: phrased,
      note,
    });

    return json(payload);
  } catch (e) {
    console.error('daily-brief failed', e);
    return json({ brief: null }, 200); // never break Home
  }
});
