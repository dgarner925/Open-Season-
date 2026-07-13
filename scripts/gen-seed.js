// Reads seed-data/*.json (one per state) and emits an idempotent seed migration
// for zones, sources, seasons, application_windows, and draft regulation_summaries.
// FKs are resolved by natural key (state code, species key, zone name, source url).
const fs = require('fs');
const path = require('path');

const dataDir = process.argv[2];
const outFile = process.argv[3];

const AGENCY = {
  GA: 'Georgia DNR Wildlife Resources Division',
  AL: 'Alabama Department of Conservation and Natural Resources',
  CO: 'Colorado Parks & Wildlife',
  MT: 'Montana Fish, Wildlife & Parks',
  WY: 'Wyoming Game & Fish Department',
};
const SPECIES_NAME = { deer: 'Deer', elk: 'Elk', bear: 'Bear', duck: 'Duck' };

// Dollar-quote so apostrophes/slashes in text never break the SQL.
function q(v) {
  if (v === null || v === undefined || v === '') return 'NULL';
  return `$s$${String(v)}$s$`;
}
function d(v) {
  return v ? `DATE '${v}'` : 'NULL';
}
function zoneType(name) {
  const n = name.toLowerCase();
  if (n === 'statewide') return 'statewide';
  if (n.includes('flyway') || n.includes('duck zone') || n.includes('waterfowl zone')) return 'flyway_zone';
  if (n.includes('gmu') || n.includes('unit') || n.includes('hunt area')) return 'gmu';
  return 'county_group';
}

const files = fs.readdirSync(dataDir).filter((f) => f.endsWith('.json')).sort();
const out = [];
out.push('-- 20260713100700_seed_seasons.sql');
out.push('-- Seasons, application windows, and draft regs summaries for the V1 states.');
out.push('-- GENERATED from researched official-source data. Every row is status=draft');
out.push('-- with a source URL; last_verified_at is intentionally NULL until a human');
out.push('-- verifies each row against the source and flips it to published.');
out.push('-- Re-runnable. Requires 20260713100600_seed_reference.sql (states/species/zones) first.');
out.push('');

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
  const code = data.state;
  const year = data.license_year;
  out.push(`-- ===========================================================================`);
  out.push(`-- ${code} — ${data.agency_name} (license year ${year})`);
  out.push(`-- ===========================================================================`);

  // 1) Zones referenced (beyond Statewide, which the reference seed already made).
  const zones = new Set();
  for (const s of data.seasons ?? []) zones.add(s.zone || 'Statewide');
  for (const w of data.application_windows ?? []) if (w.zone) zones.add(w.zone);
  for (const z of zones) {
    if (z === 'Statewide') continue;
    out.push(
      `insert into public.zones (state_id, type, name) ` +
        `select st.id, '${zoneType(z)}', ${q(z)} from public.states st where st.code = '${code}' ` +
        `on conflict (state_id, name) do nothing;`,
    );
  }

  // 2) Sources (dedup by url).
  const sources = new Map();
  for (const s of data.seasons ?? []) if (s.source_url) sources.set(s.source_url, true);
  for (const w of data.application_windows ?? []) if (w.source_url) sources.set(w.source_url, true);
  for (const url of sources.keys()) {
    const docType = url.toLowerCase().endsWith('.pdf') ? 'pdf' : 'webpage';
    out.push(
      `insert into public.sources (agency_name, url, doc_type) ` +
        `select ${q(AGENCY[code] || data.agency_name)}, ${q(url)}, '${docType}' ` +
        `where not exists (select 1 from public.sources where url = ${q(url)});`,
    );
  }
  out.push('');

  // 3) Seasons.
  for (const s of data.seasons ?? []) {
    const zone = s.zone || 'Statewide';
    const sYear = s.season_year ?? year;
    out.push(
      `insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)\n` +
        `select st.id, sp.id, z.id, ${sYear}, '${s.method}', ${q(s.label)}, ${d(s.open_date)}, ${d(s.close_date)}, ${q(s.bag_limit_summary)}, ${q(s.notes)}, src.id, 'draft'\n` +
        `from public.states st\n` +
        `join public.species sp on sp.key = '${s.species}'\n` +
        `join public.zones z on z.state_id = st.id and z.name = ${q(zone)}\n` +
        `left join public.sources src on src.url = ${q(s.source_url)}\n` +
        `where st.code = '${code}';`,
    );
  }
  out.push('');

  // 4) Application windows.
  for (const w of data.application_windows ?? []) {
    const zoneJoin = w.zone
      ? `join public.zones z on z.state_id = st.id and z.name = ${q(w.zone)}`
      : `left join public.zones z on false`;
    const zoneCol = w.zone ? 'z.id' : 'NULL';
    out.push(
      `insert into public.application_windows (state_id, species_id, zone_id, season_year, name, opens_at, closes_at, results_expected_at, fee_summary, application_url, source_id, status)\n` +
        `select st.id, sp.id, ${zoneCol}, ${w.season_year ?? year}, ${q(w.name)}, ${d(w.opens_at)}, ${d(w.closes_at)}, ${d(w.results_expected_at)}, ${q(w.fee_summary)}, ${q(w.application_url)}, src.id, 'draft'\n` +
        `from public.states st\n` +
        `join public.species sp on sp.key = '${w.species}'\n` +
        (w.zone ? zoneJoin + '\n' : '') +
        `left join public.sources src on src.url = ${q(w.source_url)}\n` +
        `where st.code = '${code}';`,
    );
  }
  out.push('');

  // 5) Draft regs summaries — one per species present. Conservative, clearly draft.
  const speciesPresent = [...new Set((data.seasons ?? []).map((s) => s.species))];
  const anySource = (data.seasons ?? []).find((s) => s.source_url)?.source_url || null;
  for (const sp of speciesPresent) {
    const spName = SPECIES_NAME[sp] || sp;
    const body =
      `## License\n` +
      `A valid ${code} hunting license and any ${spName.toLowerCase()} permits, tags, or stamps required by the state are needed before hunting.\n\n` +
      `## Seasons & limits\n` +
      `${spName} season dates, legal methods, zones, and bag limits vary. See the season entries in this app and confirm every detail against the official regulations before you hunt.\n\n` +
      (data.regs_note ? `## Notes\n${data.regs_note}\n\n` : '') +
      `_Draft summary — pending review against the official ${data.agency_name} regulations._`;
    out.push(
      `insert into public.regulation_summaries (state_id, species_id, body, source_id, status)\n` +
        `select st.id, sp.id, ${q(body)}, src.id, 'draft'\n` +
        `from public.states st\n` +
        `join public.species sp on sp.key = '${sp}'\n` +
        `left join public.sources src on src.url = ${q(anySource)}\n` +
        `where st.code = '${code}'\n` +
        `  and not exists (\n` +
        `    select 1 from public.regulation_summaries r\n` +
        `    join public.states st2 on st2.code = '${code}'\n` +
        `    join public.species sp2 on sp2.key = '${sp}'\n` +
        `    where r.state_id = st2.id and r.species_id = sp2.id\n` +
        `  );`,
    );
  }
  out.push('');
}

fs.writeFileSync(outFile, out.join('\n') + '\n');
console.log('Wrote', outFile, 'from', files.length, 'state file(s):', files.join(', '));
