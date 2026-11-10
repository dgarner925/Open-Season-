#!/usr/bin/env node
/**
 * Turn a leftover tag sale you read on an agency page into SQL to paste.
 *
 * Why this exists
 * ---------------
 * Of the first eleven states researched, roughly half keep their leftover sale
 * date somewhere a machine cannot reliably reach: a press release (WY, NM), a
 * signed-in account page (ND), an annual PDF that is replaced each year (SD),
 * or behind a 403 (AZ). A scraper pointed at those is not automation, it is a
 * confident guess about the one field -- the date -- that the whole feature
 * exists to get right.
 *
 * So those states are entered by hand, once a year, when the agency announces
 * them. This script is the paving for that path: it validates what you type,
 * resolves state and species by code rather than making you find UUIDs, and
 * prints SQL safe to paste into the Supabase SQL editor.
 *
 * Manual entries publish directly rather than going through review_queue --
 * a human reading the agency's own announcement IS the review. Scraped sales
 * still go through the queue, because nothing read them.
 *
 * Usage
 * -----
 *   node scripts/leftover_sale.js --state WY --species pronghorn \
 *     --type leftover --name "Leftover antelope licences" \
 *     --start 2027-07-13 --time 08:00 \
 *     --url https://wgfd.wyo.gov/... --source https://wgfd.wyo.gov/news/...
 *
 *   node scripts/leftover_sale.js --file scratch/leftovers.json
 *
 * A JSON file holds an array of the same fields, long form, for a state that
 * announces several at once.
 *
 * Every flag:
 *   --state      two-letter code                     (required)
 *   --species    species.key, e.g. elk, mule_deer    (required)
 *   --type       leftover | otc | reissue            (default leftover)
 *   --name       what the agency calls it            (required)
 *   --start      YYYY-MM-DD                          (required)
 *   --time       HH:MM local, OMIT if not published  (optional)
 *   --end        YYYY-MM-DD                          (optional)
 *   --end-time   HH:MM local                         (optional)
 *   --zone       IANA zone; defaults to the state's  (optional)
 *   --residency  resident | nonresident | both       (default both)
 *   --unit       zone/unit code, if unit-scoped      (optional)
 *   --url        where to buy it                     (optional)
 *   --source     the page or release you read        (strongly encouraged)
 *   --notes      anything a hunter should know       (optional)
 */

'use strict';

const fs = require('fs');

const SALE_TYPES = ['leftover', 'otc', 'reissue'];
const RESIDENCY = { resident: ['resident'], nonresident: ['nonresident'], both: ['resident', 'nonresident'] };

// Zones the migration sets on states, so --zone can be checked without a round
// trip to the database. Not exhaustive for the world, only for the US.
const KNOWN_ZONES = new Set([
  'America/New_York', 'America/Detroit', 'America/Indiana/Indianapolis',
  'America/Chicago', 'America/Denver', 'America/Boise', 'America/Phoenix',
  'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu',
]);

const STATES = new Set(
  ('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ ' +
   'NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY').split(' '),
);

function fail(msg) {
  console.error(`\n  ${msg}\n`);
  process.exit(1);
}

/** Single-quote escaping for a SQL string literal, or NULL. */
function lit(v) {
  if (v === undefined || v === null || v === '') return 'null';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function normaliseTime(raw, label) {
  if (raw === undefined || raw === null || raw === '') return null;
  const m = String(raw).trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) fail(`${label} must look like HH:MM (24-hour). Got: ${raw}`);
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) fail(`${label} is not a real time: ${raw}`);
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}:${m[3] ?? '00'}`;
}

function validate(s) {
  const state = String(s.state ?? '').toUpperCase();
  if (!STATES.has(state)) fail(`--state must be a two-letter state code. Got: ${s.state}`);

  const species = String(s.species ?? '').trim();
  if (!/^[a-z0-9_]+$/.test(species)) {
    fail(`--species must be a species key like elk or mule_deer (lower case, underscores). Got: ${s.species}`);
  }

  const type = String(s.type ?? 'leftover');
  if (!SALE_TYPES.includes(type)) fail(`--type must be one of ${SALE_TYPES.join(', ')}. Got: ${type}`);

  const name = String(s.name ?? '').trim();
  if (!name) fail('--name is required: what the agency itself calls the sale.');

  const start = String(s.start ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) fail(`--start must be YYYY-MM-DD. Got: ${s.start}`);
  if (Number.isNaN(Date.parse(`${start}T12:00:00Z`))) fail(`--start is not a real date: ${start}`);

  const end = s.end ? String(s.end).trim() : null;
  if (end) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) fail(`--end must be YYYY-MM-DD. Got: ${s.end}`);
    if (end < start) fail(`--end (${end}) is before --start (${start}).`);
  }

  const time = normaliseTime(s.time, '--time');
  const endTime = normaliseTime(s['end-time'] ?? s.endTime, '--end-time');
  if (endTime && !end) fail('--end-time needs --end as well.');

  const zone = s.zone ? String(s.zone).trim() : null;
  if (zone && !KNOWN_ZONES.has(zone)) {
    fail(`--zone is not a US IANA zone this project knows: ${zone}\n  Known: ${[...KNOWN_ZONES].join(', ')}`);
  }

  const resKey = String(s.residency ?? 'both').toLowerCase();
  if (!RESIDENCY[resKey]) fail(`--residency must be resident, nonresident or both. Got: ${s.residency}`);

  for (const [flag, val] of [['--url', s.url], ['--source', s.source]]) {
    if (val && !/^https:\/\//.test(String(val))) fail(`${flag} must be an https URL. Got: ${val}`);
  }

  // The season year a sale belongs to: a January sale is selling tags for the
  // licence year that began the previous autumn.
  const [y, mo] = start.split('-').map(Number);
  const seasonYear = mo <= 3 ? y - 1 : y;

  if (!s.source) {
    console.error('  note: no --source given. Nothing enforces it, but a sale with no provenance');
    console.error('        cannot be re-checked next year by anyone but you.\n');
  }
  if (!time) {
    console.error('  note: no --time given, so the app will show the day alone. That is correct when');
    console.error('        the agency published no hour -- do not invent one.\n');
  }

  return {
    state, species, type, name, start, end, time, endTime, zone,
    residency: RESIDENCY[resKey], unit: s.unit ?? null,
    url: s.url ?? null, source: s.source ?? null, notes: s.notes ?? null,
    seasonYear,
  };
}

function toSql(sales) {
  const rows = sales.map((v) => {
    const zoneExpr = v.zone ? lit(v.zone) : '(select time_zone from public.states where code = ' + lit(v.state) + ')';
    const unitJoin = v.unit
      ? `(select z.id from public.zones z join public.states st2 on st2.id = z.state_id
         where st2.code = ${lit(v.state)} and z.code = ${lit(v.unit)} limit 1)`
      : 'null';
    return `  (
    (select id from public.states where code = ${lit(v.state)}),
    (select id from public.species where key = ${lit(v.species)}),
    ${unitJoin},
    ${v.seasonYear},
    ${lit(v.type)}::public.leftover_sale_type,
    ${lit(v.name)},
    ${lit(v.start)}::date,
    ${v.time ? `${lit(v.time)}::time` : 'null'},
    ${v.end ? `${lit(v.end)}::date` : 'null'},
    ${v.endTime ? `${lit(v.endTime)}::time` : 'null'},
    ${zoneExpr},
    array[${v.residency.map(lit).join(', ')}]::text[],
    ${lit(v.url)},
    ${lit(v.source)},
    ${lit(v.notes)},
    'published'::public.content_status,
    now()
  )`;
  });

  return `-- Leftover tag sale(s), entered by hand from the agency's own announcement.
-- Generated by scripts/leftover_sale.js on ${new Date().toISOString().slice(0, 10)}.
--
-- Published directly rather than through review_queue: a human reading the
-- agency's announcement IS the review. Scraped sales do not get this shortcut.
--
-- Safe to run twice. The identity index (state, species, zone, type, year,
-- start date) means a re-run updates the row rather than duplicating it.

insert into public.leftover_tag_sales (
  state_id, species_id, zone_id, season_year, sale_type, name,
  sale_start_date, sale_start_time, sale_end_date, sale_end_time, time_zone,
  residency, purchase_url, source_url, notes, status, last_verified_at
) values
${rows.join(',\n')}
on conflict (state_id, species_id, coalesce(zone_id, '00000000-0000-0000-0000-000000000000'::uuid), sale_type, season_year, sale_start_date)
do update set
  name             = excluded.name,
  sale_start_time  = excluded.sale_start_time,
  sale_end_date    = excluded.sale_end_date,
  sale_end_time    = excluded.sale_end_time,
  time_zone        = excluded.time_zone,
  residency        = excluded.residency,
  purchase_url     = coalesce(excluded.purchase_url, public.leftover_tag_sales.purchase_url),
  source_url       = coalesce(excluded.source_url, public.leftover_tag_sales.source_url),
  notes            = coalesce(excluded.notes, public.leftover_tag_sales.notes),
  status           = 'published',
  last_verified_at = now();

-- Read it back, so a silent failure cannot look like success.
select st.code, sp.name as species, s.name, s.sale_type,
       s.sale_start_date, s.sale_start_time, s.time_zone, s.residency,
       s.sale_start_at at time zone s.time_zone as opens_local
  from public.leftover_tag_sales s
  join public.states st on st.id = s.state_id
  join public.species sp on sp.id = s.species_id
 where s.last_verified_at > now() - interval '2 minutes'
 order by s.sale_start_at;
`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || (!args.file && !args.state)) {
    console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^\/\*\*?/, ''));
    process.exit(args.help ? 0 : 2);
  }

  let input;
  if (args.file) {
    const raw = JSON.parse(fs.readFileSync(args.file, 'utf8'));
    input = Array.isArray(raw) ? raw : [raw];
    if (input.length === 0) fail(`${args.file} holds no sales.`);
  } else {
    input = [args];
  }

  const sales = input.map(validate);

  // A state that announces several sales at once must not be given two rows
  // with the same identity -- the second would silently overwrite the first.
  const seen = new Set();
  for (const v of sales) {
    const key = [v.state, v.species, v.unit ?? '-', v.type, v.seasonYear, v.start].join('|');
    if (seen.has(key)) fail(`two sales share an identity and would overwrite each other: ${key}`);
    seen.add(key);
  }

  console.log(toSql(sales));
}

main();
