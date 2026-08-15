-- All-states pass, batch 5: MA, ME, NH, VT, RI — 2026-27 (all were empty).
-- Filled 2026-08-15 from official sources: mass.gov 2026 summary + migratory
-- page, MDIFW 2026-27 seasons PDF + Ch. 16.11 migratory rulemaking,
-- wildlife.nh.gov species pages, VT F&W seasons page + 2026-27 migratory press
-- release, official RI 2026-27 guide PDF.
-- Closed-by-regulation (no rows on purpose): RI ruffed grouse & snowshoe hare;
-- ME cottontail rabbit.

insert into public.sources (agency_name, url, doc_type, state_id, notes, last_extracted_at)
select v.agency, v.url, (case when v.url like '%.pdf' then 'pdf' else 'webpage' end)::source_doc_type, s.id, v.notes, now()
from (values
  ('MassWildlife',
   'https://www.mass.gov/info-details/2026-hunting-and-freshwater-fishing-season-summary',
   'MA', '2026-27 filled manually 2026-08-15 from the official season summary + migratory bird page.'),
  ('Maine Department of Inland Fisheries and Wildlife',
   'https://www.maine.gov/ifw/docs/26-MDIFW-6-Hunting-Season-2026-27.pdf',
   'ME', '2026-27 filled manually 2026-08-15 from the official seasons PDF; waterfowl from the Ch. 16.11 rulemaking (spot-check when the quick-reference posts).'),
  ('New Hampshire Fish and Game Department',
   'https://www.wildlife.nh.gov/hunting-nh/deer-hunting-new-hampshire',
   'NH', '2026-27 filled manually 2026-08-15 from official species pages.'),
  ('Vermont Fish & Wildlife Department',
   'https://www.vtfishandwildlife.com/hunt/hunting-and-trapping-seasons',
   'VT', '2026-27 filled manually 2026-08-15 from the official seasons page + migratory press release (2026-07-20).'),
  ('Rhode Island Department of Environmental Management',
   'https://www.eregulations.com/assets/docs/resources/RI/26RIHD_LR.pdf',
   'RI', '2026-27 filled manually 2026-08-15 from the official regulation guide PDF.')
) as v(agency, url, code, notes)
join public.states s on s.code = v.code
where not exists (select 1 from public.sources x where x.url = v.url);

insert into public.zones (state_id, name)
select s.id, v.zone
from (values
  ('MA','Berkshire Zone'),('MA','Central Zone'),('MA','Coastal Zone'),
  ('ME','Expanded Archery Areas'),('ME','Open WMDs'),('ME','Permit WMDs'),('ME','North Zone'),('ME','South Zone'),('ME','Coastal Zone'),
  ('NH','Inland Zone'),('NH','Select WMUs'),('NH','Permit WMUs'),('NH','WMUs H2, K, L & M'),
  ('VT','Select WMUs'),('VT','Permit WMUs'),('VT','Lake Champlain Zone'),('VT','Interior Vermont Zone'),('VT','Lake Champlain & Interior Zones'),
  ('RI','Zones 1 & 2'),('RI','State Land')
) as v(code, zone)
join public.states s on s.code = v.code
where not exists (select 1 from public.zones z where z.state_id = s.id and z.name = v.zone);

-- MASSACHUSETTS --------------------------------------------------------------
with st as (select id from public.states where code = 'MA'),
src as (select id from public.sources where url = 'https://www.mass.gov/info-details/2026-hunting-and-freshwater-fishing-season-summary'),
rows_to_add (species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  ('deer', 'Statewide', 'archery', 'Archery (Zones 1-14)', date '2026-10-05', date '2026-11-28',
   '2 antlered per year.', 'New early season Zones 13-14 only Sep 21 – Oct 1; winter season Jan 1 – Feb 14 Zones 13-14. Youth deer hunt Oct 3.'),
  ('deer', 'Statewide', 'firearm', 'Shotgun (Zones 1-14)', date '2026-11-30', date '2026-12-12',
   null, 'Antlerless by zone-specific permit.'),
  ('deer', 'Statewide', 'muzzleloader', 'Primitive Firearms (Zones 1-14)', date '2026-12-14', date '2026-12-31', null, null),
  ('bear', 'Statewide', 'general', 'Black Bear (Zones 1-14)', date '2026-09-07', date '2026-12-12',
   '1 per year.', 'Continuous season; legal implements vary by segment.'),
  ('turkey', 'Statewide', 'general', 'Fall Turkey (Zones 1-13)', date '2026-10-05', date '2026-11-28',
   null, 'Runs concurrent with archery deer season.'),
  ('duck', 'Berkshire Zone', 'general', 'Duck', date '2026-10-12', date '2027-01-02',
   '6 per day.', 'Split Oct 12 – Nov 28 and Dec 14 – Jan 2.'),
  ('duck', 'Central Zone', 'general', 'Duck', date '2026-10-10', date '2027-01-02',
   '6 per day.', 'Split Oct 10 – Nov 28 and Dec 15 – Jan 2.'),
  ('duck', 'Coastal Zone', 'general', 'Duck', date '2026-10-10', date '2027-01-27',
   '6 per day.', 'Split Oct 10 – 17 and Nov 27 – Jan 27.'),
  ('goose', 'Statewide', 'general', 'Early Canada Goose', date '2026-09-01', date '2026-09-25',
   '15 per day.', 'All three zones; extended shooting hours.'),
  ('goose', 'Central Zone', 'general', 'Regular Canada Goose', date '2026-10-10', date '2027-01-02',
   '2 per day.', 'Berkshire Oct 12 – Nov 28 (3/day); Coastal Oct 10 – 17 + Nov 27 – Jan 27 (2/day); late seasons to Feb 13.'),
  ('pheasant', 'Statewide', 'general', 'Pheasant (Zones 1-14)', date '2026-10-17', date '2026-12-31',
   null, 'Closed during shotgun deer season.'),
  ('ruffed-grouse', 'Statewide', 'general', null, date '2026-10-17', date '2026-11-28', null, null),
  ('woodcock', 'Statewide', 'general', null, date '2026-10-01', date '2026-11-21', '3 per day.', null),
  ('rabbit', 'Statewide', 'general', 'Cottontail', date '2026-10-17', date '2027-02-27',
   null, 'Closed during shotgun deer season.'),
  ('snowshoe-hare', 'Statewide', 'general', null, date '2026-10-17', date '2027-02-27',
   null, 'Closed during shotgun deer season.'),
  ('squirrel', 'Statewide', 'general', 'Gray Squirrel', date '2026-09-08', date '2027-02-27',
   null, 'Closed during shotgun deer season.')
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

-- MAINE ----------------------------------------------------------------------
with st as (select id from public.states where code = 'ME'),
src as (select id from public.sources where url = 'https://www.maine.gov/ifw/docs/26-MDIFW-6-Hunting-Season-2026-27.pdf'),
rows_to_add (species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  ('deer', 'Expanded Archery Areas', 'archery', 'Expanded Archery', date '2026-09-12', date '2026-12-12',
   '1 antlered per year.', 'Designated areas only; antlerless with expanded archery permits.'),
  ('deer', 'Statewide', 'archery', 'Regular Archery', date '2026-10-03', date '2026-10-30',
   '1 antlered per year.', 'Either-sex allowance statewide during regular archery (2026 rule).'),
  ('deer', 'Statewide', 'firearm', 'Firearms', date '2026-11-02', date '2026-11-28',
   '1 antlered per year.', 'Maine Resident Only Day Oct 31; Youth Deer Hunt Oct 23 – 24; antlerless permit for an additional deer.'),
  ('deer', 'Statewide', 'muzzleloader', 'Muzzleloader', date '2026-11-30', date '2026-12-05',
   '1 antlered per year.', 'Extended Dec 7 – 12 in WMDs 12-18 and 20-29.'),
  ('bear', 'Statewide', 'general', 'Bear General Season', date '2026-08-31', date '2026-11-28',
   '2 per year (1 hunting, 1 trapping).', 'Bait segment Aug 31 – Sep 26; dogs Sep 14 – Oct 30; trapping Sep 1 – Oct 31.'),
  ('moose', 'Permit WMDs', 'general', 'Moose (permit lottery only)', date '2026-09-28', date '2026-10-31',
   '1 per permit.', 'Bull windows Sep 28 – Oct 3 and Oct 12 – 17; antlerless Oct 26 – 31, by WMD. Apply April – May.'),
  ('turkey', 'Open WMDs', 'general', 'Fall Wild Turkey', date '2026-09-14', date '2026-11-07',
   '1 – 5 per season by WMD.', 'Archery or shotgun; several northern WMDs closed. Youth day Sep 12.'),
  ('ruffed-grouse', 'Statewide', 'general', null, date '2026-09-26', date '2026-12-31', '4 per day.', null),
  ('pheasant', 'Statewide', 'general', null, date '2026-09-26', date '2026-12-31', '2 per day.', null),
  ('woodcock', 'Statewide', 'general', null, date '2026-09-26', date '2026-11-17', '3 per day.', null),
  ('snowshoe-hare', 'Statewide', 'general', null, date '2026-09-26', date '2027-03-31',
   '4 per day.', 'Cottontail rabbit has no open season in Maine.'),
  ('squirrel', 'Statewide', 'general', 'Gray Squirrel', date '2026-09-26', date '2027-01-30', '4 per day.', null),
  ('duck', 'North Zone', 'general', 'Duck', date '2026-09-28', date '2026-12-05', '6 per day.', null),
  ('duck', 'South Zone', 'general', 'Duck', date '2026-10-01', date '2026-12-25',
   '6 per day.', 'Split Oct 1 – 10 and Oct 29 – Dec 25.'),
  ('duck', 'Coastal Zone', 'general', 'Duck', date '2026-10-03', date '2027-01-05',
   '6 per day.', 'Split Oct 3 – 10 and Nov 5 – Jan 5.'),
  ('goose', 'Statewide', 'general', 'Early Canada Goose', date '2026-09-01', date '2026-09-25',
   '8/day North; 10/day South & Coastal.', null),
  ('goose', 'South Zone', 'general', 'Regular Canada Goose', date '2026-10-01', date '2026-12-25',
   '2 per day.', 'North zone Oct 1 – Dec 9 (2/day); Coastal Oct 3 – 10 + Oct 24 – Jan 5 (3/day).')
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

-- NEW HAMPSHIRE ---------------------------------------------------------------
with st as (select id from public.states where code = 'NH'),
src as (select id from public.sources where url = 'https://www.wildlife.nh.gov/hunting-nh/deer-hunting-new-hampshire'),
rows_to_add (species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  ('deer', 'Statewide', 'archery', 'Archery', date '2026-09-15', date '2026-12-15',
   null, 'Closes Dec 8 in WMU A.'),
  ('deer', 'Statewide', 'muzzleloader', 'Muzzleloader', date '2026-10-31', date '2026-11-10',
   null, 'Either-sex opening days vary by WMU, then antlered-only.'),
  ('deer', 'Statewide', 'firearm', 'Firearms', date '2026-11-11', date '2026-12-06',
   null, 'Closes Nov 29 in WMU A. Youth weekend Oct 24 – 25.'),
  ('bear', 'Statewide', 'general', 'Bear General (stalking)', date '2026-09-01', date '2026-11-30',
   '1 (second tag in White Mountains WMUs).', 'Closes Nov 10 in several WMUs; bait and dog segments vary by WMU.'),
  ('moose', 'Permit WMUs', 'general', 'Moose (permit lottery only)', date '2026-10-17', date '2026-10-25',
   '1 per permit.', '9-day hunt in the assigned WMU only.'),
  ('turkey', 'Statewide', 'archery', 'Fall Archery Turkey', date '2026-09-15', date '2026-12-15',
   '1 either sex (combined fall limit).', 'Closes Dec 8 in WMU A.'),
  ('turkey', 'Select WMUs', 'firearm', 'Fall Shotgun Turkey', date '2026-10-12', date '2026-10-18',
   '1 either sex (combined fall limit).', 'WMUs D2, H1, H2, I1, J2, K, L, M only.'),
  ('duck', 'Inland Zone', 'general', 'Duck (Inland & CT River)', date '2026-10-13', date '2026-12-24',
   '6 per day.', 'Split Oct 13 – Nov 11 and Nov 25 – Dec 24. Northern Zone Oct 2 – Nov 30; Coastal Oct 6 – 12 + Nov 26 – Jan 17. Youth weekend Sep 26 – 27.'),
  ('goose', 'Statewide', 'general', 'September Canada Goose', date '2026-09-01', date '2026-09-25', '5 per day.', null),
  ('goose', 'Inland Zone', 'general', 'Regular Canada Goose (Inland & CT River)', date '2026-10-13', date '2026-12-24',
   '2 per day.', 'Northern Oct 2 – Nov 30; Coastal Oct 6 – 12 + Nov 26 – Jan 17.'),
  ('ruffed-grouse', 'Statewide', 'general', null, date '2026-10-01', date '2026-12-31', '4 per day.', null),
  ('pheasant', 'Statewide', 'general', null, date '2026-10-01', date '2026-12-31',
   '2 per day, 10 per season.', 'Pheasant license required; closed until 2pm Thu/Fri for stocking.'),
  ('woodcock', 'Statewide', 'general', null, date '2026-10-01', date '2026-11-14', '3 per day.', 'HIP required.'),
  ('snowshoe-hare', 'Statewide', 'general', null, date '2026-10-01', date '2027-03-31',
   '3/day north WMUs; 2/day south.', null),
  ('rabbit', 'WMUs H2, K, L & M', 'general', 'Cottontail', date '2026-10-01', date '2027-03-15',
   '4 per day.', 'Open only in WMUs H2, K, L, M.'),
  ('squirrel', 'Statewide', 'general', 'Gray Squirrel', date '2026-09-01', date '2027-01-31', '5 per day.', null)
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

-- VERMONT ---------------------------------------------------------------------
with st as (select id from public.states where code = 'VT'),
src as (select id from public.sources where url = 'https://www.vtfishandwildlife.com/hunt/hunting-and-trapping-seasons'),
rows_to_add (species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  ('deer', 'Statewide', 'archery', 'Archery', date '2026-10-01', date '2026-12-15',
   null, 'Expanded archery Sep 15 – 30 in designated areas. Youth/novice weekend Nov 7 – 8.'),
  ('deer', 'Statewide', 'firearm', 'November Regular (Rifle)', date '2026-11-14', date '2026-11-29', null, null),
  ('deer', 'Statewide', 'muzzleloader', 'December Muzzleloader', date '2026-11-30', date '2026-12-13',
   null, 'October antlerless muzzleloader Oct 29 – Nov 1 by permit only.'),
  ('bear', 'Statewide', 'general', 'Black Bear Early Season', date '2026-09-01', date '2026-11-13',
   '1 per year.', 'Dog hunting by permit Sep 1 – Nov 22.'),
  ('bear', 'Statewide', 'general', 'Black Bear Late Season', date '2026-11-14', date '2026-11-22',
   '1 per year.', 'Runs with the regular deer season.'),
  ('moose', 'Permit WMUs', 'general', 'Moose (permit lottery only)', date '2026-10-01', date '2026-10-25',
   '1 per permit.', 'Archery-only Oct 1 – 7; regular Oct 17 – 25; only if lottery permits are issued.'),
  ('turkey', 'Statewide', 'archery', 'Fall Archery Turkey', date '2026-10-01', date '2026-11-13', null, null),
  ('turkey', 'Select WMUs', 'general', 'Fall Shotgun/Archery Turkey', date '2026-10-24', date '2026-11-01',
   null, 'WMUs B, D, G-J, L, M, O-Q; WMUs F, K, N run Oct 24 – Nov 8.'),
  ('ruffed-grouse', 'Statewide', 'general', 'Ruffed Grouse (Partridge)', date '2026-09-26', date '2026-12-31', null, null),
  ('squirrel', 'Statewide', 'general', 'Gray Squirrel', date '2026-09-01', date '2026-12-31', null, null),
  ('snowshoe-hare', 'Statewide', 'general', 'Hare & Rabbit Season', date '2026-09-26', date '2027-03-14',
   null, 'WMUs D and E stay open to Mar 31. Season covers hare and cottontail.'),
  ('woodcock', 'Statewide', 'general', null, date '2026-09-26', date '2026-11-09', '3 per day.', null),
  ('duck', 'Lake Champlain Zone', 'general', 'Duck', date '2026-10-10', date '2026-12-27',
   '6 per day.', 'Split Oct 10 – Nov 1 and Nov 21 – Dec 27.'),
  ('duck', 'Interior Vermont Zone', 'general', 'Duck', date '2026-10-10', date '2026-12-08',
   '6 per day.', 'CT River Zone (set by NH): Oct 13 – Nov 11 + Nov 25 – Dec 24. Youth weekend Sep 26 – 27.'),
  ('goose', 'Statewide', 'general', 'September Resident Canada Goose', date '2026-09-01', date '2026-09-25',
   '8 per day (5 CT River Zone).', null),
  ('goose', 'Lake Champlain & Interior Zones', 'general', 'Regular Canada Goose', date '2026-10-10', date '2026-11-23',
   '3 per day.', 'CT River Zone Oct 13 – Nov 11 + Nov 25 – Dec 24 (2/day); late seasons Dec – Jan (5/day).')
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

-- RHODE ISLAND ----------------------------------------------------------------
with st as (select id from public.states where code = 'RI'),
src as (select id from public.sources where url = 'https://www.eregulations.com/assets/docs/resources/RI/26RIHD_LR.pdf'),
rows_to_add (species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  ('deer', 'Zones 1 & 2', 'archery', 'Archery', date '2026-09-15', date '2027-01-31',
   '2 antlered statewide + antlerless by zone.', 'Youth days Sep 12 – 13. Zone 3 (Patience/Prudence) Oct 19 – Jan 31; Zone 4 (Block Island) select dates.'),
  ('deer', 'Zones 1 & 2', 'muzzleloader', 'Muzzleloader', date '2026-11-07', date '2026-12-04',
   null, 'Youth-only Oct 31 – Nov 1.'),
  ('deer', 'Zones 1 & 2', 'firearm', 'Shotgun', date '2026-12-05', date '2026-12-31',
   null, 'Same dates both zones this year.'),
  ('turkey', 'Statewide', 'archery', 'Fall Archery Turkey', date '2026-10-01', date '2026-10-31',
   '1 either-sex bird.', 'Fall is archery-only; firearms in spring only.'),
  ('pheasant', 'State Land', 'general', 'Pheasant', date '2026-10-17', date '2027-02-28',
   '2 per day.', 'Game Bird Permit required. Youth Oct 10 – 12. Block Island select dates, roosters only.'),
  ('rabbit', 'Statewide', 'general', 'Cottontail', date '2026-10-01', date '2027-02-28', '3 per day.', null),
  ('squirrel', 'Statewide', 'general', 'Gray & Red Squirrel', date '2026-09-12', date '2027-02-28',
   '5 per day aggregate.', null),
  ('woodcock', 'Statewide', 'general', null, date '2026-10-17', date '2026-11-30', '3 per day.', null),
  ('duck', 'Statewide', 'general', 'Duck', date '2026-10-09', date '2027-01-24',
   '6 per day.', 'Splits Oct 9 – 12, Nov 25 – 29, Dec 5 – Jan 24. Youth waterfowl Oct 24 – 25.'),
  ('goose', 'Statewide', 'general', 'Early Canada Goose', date '2026-09-01', date '2026-09-30',
   '15 per day.', null),
  ('goose', 'Statewide', 'general', 'Regular Canada Goose', date '2026-11-21', date '2027-01-24',
   '2 per day.', 'Split Nov 21 – 29 and Dec 5 – Jan 24; late season Jan 30 – Feb 13 (5/day) in limited counties.'),
  ('snipe', 'Statewide', 'general', null, date '2026-09-01', date '2026-11-09', '5 per day.', null)
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
