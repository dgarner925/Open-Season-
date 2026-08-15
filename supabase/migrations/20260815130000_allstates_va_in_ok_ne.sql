-- All-states pass, batch 1: VA, IN, OK, NE — 2026-27 seasons (all four were
-- EMPTY). Filled 2026-08-15 from official sources:
--   VA: dwr.virginia.gov regulation pages (deer/bear/turkey/small game/migratory).
--   IN: official DNR Apr 2026 – Mar 2027 seasons PDF (highest confidence).
--   OK: wildlifedepartment.com seasons + big-game pages.
--   NE: NGPC (outdoornebraska.gov) commission releases + seasons page; NGPC
--       blocks bots so some standard annual dates confirmed via snippets —
--       flagged "confirm in guide" in notes where applicable.
-- NE sandhill crane deliberately omitted: permanently closed by statute.

insert into public.sources (agency_name, url, doc_type, state_id, notes, last_extracted_at)
select v.agency, v.url, (case when v.url like '%.pdf' then 'pdf' else 'webpage' end)::source_doc_type, s.id, v.notes, now()
from (values
  ('Virginia Department of Wildlife Resources',
   'https://dwr.virginia.gov/hunting/regulations/deer/',
   'VA', '2026-27 filled manually 2026-08-15 from DWR regulation pages (deer, bear, turkey, small game, migratory).'),
  ('Indiana Department of Natural Resources',
   'https://www.in.gov/dA/2c17f1f4d5/fw-hunting_trapping_seasons.pdf',
   'IN', '2026-27 filled manually 2026-08-15 from the official DNR seasons PDF.'),
  ('Oklahoma Department of Wildlife Conservation',
   'https://www.wildlifedepartment.com/hunting/seasons',
   'OK', '2026-27 filled manually 2026-08-15 from ODWC seasons and big-game pages.'),
  ('Nebraska Game and Parks Commission',
   'https://outdoornebraska.gov/hunt/hunting-seasons/',
   'NE', '2026-27 filled manually 2026-08-15 from NGPC releases/pages; some standard annual dates to re-confirm in printed guides.')
) as v(agency, url, code, notes)
join public.states s on s.code = v.code
where not exists (select 1 from public.sources x where x.url = v.url);

insert into public.zones (state_id, name)
select s.id, v.zone
from (values
  ('VA','Statewide'),('VA','Most Counties'),('VA','West & Central Counties'),('VA','Elk Management Zone'),('VA','Resident Goose Zone'),
  ('IN','Statewide'),('IN','Open Counties'),('IN','North Zone'),('IN','South of I-74'),
  ('OK','Statewide'),('OK','Open Counties'),('OK','Zones 1 & 2'),('OK','Crane Hunting Zone'),
  ('NE','Statewide'),('NE','Elk Units'),('NE','Low & High Plains'),('NE','Zone 1'),('NE','Platte River & Niobrara Units')
) as v(code, zone)
join public.states s on s.code = v.code
where not exists (select 1 from public.zones z where z.state_id = s.id and z.name = v.zone);

-- VIRGINIA --------------------------------------------------------------------
with st as (select id from public.states where code = 'VA'),
src as (select id from public.sources where url = 'https://dwr.virginia.gov/hunting/regulations/deer/'),
rows_to_add (species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  ('deer', 'Statewide', 'archery', 'Early Archery', date '2026-10-03', date '2026-11-13',
   '5-6 per license year (2 per day).', 'Late archery (Nov 29 or Dec 13 – Jan 2) varies by county. Urban archery Sep 5 – Oct 2, antlerless only.'),
  ('deer', 'Statewide', 'muzzleloader', 'Early Muzzleloader', date '2026-10-31', date '2026-11-13',
   null, 'Late muzzleloader Dec 12 – Jan 2 west of the Blue Ridge plus select eastern counties.'),
  ('deer', 'Most Counties', 'firearm', 'General Firearms', date '2026-11-14', date '2027-01-02',
   'East: 6/yr (max 3 antlered). West: 5/yr (max 2 antlered).', 'County exceptions apply — check DWR county tables.'),
  ('bear', 'Statewide', 'archery', 'Archery', date '2026-10-03', date '2026-11-13',
   '1 per license year.', 'Opens Oct 17 in some northwestern counties.'),
  ('bear', 'West & Central Counties', 'firearm', 'Firearms', date '2026-11-23', date '2027-01-02',
   '1 per license year (min 100 lb live weight).', 'Dates vary by county group; bear muzzleloader Nov 7 – 13 in most areas.'),
  ('elk', 'Elk Management Zone', 'general', 'Elk Lottery Hunt', date '2026-10-10', date '2026-10-16',
   '1 elk per drawn tag.', 'Lottery-drawn tags only; Buchanan, Dickenson & Wise counties.'),
  ('turkey', 'Statewide', 'general', 'Fall Turkey (main segment)', date '2026-10-17', date '2026-10-30',
   '3 per license year (1/day; only 1 beardless).', 'Additional segments by zone: Nov 25 – 26, Nov 30 – Dec 12 or Dec 26, Jan 9 – 23.'),
  ('dove', 'Statewide', 'general', 'Segment 1', date '2026-09-05', date '2026-10-24', '15 per day.', null),
  ('dove', 'Statewide', 'general', 'Segment 2', date '2026-11-21', date '2026-11-29', '15 per day.', null),
  ('dove', 'Statewide', 'general', 'Segment 3', date '2026-12-19', date '2027-01-18', '15 per day.', null),
  ('duck', 'Statewide', 'general', 'September Teal', date '2026-09-19', date '2026-09-27',
   '6 per day.', 'East of I-95 Sep 19 – 27; west of I-95 Sep 22 – 27.'),
  ('duck', 'Statewide', 'general', 'Regular Season', date '2026-10-09', date '2027-01-31',
   '6 per day.', 'Segments: Oct 9 – 12 (black duck closed), Nov 18 – 29, Dec 19 – Jan 31.'),
  ('goose', 'Resident Goose Zone', 'general', 'Canada Goose (RP Zone)', date '2026-11-18', date '2027-02-21',
   '5 per day.', 'Segments Nov 18 – 29 and Dec 19 – Feb 21. AP Zone: Nov 24 – 29 + Dec 24 – Jan 31, 2/day. September resident goose statewide Sep 1 – 25, 10/day.'),
  ('bobwhite', 'Statewide', 'general', null, date '2026-11-07', date '2027-01-31',
   '6 per day.', 'Closed on all public lands west of the Blue Ridge.'),
  ('squirrel', 'Statewide', 'general', null, date '2026-09-05', date '2027-02-28',
   '6 per day, all species combined.', 'Fox squirrel closes Jan 31 in designated counties.'),
  ('rabbit', 'Statewide', 'general', null, date '2026-10-31', date '2027-02-28', '6 per day.', null)
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

-- INDIANA ----------------------------------------------------------------------
with st as (select id from public.states where code = 'IN'),
src as (select id from public.sources where url = 'https://www.in.gov/dA/2c17f1f4d5/fw-hunting_trapping_seasons.pdf'),
rows_to_add (species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  ('deer', 'Statewide', 'archery', 'Archery', date '2026-10-01', date '2027-01-03',
   'County bundle rules apply.', 'Youth weekend Sep 26 – 27. Reduction zones Sep 15 – Jan 31.'),
  ('deer', 'Statewide', 'firearm', 'Firearms', date '2026-11-14', date '2026-11-29', null, null),
  ('deer', 'Statewide', 'muzzleloader', 'Muzzleloader', date '2026-12-05', date '2026-12-20', null, null),
  ('turkey', 'Open Counties', 'archery', 'Fall Archery', date '2026-10-01', date '2026-11-01',
   '1 bird either sex per fall.', 'Second segment Dec 5 – Jan 3; open counties only.'),
  ('turkey', 'Open Counties', 'firearm', 'Fall Firearms', date '2026-10-21', date '2026-11-01',
   '1 bird either sex per fall.', 'Shared one-bird fall limit regardless of equipment.'),
  ('dove', 'Statewide', 'general', 'Dove (three segments)', date '2026-09-01', date '2026-12-31',
   '15 per day.', 'Segments: Sep 1 – Oct 18, Nov 1 – 29, Dec 19 – 31.'),
  ('duck', 'Statewide', 'general', 'Early Teal', date '2026-09-05', date '2026-09-13',
   '6 per day.', 'Sunrise to sunset.'),
  ('duck', 'North Zone', 'general', 'Duck', date '2026-10-24', date '2026-12-27',
   '6 per day.', 'North: Oct 24 – Dec 13 + Dec 19 – 27. Central: Oct 31 – Nov 8 + Nov 21 – Jan 10. South: Nov 7 – 8 + Nov 28 – Jan 24.'),
  ('goose', 'North Zone', 'general', 'Canada Goose', date '2026-09-05', date '2027-02-14',
   '5 per day (Canada + brant aggregate).', 'North segments Sep 5 – 13, Oct 24 – Nov 1, Nov 21 – Feb 14; Central/South differ slightly. Light geese 20/day.'),
  ('bobwhite', 'South of I-74', 'general', 'Quail', date '2026-11-01', date '2027-01-10',
   '8 per day.', 'North of I-74: Nov 1 – Dec 15, 4/day.'),
  ('squirrel', 'Statewide', 'general', 'Gray & Fox Squirrel', date '2026-08-15', date '2027-01-31', '5 per day.', null),
  ('rabbit', 'Statewide', 'general', null, date '2026-11-01', date '2027-02-28', '5 per day.', null),
  ('woodcock', 'Statewide', 'general', null, date '2026-10-15', date '2026-11-28', '3 per day.', null)
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

-- OKLAHOMA ---------------------------------------------------------------------
with st as (select id from public.states where code = 'OK'),
src as (select id from public.sources where url = 'https://www.wildlifedepartment.com/hunting/seasons'),
rows_to_add (species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  ('deer', 'Statewide', 'archery', 'Archery', date '2026-10-01', date '2027-01-15',
   'Combined limit incl. max 6 antlerless.', null),
  ('deer', 'Statewide', 'muzzleloader', 'Muzzleloader', date '2026-10-24', date '2026-11-01',
   null, 'Youth gun Oct 16 – 18.'),
  ('deer', 'Statewide', 'firearm', 'Gun', date '2026-11-21', date '2026-12-06',
   null, 'Holiday antlerless gun season Dec 18 – 31.'),
  ('elk', 'Open Counties', 'general', 'Elk (private lands / open range)', date '2026-10-01', date '2027-01-15',
   null, 'Archery Oct 1 – Jan 15; muzzleloader Oct 24 – Nov 1; gun Nov 21 – Dec 6. Special-zone and controlled hunts differ.'),
  ('turkey', 'Open Counties', 'archery', 'Fall Archery', date '2026-10-01', date '2027-01-15',
   null, 'Fall bag and county openings per ODWC regs.'),
  ('turkey', 'Open Counties', 'firearm', 'Fall Gun', date '2026-10-31', date '2026-11-20', null, null),
  ('dove', 'Statewide', 'general', 'Dove (two segments)', date '2026-09-01', date '2026-12-29',
   null, 'Segments: Sep 1 – Oct 31 and Dec 1 – 29.'),
  ('duck', 'Statewide', 'general', 'September Teal', date '2026-09-12', date '2026-09-20', null, null),
  ('duck', 'Zones 1 & 2', 'general', 'Duck', date '2026-11-14', date '2027-01-31',
   null, 'Segments Nov 14 – Dec 6 + Dec 12 – Jan 31. Panhandle zone: Oct 10 – Jan 13.'),
  ('goose', 'Statewide', 'general', 'Goose (dark & light)', date '2026-11-07', date '2027-02-14',
   null, 'Segments Nov 7 – Dec 6 + Dec 12 – Feb 14.'),
  ('bobwhite', 'Statewide', 'general', 'Quail', date '2026-11-14', date '2027-02-15', null, null),
  ('squirrel', 'Statewide', 'general', null, date '2026-05-15', date '2027-02-28', null, null),
  ('rabbit', 'Statewide', 'general', null, date '2026-10-01', date '2027-03-15', null, null),
  ('sandhill-crane', 'Crane Hunting Zone', 'general', 'Sandhill Crane', date '2026-10-17', date '2027-01-17',
   null, 'Designated western-Oklahoma crane zone only; free federal sandhill crane permit required.')
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

-- NEBRASKA ---------------------------------------------------------------------
with st as (select id from public.states where code = 'NE'),
src as (select id from public.sources where url = 'https://outdoornebraska.gov/hunt/hunting-seasons/'),
rows_to_add (species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  ('deer', 'Statewide', 'archery', 'Archery', date '2026-09-01', date '2026-12-31', 'Per permit.', null),
  ('deer', 'Statewide', 'firearm', 'November Firearm', date '2026-11-14', date '2026-11-22',
   'Per permit.', 'November firearm permits reduced 6% for 2026.'),
  ('deer', 'Statewide', 'muzzleloader', 'Muzzleloader', date '2026-12-01', date '2026-12-31',
   'Per permit.', 'Standard annual dates — confirm in the 2026 Big Game Guide.'),
  ('elk', 'Elk Units', 'general', 'Elk (bull, draw permits)', date '2026-09-01', date '2026-12-31',
   '1 per drawn permit.', 'Archery Sep 1 – Oct 31 + Dec 16 – 31; firearm Sep 21 – Oct 31 + Dec 16 – 31. Limited-draw permits only.'),
  ('turkey', 'Statewide', 'general', 'Fall Turkey', date '2026-10-01', date '2026-11-30',
   '1 either sex (one fall permit per year).', 'Shotgun or archery.'),
  ('dove', 'Statewide', 'general', 'Dove', date '2026-09-01', date '2026-10-30',
   null, 'Mourning, white-winged, and Eurasian collared doves.'),
  ('duck', 'Low & High Plains', 'general', 'September Teal', date '2026-09-05', date '2026-09-13',
   '6 per day.', 'Shortened 9-day season due to blue-winged teal population status.'),
  ('duck', 'Zone 1', 'general', 'Duck & Coot', date '2026-10-24', date '2027-01-17',
   'Tier I: 6/day; Tier II: 3/day.', 'Zone 1 segments Oct 24 – Dec 6 + Dec 19 – Jan 17. Zone 2: Oct 3 – Dec 15 (+ Jan 6 – 27 High Plains). New 3-zone setup for 2026-27 — check NGPC guide for Zone 3.'),
  ('goose', 'Platte River & Niobrara Units', 'general', 'Dark Goose', date '2026-10-28', date '2027-02-09',
   '5 per day.', 'North Central unit Oct 3 – Jan 15. White-fronted statewide Oct 17 – Dec 27 + Jan 25 – Feb 9 (2/day). Light goose Oct 3 – Dec 30 + Jan 25 – Feb 9 (50/day).'),
  ('bobwhite', 'Statewide', 'general', 'Quail', date '2026-10-31', date '2027-01-31',
   null, 'Youth season Oct 24 – 25.'),
  ('pheasant', 'Statewide', 'general', 'Pheasant', date '2026-10-31', date '2027-01-31',
   null, '100th Nebraska pheasant season. Youth Oct 24 – 25.'),
  ('squirrel', 'Statewide', 'general', null, date '2026-08-01', date '2027-01-31',
   null, 'Standard annual dates — confirm in the Small Game Guide.'),
  ('rabbit', 'Statewide', 'general', 'Cottontail', date '2026-09-01', date '2027-02-28',
   null, 'Standard annual dates — confirm in the Small Game Guide.')
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
