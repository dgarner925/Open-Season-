-- 20260719150000_add_states_wave1_west.sql
-- Wave 1 of the 50-state rollout: the western draw states — Arizona, Idaho,
-- New Mexico, Nevada, Oregon, Utah. All already exist as inactive rows. Activate
-- them, set agency + verified license/draw portal, add a Statewide zone, and
-- register official source URLs for the extraction pipeline. Every source below
-- was fetched and verified live (July 2026). New sources have last_extracted_at
-- = null, so the nightly refresh cron picks them up first; seasons/draws then
-- flow in through the review queue. Preferred parseable docs (agency PDFs / HTML)
-- over content pages that IP-block datacenter fetches (AZ, UT portals).

-- 1. Activate states + agency + license portal ------------------------------
update public.states set is_active = true,
  agency_name = 'Arizona Game & Fish Department',
  license_url = coalesce(license_url, 'https://license.azgfd.com/')
where code = 'AZ';
update public.states set is_active = true,
  agency_name = 'Idaho Department of Fish and Game',
  license_url = coalesce(license_url, 'https://license.gooutdoorsidaho.com/')
where code = 'ID';
update public.states set is_active = true,
  agency_name = 'New Mexico Department of Game & Fish',
  license_url = coalesce(license_url, 'https://onlinesales.wildlife.state.nm.us/')
where code = 'NM';
update public.states set is_active = true,
  agency_name = 'Nevada Department of Wildlife',
  license_url = coalesce(license_url, 'https://www.ndowlicensing.com')
where code = 'NV';
update public.states set is_active = true,
  agency_name = 'Oregon Department of Fish & Wildlife',
  license_url = coalesce(license_url, 'https://odfw.huntfishoregon.com/login')
where code = 'OR';
update public.states set is_active = true,
  agency_name = 'Utah Division of Wildlife Resources',
  license_url = coalesce(license_url, 'https://wildlifelicense.utah.gov/hflo')
where code = 'UT';

-- 2. Statewide zone per new state -------------------------------------------
insert into public.zones (state_id, name, type)
select s.id, 'Statewide', 'statewide'
from public.states s
where s.code in ('AZ', 'ID', 'NM', 'NV', 'OR', 'UT')
  and not exists (select 1 from public.zones z where z.state_id = s.id and z.name = 'Statewide');

-- 3. Sources (guarded inserts; state_id resolved by code) -------------------
insert into public.sources (agency_name, url, doc_type, state_id)
select v.agency, v.url, v.doc_type::source_doc_type, (select id from public.states where code = v.code)
from (values
  -- Arizona (AZGFD). Content pages on azgfd.com 403-block datacenter fetches;
  -- the S3-hosted regulation PDFs are directly fetchable and are the parseable
  -- source. Master regs is 120pp (may exceed the 9MB extractor cap — watch it).
  ('Arizona Game & Fish Department', 'https://azgfd-portal-wordpress-pantheon.s3.us-west-2.amazonaws.com/wp-content/uploads/2026/05/04081122/2026-27-Arizona-Hunting-Regulations.pdf', 'pdf', 'AZ'),
  ('Arizona Game & Fish Department', 'https://azgfd-portal-wordpress-pantheon.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/12/23143704/2026-Pronghorn-and-Elk-Regulations_251223.pdf', 'pdf', 'AZ'),
  ('Arizona Game & Fish Department', 'https://azgfd-portal-wordpress-pantheon.s3.us-west-2.amazonaws.com/wp-content/uploads/2026/05/04082836/2026-27-Dove-and-Pigeon-Regulations.pdf', 'pdf', 'AZ'),
  ('Arizona Game & Fish Department', 'https://azgfd-portal-wordpress-pantheon.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/05/06160846/2025-26-Waterfowl-and-Snipe-Regulations_web.pdf', 'pdf', 'AZ'),
  -- Idaho (IDFG; idfg.idaho.gov is not IP-blocked). Note: the big-game PDFs are
  -- image-heavy — if extraction comes back thin, add eRegulations Idaho as HTML.
  ('Idaho Department of Fish and Game', 'https://idfg.idaho.gov/sites/default/files/seasons-rules-big-game-2026.pdf', 'pdf', 'ID'),
  ('Idaho Department of Fish and Game', 'https://idfg.idaho.gov/sites/default/files/seasons-rules-moose-sheep-goat-2025-26.pdf', 'pdf', 'ID'),
  ('Idaho Department of Fish and Game', 'https://idfg.idaho.gov/sites/default/files/2026-2027_uplandgame_web.pdf', 'pdf', 'ID'),
  ('Idaho Department of Fish and Game', 'https://idfg.idaho.gov/sites/default/files/migratorygame2026-2027_web.pdf', 'pdf', 'ID'),
  ('Idaho Department of Fish and Game', 'https://idfg.idaho.gov/licenses/controlled/apply', 'webpage', 'ID'),
  -- New Mexico (NMDOW; dgf.nm.gov not blocked). Direct-PDF links carry a wpdmdl
  -- id + filename querystring that can rotate — re-check if they 404 later.
  ('New Mexico Department of Game & Fish', 'https://wildlife.dgf.nm.gov/download/2026-2027-new-mexico-hunting-rules-and-info/?wpdmdl=52826&filename=HNT-RIB-2026-27_ENGLISH_online_051126.pdf', 'pdf', 'NM'),
  ('New Mexico Department of Game & Fish', 'https://wildlife.dgf.nm.gov/download/2026-2027-new-mexico-migratory-game-bird-hunting-rules-and-info/?wpdmdl=55779&filename=RIB_Migratory_Game_Bird_2026-27_Supplement_ENGLISH.pdf', 'pdf', 'NM'),
  ('New Mexico Department of Game & Fish', 'https://wildlife.dgf.nm.gov/hunting/applications-and-draw-information/', 'webpage', 'NM'),
  -- Nevada (NDOW; Commission Regulation PDFs on ndow.org, all FlateDecode/parseable)
  ('Nevada Department of Wildlife', 'https://www.ndow.org/wp-content/uploads/2025/07/CR25-07-2025-2026-and-2026-2027-Big-Game-Seasons.pdf', 'pdf', 'NV'),
  ('Nevada Department of Wildlife', 'https://www.ndow.org/wp-content/uploads/2024/06/26C-CR24-13-2024-2024-2025-2026-Upland-Game-and-Furbearer-Seasons.pdf', 'pdf', 'NV'),
  ('Nevada Department of Wildlife', 'https://www.ndow.org/wp-content/uploads/2025/07/CR-25-11-2025-2026-Migratory-Game-Bird-Season-and-Bag-NBWC-Approved-March-2025-FINAL-1.pdf', 'pdf', 'NV'),
  ('Nevada Department of Wildlife', 'https://www.ndow.org/wp-content/uploads/2026/01/CR-26-01-2026-2027-Application-Deadlines-Draw-Result-Dates-NBWC-Approved-January-2026.pdf', 'pdf', 'NV'),
  -- Oregon (ODFW). Big game dates on myodfw.com HTML; game-bird + migratory dates
  -- via Oregon's eRegulations (2026-27, parseable); controlled-hunt deadline page.
  ('Oregon Department of Fish & Wildlife', 'https://myodfw.com/big-game-hunting/seasons', 'webpage', 'OR'),
  ('Oregon Department of Fish & Wildlife', 'https://www.eregulations.com/oregon/hunting/game-bird/game-bird-seasons', 'webpage', 'OR'),
  ('Oregon Department of Fish & Wildlife', 'https://www.eregulations.com/oregon/hunting/game-bird/migratory-game-bird-seasons', 'webpage', 'OR'),
  ('Oregon Department of Fish & Wildlife', 'https://myodfw.com/articles/controlled-hunt-navigation', 'webpage', 'OR'),
  -- Utah (DWR; wildlife.utah.gov guidebook PDFs, all parseable, all under 9MB)
  ('Utah Division of Wildlife Resources', 'https://wildlife.utah.gov/guidebooks/biggameapp.pdf', 'pdf', 'UT'),
  ('Utah Division of Wildlife Resources', 'https://wildlife.utah.gov/guidebooks/field_regs.pdf', 'pdf', 'UT'),
  ('Utah Division of Wildlife Resources', 'https://wildlife.utah.gov/guidebooks/black-bear-cougar-furbearer-guidebook.pdf', 'pdf', 'UT'),
  ('Utah Division of Wildlife Resources', 'https://wildlife.utah.gov/guidebooks/waterfowl-upland-game-turkey-guidebook.pdf', 'pdf', 'UT')
) as v(agency, url, doc_type, code)
where not exists (select 1 from public.sources s where s.url = v.url);
