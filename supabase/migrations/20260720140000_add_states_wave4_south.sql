-- 20260720140000_add_states_wave4_south.sql
-- Wave 4 of the 50-state rollout: the Southeast deer/turkey belt — Florida,
-- South Carolina, North Carolina, Tennessee, Arkansas, Louisiana. All already
-- exist as inactive rows (seeded) with their species matrix populated. Activate
-- them, set agency + verified license portal, add a Statewide zone, and register
-- official source URLs for the extraction pipeline. Every source verified live
-- (fetched, July 2026). Almost entirely lightweight HTML (agency pages for FL/AR,
-- eRegulations mirrors for SC/NC/TN/LA) — no PDF-timeout risk this wave. Some
-- eReg mirrors show 2025-26 until the states publish 2026-27 (Aug 2026); both
-- land proposals, approve current-season in Admin.

-- 1. Activate states + agency + license portal ------------------------------
update public.states set is_active = true,
  agency_name = 'Florida Fish and Wildlife Conservation Commission',
  license_url = coalesce(license_url, 'https://gooutdoorsflorida.com/')
where code = 'FL';
update public.states set is_active = true,
  agency_name = 'South Carolina Department of Natural Resources',
  license_url = coalesce(license_url, 'https://license.gooutdoorssouthcarolina.com/')
where code = 'SC';
update public.states set is_active = true,
  agency_name = 'North Carolina Wildlife Resources Commission',
  license_url = coalesce(license_url, 'https://license.gooutdoorsnorthcarolina.com/')
where code = 'NC';
update public.states set is_active = true,
  agency_name = 'Tennessee Wildlife Resources Agency',
  license_url = coalesce(license_url, 'https://gooutdoorstennessee.com/')
where code = 'TN';
update public.states set is_active = true,
  agency_name = 'Arkansas Game & Fish Commission',
  license_url = coalesce(license_url, 'https://ar-licensing.s3licensing.com/')
where code = 'AR';
update public.states set is_active = true,
  agency_name = 'Louisiana Department of Wildlife and Fisheries',
  license_url = coalesce(license_url, 'https://www.louisianaoutdoors.com/')
where code = 'LA';

-- 2. Statewide zone per new state -------------------------------------------
insert into public.zones (state_id, name, type)
select s.id, 'Statewide', 'statewide'
from public.states s
where s.code in ('FL', 'SC', 'NC', 'TN', 'AR', 'LA')
  and not exists (select 1 from public.zones z where z.state_id = s.id and z.name = 'Statewide');

-- 3. Sources (guarded inserts; state_id resolved by code) -------------------
insert into public.sources (agency_name, url, doc_type, state_id)
select v.agency, v.url, v.doc_type::source_doc_type, (select id from public.states where code = v.code)
from (values
  -- Florida (myfwc.com not blocked, 2026-27 HTML; eReg + limited-entry deadlines)
  ('Florida Fish and Wildlife Conservation Commission', 'https://myfwc.com/hunting/season-dates/', 'webpage', 'FL'),
  ('Florida Fish and Wildlife Conservation Commission', 'https://www.eregulations.com/florida/hunting/deer-seasons-bag-limits', 'webpage', 'FL'),
  ('Florida Fish and Wildlife Conservation Commission', 'https://www.eregulations.com/florida/hunting/turkey-seasons-bag-limits', 'webpage', 'FL'),
  ('Florida Fish and Wildlife Conservation Commission', 'https://www.eregulations.com/florida/hunting/migratory-bird-hunting-regulations', 'webpage', 'FL'),
  ('Florida Fish and Wildlife Conservation Commission', 'https://myfwc.com/wildlifehabitats/wildlife/alligator/harvest/', 'webpage', 'FL'),
  ('Florida Fish and Wildlife Conservation Commission', 'https://myfwc.com/license/limited-entry/apply/', 'webpage', 'FL'),
  -- South Carolina (SCDNR not blocked; eReg HTML + SCDNR alligator draw page)
  ('South Carolina Department of Natural Resources', 'https://www.eregulations.com/southcarolina/hunting/deer-seasons-on-private-lands', 'webpage', 'SC'),
  ('South Carolina Department of Natural Resources', 'https://www.eregulations.com/southcarolina/hunting/alligator-bear-regulations', 'webpage', 'SC'),
  ('South Carolina Department of Natural Resources', 'https://www.eregulations.com/southcarolina/hunting/turkey-regulations', 'webpage', 'SC'),
  ('South Carolina Department of Natural Resources', 'https://www.eregulations.com/southcarolina/hunting/small-game-seasons', 'webpage', 'SC'),
  ('South Carolina Department of Natural Resources', 'https://www.eregulations.com/southcarolina/hunting/general-migratory-bird-seasons-shooting-hours-bag-limits', 'webpage', 'SC'),
  ('South Carolina Department of Natural Resources', 'https://www.dnr.sc.gov/wildlife/alligator/huntinfo.html', 'webpage', 'SC'),
  -- North Carolina (NCWRC publishes only PDF; eReg HTML is primary + permit page)
  ('North Carolina Wildlife Resources Commission', 'https://www.eregulations.com/northcarolina/hunting/deer-hunting-seasons', 'webpage', 'NC'),
  ('North Carolina Wildlife Resources Commission', 'https://www.eregulations.com/northcarolina/hunting/bear-hunting-seasons', 'webpage', 'NC'),
  ('North Carolina Wildlife Resources Commission', 'https://www.eregulations.com/northcarolina/hunting/turkey-seasons-regulations', 'webpage', 'NC'),
  ('North Carolina Wildlife Resources Commission', 'https://www.eregulations.com/northcarolina/hunting/small-game-other-seasons', 'webpage', 'NC'),
  ('North Carolina Wildlife Resources Commission', 'https://www.eregulations.com/northcarolina/hunting/migratory-game-bird-seasons', 'webpage', 'NC'),
  ('North Carolina Wildlife Resources Commission', 'https://www.ncwildlife.gov/hunting/license-types-and-fees/permit-hunting-opportunities', 'webpage', 'NC'),
  -- Tennessee (eReg mirror is comprehensive HTML; TWRA summary flaky)
  ('Tennessee Wildlife Resources Agency', 'https://www.eregulations.com/tennessee/hunting/deer-seasons-bag-limits', 'webpage', 'TN'),
  ('Tennessee Wildlife Resources Agency', 'https://www.eregulations.com/tennessee/hunting/elk-seasons-bag-limits', 'webpage', 'TN'),
  ('Tennessee Wildlife Resources Agency', 'https://www.eregulations.com/tennessee/hunting/bear-seasons-bag-limits', 'webpage', 'TN'),
  ('Tennessee Wildlife Resources Agency', 'https://www.eregulations.com/tennessee/hunting/turkey-seasons-bag-limits', 'webpage', 'TN'),
  ('Tennessee Wildlife Resources Agency', 'https://www.eregulations.com/tennessee/hunting/small-game-seasons-bag-limits', 'webpage', 'TN'),
  ('Tennessee Wildlife Resources Agency', 'https://www.eregulations.com/tennessee/hunting/migratory-bird-seasons-bag-limits', 'webpage', 'TN'),
  ('Tennessee Wildlife Resources Agency', 'https://www.eregulations.com/tennessee/hunting/duck-sandhill-crane-seasons-bag-limits', 'webpage', 'TN'),
  ('Tennessee Wildlife Resources Agency', 'https://www.eregulations.com/tennessee/hunting/quota-hunts', 'webpage', 'TN'),
  -- Arkansas (AGFC not blocked, 2026-27 HTML per-species; eReg all-in-one fallback)
  ('Arkansas Game & Fish Commission', 'https://www.agfc.com/hunting/deer/deer-seasons-and-limits-by-zone/', 'webpage', 'AR'),
  ('Arkansas Game & Fish Commission', 'https://www.agfc.com/hunting/more-game/bear/bear-seasons-and-limits/', 'webpage', 'AR'),
  ('Arkansas Game & Fish Commission', 'https://www.agfc.com/hunting/more-game/elk/season-dates-and-bag-limits/', 'webpage', 'AR'),
  ('Arkansas Game & Fish Commission', 'https://www.agfc.com/hunting/turkey/turkey-dates-rules-regulations/', 'webpage', 'AR'),
  ('Arkansas Game & Fish Commission', 'https://www.agfc.com/hunting/more-game/squirrel/season-dates-and-bag-limits/', 'webpage', 'AR'),
  ('Arkansas Game & Fish Commission', 'https://www.agfc.com/hunting/waterfowl/waterfowl-dates-rules-regulations/', 'webpage', 'AR'),
  ('Arkansas Game & Fish Commission', 'https://www.agfc.com/hunting/more-game/alligator/permit-application-schedule/', 'webpage', 'AR'),
  ('Arkansas Game & Fish Commission', 'https://www.eregulations.com/arkansas/hunting/hunting-seasons-and-dates', 'webpage', 'AR'),
  -- Louisiana (LDWF not blocked; eReg HTML — deer split into numbered areas)
  ('Louisiana Department of Wildlife and Fisheries', 'https://www.eregulations.com/louisiana/hunting/deer-hunting', 'webpage', 'LA'),
  ('Louisiana Department of Wildlife and Fisheries', 'https://www.eregulations.com/louisiana/hunting/deer-hunting-area-1', 'webpage', 'LA'),
  ('Louisiana Department of Wildlife and Fisheries', 'https://www.eregulations.com/louisiana/hunting/deer-hunting-area-2', 'webpage', 'LA'),
  ('Louisiana Department of Wildlife and Fisheries', 'https://www.eregulations.com/louisiana/hunting/turkey-seasons', 'webpage', 'LA'),
  ('Louisiana Department of Wildlife and Fisheries', 'https://www.eregulations.com/louisiana/hunting/quadrupeds-resident-game-birds-seasons', 'webpage', 'LA'),
  ('Louisiana Department of Wildlife and Fisheries', 'https://www.eregulations.com/louisiana/hunting/migratory-birds-seasons', 'webpage', 'LA'),
  ('Louisiana Department of Wildlife and Fisheries', 'https://www.wlf.louisiana.gov/page/alligator-hunting', 'webpage', 'LA')
) as v(agency, url, doc_type, code)
where not exists (select 1 from public.sources s where s.url = v.url);
