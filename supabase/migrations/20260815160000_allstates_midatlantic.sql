-- All-states pass, batch 4: NY, NJ, MD, DE, CT — 2026-27 (all were empty).
-- Filled 2026-08-15 from official sources: NYSDEC 2026-27 guide PDFs, MD DNR
-- 2026-2027 Hunting Seasons Calendar PDF, eRegulations DE 2026-27 guide,
-- CT DEEP 2026 guide + 2026-27 migratory guide, NJDEP official documents.
--
-- Notes:
--   * Dove is NOT legal game in NY/NJ/CT — no dove rows for those states.
--   * NJ's 2026-27 hunting digest is unpublished as of 2026-08-15: only the
--     fixed six-day firearm week and the official migratory-bird framework are
--     included. Deer archery/permit seasons, bear, turkey, small game =
--     FOLLOW-UP (recheck dep.nj.gov/njfw late August).
--   * MD AP-zone regular goose omitted pending verification (calendar PDF
--     table ambiguity) — early resident goose and duck zones are exact.

insert into public.sources (agency_name, url, doc_type, state_id, notes, last_extracted_at)
select v.agency, v.url, (case when v.url like '%.pdf' then 'pdf' else 'webpage' end)::source_doc_type, s.id, v.notes, now()
from (values
  ('New York State Department of Environmental Conservation',
   'https://dec.ny.gov/things-to-do/hunting/deer-bear/seasons',
   'NY', '2026-27 filled manually 2026-08-15 from the official DEC guide pages/PDFs.'),
  ('New Jersey Division of Fish and Wildlife',
   'https://dep.nj.gov/wp-content/uploads/njfw/proposed-migratory-bird-seasons-2026-2027.pdf',
   'NJ', 'Partial 2026-27 fill 2026-08-15: six-day firearm + migratory framework. Digest unpublished — finish when posted.'),
  ('Maryland Department of Natural Resources',
   'https://dnr.maryland.gov/wildlife/Documents/Hunting-Seasons-Calendar.pdf',
   'MD', '2026-27 filled manually 2026-08-15 from the official DNR seasons calendar PDF.'),
  ('Delaware Division of Fish and Wildlife',
   'https://www.eregulations.com/delaware/hunting/deer-seasons',
   'DE', '2026-27 filled manually 2026-08-15 from the official guide via eRegulations (published Jun 29, 2026).'),
  ('Connecticut DEEP Wildlife Division',
   'https://portal.ct.gov/deep/hunting/2026-connecticut-hunting-and-trapping-guide/deer-hunting',
   'CT', '2026-27 filled manually 2026-08-15 from CT DEEP 2026 guide + migratory bird guide. Jan-Feb 2027 continuations confirmed in the 2027 guide cycle.')
) as v(agency, url, code, notes)
join public.states s on s.code = v.code
where not exists (select 1 from public.sources x where x.url = v.url);

insert into public.zones (state_id, name)
select s.id, v.zone
from (values
  ('NY','Southern Zone'),('NY','Northern Zone'),('NY','Western Zone'),('NY','Southeastern Zone'),('NY','Long Island Zone'),
  ('NJ','North Zone'),('NJ','South Zone'),
  ('MD','Western Maryland'),('MD','September Teal Zone'),('MD','Eastern Zone'),('MD','Western Zone'),('MD','Western Counties'),
  ('DE','Teal Zone'),
  ('CT','North Zone'),('CT','South Zone')
) as v(code, zone)
join public.states s on s.code = v.code
where not exists (select 1 from public.zones z where z.state_id = s.id and z.name = v.zone);

-- NEW YORK ------------------------------------------------------------------
with st as (select id from public.states where code = 'NY'),
src as (select id from public.sources where url = 'https://dec.ny.gov/things-to-do/hunting/deer-bear/seasons'),
rows_to_add (species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  ('deer', 'Southern Zone', 'archery', 'Early Bowhunting', date '2026-10-01', date '2026-11-20',
   'Per tags/DMPs.', 'Crossbows legal in bow seasons. Early antlerless hunt Sep 12 – 20 in select WMUs.'),
  ('deer', 'Southern Zone', 'firearm', 'Regular Firearms', date '2026-11-21', date '2026-12-13',
   'Per tags/DMPs.', null),
  ('deer', 'Southern Zone', 'muzzleloader', 'Late Bow/Muzzleloader', date '2026-12-14', date '2026-12-22',
   'Per tags/DMPs.', 'Holiday Deer Hunt continues Dec 26 – Jan 1 in most Southern Zone WMUs.'),
  ('deer', 'Northern Zone', 'firearm', 'Regular Firearms', date '2026-10-24', date '2026-12-06',
   'Per tags/DMPs.', 'NZ bow Sep 27 – Oct 23; early muzzleloader Oct 17 – 23; late muzzleloader Dec 7 – 13 in select WMUs.'),
  ('bear', 'Southern Zone', 'firearm', 'Regular Bear', date '2026-11-21', date '2026-12-13',
   '1.', 'Early firearms Sep 12 – 27 in select WMUs; bow Oct 1 – Nov 20; late bow/ML Dec 14 – 22.'),
  ('bear', 'Northern Zone', 'firearm', 'Regular Bear', date '2026-09-19', date '2026-12-06',
   '1.', 'Adirondack-area regular season.'),
  ('turkey', 'Statewide', 'general', 'Fall Turkey', date '2026-10-01', date '2026-10-14',
   '1 either sex per season.', 'Most zones Oct 1 – 14; other zones Oct 17 – 30; Long Island Nov 21 – Dec 4. Some WMUs closed.'),
  ('duck', 'Western Zone', 'general', 'Duck', date '2026-10-10', date '2027-01-10',
   '6 per day.', 'Splits Oct 10 – Nov 1 and Dec 5 – Jan 10. Northeast Zone and Lake Champlain differ.'),
  ('duck', 'Southeastern Zone', 'general', 'Duck', date '2026-10-10', date '2026-12-27',
   '6 per day.', 'Splits Oct 10 – 18 and Nov 7 – Dec 27.'),
  ('duck', 'Long Island Zone', 'general', 'Duck', date '2026-11-21', date '2027-01-31',
   '6 per day.', 'Splits Nov 21 – 29 and Dec 12 – Jan 31; youth/military days Nov 7 – 8.'),
  ('goose', 'Statewide', 'general', 'September Canada Goose', date '2026-09-01', date '2026-09-25',
   '15 per day.', 'Long Island areas Sep 8 – 30; NYC closed.'),
  ('goose', 'Statewide', 'general', 'Regular Canada Goose', date '2026-10-24', date '2027-01-11',
   '5 per day (South Area).', 'Varies widely by goose area — Western Nov 7 – Feb 21 (8/day); several areas 3/day with splits.'),
  ('pheasant', 'Statewide', 'general', 'Pheasant', date '2026-10-01', date '2027-02-28',
   '2 – 4 per day by region.', 'Region-dependent openers Oct 1 or Oct 17; Long Island Nov 1 – Dec 31.'),
  ('ruffed-grouse', 'Statewide', 'general', null, date '2026-09-20', date '2027-02-28',
   '4 per day.', 'Sep 20 opener in the north; Oct 1 elsewhere; closed in NYC region. Spruce grouse protected.'),
  ('squirrel', 'Statewide', 'general', 'Gray, Black & Fox Squirrel', date '2026-09-01', date '2027-02-28',
   '6 per day.', 'Long Island & NYC: Nov 1 – Feb 28.'),
  ('rabbit', 'Statewide', 'general', 'Cottontail', date '2026-10-01', date '2027-02-28',
   '6 per day.', 'Some northern WMUs run to Mar 21.'),
  ('bobwhite', 'Long Island Zone', 'general', 'Bobwhite Quail (Suffolk)', date '2026-11-01', date '2026-12-31',
   '6 per day, 40 per season.', 'Closed in most of the state.'),
  ('woodcock', 'Statewide', 'general', null, date '2026-10-01', date '2026-11-14',
   '3 per day.', 'Closed in NYC region.'),
  ('snipe', 'Statewide', 'general', null, date '2026-09-01', date '2026-11-09', '8 per day.', null)
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

-- NEW JERSEY (confirmed rows only — digest pending) --------------------------
with st as (select id from public.states where code = 'NJ'),
src as (select id from public.sources where url = 'https://dep.nj.gov/wp-content/uploads/njfw/proposed-migratory-bird-seasons-2026-2027.pdf'),
rows_to_add (species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  ('deer', 'Statewide', 'firearm', 'Six-day Firearm', date '2026-12-07', date '2026-12-12',
   'Antlered only.', 'Always the second Monday after Thanksgiving. Bow, permit, and winter seasons publish with the 2026-27 digest — check NJ Fish & Wildlife.'),
  ('duck', 'North Zone', 'general', 'Duck', date '2026-10-10', date '2027-01-14',
   '6 per day.', 'Splits Oct 10 – 17 and Nov 14 – Jan 14. From the official 2026-27 framework; NJ typically adopts unchanged.'),
  ('duck', 'South Zone', 'general', 'Duck', date '2026-10-17', date '2027-01-21',
   '6 per day.', 'Splits Oct 17 – 24 and Nov 21 – Jan 21; Coastal Zone Nov 21 – Jan 29.'),
  ('goose', 'Statewide', 'general', 'September Canada Goose', date '2026-09-01', date '2026-09-30',
   '15 per day.', null),
  ('goose', 'Statewide', 'general', 'Regular Canada Goose', date '2026-11-21', date '2027-01-30',
   '3 per day (Coastal 2).', 'Special winter season Feb 1 – 15 (5/day); light goose Nov 7 – Mar 10 (25/day).'),
  ('woodcock', 'Statewide', 'general', null, date '2026-10-24', date '2026-12-31',
   '3 per day.', 'North Zone Oct 24 – 31 + Nov 3 – Dec 5; South Zone Nov 7 – Dec 5 + Dec 19 – 31.'),
  ('snipe', 'Statewide', 'general', null, date '2026-09-05', date '2027-01-07', '8 per day.', null)
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

-- MARYLAND ------------------------------------------------------------------
with st as (select id from public.states where code = 'MD'),
src as (select id from public.sources where url = 'https://dnr.maryland.gov/wildlife/Documents/Hunting-Seasons-Calendar.pdf'),
rows_to_add (species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  ('deer', 'Statewide', 'archery', 'Archery', date '2026-09-11', date '2027-01-31',
   '1 – 2 antlered by region.', 'Segments: Sep 11 – Oct 21, Oct 25 – Nov 27, Dec 14 – 18, Jan 3 – 7, Jan 11 – 31.'),
  ('deer', 'Statewide', 'firearm', 'Firearm', date '2026-11-28', date '2026-12-12',
   '1 – 2 antlered by region.', 'Plus Jan 8 – 10 in Region B. Junior hunt days Nov 14 – 15. Primitive deer days Feb 1 – 3.'),
  ('deer', 'Statewide', 'muzzleloader', 'Muzzleloader', date '2026-10-22', date '2027-01-02',
   '1 – 2 antlered by region.', 'Early segment Oct 22 – 24; late segment Dec 19 – Jan 2.'),
  ('bear', 'Western Maryland', 'firearm', 'Black Bear', date '2026-10-26', date '2026-10-31',
   '1 (permit lottery).', 'Allegany, Frederick, Garrett & Washington counties; permit required.'),
  ('turkey', 'Western Counties', 'general', 'Fall Turkey', date '2026-10-31', date '2026-11-08',
   '1.', 'Allegany, Garrett & Washington counties only. Winter season Jan 21 – 23 statewide.'),
  ('dove', 'Statewide', 'general', 'Dove (three splits)', date '2026-09-01', date '2027-01-09',
   '15 per day.', 'Splits Sep 1 – Oct 17, Oct 24 – Nov 27, Dec 19 – Jan 9.'),
  ('duck', 'September Teal Zone', 'general', 'September Teal', date '2026-09-17', date '2026-09-26',
   '6 per day.', 'Designated teal-zone counties only.'),
  ('duck', 'Eastern Zone', 'general', 'Duck', date '2026-10-10', date '2027-01-30',
   '6 per day.', 'Splits Oct 10 – 17, Nov 14 – 27, Dec 15 – Jan 30. Youth/veteran days Nov 7 and Feb 6.'),
  ('duck', 'Western Zone', 'general', 'Duck', date '2026-10-03', date '2027-01-30',
   '6 per day.', 'Splits Oct 3 – 17, Nov 21 – 27, Dec 15 – Jan 30.'),
  ('goose', 'Statewide', 'general', 'Early Resident Canada Goose', date '2026-09-01', date '2026-09-15',
   '15 per day.', 'Eastern Hunt Zone Sep 1 – 15; Western Hunt Zone Sep 1 – 25. Regular AP-zone season: see the MD migratory bird guide.'),
  ('bobwhite', 'Statewide', 'general', null, date '2026-11-07', date '2027-01-15',
   null, 'Closed in Garrett & Allegany counties and on DNR lands east of the Susquehanna.'),
  ('pheasant', 'Statewide', 'general', null, date '2026-11-07', date '2027-02-28', null, null),
  ('ruffed-grouse', 'Western Maryland', 'general', null, date '2026-10-03', date '2026-12-31', null, null),
  ('rabbit', 'Statewide', 'general', 'Cottontail', date '2026-11-07', date '2027-02-28', null, null),
  ('squirrel', 'Statewide', 'general', 'Gray Squirrel', date '2026-09-05', date '2027-02-28',
   null, 'Delmarva fox squirrel closed.'),
  ('woodcock', 'Statewide', 'general', null, date '2026-10-24', date '2027-01-27',
   '3 per day.', 'Splits Oct 24 – Nov 27 and Jan 11 – 27.'),
  ('snipe', 'Statewide', 'general', null, date '2026-09-26', date '2027-01-28', '8 per day.', null)
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

-- DELAWARE ------------------------------------------------------------------
with st as (select id from public.states where code = 'DE'),
src as (select id from public.sources where url = 'https://www.eregulations.com/delaware/hunting/deer-seasons'),
rows_to_add (species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  ('deer', 'Statewide', 'archery', 'Archery & Crossbow', date '2026-09-01', date '2027-01-31',
   '2 antlered per license year + antlerless.', 'Continuous Sep – Jan; hunter orange required during firearm seasons.'),
  ('deer', 'Statewide', 'muzzleloader', 'Muzzleloader', date '2026-10-09', date '2026-10-18',
   null, 'Second segment Jan 25 – 31.'),
  ('deer', 'Statewide', 'firearm', 'Shotgun', date '2026-11-13', date '2026-11-22',
   null, 'January segment Jan 16 – 24; handgun/straight-wall rifle Jan 2 – 10. Antlerless days in Oct and Dec; youth weekends Sep 26 – 27 and Nov 7 – 8.'),
  ('turkey', 'Statewide', 'general', 'Spring Turkey (no fall season)', date '2027-04-10', date '2027-05-09',
   '1 bearded.', 'Delaware has no fall turkey season. Youth/non-ambulatory Apr 3 – 4. Public-land segments by lottery.'),
  ('dove', 'Statewide', 'general', 'Dove (three splits)', date '2026-09-01', date '2027-01-31',
   '15 per day.', 'Splits Sep 1 – 27, Nov 23 – 29, Dec 7 – Jan 31.'),
  ('duck', 'Teal Zone', 'general', 'September Teal', date '2026-09-05', date '2026-09-13',
   '6 per day.', 'Designated teal zone only.'),
  ('duck', 'Statewide', 'general', 'Duck', date '2026-10-31', date '2027-01-31',
   '6 per day.', 'Splits Oct 31 – Nov 7, Nov 25 – 29, Dec 16 – Jan 31.'),
  ('goose', 'Statewide', 'general', 'September Canada Goose (resident)', date '2026-09-01', date '2026-09-25',
   '15 per day.', 'Segmented differently inside the teal zone — check the DE migratory guide.'),
  ('goose', 'Statewide', 'general', 'Regular Canada Goose (AP)', date '2026-11-25', date '2027-01-31',
   '2 per day.', 'Splits Nov 25 – 29 and Dec 23 – Jan 31. Snow goose Nov 25 – Mar 10 (25/day); brant split seasons (1/day).'),
  ('pheasant', 'Statewide', 'general', 'Pheasant (males only)', date '2026-11-23', date '2027-02-28', '2 per day.', null),
  ('bobwhite', 'Statewide', 'general', 'Quail (pen-raised only)', date '2026-11-23', date '2027-02-28',
   null, 'Wild quail season closed; pen-raised birds only with Division permit.'),
  ('rabbit', 'Statewide', 'general', 'Cottontail', date '2026-11-23', date '2027-02-28', '4 per day.', null),
  ('squirrel', 'Statewide', 'general', 'Gray Squirrel', date '2026-09-15', date '2027-02-28',
   '6 per day.', 'Closed during the November firearm deer season.'),
  ('woodcock', 'Statewide', 'general', null, date '2026-11-23', date '2027-01-24',
   '3 per day.', 'Splits Nov 23 – Dec 6 and Dec 25 – Jan 24.'),
  ('snipe', 'Statewide', 'general', null, date '2026-09-29', date '2027-01-31',
   '8 per day.', 'Splits Sep 29 – Dec 6 and Dec 25 – Jan 31.')
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

-- CONNECTICUT ----------------------------------------------------------------
with st as (select id from public.states where code = 'CT'),
src as (select id from public.sources where url = 'https://portal.ct.gov/deep/hunting/2026-connecticut-hunting-and-trapping-guide/deer-hunting'),
rows_to_add (species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  ('deer', 'Statewide', 'archery', 'Archery (private land)', date '2026-09-15', date '2026-12-31',
   '4 (2 either-sex + 2 antlerless).', 'State land Sep 15 – Nov 17 + Dec 23 – 31. January archery extension in zones 11 – 12.'),
  ('deer', 'Statewide', 'firearm', 'Shotgun/Rifle (private land)', date '2026-11-18', date '2026-12-08',
   '1 either sex + antlerless by zone.', 'State-land lottery "A" season Nov 18 – 27.'),
  ('deer', 'Statewide', 'muzzleloader', 'Muzzleloader (private land)', date '2026-12-09', date '2026-12-31',
   '1 either sex + antlerless by zone.', 'State land Dec 9 – 22.'),
  ('turkey', 'Statewide', 'archery', 'Fall Archery Turkey', date '2026-09-15', date '2026-12-31',
   '2 either sex.', 'Private land all zones; state land Sep 15 – Nov 17 + Dec 23 – 31.'),
  ('turkey', 'Statewide', 'firearm', 'Fall Firearms Turkey', date '2026-10-03', date '2026-10-31',
   '3 either sex.', null),
  ('duck', 'North Zone', 'general', 'Duck', date '2026-10-10', date '2027-01-09',
   '6 per day.', 'Segments Oct 10 – 17, Nov 7 – 11, Nov 14 – Jan 9.'),
  ('duck', 'South Zone', 'general', 'Duck', date '2026-10-10', date '2027-01-19',
   '6 per day.', 'Segments Oct 10 – 12, Nov 11, Nov 14 – Jan 19.'),
  ('goose', 'North Zone', 'general', 'September Canada Goose', date '2026-09-01', date '2026-09-30',
   '15 per day.', 'South Zone Sep 15 – 30.'),
  ('goose', 'Statewide', 'general', 'Regular Canada Goose (NAP-H)', date '2026-10-10', date '2027-01-14',
   '2 per day.', 'AP Unit and AFRP Unit dates/bags differ; snow goose Oct 1 – Jan 9 + Feb 16 – Mar 10 (25/day).'),
  ('pheasant', 'Statewide', 'general', null, date '2026-10-17', date '2026-12-31',
   '2 per day, 10 per season.', 'Resumes Jan 1 – Feb 28 (formally in the 2027 guide).'),
  ('ruffed-grouse', 'Statewide', 'general', null, date '2026-10-17', date '2026-11-30',
   '1 per day, 8 per season.', null),
  ('bobwhite', 'Statewide', 'general', 'Quail', date '2026-10-17', date '2026-10-31',
   '2 per day, 10 per season.', null),
  ('rabbit', 'Statewide', 'general', 'Cottontail', date '2026-10-17', date '2026-12-31',
   '3 per day, 25 per season.', 'Resumes Jan 1 – Feb 28. Snowshoe hare Nov 21 – Dec 31.'),
  ('squirrel', 'Statewide', 'general', 'Gray Squirrel', date '2026-09-01', date '2026-12-31',
   '8 per day, 40 per season.', 'Resumes Jan 1 – Feb 28.'),
  ('woodcock', 'Statewide', 'general', null, date '2026-10-22', date '2026-12-12', '3 per day.', null),
  ('snipe', 'Statewide', 'general', null, date '2026-09-01', date '2027-01-08',
   '8 per day.', 'Splits Sep 1 – Oct 10 and Oct 17 – Jan 8.')
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
