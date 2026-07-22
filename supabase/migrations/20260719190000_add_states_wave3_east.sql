-- 20260719190000_add_states_wave3_east.sql
-- Wave 3 of the 50-state rollout: the eastern / Great Lakes block — Pennsylvania,
-- New York, Wisconsin, Minnesota, Missouri, West Virginia. All already exist as
-- inactive rows. Activate them, set agency + verified license portal, add a
-- Statewide zone, and register official source URLs for the extraction pipeline.
-- Every source verified live (fetched, July 2026). This block is almost entirely
-- lightweight HTML (agencies not IP-blocked), so few PDF-timeout risks; eReg
-- mirrors are registered as fallbacks and for categories a state hides in images.

-- 1. Activate states + agency + license portal ------------------------------
update public.states set is_active = true,
  agency_name = 'Pennsylvania Game Commission',
  license_url = coalesce(license_url, 'https://huntfish.pa.gov/')
where code = 'PA';
update public.states set is_active = true,
  agency_name = 'New York State Department of Environmental Conservation',
  license_url = coalesce(license_url, 'https://decals.east.licensing.app/')
where code = 'NY';
update public.states set is_active = true,
  agency_name = 'Wisconsin Department of Natural Resources',
  license_url = coalesce(license_url, 'https://gowild.wi.gov')
where code = 'WI';
update public.states set is_active = true,
  agency_name = 'Minnesota Department of Natural Resources',
  license_url = coalesce(license_url, 'https://licenses.dnr.state.mn.us/')
where code = 'MN';
update public.states set is_active = true,
  agency_name = 'Missouri Department of Conservation',
  license_url = coalesce(license_url, 'https://mdc-web.s3licensing.com/')
where code = 'MO';
update public.states set is_active = true,
  agency_name = 'West Virginia Division of Natural Resources',
  license_url = coalesce(license_url, 'https://www.wvhunt.com/login')
where code = 'WV';

-- 2. Statewide zone per new state -------------------------------------------
insert into public.zones (state_id, name, type)
select s.id, 'Statewide', 'statewide'
from public.states s
where s.code in ('PA', 'NY', 'WI', 'MN', 'MO', 'WV')
  and not exists (select 1 from public.zones z where z.state_id = s.id and z.name = 'Statewide');

-- 2b. Matrix gap: Missouri runs limited elk + black bear draws, but the species
-- matrix omitted them — so add the mappings, or extracted MO elk/bear data would
-- have no followable species in the picker.
insert into public.state_species (state_id, species_id)
  select st.id, sp.id from public.states st, public.species sp
  where st.code = 'MO' and sp.key in ('elk', 'bear')
  on conflict do nothing;

-- 3. Sources (guarded inserts; state_id resolved by code) -------------------
insert into public.sources (agency_name, url, doc_type, state_id)
select v.agency, v.url, v.doc_type::source_doc_type, (select id from public.states where code = v.code)
from (values
  -- Pennsylvania (pa.gov not blocked; one HTML page carries all seasons, 2026-27)
  ('Pennsylvania Game Commission', 'https://www.pa.gov/agencies/pgc/huntingandtrapping/regulations/seasons-and-bag-limits', 'webpage', 'PA'),
  ('Pennsylvania Game Commission', 'https://www.pa.gov/services/pgc/apply-for-an-elk-license', 'webpage', 'PA'),
  ('Pennsylvania Game Commission', 'https://www.eregulations.com/pennsylvania/hunting/hunting-seasons-and-dates', 'webpage', 'PA'),
  -- New York (dec.ny.gov not blocked; deer/bear + migratory have text dates 2026-27.
  -- Turkey + small game are image-only on every source — a known gap for later.)
  ('New York State Department of Environmental Conservation', 'https://dec.ny.gov/things-to-do/hunting/deer-bear/seasons', 'webpage', 'NY'),
  ('New York State Department of Environmental Conservation', 'https://dec.ny.gov/things-to-do/hunting/migratory-game-bird/seasons', 'webpage', 'NY'),
  ('New York State Department of Environmental Conservation', 'https://dec.ny.gov/things-to-do/hunting/deer-bear/deer-management-permits', 'webpage', 'NY'),
  -- Wisconsin (dnr.wisconsin.gov not blocked; one dates page + elk newsroom release)
  ('Wisconsin Department of Natural Resources', 'https://dnr.wisconsin.gov/topic/hunt/dates', 'webpage', 'WI'),
  ('Wisconsin Department of Natural Resources', 'https://dnr.wisconsin.gov/newsroom/release/123136', 'webpage', 'WI'),
  ('Wisconsin Department of Natural Resources', 'https://www.eregulations.com/wisconsin/hunting/hunting-seasons-and-dates', 'webpage', 'WI'),
  -- Minnesota (dnr.state.mn.us not blocked; per-topic HTML pages, 2026-27)
  ('Minnesota Department of Natural Resources', 'https://www.dnr.state.mn.us/hunting/seasons.html', 'webpage', 'MN'),
  ('Minnesota Department of Natural Resources', 'https://www.dnr.state.mn.us/hunting/elk/index.html', 'webpage', 'MN'),
  ('Minnesota Department of Natural Resources', 'https://www.dnr.state.mn.us/hunting/turkey/index.html', 'webpage', 'MN'),
  ('Minnesota Department of Natural Resources', 'https://www.dnr.state.mn.us/hunting/waterfowl/seasons.html', 'webpage', 'MN'),
  ('Minnesota Department of Natural Resources', 'https://www.dnr.state.mn.us/hunting/bear/index.html', 'webpage', 'MN'),
  ('Minnesota Department of Natural Resources', 'https://www.eregulations.com/minnesota/hunting/hunting-seasons-and-dates', 'webpage', 'MN'),
  -- Missouri (mdc.mo.gov not blocked; seasons page + species/draw pages, 2026-27)
  ('Missouri Department of Conservation', 'https://mdc.mo.gov/hunting-trapping/seasons', 'webpage', 'MO'),
  ('Missouri Department of Conservation', 'https://mdc.mo.gov/newsroom/mdc-sets-deer-turkey-hunting-dates-2026-2027-seasons', 'webpage', 'MO'),
  ('Missouri Department of Conservation', 'https://mdc.mo.gov/hunting-trapping/species/elk/elk-application-process', 'webpage', 'MO'),
  ('Missouri Department of Conservation', 'https://mdc.mo.gov/hunting-trapping/species/bear/bear-application-draw-process', 'webpage', 'MO'),
  ('Missouri Department of Conservation', 'https://www.eregulations.com/missouri/hunting/hunting-seasons-and-dates', 'webpage', 'MO'),
  -- West Virginia (wvdnr.gov not blocked; one HTML seasons page + lottery page.
  -- Migratory is on a separate PDF only — eReg mirror covers it as fallback.)
  ('West Virginia Division of Natural Resources', 'https://wvdnr.gov/hunting-seasons/', 'webpage', 'WV'),
  ('West Virginia Division of Natural Resources', 'https://wvdnr.gov/hunting/wv-lottery-hunts/', 'webpage', 'WV'),
  ('West Virginia Division of Natural Resources', 'https://www.eregulations.com/westvirginia/hunting/hunting-seasons-and-dates', 'webpage', 'WV')
) as v(agency, url, doc_type, code)
where not exists (select 1 from public.sources s where s.url = v.url);
