-- 20260715170000_add_states_ks_il_mi_tx.sql
-- Add Kansas, Illinois, Michigan, and Texas: activate the states (all 50 already
-- exist as inactive rows), set agency + license portal, register their official
-- source URLs for the extraction pipeline, and add a Statewide zone each.
-- Every source URL was verified live (fetched, July 2026). Seasons/draws/regs
-- flow in through the review queue once extraction runs — nothing here publishes
-- dated content.

-- 1. Activate states + agency + license portal -----------------------------
update public.states set is_active = true,
  agency_name = 'Kansas Department of Wildlife & Parks',
  license_url = coalesce(license_url, 'https://www.ksoutdoors.gov/licenses-permits-fees')
where code = 'KS';
update public.states set is_active = true,
  agency_name = 'Illinois Department of Natural Resources',
  license_url = coalesce(license_url, 'https://www.exploremoreil.com/')
where code = 'IL';
update public.states set is_active = true,
  agency_name = 'Michigan Department of Natural Resources',
  license_url = coalesce(license_url, 'https://www.mdnr-elicense.com/')
where code = 'MI';
update public.states set is_active = true,
  agency_name = 'Texas Parks & Wildlife Department',
  license_url = coalesce(license_url, 'https://tpwd.texas.gov/business/licenses/online_sales/')
where code = 'TX';

-- 2. Statewide zone per new state (extractor also creates zones on demand) ---
insert into public.zones (state_id, name, type)
select s.id, 'Statewide', 'statewide'
from public.states s
where s.code in ('KS', 'IL', 'MI', 'TX')
  and not exists (select 1 from public.zones z where z.state_id = s.id and z.name = 'Statewide');

-- 3. Sources (guarded inserts; state_id resolved by code) -------------------
insert into public.sources (agency_name, url, doc_type, state_id)
select v.agency, v.url, v.doc_type::source_doc_type, (select id from public.states where code = v.code)
from (values
  -- Kansas (KDWP moved to ksoutdoors.gov; When-to-Hunt covers deer/elk/duck)
  ('Kansas Department of Wildlife & Parks', 'https://www.ksoutdoors.gov/outdoor-activities/hunting-in-kansas/when-to-hunt', 'webpage', 'KS'),
  ('Kansas Department of Wildlife & Parks', 'https://www.ksoutdoors.gov/outdoor-activities/hunting-in-kansas/what-to-hunt/big-game/deer', 'webpage', 'KS'),
  ('Kansas Department of Wildlife & Parks', 'https://www.ksoutdoors.gov/outdoor-activities/hunting-in-kansas/what-to-hunt/big-game/elk', 'webpage', 'KS'),
  -- Illinois (DNR deer pages HTML; waterfowl dates only in the S3 PDF)
  ('Illinois Department of Natural Resources', 'https://dnr.illinois.gov/hunting/deerfirearmmuzzleloader.html', 'webpage', 'IL'),
  ('Illinois Department of Natural Resources', 'https://dnr.illinois.gov/hunting/deerarcheryinformation.html', 'webpage', 'IL'),
  ('Illinois Department of Natural Resources', 'https://ngrrec-hunt-illinois-wordpress-images.s3.amazonaws.com/wp-content/uploads/2025/10/20142741/2026-2030WaterfowlSeasonsZonesDates.pdf', 'pdf', 'IL'),
  ('Illinois Department of Natural Resources', 'https://dnr.illinois.gov/lpr/deerpermitsfees.html', 'webpage', 'IL'),
  -- Michigan (per-species regs pages are the machine-parseable date tables)
  ('Michigan Department of Natural Resources', 'https://www.michigan.gov/dnr/managing-resources/laws/regulations/deer/', 'webpage', 'MI'),
  ('Michigan Department of Natural Resources', 'https://www.michigan.gov/dnr/managing-resources/laws/regulations/elk', 'webpage', 'MI'),
  ('Michigan Department of Natural Resources', 'https://www.michigan.gov/dnr/managing-resources/laws/regulations/bear', 'webpage', 'MI'),
  ('Michigan Department of Natural Resources', 'https://www.michigan.gov/dnr/managing-resources/laws/regulations/waterfowl', 'webpage', 'MI'),
  ('Michigan Department of Natural Resources', 'https://www.michigan.gov/dnr/things-to-do/hunting/deer/reserved-deer-hunts', 'webpage', 'MI'),
  -- Texas (one consolidated season-dates page covers deer + duck)
  ('Texas Parks & Wildlife Department', 'https://tpwd.texas.gov/regulations/outdoor-annual/hunting/2026-2027-hunting-season-dates', 'webpage', 'TX'),
  ('Texas Parks & Wildlife Department', 'https://tpwd.texas.gov/huntwild/hunt/public/public_hunt_drawing/deadlines.phtml', 'webpage', 'TX')
) as v(agency, url, doc_type, code)
where not exists (select 1 from public.sources s where s.url = v.url);
