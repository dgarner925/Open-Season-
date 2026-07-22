-- 20260719170000_add_states_wave2_north.sql
-- Wave 2 of the 50-state rollout: the northern / plains draw states — Wyoming,
-- Montana, Washington, North Dakota, South Dakota, Nebraska. All already exist as
-- inactive rows. Activate them, set agency + verified license/draw portal, add a
-- Statewide zone, and register official source URLs for the extraction pipeline.
-- Every source verified live (fetched, July 2026).
--
-- Lesson applied from Wave 1: prefer lightweight HTML that carries real dates over
-- big regulation PDFs (which time out the extractor at 504/546). Most of these
-- states publish seasons on parseable HTML; where the agency IP-blocks datacenter
-- fetches (NE) or hides dates behind PDFs (WY), we register the eRegulations HTML
-- mirror. Several eReg mirrors lag one season (2025-26) while the state's own dates
-- are 2026-27 — both land proposals; approve current-season, skip stale in Admin.

-- 1. Activate states + agency + license portal ------------------------------
update public.states set is_active = true,
  agency_name = 'Wyoming Game & Fish Department',
  license_url = coalesce(license_url, 'https://wgfapps.wyo.gov/elsapplication/ELSWelcome.aspx')
where code = 'WY';
update public.states set is_active = true,
  agency_name = 'Montana Fish, Wildlife & Parks',
  license_url = coalesce(license_url, 'https://ols.fwp.mt.gov/')
where code = 'MT';
update public.states set is_active = true,
  agency_name = 'Washington Department of Fish & Wildlife',
  license_url = coalesce(license_url, 'https://fishhunt.dfw.wa.gov/')
where code = 'WA';
update public.states set is_active = true,
  agency_name = 'North Dakota Game and Fish Department',
  license_url = coalesce(license_url, 'https://apps.nd.gov/gnf/onlineservices/lic/public/myGNF.htm')
where code = 'ND';
update public.states set is_active = true,
  agency_name = 'South Dakota Game, Fish and Parks',
  license_url = coalesce(license_url, 'https://license.gooutdoorssouthdakota.com/')
where code = 'SD';
update public.states set is_active = true,
  agency_name = 'Nebraska Game and Parks Commission',
  license_url = coalesce(license_url, 'https://www.gooutdoorsne.com/')
where code = 'NE';

-- 2. Statewide zone per new state -------------------------------------------
insert into public.zones (state_id, name, type)
select s.id, 'Statewide', 'statewide'
from public.states s
where s.code in ('WY', 'MT', 'WA', 'ND', 'SD', 'NE')
  and not exists (select 1 from public.zones z where z.state_id = s.id and z.name = 'Statewide');

-- 3. Sources (guarded inserts; state_id resolved by code) -------------------
insert into public.sources (agency_name, url, doc_type, state_id)
select v.agency, v.url, v.doc_type::source_doc_type, (select id from public.states where code = v.code)
from (values
  -- Wyoming (WGFD not blocked; current 2026 dates live in chapter PDFs, eReg mirror
  -- is one season behind, draw deadlines are concrete 2026-27 HTML).
  ('Wyoming Game & Fish Department', 'https://wgfd.wyo.gov/news-events/big-game-applications-open-2026-27-hunting-season-key-deadlines-approaching', 'webpage', 'WY'),
  ('Wyoming Game & Fish Department', 'https://www.eregulations.com/wyoming/hunting/hunting-seasons-and-dates', 'webpage', 'WY'),
  ('Wyoming Game & Fish Department', 'https://www.eregulations.com/wyoming/hunting/game-bird-seasons', 'webpage', 'WY'),
  ('Wyoming Game & Fish Department', 'https://wgfd.wyo.gov/media/33694/download', 'pdf', 'WY'),
  ('Wyoming Game & Fish Department', 'https://wgfd.wyo.gov/media/33698/download', 'pdf', 'WY'),
  -- Montana (FWP not blocked; one HTML page carries big game + upland + migratory)
  ('Montana Fish, Wildlife & Parks', 'https://fwp.mt.gov/hunt/seasons', 'webpage', 'MT'),
  ('Montana Fish, Wildlife & Parks', 'https://fwp.mt.gov/buyandapply/hunting-licenses/application-drawing-dates', 'webpage', 'MT'),
  ('Montana Fish, Wildlife & Parks', 'https://www.eregulations.com/montana/hunting/hunting-seasons-and-dates', 'webpage', 'MT'),
  -- Washington (WDFW seasons are hosted on the eRegulations platform — all HTML)
  ('Washington Department of Fish & Wildlife', 'https://www.eregulations.com/washington/hunting/deer-general-seasons', 'webpage', 'WA'),
  ('Washington Department of Fish & Wildlife', 'https://www.eregulations.com/washington/hunting/elk-general-seasons', 'webpage', 'WA'),
  ('Washington Department of Fish & Wildlife', 'https://www.eregulations.com/washington/hunting/black-bear', 'webpage', 'WA'),
  ('Washington Department of Fish & Wildlife', 'https://www.eregulations.com/washington/hunting/cougar-general-seasons', 'webpage', 'WA'),
  ('Washington Department of Fish & Wildlife', 'https://www.eregulations.com/washington/hunting/game-bird/resident-game-bird-seasons', 'webpage', 'WA'),
  ('Washington Department of Fish & Wildlife', 'https://www.eregulations.com/washington/hunting/game-bird/migratory-game-bird-seasons', 'webpage', 'WA'),
  ('Washington Department of Fish & Wildlife', 'https://www.eregulations.com/washington/hunting/special-permit-application-instructions', 'webpage', 'WA'),
  -- North Dakota (gf.nd.gov not blocked; consolidated season-dates HTML, 2026-27)
  ('North Dakota Game and Fish Department', 'https://gf.nd.gov/hunting/season-dates', 'webpage', 'ND'),
  ('North Dakota Game and Fish Department', 'https://gf.nd.gov/hunting/deer', 'webpage', 'ND'),
  ('North Dakota Game and Fish Department', 'https://www.eregulations.com/northdakota/hunting/hunting-seasons-and-dates', 'webpage', 'ND'),
  -- South Dakota (gfp.sd.gov not blocked; eReg seasons page + agency key-dates page)
  ('South Dakota Game, Fish and Parks', 'https://www.eregulations.com/southdakota/hunting/hunting-seasons-and-dates', 'webpage', 'SD'),
  ('South Dakota Game, Fish and Parks', 'https://gfp.sd.gov/events/keydates/', 'webpage', 'SD'),
  -- Nebraska (outdoornebraska.gov 403-blocks datacenter fetches; use eReg mirror +
  -- a wire mirror of the official draw-deadline press release)
  ('Nebraska Game and Parks Commission', 'https://www.eregulations.com/nebraska/hunting/hunting-seasons-and-dates', 'webpage', 'NE'),
  ('Nebraska Game and Parks Commission', 'https://www.theoutdoorwire.com/releases/2026/05/big-game-draw-permit-applications-taken-june-1-12/', 'webpage', 'NE')
) as v(agency, url, doc_type, code)
where not exists (select 1 from public.sources s where s.url = v.url);
