// coverage-watch — notice when the data rots, before a hunter does.
//
// scripts/audit_coverage.py counts holes. Counting was never the problem: on
// 2026-11-02 it read 106 gaps and the right response to ~95 of them was
// "nothing, the agency hasn't published next season yet". Buried in that noise
// were duck in IA/MT/OH/SC/WV and goose in MD/SC/WV — seasons that were OPEN,
// that followers were being told had "no dates yet", and that had been wrong
// for weeks because nobody ran the script and the script couldn't tell the two
// kinds apart anyway.
//
// So: classify every gap, and only ever surface the ones that are actually
// wrong. The classification is mostly arithmetic against our own history —
// project last season forward a year and see whether it should have opened by
// now. The model is used for the one judgement arithmetic can't make: whether
// a pair we've NEVER covered is a real hole or a bad state_species mapping
// (we list duck for Hawaii; Hawaii's waterfowl situation is not Iowa's).
//
// Deploy:  supabase functions deploy coverage-watch
// Secrets: ANTHROPIC_API_KEY (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY injected)
// Invoke:
//   POST {}              -> classify, write coverage_gaps, return the triage
//   POST { dry: true }   -> classify and return, write nothing
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MODEL = Deno.env.get('EXTRACT_MODEL') ?? 'claude-sonnet-5-5';
const SECRET_KEYS_RAW = Deno.env.get('SUPABASE_SECRET_KEYS') ?? '';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

// A season should be in hand before it opens, not after. Inside this many days
// of a projected opener, having nothing is a hole rather than patience.
const LEAD_DAYS = 45;

// Same guard as extract-source: this spends money and the app's publishable
// key ships in every build. See that file for why each branch exists.
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

/** Every row of a table, past PostgREST's 1000-row cap. */
async function all(table: string, select: string, filter?: (q: any) => any) {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    let q = admin.from(table).select(select).range(from, from + 999);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
    if ((data ?? []).length < 1000) return out;
  }
}

const DAY = 86_400_000;

const d = (iso: string) => new Date(iso + 'T00:00:00Z');
const iso = (x: Date) => x.toISOString().slice(0, 10);

/**
 * Project a past season's window forward by whole years until it is the next
 * one to come — i.e. until it closes in the future. Whole years, not 365 days,
 * so an opener keeps its own calendar date instead of drifting.
 *
 * Getting this wrong is subtle and expensive. A first cut advanced only until
 * the OPENER was recent, which left a season that opened 25 Sep and closed in
 * October reading as "should be open now" on 2 November — it flagged WY
 * pronghorn, ME moose and a dozen others that had simply ended. Anchor on the
 * close, not the open.
 */
function projectWindow(open: string, close: string | null, today: Date) {
  const o = d(open);
  const c = close ? d(close) : d(open);
  // A close before its open means the season wraps the new year (e.g. duck,
  // Oct–Jan); carry the close into the following year before projecting.
  if (c.getTime() < o.getTime()) c.setUTCFullYear(c.getUTCFullYear() + 1);
  while (c.getTime() < today.getTime()) {
    o.setUTCFullYear(o.getUTCFullYear() + 1);
    c.setUTCFullYear(c.getUTCFullYear() + 1);
  }
  return { open: o, close: c };
}

const SYSTEM = `You triage coverage holes for a US hunting-season database.

Each item is a (state, species) pair the app offers to follow but has no current
dates for, and which we have NEVER had dates for. Decide which of two things it is:

- "never_covered": the state really does run this season and we are simply
  missing it. Someone can go and find it.
- "not_huntable": the state does not offer a huntable season for this species at
  all, so the pair should not be offered to follow. Say so plainly.

Judge from what you know about that state's actual wildlife agency and its
seasons. Be conservative: if a state plausibly runs the season, call it
never_covered. Only use not_huntable when you are confident the season does not
exist there — no open season, no population, or the species is protected there.

Keep "detail" to one short sentence a busy admin can act on. No hedging.`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdicts'],
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['state', 'species', 'kind', 'detail'],
        properties: {
          state: { type: 'string' },
          species: { type: 'string' },
          kind: { type: 'string', enum: ['never_covered', 'not_huntable'] },
          detail: { type: 'string' },
        },
      },
    },
  },
};

async function classifyUnknowns(items: { state: string; species: string }[]) {
  if (items.length === 0) return [];
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{
        role: 'user',
        content: `Triage these ${items.length} pairs:\n` +
          items.map((i) => `${i.state} / ${i.species}`).join('\n'),
      }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const block = (data.content ?? []).find((b: any) => b.type === 'text');
  if (!block) throw new Error('no text block in model response');
  return JSON.parse(block.text).verdicts ?? [];
}

Deno.serve(async (req) => {
  try {
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!isServiceRole(token)) return json({ error: 'forbidden' }, 403);
    const body = await req.json().catch(() => ({}));
    const dry = body?.dry === true;

    const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
    const todayISO = today.toISOString().slice(0, 10);

    const states = await all('states', 'id, code, name');
    const species = await all('species', 'id, key, name');
    const stateById = Object.fromEntries(states.map((s) => [s.id, s]));
    const speciesById = Object.fromEntries(species.map((s) => [s.id, s]));

    const pairs = await all('state_species', 'state_id, species_id');

    // Covered = any published season still to close, or any draw window still
    // open. Mirrors scripts/audit_coverage.py exactly, so the two never disagree.
    const current = await all('seasons', 'state_id, species_id', (q) =>
      q.or(`close_date.gte.${todayISO},open_date.gte.${todayISO}`));
    const windows = await all('application_windows', 'state_id, species_id', (q) =>
      q.gte('closes_at', todayISO));
    const covered = new Set<string>([
      ...current.map((r) => `${r.state_id}|${r.species_id}`),
      ...windows.map((r) => `${r.state_id}|${r.species_id}`),
    ]);

    // History, for projecting forward. Latest window per pair.
    const history = await all('seasons', 'state_id, species_id, open_date, close_date');
    const lastWindow: Record<string, { open: string; close: string | null }> = {};
    for (const r of history) {
      if (!r.open_date) continue;
      const k = `${r.state_id}|${r.species_id}`;
      if (!lastWindow[k] || r.open_date > lastWindow[k].open) {
        lastWindow[k] = { open: r.open_date, close: r.close_date ?? null };
      }
    }

    // Cross-sectional signal: how many OTHER states have this species in season
    // right now. This is what catches a split season — Iowa's duck opener is in
    // our history but the late segment isn't, so projecting forward says
    // "next October" while ducks are being shot in eleven other states today.
    // Peers in season is the honest evidence that we are missing something live.
    // It has to be a SHARE, not a count. Two states with pronghorn open in
    // November does not mean Wyoming's pronghorn season is missing — it means
    // two states run late hunts and Wyoming's ended in October. Counting
    // states flagged 77 holes, most of them seasons that had simply finished.
    // Against the number of states that offer the species at all, duck reads
    // 44/48 and pronghorn reads 2/14, which is the real distinction.
    const peersInSeason: Record<string, Set<string>> = {};
    for (const r of current) {
      (peersInSeason[r.species_id] ??= new Set()).add(r.state_id);
    }
    const offering: Record<string, number> = {};
    for (const p of pairs) offering[p.species_id] = (offering[p.species_id] ?? 0) + 1;
    const PEER_SHARE = 0.5;   // most of the country is hunting it right now
    const PEER_FLOOR = 3;     // and it isn't just a couple of outliers

    // One source per state to aim the extractor at. Freshest-stale first so a
    // gap doesn't keep pointing at a source we just read.
    const sources = await all('sources', 'id, state_id, last_extracted_at', (q) =>
      q.not('state_id', 'is', null));
    const sourceByState: Record<string, string> = {};
    for (const s of sources) if (!sourceByState[s.state_id]) sourceByState[s.state_id] = s.id;

    const rows: any[] = [];
    const unknown: { state: string; species: string; state_id: string; species_id: string }[] = [];

    for (const p of pairs) {
      const key = `${p.state_id}|${p.species_id}`;
      if (covered.has(key)) continue;
      const st = stateById[p.state_id], sp = speciesById[p.species_id];
      if (!st || !sp) continue;

      const prior = lastWindow[key];
      if (!prior) {
        // No history at all — arithmetic can't help. Ask the model.
        unknown.push({ state: st.code, species: sp.key, state_id: p.state_id, species_id: p.species_id });
        continue;
      }
      const w = projectWindow(prior.open, prior.close, today);
      const daysOut = Math.round((w.open.getTime() - today.getTime()) / DAY);
      const peers = peersInSeason[p.species_id]?.size ?? 0;

      let kind: string, detail: string, priority: number;
      if (daysOut <= 0) {
        // Today falls inside the projected window: this should be open NOW.
        kind = 'stale_in_season';
        detail = `Season should be open now (${iso(w.open)}–${iso(w.close)}) and we have no current dates.`;
        priority = 200;
      } else if (daysOut <= LEAD_DAYS) {
        kind = 'stale_in_season';
        detail = `Opens in ${daysOut} days (${iso(w.open)}) and the dates aren't published here yet.`;
        priority = 150 - daysOut;
      } else if (peers >= PEER_FLOOR && peers / Math.max(offering[p.species_id] ?? 1, 1) >= PEER_SHARE) {
        // Out of season by our own history, yet most of the country is hunting
        // it today — almost always a split season whose later segment we never
        // captured, which is exactly the IA/OH duck case.
        kind = 'stale_in_season';
        detail = `${peers} of ${offering[p.species_id]} states have ${sp.key} open today while this one shows nothing — likely a missing late segment.`;
        priority = 100;
      } else {
        kind = 'out_of_season';
        detail = `Out of season — next window projected ${iso(w.open)}, ${daysOut} days out.`;
        priority = 0;
      }

      rows.push({
        state_id: p.state_id,
        species_id: p.species_id,
        kind,
        projected_open: iso(w.open),
        detail,
        source_id: sourceByState[p.state_id] ?? null,
        priority,
        checked_at: new Date().toISOString(),
      });
    }

    const verdicts = await classifyUnknowns(unknown.map(({ state, species }) => ({ state, species })));
    const verdictBy = Object.fromEntries(verdicts.map((v: any) => [`${v.state}|${v.species}`, v]));
    for (const u of unknown) {
      const v = verdictBy[`${u.state}|${u.species}`];
      const kind = v?.kind === 'not_huntable' ? 'not_huntable' : 'never_covered';
      rows.push({
        state_id: u.state_id,
        species_id: u.species_id,
        kind,
        projected_open: null,
        detail: v?.detail ?? 'Never covered; classifier returned no verdict.',
        source_id: kind === 'never_covered' ? (sourceByState[u.state_id] ?? null) : null,
        // Below any overdue season: a pair we've never had is a slower problem
        // than one that broke this week.
        priority: kind === 'never_covered' ? 1 : 0,
        checked_at: new Date().toISOString(),
      });
    }

    const counts = rows.reduce((a: Record<string, number>, r) => {
      a[r.kind] = (a[r.kind] ?? 0) + 1;
      return a;
    }, {});

    // The triage: what a human should actually look at.
    const actionable = rows
      .filter((r) => r.kind === 'stale_in_season' || r.kind === 'not_huntable')
      .sort((a, b) => b.priority - a.priority)
      .map((r) => ({
        state: stateById[r.state_id].code,
        species: speciesById[r.species_id].key,
        kind: r.kind,
        detail: r.detail,
      }));

    if (!dry && rows.length) {
      // Pairs that recovered since the last run must not linger as stale rows.
      const keep = new Set(rows.map((r) => `${r.state_id}|${r.species_id}`));
      const existing = await all('coverage_gaps', 'id, state_id, species_id');
      const dead = existing.filter((e) => !keep.has(`${e.state_id}|${e.species_id}`)).map((e) => e.id);
      if (dead.length) await admin.from('coverage_gaps').delete().in('id', dead);

      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await admin.from('coverage_gaps')
          .upsert(rows.slice(i, i + 200), { onConflict: 'state_id,species_id' });
        if (error) throw new Error(`upsert: ${error.message}`);
      }
    }

    return json({
      ok: true,
      dry,
      followable_pairs: pairs.length,
      gaps: rows.length,
      counts,
      actionable_count: actionable.length,
      actionable,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
