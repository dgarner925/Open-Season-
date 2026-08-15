-- All-states pass, batch 3: CA, AK, HI — 2026-27 (all were empty).
-- Filled 2026-08-15 from official sources (CDFW approved-seasons PDF + program
-- pages; ADFG 2026-27 regulation PDFs; Hawaii DLNR HAR 13-123 framework).
-- AK rows are framework windows — nearly everything is registration/draw by
-- GMU, and the notes say so. HI game-bird seasons are NOT included: DLNR
-- announces them ~mid-October (follow-up item).

insert into public.sources (agency_name, url, doc_type, state_id, notes, last_extracted_at)
select v.agency, v.url, (case when v.url like '%.pdf' then 'pdf' else 'webpage' end)::source_doc_type, s.id, v.notes, now()
from (values
  ('California Department of Fish and Wildlife',
   'https://wildlife.ca.gov/Hunting/Upland-Game-Birds',
   'CA', '2026-27 filled manually 2026-08-15 from CDFW approved deer seasons PDF + bear/waterfowl/upland/small game pages.'),
  ('Alaska Department of Fish and Game',
   'https://www.adfg.alaska.gov/static/regulations/wildliferegulations/pdfs/waterfowl.pdf',
   'AK', '2026-27 filled manually 2026-08-15 from ADFG GMU and migratory bird regulation PDFs (effective Jul 1 2026 – Jun 30 2027).'),
  ('Hawaii DLNR Division of Forestry and Wildlife',
   'https://dlnr.hawaii.gov/recreation/files/2016/01/Chapter-123_Final.pdf',
   'HI', 'Game mammal framework (HAR 13-123) filled 2026-08-15. Game-bird 2026-27 announcement pending (~mid-October).')
) as v(agency, url, code, notes)
join public.states s on s.code = v.code
where not exists (select 1 from public.sources x where x.url = v.url);

insert into public.zones (state_id, name)
select s.id, v.zone
from (values
  ('CA','A Zone'),('CA','D Zones'),('CA','Balance of State'),
  ('AK','Southeast Alaska'),
  ('HI','Public Hunting Areas')
) as v(code, zone)
join public.states s on s.code = v.code
where not exists (select 1 from public.zones z where z.state_id = s.id and z.name = v.zone);

-- CALIFORNIA ----------------------------------------------------------------
with st as (select id from public.states where code = 'CA'),
src as (select id from public.sources where url = 'https://wildlife.ca.gov/Hunting/Upland-Game-Birds'),
rows_to_add (species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  ('deer', 'A Zone', 'firearm', 'A Zone General', date '2026-08-08', date '2026-09-20',
   '1 buck per tag.', 'Earliest general deer opener in California. A Zone archery ran Jul 11 – Aug 2.'),
  ('deer', 'D Zones', 'firearm', 'D Zone General (framework)', date '2026-09-26', date '2026-11-01',
   '1 buck per tag.', 'Shown: D3-D5. Varies by zone — D6/D7 Sep 19 – Nov 1; D11/13/14/15 Oct 10 – Nov 8; D16 Oct 24 – Nov 22; others differ. D-zone archery Aug 15 – Sep 6 or Sep 5 – 27.'),
  ('bear', 'Statewide', 'general', 'Black Bear General', date '2026-10-10', date '2026-12-27',
   '1 per license year.', 'Closes earlier if the 1,700-bear statewide quota is reached. Archery Aug 15 – Sep 6. Cubs and females with cubs protected.'),
  ('dove', 'Statewide', 'general', 'Segment 1', date '2026-09-01', date '2026-09-15',
   '15 per day (max 10 white-winged).', 'Second segment Nov 14 – Dec 28. Eurasian collared-dove open all year, no limit.'),
  ('duck', 'Balance of State', 'general', 'Duck', date '2026-10-24', date '2027-01-31',
   '7 per day.', 'Balance of State zone; other zones differ.'),
  ('goose', 'Balance of State', 'general', 'Goose', date '2026-10-24', date '2027-01-31',
   '30 per day (20 white, 10 dark).', 'Late season: Canada geese Feb 20 – 21; white-fronted + white geese Feb 20 – 24.'),
  ('western-quail', 'Statewide', 'general', 'Quail General (Zones Q1/Q3)', date '2026-10-17', date '2027-01-31',
   '10 per day.', 'Zone Q2 opens Sep 26. Q1 mountain-quail-only early season Sep 12 – Oct 16.'),
  ('turkey', 'Statewide', 'general', 'Fall Turkey', date '2026-11-14', date '2026-12-13',
   '1 per day, either sex.', null),
  ('rabbit', 'Statewide', 'general', 'Cottontail & Brush Rabbit', date '2026-07-01', date '2027-01-31',
   '5 per day.', 'Jackrabbit open all year, no limit.'),
  ('squirrel', 'Statewide', 'general', 'Tree Squirrel General', date '2026-09-12', date '2027-01-31',
   '4 per day.', 'Archery/falconry-only season Aug 1 – Sep 11.'),
  ('wild-hog', 'Statewide', 'general', 'Wild Pig (year-round)', date '2026-07-01', date '2027-06-30',
   'No daily limit.', 'Pig tag required per pig.')
)
insert into public.seasons
  (state_id, species_id, zone_id, season_year, method, label, open_date, close_date,
   bag_limit_summary, notes, source_id, last_verified_at, status)
select st.id, sp.id, z.id, 2026, r.method::season_method, r.label, r.open_date, r.close_date,
       r.bag, r.notes, src.id, now(), 'published'
from rows_to_add r cross join st cross join src
join public.species sp on sp.key = r.species_key
join public.zones z on z.state_id = st.id and z.name = r.zone_name
where not exists (
  select 1 from public.seasons s
  where s.state_id = st.id and s.species_id = sp.id and s.zone_id = z.id
    and s.method = r.method::season_method and s.season_year = 2026
    and coalesce(s.label, '') = coalesce(r.label, '')
);

-- ALASKA --------------------------------------------------------------------
with st as (select id from public.states where code = 'AK'),
src as (select id from public.sources where url = 'https://www.adfg.alaska.gov/static/regulations/wildliferegulations/pdfs/waterfowl.pdf'),
rows_to_add (species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  ('moose', 'Statewide', 'general', 'Moose (Interior framework)', date '2026-09-01', date '2026-09-25',
   '1 bull (antler restrictions by hunt).', 'Varies by GMU — mostly registration or draw hunts; many units Sep 1 – 15. Southeast registration Sep 15 – Oct 15.'),
  ('caribou', 'Statewide', 'general', 'Caribou (Interior framework)', date '2026-08-10', date '2026-09-20',
   '1 bull (some hunts 1 caribou).', 'Varies by GMU/herd; Fortymile registration windows differ; resident winter registration Oct 27 – Mar 31; many herds draw-only.'),
  ('deer', 'Southeast Alaska', 'general', 'Sitka Blacktail Deer', date '2026-08-01', date '2026-12-31',
   '2 – 6 deer by unit.', 'Harvest ticket; Southeast (GMUs 1-5) and Kodiak (GMU 8) framework. Varies by GMU.'),
  ('brown-bear', 'Southeast Alaska', 'general', 'Brown Bear — Fall (registration)', date '2026-09-15', date '2026-12-31',
   '1 bear every 4 regulatory years (SE).', 'Registration permit; spring season Mar 15 – May 31. Interior GMUs differ (some Aug 10 – Jun 30). Nonresidents need a guide.'),
  ('bear', 'Statewide', 'general', 'Black Bear', date '2026-09-01', date '2027-06-30',
   '1 – 3 bears by unit.', 'Southeast: 2 bears (residents) Sep 1 – Jun 30. Interior GMU 20: 3 bears, no closed season. Varies by GMU.'),
  ('dall-sheep', 'Statewide', 'general', 'Dall Sheep (harvest ticket framework)', date '2026-08-10', date '2026-09-20',
   '1 full-curl ram.', 'Many areas draw-only; Sheep Hunter Orientation required; youth hunt Aug 1 – 5.'),
  ('ptarmigan', 'Statewide', 'general', 'Ptarmigan', date '2026-08-10', date '2027-02-28',
   '20 per day (GMUs 12/20/25C).', 'Aug 1 opener in Southeast units; closers vary by unit Jan 31 – Jun 15.'),
  ('duck', 'Statewide', 'general', 'Duck (Northern & Gulf Coast zones)', date '2026-09-01', date '2026-12-16',
   '10/day Northern; 8/day Gulf Coast.', 'Southeast: Sep 1 – Nov 30 + Dec 16 – 31 (7/day). Kodiak/Aleutians: Oct 8 – Jan 22 (7/day).'),
  ('goose', 'Statewide', 'general', 'Goose (Canada/white-fronted/white)', date '2026-09-01', date '2026-12-16',
   'Canada 4/day; white geese 6/day.', 'Zone dates vary; brant Sep 1 – Oct 21. Emperor geese and trumpeter swans closed statewide.')
)
insert into public.seasons
  (state_id, species_id, zone_id, season_year, method, label, open_date, close_date,
   bag_limit_summary, notes, source_id, last_verified_at, status)
select st.id, sp.id, z.id, 2026, r.method::season_method, r.label, r.open_date, r.close_date,
       r.bag, r.notes, src.id, now(), 'published'
from rows_to_add r cross join st cross join src
join public.species sp on sp.key = r.species_key
join public.zones z on z.state_id = st.id and z.name = r.zone_name
where not exists (
  select 1 from public.seasons s
  where s.state_id = st.id and s.species_id = sp.id and s.zone_id = z.id
    and s.method = r.method::season_method and s.season_year = 2026
    and coalesce(s.label, '') = coalesce(r.label, '')
);

-- HAWAII ---------------------------------------------------------------------
with st as (select id from public.states where code = 'HI'),
src as (select id from public.sources where url = 'https://dlnr.hawaii.gov/recreation/files/2016/01/Chapter-123_Final.pdf'),
rows_to_add (species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  ('wild-hog', 'Public Hunting Areas', 'general', 'Feral Pig (public areas)', date '2026-07-01', date '2027-06-30',
   'Typically 1 – 2 per day; varies by unit.', 'Open year-round in many units, but hunting DAYS are limited to weekends and state holidays in most units. Season/method/bag set per unit (HAR 13-123).')
)
insert into public.seasons
  (state_id, species_id, zone_id, season_year, method, label, open_date, close_date,
   bag_limit_summary, notes, source_id, last_verified_at, status)
select st.id, sp.id, z.id, 2026, r.method::season_method, r.label, r.open_date, r.close_date,
       r.bag, r.notes, src.id, now(), 'published'
from rows_to_add r cross join st cross join src
join public.species sp on sp.key = r.species_key
join public.zones z on z.state_id = st.id and z.name = r.zone_name
where not exists (
  select 1 from public.seasons s
  where s.state_id = st.id and s.species_id = sp.id and s.zone_id = z.id
    and s.method = r.method::season_method and s.season_year = 2026
    and coalesce(s.label, '') = coalesce(r.label, '')
);
