-- Late-August 2026 publication sweep (verified 2026-08-25 from official sources):
--   NJ: 2026-27 Hunting & Trapping Digest published — bear, pheasant, quail
--       (stocked areas), rabbit, squirrel, coyote, fox, raccoon, spring turkey
--       2027. FALL turkey CLOSED statewide (population decline) — no fall rows.
--   ME: 2026-27 trapping seasons page live — fisher, marten (Nov 1 – Dec 31).
--   KY: dove 2026-27 three segments (fw.ky.gov migratory bird page).
--   MT: 2026 waterfowl regs final PDF — goose by flyway/zone.
--   NE: bighorn (Dec 1-22 lottery+auction), crow (two segments).
--   WY: sandhill crane 2026 (Ch. 14 final, media/33699 — NOT the 2025 32327).
--   OH: ruffed grouse ELIMINATED statewide for 2026-27 (controlled-lottery
--       hunts only, no public season dates) — pair pruned below.
-- Still pending publication: WV duck/goose (brochure due late Aug; site still
-- carries the 2025 edition as of 2026-08-25), HI all five (October).

insert into public.sources (agency_name, url, doc_type, state_id, notes, last_extracted_at)
select v.agency, v.url, (case when v.url like '%.pdf' then 'pdf' else 'webpage' end)::source_doc_type, s.id, v.notes, now()
from (values
  ('New Jersey Division of Fish and Wildlife',
   'https://dep.nj.gov/wp-content/uploads/njfw/digest-hunting-and-trapping-2026-2027-complete.pdf',
   'NJ', '2026-27 Hunting & Trapping Digest (Aug 2026). Fall turkey closed statewide.'),
  ('Maine Department of Inland Fisheries and Wildlife',
   'https://www.maine.gov/ifw/hunting-trapping/trapping/laws-rules/index.html',
   'ME', '2026-27 trapping seasons table (lawbook PDF not yet posted as of 2026-08-25).'),
  ('Kentucky Department of Fish and Wildlife Resources',
   'https://fw.ky.gov/Hunt/Pages/Migratory-Bird-Hunting.aspx',
   'KY', '2026-27 migratory bird seasons page.'),
  ('Montana Fish, Wildlife & Parks',
   'https://fwp.mt.gov/binaries/content/assets/fwp/hunt/regulations/2026/2026-mig-bird--webless-final-for-web.pdf',
   'MT', '2026 waterfowl/crane/dove regulations, final for web.'),
  ('Wyoming Game and Fish Department',
   'https://wgfd.wyo.gov/media/33699/download?inline',
   'WY', '2026 Chapter 14 Migratory Game Bird regulations (Commission April 22, 2026).')
) as v(agency, url, code, notes)
join public.states s on s.code = v.code
where not exists (select 1 from public.sources x where x.url = v.url);

insert into public.zones (state_id, name)
select s.id, v.zone
from (values
  ('NJ','Greenwood Forest & Peaslee WMAs'),
  ('MT','Pacific Flyway'),('MT','Central Flyway Zone 1'),('MT','Central Flyway Zone 2')
) as v(code, zone)
join public.states s on s.code = v.code
where not exists (select 1 from public.zones z where z.state_id = s.id and z.name = v.zone);

-- NEW JERSEY ------------------------------------------------------------------
with st as (select id from public.states where code = 'NJ'),
src as (select id from public.sources where url = 'https://dep.nj.gov/wp-content/uploads/njfw/digest-hunting-and-trapping-2026-2027-complete.pdf'),
rows_to_add (species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  ('bear', 'Statewide', 'archery', 'Segment A', date '2026-10-12', date '2026-10-17',
   '1 bear over 75 lb per segment.', 'Muzzleloader also legal the last three days (Oct 15-17). Permit required; sales Sept 14 - Oct 17.'),
  ('bear', 'Statewide', 'firearm', 'Segment B', date '2026-12-07', date '2026-12-12',
   '1 bear over 75 lb per segment.', 'Shotgun or muzzleloader. Contingent extension Dec 16-19 announced Dec 14 if the harvest objective is unmet. Season limit two bears (one per segment, different zones).'),
  ('pheasant', 'Statewide', 'general', null, date '2026-11-07', date '2027-02-15',
   '2 per day.', 'Stocked WMAs; Pheasant & Quail Stamp required on stocked areas. Closed Dec 7-12 and Dec 16. Youth Upland Bird Day Oct 31; Youth Pheasant Days Nov 2-6.'),
  ('bobwhite', 'Greenwood Forest & Peaslee WMAs', 'general', 'Stocked birds only', date '2026-11-07', date '2027-01-31',
   '4 per day.', 'Pen-raised quail at Greenwood Forest and Peaslee WMAs only — wild bobwhite is closed statewide. Closed Dec 7-12 and Dec 16.'),
  ('rabbit', 'Statewide', 'general', null, date '2026-09-26', date '2027-02-20',
   '4 cottontail per day (1 hare or jackrabbit).', 'Closed Dec 7-12 and Dec 16.'),
  ('squirrel', 'Statewide', 'general', null, date '2026-09-26', date '2027-02-20',
   '5 per day.', 'Gray squirrel. Closed Dec 7-12 and Dec 16.'),
  ('coyote', 'Statewide', 'firearm', 'Daytime', date '2026-09-08', date '2027-03-15',
   'No limit.', 'Bow, shotgun, rifle, or air gun. Harvest report required by 10 p.m. day of harvest.'),
  ('coyote', 'Statewide', 'firearm', 'Nighttime (shotgun only)', date '2027-01-01', date '2027-03-15',
   'No limit.', 'The former special-permit season was eliminated; no permit needed.'),
  ('coyote', 'Statewide', 'general', 'Trapping', date '2026-11-15', date '2027-03-15',
   'No limit.', 'Stocked WMAs open Jan 1.'),
  ('fox', 'Statewide', 'firearm', 'Daytime', date '2026-09-08', date '2027-03-15',
   'No limit.', 'Red and gray fox. Gray fox harvest reporting is now mandatory.'),
  ('fox', 'Statewide', 'firearm', 'Nighttime (shotgun only)', date '2027-01-01', date '2027-03-15',
   'No limit.', null),
  ('fox', 'Statewide', 'general', 'Trapping', date '2026-11-15', date '2027-03-15',
   'No limit.', 'Stocked WMAs open Jan 1.'),
  ('raccoon', 'Statewide', 'firearm', 'Night hunting', date '2026-10-01', date '2027-03-01',
   'No limit.', 'One hour after sunset to one hour before sunrise; air gun, .22 short, or shotgun. Closed Dec 7-12 and Dec 16.'),
  ('raccoon', 'Statewide', 'general', 'Trapping', date '2026-11-15', date '2027-03-15',
   'No limit.', 'Stocked WMAs open Jan 1.'),
  ('turkey', 'Statewide', 'general', 'Spring Youth Day', date '2027-04-24', date '2027-04-24',
   '1 male turkey per permit.', 'Ages 10-16. Fall 2026 turkey season is CLOSED statewide. Half hour before sunrise to noon.'),
  ('turkey', 'Statewide', 'general', 'Spring Gobbler Period A', date '2027-04-26', date '2027-04-30',
   '1 male turkey per permit.', 'Mon-Fri; lottery permits by Turkey Hunting Area; hunting closes at noon.'),
  ('turkey', 'Statewide', 'general', 'Spring Gobbler Period B', date '2027-05-03', date '2027-05-07',
   '1 male turkey per permit.', 'Mon-Fri; closes at noon.'),
  ('turkey', 'Statewide', 'general', 'Spring Gobbler Period C', date '2027-05-10', date '2027-05-14',
   '1 male turkey per permit.', 'Mon-Fri; closes at noon.'),
  ('turkey', 'Statewide', 'general', 'Spring Gobbler Period D', date '2027-05-17', date '2027-05-28',
   '1 male turkey per permit.', 'Mon-Fri across two weeks (May 17-21 and 24-28); hunting to sunset.'),
  ('turkey', 'Statewide', 'general', 'Spring Gobbler Period E (Saturdays)', date '2027-05-01', date '2027-05-22',
   '1 male turkey per permit.', 'Saturdays only: May 1, 8, 15, 22. Noon close except May 22 (sunset).')
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

-- MAINE -----------------------------------------------------------------------
with st as (select id from public.states where code = 'ME'),
src as (select id from public.sources where url = 'https://www.maine.gov/ifw/hunting-trapping/trapping/laws-rules/index.html'),
rows_to_add (species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  ('fisher', 'Statewide', 'general', 'Trapping', date '2026-11-01', date '2026-12-31',
   'Season cap 25 fisher.', 'General trapping season, statewide.'),
  ('marten', 'Statewide', 'general', 'Trapping', date '2026-11-01', date '2026-12-31',
   'Season cap 25 marten.', 'General trapping season, statewide.')
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

-- KENTUCKY --------------------------------------------------------------------
with st as (select id from public.states where code = 'KY'),
src as (select id from public.sources where url = 'https://fw.ky.gov/Hunt/Pages/Migratory-Bird-Hunting.aspx'),
rows_to_add (species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  ('dove', 'Statewide', 'general', 'Segment 1', date '2026-09-01', date '2026-10-26',
   '15 per day.', 'Sept 1 shooting hours 11 a.m. to sunset; thereafter half hour before sunrise to sunset.'),
  ('dove', 'Statewide', 'general', 'Segment 2', date '2026-11-26', date '2026-12-06',
   '15 per day.', null),
  ('dove', 'Statewide', 'general', 'Segment 3', date '2026-12-19', date '2027-01-10',
   '15 per day.', null)
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

-- MONTANA ---------------------------------------------------------------------
with st as (select id from public.states where code = 'MT'),
src as (select id from public.sources where url = 'https://fwp.mt.gov/binaries/content/assets/fwp/hunt/regulations/2026/2026-mig-bird--webless-final-for-web.pdf'),
rows_to_add (species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  ('goose', 'Pacific Flyway', 'firearm', null, date '2026-10-03', date '2027-01-15',
   '5 dark geese and 20 white geese per day.', 'Youth waterfowl days Sept 26-27 statewide. Possession 3x daily bag.'),
  ('goose', 'Central Flyway Zone 1', 'firearm', null, date '2026-10-03', date '2027-01-15',
   '5 dark geese and 20 white geese per day.', null),
  ('goose', 'Central Flyway Zone 2', 'firearm', 'Segment 1', date '2026-10-03', date '2026-10-11',
   '5 dark geese and 20 white geese per day.', 'Zone 2: Big Horn, Carbon, Custer, Prairie, Rosebud, Stillwater, Sweet Grass, Treasure, Yellowstone counties.'),
  ('goose', 'Central Flyway Zone 2', 'firearm', 'Segment 2', date '2026-10-24', date '2027-01-27',
   '5 dark geese and 20 white geese per day.', null)
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

-- NEBRASKA --------------------------------------------------------------------
with st as (select id from public.states where code = 'NE'),
src as (select id from public.sources where url = 'https://outdoornebraska.gov/hunt/hunting-seasons/'),
rows_to_add (species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  ('bighorn-sheep', 'Statewide', 'firearm', 'Lottery & auction permits', date '2026-12-01', date '2026-12-22',
   '1 ram per permit.', 'One resident lottery permit and one auction permit for 2026.'),
  ('crow', 'Statewide', 'firearm', 'Fall segment', date '2026-10-10', date '2026-12-10',
   null, null),
  ('crow', 'Statewide', 'firearm', 'Winter-spring segment', date '2027-01-09', date '2027-03-11',
   null, null)
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

-- WYOMING ---------------------------------------------------------------------
with st as (select id from public.states where code = 'WY'),
src as (select id from public.sources where url = 'https://wgfd.wyo.gov/media/33699/download?inline'),
rows_to_add (species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  ('sandhill-crane', 'Statewide', 'firearm', 'Limited quota (Areas 1-6, 8)', date '2026-09-01', date '2026-10-18',
   '1 per season per permit.', 'Per-area dates: 1 & 2 Sept 1-20; 3 Sept 1-13; 4 Sept 26 - Oct 18; 5 Sept 1-15; 6 Sept 5 - Oct 4; 8 Sept 1-30.'),
  ('sandhill-crane', 'Statewide', 'firearm', 'Area 7 (general permit)', date '2026-09-12', date '2026-11-08',
   '3 per day.', null)
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

-- OHIO: prune ruffed grouse — statewide season eliminated for 2026-27.
-- Only four controlled-lottery hunts remain (permit-specific 3-day blocks, no
-- public open/close dates), so the pair is no longer followable.
-- Source: https://dam.assets.ohio.gov/image/upload/ohiodnr.gov/documents/wildlife/news/2026-27_Hunting_Seasons.pdf
delete from public.state_species ss
using public.states st, public.species sp
where ss.state_id = st.id and ss.species_id = sp.id
  and st.code = 'OH' and sp.key = 'ruffed-grouse';
