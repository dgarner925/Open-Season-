-- 20260720160000_add_states_wave6_final.sql
-- Wave 6 (final): the last six — Mississippi, Oklahoma, Indiana, California,
-- Alaska, Hawaii. Completes all 50 states. All already exist as inactive rows
-- with species matrix populated. Activate them, set agency + license portal, add
-- a Statewide zone, register sources. Every source verified live (July 2026).
--
-- Mostly lightweight HTML (eRegulations mirrors for MS/OK/IN/CA/HI, agency HTML
-- where present). Two special cases:
--   * CALIFORNIA: CDFW digests are 25 MB / 17 MB PDFs (would time out); the eReg
--     mirror carries all species on one HTML page, so that's the source.
--   * ALASKA: no eReg mirror and NO html season table — ADF&G publishes dates
--     only as per-GMU PDFs (~26 units, rotating URL hashes). Activated with its
--     unique species + license/draw links, but big-game DATES won't auto-populate
--     until the extractor gains per-GMU PDF handling (flagged for later).

-- 1. Activate states + agency + license portal ------------------------------
update public.states set is_active = true,
  agency_name = 'Mississippi Department of Wildlife, Fisheries and Parks',
  license_url = coalesce(license_url, 'https://licensing.outdoors.ms/')
where code = 'MS';
update public.states set is_active = true,
  agency_name = 'Oklahoma Department of Wildlife Conservation',
  license_url = coalesce(license_url, 'https://gooutdoorsoklahoma.com/')
where code = 'OK';
update public.states set is_active = true,
  agency_name = 'Indiana DNR Division of Fish & Wildlife',
  license_url = coalesce(license_url, 'https://www.gooutdoorsin.com/')
where code = 'IN';
update public.states set is_active = true,
  agency_name = 'California Department of Fish & Wildlife',
  license_url = coalesce(license_url, 'https://www.licenses.wildlife.ca.gov/internetsales/')
where code = 'CA';
update public.states set is_active = true,
  agency_name = 'Alaska Department of Fish and Game',
  license_url = coalesce(license_url, 'https://store.adfg.alaska.gov/')
where code = 'AK';
update public.states set is_active = true,
  agency_name = 'Hawaii DLNR Division of Forestry and Wildlife',
  license_url = coalesce(license_url, 'https://hunting.ehawaii.gov/hunting/license.html')
where code = 'HI';

-- 2. Statewide zone per new state -------------------------------------------
insert into public.zones (state_id, name, type)
select s.id, 'Statewide', 'statewide'
from public.states s
where s.code in ('MS', 'OK', 'IN', 'CA', 'AK', 'HI')
  and not exists (select 1 from public.zones z where z.state_id = s.id and z.name = 'Statewide');

-- 3. Sources (guarded inserts; state_id resolved by code) -------------------
insert into public.sources (agency_name, url, doc_type, state_id)
select v.agency, v.url, v.doc_type::source_doc_type, (select id from public.states where code = v.code)
from (values
  -- Mississippi (mdwfp.com has SSL issues from datacenter; eReg mirror)
  ('Mississippi Department of Wildlife, Fisheries and Parks', 'https://www.eregulations.com/mississippi/hunting/deer-hunting-seasons', 'webpage', 'MS'),
  ('Mississippi Department of Wildlife, Fisheries and Parks', 'https://www.eregulations.com/mississippi/hunting/turkey-hunting-seasons-bag-limits', 'webpage', 'MS'),
  ('Mississippi Department of Wildlife, Fisheries and Parks', 'https://www.eregulations.com/mississippi/hunting/small-game-migratory-game-birds', 'webpage', 'MS'),
  ('Mississippi Department of Wildlife, Fisheries and Parks', 'https://www.eregulations.com/mississippi/hunting/hunting-regulations-requirements', 'webpage', 'MS'),
  -- Oklahoma (ODWC not blocked; eReg per-species + controlled-hunts page)
  ('Oklahoma Department of Wildlife Conservation', 'https://www.eregulations.com/oklahoma/hunting/deer-hunting-seasons', 'webpage', 'OK'),
  ('Oklahoma Department of Wildlife Conservation', 'https://www.eregulations.com/oklahoma/hunting/elk-hunting-seasons', 'webpage', 'OK'),
  ('Oklahoma Department of Wildlife Conservation', 'https://www.eregulations.com/oklahoma/hunting/bear-hunting-seasons', 'webpage', 'OK'),
  ('Oklahoma Department of Wildlife Conservation', 'https://www.eregulations.com/oklahoma/hunting/antelope-hunting-seasons', 'webpage', 'OK'),
  ('Oklahoma Department of Wildlife Conservation', 'https://www.eregulations.com/oklahoma/hunting/turkey-hunting-seasons', 'webpage', 'OK'),
  ('Oklahoma Department of Wildlife Conservation', 'https://www.eregulations.com/oklahoma/hunting/small-game-hog-regulations', 'webpage', 'OK'),
  ('Oklahoma Department of Wildlife Conservation', 'https://www.eregulations.com/oklahoma/hunting/migratory-game-bird-season-dates-limits', 'webpage', 'OK'),
  ('Oklahoma Department of Wildlife Conservation', 'https://www.eregulations.com/oklahoma/hunting/ducks-mergansers-coots-regulations', 'webpage', 'OK'),
  ('Oklahoma Department of Wildlife Conservation', 'https://www.eregulations.com/oklahoma/hunting/september-teal-geese-sandhill-cranes-regulations', 'webpage', 'OK'),
  ('Oklahoma Department of Wildlife Conservation', 'https://www.wildlifedepartment.com/hunting/controlledhunts', 'webpage', 'OK'),
  -- Indiana (in.gov not blocked; eReg seasons + waterfowl + reserved hunts)
  ('Indiana DNR Division of Fish & Wildlife', 'https://www.eregulations.com/indiana/hunting/hunting-seasons', 'webpage', 'IN'),
  ('Indiana DNR Division of Fish & Wildlife', 'https://www.eregulations.com/indiana/hunting/waterfowl-migratory-bird-regulations', 'webpage', 'IN'),
  ('Indiana DNR Division of Fish & Wildlife', 'https://www.in.gov/dnr/fish-and-wildlife/hunting-and-trapping/reserved-hunts', 'webpage', 'IN'),
  -- California (CDFW digests are 25MB/17MB PDFs; eReg mirror = all species, one HTML page)
  ('California Department of Fish & Wildlife', 'https://www.eregulations.com/california/hunting/hunting-seasons-and-dates', 'webpage', 'CA'),
  ('California Department of Fish & Wildlife', 'https://wildlife.ca.gov/Publications/Hunting-Digest', 'webpage', 'CA'),
  -- Alaska (no eReg mirror, no HTML dates table — hub + draw pages only; dates are per-GMU PDFs, flagged)
  ('Alaska Department of Fish and Game', 'https://www.adfg.alaska.gov/index.cfm?adfg=wildliferegulations.hunting', 'webpage', 'AK'),
  ('Alaska Department of Fish and Game', 'https://www.adfg.alaska.gov/index.cfm?adfg=huntlicense.drawsupplements', 'webpage', 'AK'),
  -- Hawaii (DLNR not blocked; eReg per-island mammals+birds; Go Hunt Hawaii draw portal)
  ('Hawaii DLNR Division of Forestry and Wildlife', 'https://www.eregulations.com/hawaii/hunting/hunting-seasons-and-dates', 'webpage', 'HI'),
  ('Hawaii DLNR Division of Forestry and Wildlife', 'https://gohunthawaii.ehawaii.gov/public/hunts', 'webpage', 'HI')
) as v(agency, url, doc_type, code)
where not exists (select 1 from public.sources s where s.url = v.url);
