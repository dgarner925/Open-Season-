-- September catch-up: SC, TN, MS, LA — 2026-27 seasons filled manually from
-- official sources (2026-08-15). MS previously had ZERO season rows; TN/LA/SC
-- carried mostly stale 2025-26 rows (which self-hide once past close_date).
--
-- Sources:
--   TN: TWRA season summary (tn.gov/twra) — exact published dates.
--   SC: eRegulations SC (official regs publisher) for deer/small game;
--       early migratory dates as announced by SCDNR (approved by USFWS).
--   MS: eRegulations MS 2026-27 pages (mdwfp.com TLS cert currently broken).
--   LA: LDWF 2026-2027 hunting dates PDF (adopted by LWFC via NOI, Jan 2026).
--       Note on rows: adopted-NOI dates; confirm against the official digest.
--
-- Same dedupe key as the GA fill: (state, species, zone, method, year, label).

-- 1. Sources -----------------------------------------------------------------
insert into public.sources (agency_name, url, doc_type, state_id, notes, last_extracted_at)
select v.agency, v.url, (case when v.url like '%.pdf' then 'pdf' else 'webpage' end)::source_doc_type, s.id, v.notes, now()
from (values
  ('Tennessee Wildlife Resources Agency',
   'https://www.tn.gov/twra/hunting/tennessee-hunting-seasons-summary.html',
   'TN', '2026-27 season summary. Filled manually 2026-08-15.'),
  ('South Carolina Department of Natural Resources',
   'https://www.eregulations.com/southcarolina/hunting/deer-seasons-on-private-lands',
   'SC', '2026-27 deer/small game via eRegulations; early migratory per SCDNR announcement. Filled manually 2026-08-15.'),
  ('Mississippi Department of Wildlife, Fisheries, and Parks',
   'https://www.eregulations.com/mississippi/hunting/deer-hunting-seasons',
   'MS', '2026-27 via eRegulations MS (mdwfp.com cert broken at fill time). Filled manually 2026-08-15.'),
  ('Louisiana Department of Wildlife and Fisheries',
   'https://www.wlf.louisiana.gov/assets/Resources/Publications/Commission_Action_Items/2026-2027-Proposed-Hunting-Dates.pdf',
   'LA', '2026-27 dates adopted by LWFC (NOI Jan 2026). Filled manually 2026-08-15.')
) as v(agency, url, code, notes)
join public.states s on s.code = v.code
where not exists (select 1 from public.sources x where x.url = v.url);

-- 2. Zones needed by this fill -----------------------------------------------
insert into public.zones (state_id, name)
select s.id, v.zone
from (values
  ('SC', 'Game Zone 3'),
  ('MS', 'Delta, North Central & Hills DMUs'),
  ('MS', 'Southeast DMU'),
  ('LA', 'Areas 1 & 4'),
  ('LA', 'Areas 5, 6 & 9')
) as v(code, zone)
join public.states s on s.code = v.code
where not exists (
  select 1 from public.zones z where z.state_id = s.id and z.name = v.zone
);

-- 3. TENNESSEE ---------------------------------------------------------------
with st as (select id from public.states where code = 'TN'),
src as (select id from public.sources where url = 'https://www.tn.gov/twra/hunting/tennessee-hunting-seasons-summary.html'),
rows_to_add (species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  ('deer', 'Statewide', 'archery', 'August Archery (private lands)', date '2026-08-28', date '2026-08-30',
   null, 'Private lands only.'),
  ('deer', 'Statewide', 'archery', 'Archery Segment 1', date '2026-09-26', date '2026-10-30', null, null),
  ('deer', 'Statewide', 'archery', 'Archery Segment 2', date '2026-11-02', date '2026-11-06', null, null),
  ('deer', 'Statewide', 'muzzleloader', 'Muzzleloader/Archery', date '2026-11-07', date '2026-11-20', null, null),
  ('deer', 'Statewide', 'firearm', 'Gun/Muzzleloader/Archery', date '2026-11-21', date '2027-01-03', null, null),
  ('dove', 'Statewide', 'general', 'Segment 1', date '2026-09-01', date '2026-09-28',
   '15 per day.', 'Opening day begins at noon.'),
  ('dove', 'Statewide', 'general', 'Segment 2', date '2026-10-10', date '2026-11-01', '15 per day.', null),
  ('dove', 'Statewide', 'general', 'Segment 3', date '2026-12-08', date '2027-01-15', '15 per day.', null),
  ('duck', 'Statewide', 'general', 'September Wood Duck & Teal', date '2026-09-12', date '2026-09-16',
   '6 per day; no more than 2 wood ducks.', null),
  ('duck', 'Statewide', 'general', 'Regular Season Split 1', date '2026-11-28', date '2026-11-29', '6 per day.', null),
  ('duck', 'Statewide', 'general', 'Regular Season Split 2', date '2026-12-05', date '2027-01-31', '6 per day.', null),
  ('sandhill-crane', 'Statewide', 'general', 'Sandhill Crane (tag holders)', date '2026-12-03', date '2027-01-31',
   'Per allocated tag.', 'Tags allocated by draw — apply with TWRA in summer. Post-season survey due Feb 10.'),
  ('bobwhite', 'Statewide', 'general', null, date '2026-11-07', date '2027-02-28', '6 per day.', null),
  ('squirrel', 'Statewide', 'general', null, date '2026-08-22', date '2027-03-15', '10 per day.', null)
)
insert into public.seasons
  (state_id, species_id, zone_id, season_year, method, label, open_date, close_date,
   bag_limit_summary, notes, source_id, last_verified_at, status)
select st.id, sp.id, z.id, 2026, r.method::season_method, r.label, r.open_date, r.close_date,
       r.bag, r.notes, src.id, now(), 'published'
from rows_to_add r
cross join st cross join src
join public.species sp on sp.key = r.species_key
join public.zones z on z.state_id = st.id and z.name = r.zone_name
where not exists (
  select 1 from public.seasons s
  where s.state_id = st.id and s.species_id = sp.id and s.zone_id = z.id
    and s.method = r.method::season_method and s.season_year = 2026
    and coalesce(s.label, '') = coalesce(r.label, '')
);

-- 4. SOUTH CAROLINA ----------------------------------------------------------
with st as (select id from public.states where code = 'SC'),
src as (select id from public.sources where url = 'https://www.eregulations.com/southcarolina/hunting/deer-seasons-on-private-lands'),
rows_to_add (species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  -- Deer (private lands)
  ('deer', 'Game Zone 1', 'muzzleloader', 'Primitive Weapons', date '2026-10-01', date '2026-10-10',
   'Antlered: 2/day, 5 season (residents). Antlerless: 2/day, 3 season.', 'Private lands.'),
  ('deer', 'Game Zone 1', 'firearm', 'Gun Hunts', date '2026-10-11', date '2027-01-01', null, 'Private lands.'),
  ('deer', 'Game Zone 2', 'archery', 'Archery Only', date '2026-09-15', date '2026-09-30', null, 'Private lands.'),
  ('deer', 'Game Zone 2', 'muzzleloader', 'Primitive Weapons', date '2026-10-01', date '2026-10-10', null, 'Private lands.'),
  ('deer', 'Game Zone 2', 'firearm', 'Gun Hunts', date '2026-10-11', date '2027-01-01', null, 'Private lands.'),
  ('deer', 'Game Zone 3', 'general', 'Archery & Gun', date '2026-08-15', date '2027-01-01',
   'Antlerless: 2/day, 9 season.', 'Private lands. Aug 15 – Sep 14 bucks only.'),
  ('deer', 'Game Zone 4', 'archery', 'Archery Only', date '2026-08-15', date '2026-08-31',
   null, 'Private lands. Aug 15 – Sep 14 bucks only.'),
  ('deer', 'Game Zone 4', 'firearm', 'Gun Hunts', date '2026-09-01', date '2027-01-01',
   null, 'Private lands. Sep 1 – 14 bucks only.'),
  -- Early migratory (SCDNR-announced, USFWS-approved)
  ('dove', 'Statewide', 'general', 'Segment 1 (opening days noon–sunset)', date '2026-09-03', date '2026-09-05',
   '15 per day.', 'Sept 3–5 shooting hours are noon to sunset.'),
  ('dove', 'Statewide', 'general', 'Segment 1 (continued)', date '2026-09-06', date '2026-10-08', '15 per day.', null),
  ('dove', 'Statewide', 'general', 'Segment 2', date '2026-11-19', date '2026-11-26', '15 per day.', null),
  ('dove', 'Statewide', 'general', 'Segment 3', date '2026-12-21', date '2027-01-15', '15 per day.', null),
  ('duck', 'Statewide', 'general', 'Early Teal', date '2026-09-15', date '2026-09-30', '4 per day.', null),
  ('goose', 'Statewide', 'general', 'Early Canada Goose', date '2026-09-01', date '2026-09-30', '15 per day.', null),
  -- Small game (guns & dogs periods)
  ('bobwhite', 'Statewide', 'general', 'Guns & Dogs', date '2026-11-23', date '2027-03-01', '12 per day.', null),
  ('rabbit', 'Statewide', 'general', 'Guns & Dogs', date '2026-11-26', date '2027-03-01', '5 per day.', null),
  ('squirrel', 'Statewide', 'general', 'Guns & Dogs', date '2026-10-01', date '2027-03-01', '10 per day.', null),
  ('ruffed-grouse', 'Game Zone 1', 'general', null, date '2026-11-26', date '2027-03-01', '3 per day.', 'Game Zone 1 only.')
)
insert into public.seasons
  (state_id, species_id, zone_id, season_year, method, label, open_date, close_date,
   bag_limit_summary, notes, source_id, last_verified_at, status)
select st.id, sp.id, z.id, 2026, r.method::season_method, r.label, r.open_date, r.close_date,
       r.bag, r.notes, src.id, now(), 'published'
from rows_to_add r
cross join st cross join src
join public.species sp on sp.key = r.species_key
join public.zones z on z.state_id = st.id and z.name = r.zone_name
where not exists (
  select 1 from public.seasons s
  where s.state_id = st.id and s.species_id = sp.id and s.zone_id = z.id
    and s.method = r.method::season_method and s.season_year = 2026
    and coalesce(s.label, '') = coalesce(r.label, '')
);

-- 5. MISSISSIPPI (previously EMPTY) ------------------------------------------
with st as (select id from public.states where code = 'MS'),
src as (select id from public.sources where url = 'https://www.eregulations.com/mississippi/hunting/deer-hunting-seasons'),
rows_to_add (species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  -- Deer — Delta, North Central & Hills DMUs
  ('deer', 'Delta, North Central & Hills DMUs', 'archery', 'Archery (Velvet)', date '2026-09-11', date '2026-09-13',
   '1 legal buck.', 'Private/authorized lands; special permit and CWD sampling required.'),
  ('deer', 'Delta, North Central & Hills DMUs', 'archery', 'Archery', date '2026-10-01', date '2026-11-20',
   null, 'Either-sex on private and open public lands.'),
  ('deer', 'Delta, North Central & Hills DMUs', 'firearm', 'Gun (dogs allowed)', date '2026-11-21', date '2026-12-01',
   null, 'Either-sex on private land; legal bucks only on open public land.'),
  ('deer', 'Delta, North Central & Hills DMUs', 'muzzleloader', 'Primitive Weapon', date '2026-12-02', date '2026-12-15',
   null, 'Either-sex on all land types.'),
  ('deer', 'Delta, North Central & Hills DMUs', 'firearm', 'Gun (dogs not allowed)', date '2026-12-16', date '2026-12-23',
   null, 'Either-sex on private land; legal bucks only on open public land.'),
  ('deer', 'Delta, North Central & Hills DMUs', 'firearm', 'Gun (dogs allowed) — Late', date '2026-12-24', date '2027-01-20',
   null, null),
  ('deer', 'Delta, North Central & Hills DMUs', 'archery', 'Archery/Primitive — Late', date '2027-01-21', date '2027-01-31',
   null, null),
  -- Deer — Southeast DMU
  ('deer', 'Southeast DMU', 'archery', 'Archery (Velvet)', date '2026-09-11', date '2026-09-13',
   '1 legal buck.', 'Special permit and CWD sampling required.'),
  ('deer', 'Southeast DMU', 'archery', 'Archery', date '2026-10-15', date '2026-11-20', null, null),
  ('deer', 'Southeast DMU', 'firearm', 'Gun (dogs allowed)', date '2026-11-21', date '2026-12-01', null, null),
  ('deer', 'Southeast DMU', 'muzzleloader', 'Primitive Weapon', date '2026-12-02', date '2026-12-15', null, null),
  ('deer', 'Southeast DMU', 'firearm', 'Gun (dogs not allowed)', date '2026-12-16', date '2026-12-23', null, null),
  ('deer', 'Southeast DMU', 'firearm', 'Gun (dogs allowed) — Late', date '2026-12-24', date '2027-01-20', null, null),
  ('deer', 'Southeast DMU', 'archery', 'Archery/Primitive — Late', date '2027-01-21', date '2027-02-15',
   null, 'Southeast DMU runs through Feb 15.'),
  -- Migratory & small game (statewide)
  ('dove', 'Statewide', 'general', 'Segment 1', date '2026-09-05', date '2026-10-04', '15 per day.', null),
  ('dove', 'Statewide', 'general', 'Segment 2', date '2026-10-24', date '2026-11-22', '15 per day.', null),
  ('dove', 'Statewide', 'general', 'Segment 3', date '2026-12-26', date '2027-01-24', '15 per day.', null),
  ('duck', 'Statewide', 'general', 'September Teal', date '2026-09-19', date '2026-09-27', '6 per day.', null),
  ('duck', 'Statewide', 'general', 'Regular Season Split 1', date '2026-11-27', date '2026-11-29', '6 per day.', null),
  ('duck', 'Statewide', 'general', 'Regular Season Split 2', date '2026-12-04', date '2026-12-06', '6 per day.', null),
  ('duck', 'Statewide', 'general', 'Regular Season Split 3', date '2026-12-09', date '2027-01-31', '6 per day.', null),
  ('goose', 'Statewide', 'general', 'Season Split 1', date '2026-11-13', date '2026-11-29',
   'Canada 5; Snow/Blue/Ross''s 20; White-fronted 3; Brant 1 per day.', null),
  ('goose', 'Statewide', 'general', 'Season Split 2', date '2026-12-04', date '2026-12-06',
   'Canada 5; Snow/Blue/Ross''s 20; White-fronted 3; Brant 1 per day.', null),
  ('goose', 'Statewide', 'general', 'Season Split 3', date '2026-12-09', date '2027-01-31',
   'Canada 5; Snow/Blue/Ross''s 20; White-fronted 3; Brant 1 per day.', null),
  ('squirrel', 'Statewide', 'general', 'Fall Season', date '2026-10-01', date '2027-02-28', '8 per day.', null),
  ('rabbit', 'Statewide', 'general', null, date '2026-10-17', date '2027-02-28', '8 per day.', null),
  ('bobwhite', 'Statewide', 'general', null, date '2026-11-26', date '2027-03-07', '8 per day.', null),
  ('woodcock', 'Statewide', 'general', null, date '2026-12-18', date '2027-01-31', '3 per day.', null),
  ('snipe', 'Statewide', 'general', null, date '2026-11-14', date '2027-02-28', '8 per day.', null)
)
insert into public.seasons
  (state_id, species_id, zone_id, season_year, method, label, open_date, close_date,
   bag_limit_summary, notes, source_id, last_verified_at, status)
select st.id, sp.id, z.id, 2026, r.method::season_method, r.label, r.open_date, r.close_date,
       r.bag, r.notes, src.id, now(), 'published'
from rows_to_add r
cross join st cross join src
join public.species sp on sp.key = r.species_key
join public.zones z on z.state_id = st.id and z.name = r.zone_name
where not exists (
  select 1 from public.seasons s
  where s.state_id = st.id and s.species_id = sp.id and s.zone_id = z.id
    and s.method = r.method::season_method and s.season_year = 2026
    and coalesce(s.label, '') = coalesce(r.label, '')
);

-- 6. LOUISIANA ---------------------------------------------------------------
-- Dates adopted by LWFC (NOI Jan 2026). Waterfowl/dove zone splits are encoded
-- in labels on the Statewide zone to avoid zone sprawl.
with st as (select id from public.states where code = 'LA'),
src as (select id from public.sources where url = 'https://www.wlf.louisiana.gov/assets/Resources/Publications/Commission_Action_Items/2026-2027-Proposed-Hunting-Dates.pdf'),
rows_to_add (species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  -- Deer — Areas 1 & 4
  ('deer', 'Areas 1 & 4', 'archery', 'Archery (Either-Sex)', date '2026-10-01', date '2027-01-31', null, null),
  ('deer', 'Areas 1 & 4', 'muzzleloader', 'Primitive Firearms', date '2026-11-14', date '2026-11-20',
   null, 'Second primitive split Jan 25 – 31.'),
  ('deer', 'Areas 1 & 4', 'firearm', 'Firearms (Still-Hunt Only)', date '2026-11-21', date '2026-12-11',
   null, 'Second still-hunt split Jan 4 – 24.'),
  ('deer', 'Areas 1 & 4', 'firearm', 'Firearms (With or Without Dogs)', date '2026-12-12', date '2027-01-03', null, null),
  ('deer', 'Areas 1 & 4', 'general', 'Youth & Veterans (Either-Sex)', date '2026-10-31', date '2026-11-06', null, null),
  -- Deer — Area 2
  ('deer', 'Area 2', 'archery', 'Velvet Season (bucks only)', date '2026-08-26', date '2026-09-06', null, null),
  ('deer', 'Area 2', 'archery', 'Archery (Either-Sex)', date '2026-10-01', date '2027-01-31', null, null),
  ('deer', 'Area 2', 'muzzleloader', 'Primitive Firearms', date '2026-10-24', date '2026-10-30',
   null, 'Second primitive split Jan 18 – 24.'),
  ('deer', 'Area 2', 'firearm', 'Firearms (Still-Hunt Only)', date '2026-10-31', date '2026-12-09', null, null),
  ('deer', 'Area 2', 'firearm', 'Firearms (With or Without Dogs)', date '2026-12-10', date '2027-01-17', null, null),
  ('deer', 'Area 2', 'general', 'Youth & Veterans (Either-Sex)', date '2026-10-10', date '2026-10-16', null, null),
  -- Deer — Areas 3, 7, 8 & 10 (early archery!)
  ('deer', 'Areas 3, 7, 8 & 10', 'archery', 'Archery (Either-Sex)', date '2026-09-19', date '2027-01-15', null, null),
  ('deer', 'Areas 3, 7, 8 & 10', 'muzzleloader', 'Primitive Firearms', date '2026-10-10', date '2026-10-16',
   null, 'Second primitive split Jan 4 – 10.'),
  ('deer', 'Areas 3, 7, 8 & 10', 'firearm', 'Firearms (Still-Hunt Only)', date '2026-10-17', date '2026-11-29',
   null, 'Area 10 still-hunt runs through Jan 3 with no dog season.'),
  ('deer', 'Areas 3, 7, 8 & 10', 'firearm', 'Firearms (With or Without Dogs)', date '2026-11-30', date '2027-01-03',
   null, 'Not applicable in Area 10.'),
  ('deer', 'Areas 3, 7, 8 & 10', 'general', 'Youth & Veterans (Either-Sex)', date '2026-09-26', date '2026-10-02', null, null),
  -- Deer — Areas 5, 6 & 9
  ('deer', 'Areas 5, 6 & 9', 'archery', 'Archery (bucks only Oct 1–15, then either-sex)', date '2026-10-01', date '2027-02-15',
   null, 'Either-sex Oct 16 – Feb 15 unless a bucks-only firearms season is in progress. Area 6 velvet season Sept 12 – 20.'),
  ('deer', 'Areas 5, 6 & 9', 'muzzleloader', 'Primitive Firearms', date '2026-11-14', date '2026-11-20',
   null, 'Second primitive split Jan 25 – 31.'),
  ('deer', 'Areas 5, 6 & 9', 'firearm', 'Firearms (see split details)', date '2026-11-21', date '2027-01-24',
   null, 'Alternating either-sex and bucks-only splits — check LDWF regs for exact split dates in your area.'),
  ('deer', 'Areas 5, 6 & 9', 'general', 'Youth & Veterans (Either-Sex)', date '2026-10-31', date '2026-11-06', null, null),
  -- Migratory
  ('dove', 'Statewide', 'general', 'South Zone — Segment 1', date '2026-09-05', date '2026-09-20', '15 per day.', null),
  ('dove', 'Statewide', 'general', 'South Zone — Segment 2', date '2026-10-17', date '2026-11-29', '15 per day.', null),
  ('dove', 'Statewide', 'general', 'South Zone — Segment 3', date '2026-12-12', date '2027-01-10', '15 per day.', null),
  ('dove', 'Statewide', 'general', 'North Zone — Segment 1', date '2026-09-05', date '2026-09-27', '15 per day.', null),
  ('dove', 'Statewide', 'general', 'North Zone — Segment 2', date '2026-10-10', date '2026-11-15', '15 per day.', null),
  ('dove', 'Statewide', 'general', 'North Zone — Segment 3', date '2026-12-19', date '2027-01-17', '15 per day.', null),
  ('duck', 'Statewide', 'general', 'September Teal', date '2026-09-19', date '2026-09-27', '6 per day.', null),
  ('duck', 'Statewide', 'general', 'West Zone — Split 1', date '2026-11-14', date '2026-12-06',
   '6 per day.', 'Youth & Veterans day Nov 7.'),
  ('duck', 'Statewide', 'general', 'West Zone — Split 2', date '2026-12-19', date '2027-01-24',
   '6 per day.', 'Youth & Veterans day Jan 30.'),
  ('duck', 'Statewide', 'general', 'East Zone — Split 1', date '2026-11-21', date '2026-12-06',
   '6 per day.', 'Youth & Veterans days Nov 14 and Feb 6.'),
  ('duck', 'Statewide', 'general', 'East Zone — Split 2', date '2026-12-19', date '2027-01-31', '6 per day.', null),
  ('goose', 'Statewide', 'general', 'All Geese — Split 1 (both zones)', date '2026-11-14', date '2026-12-06', null, null),
  ('goose', 'Statewide', 'general', 'All Geese — Split 2 (both zones)', date '2026-12-19', date '2027-02-07',
   null, 'Light goose conservation order: Dec 7 – 18 and Feb 8 – Mar 7.'),
  ('woodcock', 'Statewide', 'general', null, date '2026-12-18', date '2027-01-31', null, null),
  ('snipe', 'Statewide', 'general', 'Split 1', date '2026-10-31', date '2027-01-10', null, null),
  ('snipe', 'Statewide', 'general', 'Split 2', date '2027-01-25', date '2027-02-28', null, null),
  -- Resident small game
  ('squirrel', 'Statewide', 'general', null, date '2026-10-03', date '2027-02-28', '8 per day.', null),
  ('rabbit', 'Statewide', 'general', null, date '2026-10-03', date '2027-02-28', '8 per day.', null),
  ('bobwhite', 'Statewide', 'general', null, date '2026-11-21', date '2027-02-28', '10 per day.', null)
)
insert into public.seasons
  (state_id, species_id, zone_id, season_year, method, label, open_date, close_date,
   bag_limit_summary, notes, source_id, last_verified_at, status)
select st.id, sp.id, z.id, 2026, r.method::season_method, r.label, r.open_date, r.close_date,
       r.bag, r.notes, src.id, now(), 'published'
from rows_to_add r
cross join st cross join src
join public.species sp on sp.key = r.species_key
join public.zones z on z.state_id = st.id and z.name = r.zone_name
where not exists (
  select 1 from public.seasons s
  where s.state_id = st.id and s.species_id = sp.id and s.zone_id = z.id
    and s.method = r.method::season_method and s.season_year = 2026
    and coalesce(s.label, '') = coalesce(r.label, '')
);
