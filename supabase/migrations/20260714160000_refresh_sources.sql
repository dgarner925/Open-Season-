-- 20260714160000_refresh_sources.sql
-- Prepares the source catalog for the automated refresh pipeline (verified via
-- live fetches of each official site, July 2026):
--   1. Backfill sources.state_id for ALL states. Previously only Georgia's
--      sources had a state_id, so the round-robin extractor would have skipped
--      Alabama / Colorado / Montana / Wyoming entirely.
--   2. Georgia: the direct season-dates PDFs were discontinued for 2026-27 (the
--      26-27 filenames 404; GA now publishes off-domain JS flip-books we can't
--      parse). Switch to the eRegulations HTML pages, which are machine-parseable
--      and roll over in place each season.
--   3. Wyoming: the seeded waterfowl Chapter 14 (media/32327) is a superseded
--      draft; the live WGFD page now serves media/33699 (later final revision).
--   4. Add the official draw/quota deadline pages for Georgia and Alabama.
-- Every changed/new source gets last_extracted_at = null so the round-robin
-- picks it up first.

-- 1. Backfill state_id by domain (only where still null) --------------------
update public.sources set state_id = (select id from public.states where code = 'AL')
  where state_id is null and url ilike '%outdooralabama.com%';
update public.sources set state_id = (select id from public.states where code = 'CO')
  where state_id is null and (url ilike '%cpw.state.co.us%' or url ilike '%cpw.widen%');
update public.sources set state_id = (select id from public.states where code = 'GA')
  where state_id is null and (url ilike '%georgiawildlife.com%' or url ilike '%eregulations.com/georgia%');
update public.sources set state_id = (select id from public.states where code = 'MT')
  where state_id is null and url ilike '%fwp.mt.gov%';
update public.sources set state_id = (select id from public.states where code = 'WY')
  where state_id is null and url ilike '%wgfd.wyo.gov%';

-- 2. Georgia: stale PDFs -> parseable eRegulations pages ---------------------
update public.sources
set url = 'https://www.eregulations.com/georgia/hunting/big-game-seasons-dates-limits',
    doc_type = 'webpage', last_extracted_at = null
where url = 'https://georgiawildlife.com/sites/default/files/wrd/pdf/hunting/Season%20Dates%20July%2025-26.pdf';

update public.sources
set url = 'https://www.eregulations.com/georgia/hunting/migratory-birds-seasons',
    doc_type = 'webpage', last_extracted_at = null
where url = 'https://georgiawildlife.com/sites/default/files/wrd/pdf/hunting/2025-26%20Migratory%20Bird%20Season%20Dates.pdf';

-- keep state_id correct if the GA rows were somehow still null
update public.sources set state_id = (select id from public.states where code = 'GA')
  where state_id is null and url ilike '%eregulations.com/georgia%';

-- 3. Wyoming: superseded waterfowl Chapter 14 -> current revision ------------
update public.sources
set url = 'https://wgfd.wyo.gov/media/33699/download?inline=', last_extracted_at = null
where url = 'https://wgfd.wyo.gov/media/32327/download?inline=';

-- 4. New draw / quota deadline sources (idempotent) -------------------------
insert into public.sources (agency_name, url, doc_type, state_id)
select 'Georgia DNR Wildlife Resources Division',
       'https://georgiawildlife.com/hunting/quota', 'webpage',
       (select id from public.states where code = 'GA')
where not exists (select 1 from public.sources where url = 'https://georgiawildlife.com/hunting/quota');

insert into public.sources (agency_name, url, doc_type, state_id)
select 'Alabama Department of Conservation and Natural Resources',
       'https://www.outdooralabama.com/hunting/special-opportunity-areas', 'webpage',
       (select id from public.states where code = 'AL')
where not exists (select 1 from public.sources where url = 'https://www.outdooralabama.com/hunting/special-opportunity-areas');
