-- All-states pass, batch 6 (FINAL): AL, AZ, KS, NV — 2026-27.
-- AL had 1 row (launch-state embarrassment); AZ/KS/NV were stale 2025 data.
-- Filled 2026-08-15 from official sources: outdooralabama.com + eRegulations AL
-- digest; AZGFD official regulation PDFs; ksoutdoors.gov When-to-Hunt; NDOW
-- commission regulations (CR 25-07, CR 26-10, CR 26-13).
-- Deliberately omitted: AZ spring turkey/javelina 2027 (booklet publishes
-- ~mid-Sept — follow-up); KS fall turkey (closed by regulation).

insert into public.sources (agency_name, url, doc_type, state_id, notes, last_extracted_at)
select v.agency, v.url, (case when v.url like '%.pdf' then 'pdf' else 'webpage' end)::source_doc_type, s.id, v.notes, now()
from (values
  ('Alabama Department of Conservation and Natural Resources',
   'https://www.outdooralabama.com/seasons-and-bag-limits/deer-season',
   'AL', '2026-27 filled manually 2026-08-15 from outdooralabama.com + the official digest via eRegulations.'),
  ('Arizona Game & Fish Department',
   'https://azgfd-portal-wordpress-pantheon.s3.us-west-2.amazonaws.com/wp-content/uploads/2026/05/04081122/2026-27-Arizona-Hunting-Regulations.pdf',
   'AZ', '2026-27 filled manually 2026-08-15 from AZGFD official regulation PDFs. Spring 2027 turkey/javelina pending the spring booklet (~Sept).'),
  ('Kansas Department of Wildlife & Parks',
   'https://www.ksoutdoors.gov/outdoor-activities/hunting-in-kansas/when-to-hunt',
   'KS', '2026-27 filled manually 2026-08-15 from the official When-to-Hunt page.'),
  ('Nevada Department of Wildlife',
   'https://www.ndow.org/wp-content/uploads/2025/07/CR25-07-2025-2026-and-2026-2027-Big-Game-Seasons.pdf',
   'NV', '2026-27 filled manually 2026-08-15 from NDOW commission regulations (CR 25-07, 26-10, 26-13). Small-game book pending publication.')
) as v(agency, url, code, notes)
join public.states s on s.code = v.code
where not exists (select 1 from public.sources x where x.url = v.url);

insert into public.zones (state_id, name)
select s.id, v.zone
from (values
  ('AL','Zone A'),('AL','Zone 3'),('AL','North Zone'),('AL','South Zone'),
  ('KS','Low Plains'),('KS','High Plains'),('KS','Central Zone'),
  ('NV','Northwest Zone'),('NV','Northeast Zone')
) as v(code, zone)
join public.states s on s.code = v.code
where not exists (select 1 from public.zones z where z.state_id = s.id and z.name = v.zone);

-- ALABAMA ---------------------------------------------------------------------
with st as (select id from public.states where code = 'AL'),
src as (select id from public.sources where url = 'https://www.outdooralabama.com/seasons-and-bag-limits/deer-season'),
rows_to_add (species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  ('deer', 'Zone A', 'archery', 'Archery & Spot-and-Stalk', date '2026-10-15', date '2027-02-10',
   '1 per day; 3-buck season limit statewide.', 'Either sex. Zone B bucks-only Oct 15 – 24; Zones D/E run Oct 1 – Jan 27.'),
  ('deer', 'Zone A', 'muzzleloader', 'Special Muzzleloader & Air Rifle', date '2026-11-16', date '2026-11-20',
   '1 per day.', 'Either sex; private/leased land and open-permit public land. Youth gun Nov 13 – 16.'),
  ('deer', 'Zone A', 'firearm', 'Gun Deer (stalk, private land)', date '2026-11-21', date '2027-02-10',
   '1 per day.', 'Public land: bucks-only Nov 21 – Dec 11 + Jan 4 – Feb 10, either-sex Dec 12 – Jan 3. Zones C/D/E differ.'),
  ('turkey', 'Zone 3', 'firearm', 'Fall Turkey (Zone 3 only)', date '2026-11-14', date '2026-11-22',
   '1 gobbler per day.', 'Second fall segment Dec 12 – 27. No decoys in fall. 4-gobbler combined fall+spring limit.'),
  ('turkey', 'Statewide', 'firearm', 'Spring Turkey', date '2027-03-20', date '2027-05-03',
   '1 gobbler per day; 4 per year.', 'Zones 1 & 3 open Mar 20; Zone 2 opens Mar 27. Youth weekends precede. Hunt until 1 p.m.'),
  ('dove', 'North Zone', 'general', 'Dove (three segments)', date '2026-09-05', date '2027-01-17',
   '15 per day.', 'Segments: Sep 5 – Oct 18 (opening day noon – sunset), Nov 21 – 29, Dec 12 – Jan 17.'),
  ('dove', 'South Zone', 'general', 'Dove (three segments)', date '2026-09-12', date '2027-01-17',
   '15 per day.', 'Segments: Sep 12 – Oct 25 (opening day noon – sunset), Nov 21 – 29, Dec 12 – Jan 17.'),
  ('duck', 'Statewide', 'general', 'September Teal', date '2026-09-12', date '2026-09-20', '6 per day.', null),
  ('duck', 'Statewide', 'general', 'Duck, Coot & Merganser', date '2026-11-27', date '2027-01-31',
   '6 per day (max 4 mallards).', 'Segments Nov 27 – 28 and Dec 5 – Jan 31. Digest printed before final federal frameworks — verify before hunting.'),
  ('goose', 'Statewide', 'general', 'Goose (Canada & light)', date '2026-09-05', date '2027-01-31',
   '5 dark + 5 light per day.', 'Segments: Sep 5 – Oct 4, Oct 17 – 31, Nov 27 – 28, Dec 5 – Jan 31.'),
  ('bobwhite', 'Statewide', 'general', 'Quail', date '2026-11-07', date '2027-02-28',
   '8 per day.', 'Closed on Bankhead National Forest.'),
  ('squirrel', 'Statewide', 'general', null, date '2026-09-12', date '2027-02-28', '8 per day.', null),
  ('rabbit', 'Statewide', 'general', null, date '2026-09-12', date '2027-02-28', '8 per day.', null)
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

-- ARIZONA ---------------------------------------------------------------------
with st as (select id from public.states where code = 'AZ'),
src as (select id from public.sources where url = 'https://azgfd-portal-wordpress-pantheon.s3.us-west-2.amazonaws.com/wp-content/uploads/2026/05/04081122/2026-27-Arizona-Hunting-Regulations.pdf'),
rows_to_add (species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  ('deer', 'Statewide', 'archery', 'Archery OTC (nonpermit tag)', date '2026-08-21', date '2026-09-10',
   '1 deer per calendar year.', 'Additional OTC segments Dec 11 – 31 and Jan 1 – 31. Open units vary — check Commission Order 2.'),
  ('deer', 'Statewide', 'firearm', 'General Deer (draw permit)', date '2026-10-23', date '2026-12-31',
   '1 deer per calendar year.', 'Most hunts are 7 – 10 day windows in this range. Dates vary by unit.'),
  ('deer', 'Statewide', 'muzzleloader', 'Muzzleloader Deer (draw permit)', date '2026-10-23', date '2026-12-31',
   '1 deer per calendar year.', 'Week-long windows. Dates vary by unit.'),
  ('elk', 'Statewide', 'archery', 'Archery Bull Elk (draw)', date '2026-09-11', date '2026-09-24',
   '1 elk per calendar year.', 'Rut window; a few hunts differ by unit.'),
  ('elk', 'Statewide', 'firearm', 'General Elk (draw)', date '2026-09-25', date '2026-12-10',
   '1 elk per calendar year.', 'Early bull Sep 25 – Oct 1; mid Oct 16 – 22; late/antlerless Nov 27 – Dec 10. Dates vary by unit.'),
  ('pronghorn', 'Statewide', 'archery', 'Archery Pronghorn (draw)', date '2026-08-21', date '2026-09-03',
   '1 buck per tag.', 'Unit 11M runs to Sep 10.'),
  ('pronghorn', 'Statewide', 'firearm', 'General Pronghorn (draw)', date '2026-09-04', date '2026-09-13',
   '1 buck per tag.', 'Units 3A/7/8/9 run Oct 2 – 11. Muzzleloader hunts mostly Sep 4 – 13.'),
  ('turkey', 'Statewide', 'firearm', 'Fall Turkey — Shotgun (draw)', date '2026-10-02', date '2026-10-08',
   '1 turkey.', 'Units with fall populations only. Spring 2027 dates publish ~mid-Sept in the spring booklet.'),
  ('turkey', 'Statewide', 'archery', 'Fall Turkey — Archery OTC', date '2026-08-21', date '2026-09-10',
   '1 turkey.', 'Nonpermit tag; listed units only.'),
  ('javelina', 'Statewide', 'general', 'HAM Javelina OTC (northern units)', date '2026-08-15', date '2026-12-31',
   '2 per calendar year.', 'OTC nonpermit javelina in units 1 – 9 runs all of 2026. Spring 2027 draw hunts publish ~mid-Sept.'),
  ('dove', 'Statewide', 'general', 'Early Season', date '2026-09-01', date '2026-09-15',
   '15 per day (mourning + white-winged).', 'Eurasian collared-dove open year-round, no limit.'),
  ('dove', 'Statewide', 'general', 'Late Season', date '2026-11-20', date '2027-01-03', '15 per day.', null),
  ('duck', 'Statewide', 'general', 'Duck', date '2026-10-23', date '2027-01-31',
   '7 per day.', 'Scaup Nov 7 – Jan 31. Arizona has no September teal season.'),
  ('goose', 'Statewide', 'general', 'Goose (dark & light)', date '2026-10-23', date '2027-01-31',
   '5 dark + 20 light per day.', null),
  ('western-quail', 'Statewide', 'general', 'Quail (Gambel''s, scaled, California)', date '2026-10-16', date '2027-02-07',
   '15 per day aggregate (max 8 Mearns'').', 'Mearns'' quail opens Dec 4.'),
  ('pheasant', 'Statewide', 'general', null, date '2026-10-16', date '2027-02-07', null, null),
  ('squirrel', 'Statewide', 'general', 'Tree Squirrel', date '2026-10-02', date '2027-01-31',
   null, 'Archery-only tree squirrel Aug 21 – Oct 1.'),
  ('rabbit', 'Statewide', 'general', 'Cottontail (license year)', date '2026-07-01', date '2027-06-30',
   null, 'Year-round statewide; refuge dates differ.')
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

-- KANSAS ----------------------------------------------------------------------
with st as (select id from public.states where code = 'KS'),
src as (select id from public.sources where url = 'https://www.ksoutdoors.gov/outdoor-activities/hunting-in-kansas/when-to-hunt'),
rows_to_add (species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  ('deer', 'Statewide', 'firearm', 'Youth & Disability', date '2026-09-05', date '2026-09-13', null, null),
  ('deer', 'Statewide', 'muzzleloader', 'Early Muzzleloader', date '2026-09-14', date '2026-09-27', null, null),
  ('deer', 'Statewide', 'archery', 'Archery', date '2026-09-14', date '2026-12-31',
   null, 'Extended archery in Unit 19 Jan 25 – 31.'),
  ('deer', 'Statewide', 'firearm', 'Regular Firearms', date '2026-12-02', date '2026-12-13',
   null, 'Pre-rut whitetail-antlerless-only Oct 10 – 12; extended January antlerless segments by unit.'),
  ('elk', 'Statewide', 'archery', 'Elk Archery', date '2026-09-14', date '2026-12-31',
   '1 per tag.', 'Limited permits; closed Unit 1; Fort Riley subunit has its own schedule.'),
  ('elk', 'Statewide', 'firearm', 'Elk Firearms (main segment)', date '2026-12-02', date '2026-12-13',
   '1 per tag.', 'Other segments Aug 1 – 31 and Jan 1 – Mar 15; muzzleloader Sep 1 – 30.'),
  ('pronghorn', 'Statewide', 'archery', 'Antelope Archery', date '2026-09-19', date '2026-09-27',
   '1 per permit.', 'Western units only.'),
  ('pronghorn', 'Statewide', 'firearm', 'Antelope Firearms', date '2026-10-02', date '2026-10-05',
   '1 per permit.', 'Muzzleloader Sep 28 – Oct 5. Limited draw, western units.'),
  ('turkey', 'Statewide', 'general', 'Spring Turkey (draw)', date '2027-04-14', date '2027-05-31',
   '1 bearded turkey per permit.', 'Youth/disability Apr 1 – 13; archery-only Apr 5 – 13. NO fall turkey season — closed by regulation.'),
  ('dove', 'Statewide', 'general', null, date '2026-09-01', date '2026-11-29',
   null, 'Eurasian collared-dove open year-round.'),
  ('duck', 'Low Plains', 'general', 'September Teal', date '2026-09-12', date '2026-09-20', '6 teal per day.', null),
  ('duck', 'High Plains', 'general', 'September Teal', date '2026-09-19', date '2026-09-27', '6 teal per day.', null),
  ('duck', 'High Plains', 'general', 'Duck', date '2026-10-10', date '2027-01-31',
   '6 per day (max 5 mallards).', 'Segments Oct 10 – Jan 3 and Jan 22 – 31.'),
  ('duck', 'Low Plains', 'general', 'Duck (three zones)', date '2026-10-10', date '2027-01-31',
   '6 per day.', 'Early Zone Oct 10 – Dec 6 + Dec 19 – Jan 3; Late Zone Oct 31 – Jan 3 + Jan 23 – 31; Southeast Zone Nov 7 – Jan 3 + Jan 16 – 31.'),
  ('goose', 'Statewide', 'general', 'Canada & Light Goose', date '2026-10-31', date '2027-02-14',
   '6 dark; 50 light per day.', 'White-fronted segments differ (2/day). Light goose conservation order Feb 15 – Apr 30.'),
  ('sandhill-crane', 'Central Zone', 'general', 'Sandhill Crane', date '2026-11-11', date '2027-01-07',
   null, 'West Zone: Oct 17 – Dec 13. Permit + crane ID test required.'),
  ('bobwhite', 'Statewide', 'general', 'Quail', date '2026-11-14', date '2027-01-31',
   null, 'Youth season Nov 7 – 8.'),
  ('pheasant', 'Statewide', 'general', null, date '2026-11-14', date '2027-01-31',
   '4 cocks per day.', 'Youth season Nov 7 – 8.'),
  ('squirrel', 'Statewide', 'general', null, date '2026-06-01', date '2027-02-28', null, null),
  ('rabbit', 'Statewide', 'general', 'Cottontail & Jackrabbit (year-round)', date '2026-07-01', date '2027-06-30',
   null, 'Open year-round, every year.')
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

-- NEVADA ----------------------------------------------------------------------
with st as (select id from public.states where code = 'NV'),
src as (select id from public.sources where url = 'https://www.ndow.org/wp-content/uploads/2025/07/CR25-07-2025-2026-and-2026-2027-Big-Game-Seasons.pdf'),
rows_to_add (species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  ('deer', 'Statewide', 'archery', 'Mule Deer Archery (draw)', date '2026-08-10', date '2026-09-09',
   '1 per tag.', 'Dominant framework; a few units differ. Dates vary by unit.'),
  ('deer', 'Statewide', 'muzzleloader', 'Mule Deer Muzzleloader (draw)', date '2026-09-10', date '2026-10-04',
   '1 per tag.', 'Some units run Nov – Dec. Dates vary by unit.'),
  ('deer', 'Statewide', 'firearm', 'Mule Deer Any Legal Weapon (draw)', date '2026-10-05', date '2026-11-05',
   '1 per tag.', 'Many units split early/late; some run into Dec. Dates vary by unit.'),
  ('elk', 'Statewide', 'archery', 'Elk Archery — Antlered (draw)', date '2026-08-16', date '2026-09-16',
   '1 per tag.', 'Typical windows Aug 16 – 31 or Aug 25 – Sep 16 by unit group.'),
  ('elk', 'Statewide', 'muzzleloader', 'Elk Muzzleloader — Antlered (draw)', date '2026-09-01', date '2026-11-05',
   '1 per tag.', 'Windows vary by unit group.'),
  ('elk', 'Statewide', 'firearm', 'Elk Any Legal Weapon — Antlered (draw)', date '2026-09-17', date '2026-12-04',
   '1 per tag.', 'Split seasons through Nov 21 – Dec 4 by unit group.'),
  ('pronghorn', 'Statewide', 'archery', 'Antelope Archery (draw)', date '2026-08-01', date '2026-08-21',
   '1 per tag.', 'Units close Aug 14 or Aug 21 by unit group.'),
  ('pronghorn', 'Statewide', 'firearm', 'Antelope Any Legal Weapon (draw)', date '2026-08-22', date '2026-09-07',
   '1 per tag.', 'Units 202/204 Oct 15 – 30; some unit groups split per Amendment 1. Dates vary by unit.'),
  ('turkey', 'Statewide', 'general', 'Fall Turkey — Limited Entry (draw)', date '2026-11-01', date '2026-11-30',
   '1 either-sex per tag.', 'Pershing and Lincoln Counties only; roughly 10 resident tags each.'),
  ('turkey', 'Statewide', 'general', 'Spring Turkey — Limited Entry (draw)', date '2027-03-27', date '2027-05-02',
   '1 bearded per tag.', 'Junior hunt Mar 20 – May 2. Very limited quotas in select counties.'),
  ('dove', 'Statewide', 'general', null, date '2026-09-01', date '2026-10-30',
   '15 per day.', 'Nevada has no September teal season.'),
  ('duck', 'Northwest Zone', 'general', 'Duck & Merganser', date '2026-10-17', date '2027-01-31',
   '7 per day.', 'Split Oct 17 – Jan 3 and Jan 6 – 31. South Zone Oct 17 – 25 + Oct 28 – Jan 31.'),
  ('duck', 'Northeast Zone', 'general', 'Duck & Merganser', date '2026-09-26', date '2027-01-18',
   '7 per day.', 'Split Sep 26 – Dec 1 and Dec 12 – Jan 18.'),
  ('goose', 'Northwest Zone', 'general', 'Canada Goose', date '2026-10-17', date '2027-01-31',
   '5 per day.', 'Same zone splits as duck; NE Zone Sep 26 – Dec 1 + Dec 12 – Jan 18. Snow/Ross'' extra segment Feb 22 – Mar 7 (20/day).'),
  ('western-quail', 'Statewide', 'general', 'Quail (California, Gambel''s, mountain)', date '2026-10-17', date '2027-02-07',
   'California 10; Gambel''s 5; mountain 2 per day.', 'Chukar & Hungarian partridge same dates, 6/day aggregate.'),
  ('rabbit', 'Statewide', 'general', 'Cottontail & White-tailed Jackrabbit', date '2026-11-01', date '2027-02-28',
   '5 per day.', null)
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
