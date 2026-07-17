-- 20260717120000_add_states_ky_oh_ia.sql
-- Add Kentucky, Ohio, and Iowa (states already exist as inactive rows). Activate
-- them, set agency + verified license portal, add a Statewide zone, and register
-- official source URLs for the extraction pipeline. Every source verified live
-- (fetched, July 2026). New sources have last_extracted_at = null, so the nightly
-- refresh cron picks them up first. Seasons/draws flow in via the review queue.

-- 1. Activate states + agency + license portal ------------------------------
update public.states set is_active = true,
  agency_name = 'Kentucky Department of Fish & Wildlife Resources',
  license_url = coalesce(license_url, 'https://app.fw.ky.gov/solar')
where code = 'KY';
update public.states set is_active = true,
  agency_name = 'Ohio Department of Natural Resources, Division of Wildlife',
  license_url = coalesce(license_url, 'https://oh-web.s3licensing.com/Home')
where code = 'OH';
update public.states set is_active = true,
  agency_name = 'Iowa Department of Natural Resources',
  license_url = coalesce(license_url, 'https://gooutdoorsiowa.com/')
where code = 'IA';

-- 2. Statewide zone per new state -------------------------------------------
insert into public.zones (state_id, name, type)
select s.id, 'Statewide', 'statewide'
from public.states s
where s.code in ('KY', 'OH', 'IA')
  and not exists (select 1 from public.zones z where z.state_id = s.id and z.name = 'Statewide');

-- 3. Sources (guarded inserts; state_id resolved by code) -------------------
insert into public.sources (agency_name, url, doc_type, state_id)
select v.agency, v.url, v.doc_type::source_doc_type, (select id from public.states where code = v.code)
from (values
  -- Kentucky (fw.ky.gov species pages, HTML, current 2026-27)
  ('Kentucky Department of Fish & Wildlife Resources', 'https://fw.ky.gov/Hunt/Pages/Deer.aspx', 'webpage', 'KY'),
  ('Kentucky Department of Fish & Wildlife Resources', 'https://fw.ky.gov/Hunt/Pages/ElkHuntingPermits.aspx', 'webpage', 'KY'),
  ('Kentucky Department of Fish & Wildlife Resources', 'https://fw.ky.gov/Hunt/Pages/Bear-Hunting.aspx', 'webpage', 'KY'),
  ('Kentucky Department of Fish & Wildlife Resources', 'https://fw.ky.gov/Hunt/Pages/Waterfowl-Hunting.aspx', 'webpage', 'KY'),
  -- Ohio (ohiodnr.gov HTML is datacenter-blocked; the public asset-server PDF
  -- carries the 2026-27 season chart for deer + duck and is reachable)
  ('Ohio Department of Natural Resources, Division of Wildlife', 'https://dam.assets.ohio.gov/image/upload/ohiodnr.gov/documents/wildlife/news/2026-27_Proposed_Hunting_Seasons_Chart_1.pdf', 'pdf', 'OH'),
  -- Iowa (iowadnr.gov HTML, current 2026-27)
  ('Iowa Department of Natural Resources', 'https://www.iowadnr.gov/things-do/hunting-trapping/types-hunting-trapping/deer-hunting', 'webpage', 'IA'),
  ('Iowa Department of Natural Resources', 'https://www.iowadnr.gov/things-do/hunting-trapping/types-hunting-trapping/migratory-game-bird-hunting', 'webpage', 'IA')
) as v(agency, url, doc_type, code)
where not exists (select 1 from public.sources s where s.url = v.url);
