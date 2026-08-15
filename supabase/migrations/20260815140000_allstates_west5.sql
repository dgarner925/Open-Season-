-- All-states pass, batch 2: ID, NM, UT, WY, WA — 2026-27 (all were thin).
-- Filled 2026-08-15 from official agency publications (IDFG PDFs, NMDGF
-- 2026-27 booklet, Utah DWR guidebooks, WGFD commission-adopted chapters,
-- WDFW pamphlets via eRegulations). Big-game rows are FRAMEWORK windows —
-- these states are unit/draw-heavy, and the "dates vary by unit" notes are
-- load-bearing.

insert into public.sources (agency_name, url, doc_type, state_id, notes, last_extracted_at)
select v.agency, v.url, (case when v.url like '%.pdf' then 'pdf' else 'webpage' end)::source_doc_type, s.id, v.notes, now()
from (values
  ('Idaho Department of Fish and Game',
   'https://idfg.idaho.gov/sites/default/files/seasons-rules-big-game-2026.pdf',
   'ID', '2026-27 filled manually 2026-08-15 from IDFG big game, upland, migratory, and sage-grouse PDFs.'),
  ('New Mexico Department of Game & Fish',
   'https://wildlife.dgf.nm.gov/download/2026-2027-new-mexico-hunting-rules-and-info/',
   'NM', '2026-27 filled manually 2026-08-15 from the official Rules & Info booklet + migratory bird supplement.'),
  ('Utah Division of Wildlife Resources',
   'https://wildlife.utah.gov/guidebooks/field_regs.pdf',
   'UT', '2026-27 filled manually 2026-08-15 from DWR big game field regs + combined waterfowl/upland/turkey guidebook.'),
  ('Wyoming Game & Fish Department',
   'https://wgfd.wyo.gov/media/33694/download?inline',
   'WY', '2026-27 filled manually 2026-08-15 from commission-adopted regulation chapters (Apr 22, 2026).'),
  ('Washington Department of Fish & Wildlife',
   'https://www.eregulations.com/washington/hunting/deer-general-seasons',
   'WA', '2026-27 filled manually 2026-08-15 from WDFW pamphlets via eRegulations.')
) as v(agency, url, code, notes)
join public.states s on s.code = v.code
where not exists (select 1 from public.sources x where x.url = v.url);

insert into public.zones (state_id, name)
select s.id, v.zone
from (values
  ('ID','Area 1'),
  ('NM','North Zone'),('NM','Central Flyway'),('NM','Eastern Counties'),
  ('UT','Northern Zone'),('UT','Northern Goose Area'),
  ('WY','Pacific Flyway'),('WY','Central Flyway'),('WY','Hunt Area 1'),
  ('WA','Eastern WA'),('WA','Western WA')
) as v(code, zone)
join public.states s on s.code = v.code
where not exists (select 1 from public.zones z where z.state_id = s.id and z.name = v.zone);

-- IDAHO -------------------------------------------------------------------
with st as (select id from public.states where code = 'ID'),
src as (select id from public.sources where url = 'https://idfg.idaho.gov/sites/default/files/seasons-rules-big-game-2026.pdf'),
rows_to_add (species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  ('deer', 'Statewide', 'firearm', 'General Any-Weapon (most common window)', date '2026-10-10', date '2026-10-24',
   '1 per tag.', 'Dates vary by unit — some Sep 15 – Nov 20, many Oct 10 – 31, whitetail units to Dec 1. Check IDFG regs.'),
  ('elk', 'Statewide', 'firearm', 'General Any-Weapon B Tag (common window)', date '2026-10-10', date '2026-10-24',
   '1 per tag.', 'Zone-based A/B tag system; other zones run Oct 1 – Nov 11. Check IDFG regs.'),
  ('pronghorn', 'Statewide', 'firearm', 'Controlled Hunt (draw only)', date '2026-09-25', date '2026-10-24',
   '1 per permit.', 'All 2026 pronghorn hunting is controlled-hunt draw — no general season. Dates vary by hunt.'),
  ('turkey', 'Statewide', 'general', 'Fall General (either sex)', date '2026-08-30', date '2026-12-31',
   '1.', 'Close varies by unit group: Oct 9, Dec 31, or Jan 31 (Panhandle, needs 2027 tag).'),
  ('dove', 'Statewide', 'general', null, date '2026-09-01', date '2026-10-30', '15 per day.', 'HIP permit required.'),
  ('duck', 'Area 1', 'general', 'Duck, Merganser & Coot', date '2026-10-19', date '2027-01-31',
   '7 per day.', 'Area 1 = state except Areas 2-3. Area 2 (SE) Oct 3 – Jan 15; Area 3 (Panhandle) Oct 10 – Jan 22. Youth/veterans weekend Sep 26 – 27.'),
  ('goose', 'Area 1', 'general', 'Canada Goose', date '2026-10-19', date '2027-01-31',
   '5 per day.', 'Area 2 Oct 3 – Jan 15; Area 3 Nov 3 – Feb 15; Area 4 (SE) Sep 1 – 15 + Oct 3 – Dec 31. White-fronted bag 6; light geese bag 20.'),
  ('western-quail', 'Statewide', 'general', 'California Quail', date '2026-09-15', date '2027-01-31',
   '10 per day.', 'Mountain and Gambel''s quail closed.'),
  ('ruffed-grouse', 'Statewide', 'general', 'Forest Grouse (dusky/ruffed/spruce)', date '2026-08-30', date '2026-12-31',
   '4 per day aggregate.', 'Northern 10 counties run Aug 30 – Jan 31.'),
  ('sage-grouse', 'Statewide', 'general', 'Sage-Grouse (tag required)', date '2026-09-15', date '2026-10-31',
   '2 per season.', 'Open only in 12 designated zones; 4,280 tags, on sale Aug 3.'),
  ('pheasant', 'Statewide', 'general', 'Pheasant (roosters only)', date '2026-10-15', date '2026-12-31',
   '3 per day.', 'Nonresident opener Oct 20; youth season Oct 8 – 14.'),
  ('rabbit', 'Statewide', 'general', 'Cottontail', date '2026-08-30', date '2027-03-31',
   '8 per day.', 'Snowshoe hare same dates and bag; pygmy rabbit closed.'),
  ('squirrel', 'Statewide', 'general', 'Red Squirrel', date '2026-08-30', date '2027-03-31', '8 per day.', null)
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

-- NEW MEXICO --------------------------------------------------------------
with st as (select id from public.states where code = 'NM'),
src as (select id from public.sources where url = 'https://wildlife.dgf.nm.gov/download/2026-2027-new-mexico-hunting-rules-and-info/'),
rows_to_add (species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  ('deer', 'Statewide', 'firearm', 'Rifle (typical draw windows)', date '2026-10-24', date '2026-11-18',
   '1 per license.', 'All draw; mostly 5-day windows. Archery Sep 1 – 24 + Jan 1 – 15; muzzleloader Sep 27 – Oct 3. Dates vary by unit/hunt code.'),
  ('elk', 'Statewide', 'firearm', 'Rifle (framework)', date '2026-10-01', date '2026-12-30',
   '1 per license.', 'All draw; 5-day windows scattered Oct – Dec. Archery Sep 1 – 14 and Sep 15 – 24. Dates vary by unit/hunt code.'),
  ('pronghorn', 'Statewide', 'firearm', 'Rifle (framework)', date '2026-08-29', date '2026-10-05',
   '1 per license.', 'All draw; mostly 3-day hunts. Archery Aug 15 – 23. Dates vary by unit/hunt code.'),
  ('turkey', 'Statewide', 'general', 'Fall Turkey (over the counter)', date '2026-09-01', date '2026-11-30',
   '1 per fall season.', 'Sep 1 – 30 bow only; Nov 1 – 30 shotgun/bow/crossbow. Some units/WMAs closed.'),
  ('dove', 'North Zone', 'general', null, date '2026-09-01', date '2026-11-29',
   '15 per day.', 'South Zone split: Sep 1 – Oct 28 + Dec 1 – Jan 1.'),
  ('duck', 'Central Flyway', 'general', 'September Teal', date '2026-09-12', date '2026-09-20',
   '6 per day.', 'East of the Continental Divide only — no teal season in the Pacific Flyway portion.'),
  ('duck', 'Central Flyway', 'general', 'Duck & Coot', date '2026-10-10', date '2027-01-31',
   '6 per day.', 'CF North Oct 10 – Jan 13; CF South Oct 28 – Jan 31. Pacific Flyway (west of Divide) Oct 19 – Jan 31, bag 7.'),
  ('goose', 'Central Flyway', 'general', 'Goose (dark & light)', date '2026-10-17', date '2027-01-31',
   'Dark 5/day; light 50/day.', 'MRGV dark-goose season Dec 19 – Jan 31 (2/season). Light-goose Conservation Order Feb 1 – Mar 10.'),
  ('sandhill-crane', 'Eastern Counties', 'general', 'Sandhill Crane (Eastern hunt)', date '2026-10-24', date '2027-01-21',
   '3 per day.', 'Unlimited free permits for the Eastern hunt; MRGV/Estancia/Southwest hunts are draw-only short windows.'),
  ('western-quail', 'Statewide', 'general', 'Quail (scaled/Gambel''s/bobwhite/Montezuma)', date '2026-11-15', date '2027-02-15',
   '15 per day aggregate (max 5 Montezuma).', 'Over the counter.'),
  ('ruffed-grouse', 'Statewide', 'general', 'Dusky Grouse', date '2026-09-01', date '2026-12-31',
   '3 per day North zone; 1 per day South.', null),
  ('squirrel', 'Statewide', 'general', 'Tree Squirrel', date '2026-09-01', date '2026-12-31', '8 per day.', null),
  ('pheasant', 'Statewide', 'general', 'Pheasant (4-day season)', date '2026-12-10', date '2026-12-13',
   '3 per day, males only.', 'Separate resident-only draw hunts on select WMAs.')
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

-- UTAH --------------------------------------------------------------------
with st as (select id from public.states where code = 'UT'),
src as (select id from public.sources where url = 'https://wildlife.utah.gov/guidebooks/field_regs.pdf'),
rows_to_add (species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  ('deer', 'Statewide', 'firearm', 'General Buck (any legal weapon)', date '2026-10-17', date '2026-10-25',
   '1.', 'Early rifle Oct 7 – 11 on select units. Dates vary by unit/season type.'),
  ('deer', 'Statewide', 'archery', 'General Buck Archery', date '2026-08-15', date '2026-09-11',
   '1.', 'Extended-archery areas continue Sep 12 – Oct 15 or Nov 30 by area.'),
  ('elk', 'Statewide', 'firearm', 'General Elk (any legal weapon)', date '2026-10-03', date '2026-10-15',
   '1.', 'Spike-bull units Oct 3 – 15; any-bull units split Oct 3 – 9 / Oct 10 – 16.'),
  ('elk', 'Statewide', 'archery', 'General Elk Archery', date '2026-08-15', date '2026-09-16',
   '1.', 'Any-bull Aug 15 – Sep 16; spike units Aug 15 – Sep 4.'),
  ('pronghorn', 'Statewide', 'firearm', 'Buck Pronghorn (limited entry rifle)', date '2026-09-12', date '2026-09-20',
   '1 per permit.', 'All pronghorn is limited-entry draw. Archery Aug 15 – Sep 11; muzzleloader Sep 23 – Oct 1.'),
  ('turkey', 'Statewide', 'general', 'Fall Turkey (management hunts)', date '2026-10-01', date '2027-02-28',
   '1 per permit (up to 3 fall permits).', 'Permit required (on sale Sep 10); select mapped areas in 4 regions, mostly private land. Mandatory harvest reporting new for fall 2026.'),
  ('dove', 'Statewide', 'general', null, date '2026-09-01', date '2026-10-30', '15 per day.', 'HIP required.'),
  ('duck', 'Northern Zone', 'general', 'Duck, Merganser, Coot & Snipe', date '2026-10-03', date '2027-01-16',
   '7 per day.', 'Southern Zone Oct 10 – Jan 23. Youth days Sep 19 (N) / Sep 26 (S).'),
  ('goose', 'Northern Goose Area', 'general', 'Dark Geese', date '2026-10-03', date '2027-01-31',
   '5 per day.', 'Split Oct 3 – 10 then Oct 26 – Jan 31; other areas differ (Wasatch Front Oct 3 – 10 + Nov 10 – Feb 15). Light geese separate, bag 20.'),
  ('western-quail', 'Statewide', 'general', 'California & Gambel''s Quail', date '2026-11-07', date '2026-12-31',
   '5 per day.', 'Youth hunt Oct 31 – Nov 2. Scaled quail closed statewide.'),
  ('pheasant', 'Statewide', 'general', 'Pheasant (males only)', date '2026-11-07', date '2026-12-06',
   '2 per day.', 'Youth hunt Oct 31 – Nov 5.'),
  ('ruffed-grouse', 'Statewide', 'general', 'Dusky & Ruffed Grouse', date '2026-09-01', date '2026-12-31',
   '4 per day combined.', null),
  ('chukar', 'Statewide', 'general', 'Chukar & Gray Partridge', date '2026-09-26', date '2027-02-15',
   '5 per day.', 'Youth hunt Sep 19 – 21.'),
  ('rabbit', 'Statewide', 'general', 'Cottontail', date '2026-09-01', date '2027-02-28',
   '10 per day.', 'Snowshoe hare Sep 1 – Mar 15 (bag 5); jackrabbit year-round.')
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

-- WYOMING -----------------------------------------------------------------
with st as (select id from public.states where code = 'WY'),
src as (select id from public.sources where url = 'https://wgfd.wyo.gov/media/33694/download?inline'),
rows_to_add (species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  ('deer', 'Statewide', 'firearm', 'General (most common window)', date '2026-10-01', date '2026-10-15',
   '1 per license.', 'Most general areas open Oct 1; closes vary Oct 14 – Nov 20 by hunt area. Special archery Sep 1 – 30.'),
  ('elk', 'Statewide', 'firearm', 'General (most common window)', date '2026-10-15', date '2026-11-30',
   '1 per license.', 'Oct 15 most common opener; closes vary Oct 31 – Jan 31 by hunt area. Special archery Sep 1 – 30.'),
  ('pronghorn', 'Statewide', 'firearm', 'Antelope (limited quota)', date '2026-10-01', date '2026-10-31',
   '1 per license.', 'All areas draw-only limited quota; nearly all open Oct 1. Archery Aug 15 – Sep 30.'),
  ('turkey', 'Statewide', 'general', 'Fall Turkey (Area 1 general)', date '2026-09-01', date '2027-01-31',
   '1.', 'Archery only Sep 1 – 30, any legal method Oct 1 – Jan 31; general license valid in listed counties plus private land elsewhere.'),
  ('dove', 'Statewide', 'general', null, date '2026-09-01', date '2026-11-29',
   '15 per day.', 'A few local areas close after mid-Nov.'),
  ('duck', 'Pacific Flyway', 'general', 'Ducks & Mergansers', date '2026-09-26', date '2027-01-08',
   '7 per day.', 'Youth/veteran days Sep 19 – 20.'),
  ('duck', 'Central Flyway', 'general', 'Ducks & Mergansers (splits)', date '2026-10-03', date '2027-01-31',
   '6 per day.', 'Zones C1/C1A: Oct 3 – 20 + Nov 14 – Jan 31. Zone C2: Sep 26 – Nov 29 + Dec 12 – Jan 12. No separate September teal season.'),
  ('goose', 'Pacific Flyway', 'general', 'Dark Geese', date '2026-09-26', date '2026-12-31',
   '5 per day.', 'Light geese same dates, bag 10. Central Flyway zones split through Feb 14; light-goose Conservation Order Feb 15 – Apr 30.'),
  ('sage-grouse', 'Hunt Area 1', 'general', 'Sage Grouse', date '2026-09-19', date '2026-09-30',
   '2 per day.', 'Hunt Areas 2/3/4 closed. Free sage grouse permit required.'),
  ('ruffed-grouse', 'Statewide', 'general', 'Blue (Dusky) & Ruffed Grouse', date '2026-09-01', date '2026-12-31',
   '3 per day.', 'Sharp-tailed grouse east of the Divide: same dates and limits.'),
  ('chukar', 'Statewide', 'general', 'Chukar & Gray Partridge', date '2026-09-15', date '2027-01-31', '5 per day.', null),
  ('pheasant', 'Statewide', 'general', 'Pheasant (most areas)', date '2026-11-01', date '2026-12-31',
   '3 per day, males only most areas.', 'Area 2 closes Nov 30; special WHMA permit hunts differ.'),
  ('squirrel', 'Statewide', 'general', 'Red, Gray & Fox Squirrel', date '2026-09-01', date '2027-03-31', '4 per day.', null),
  ('rabbit', 'Statewide', 'general', 'Cottontail', date '2026-09-01', date '2027-03-31', '10 per day.', null)
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

-- WASHINGTON ----------------------------------------------------------------
with st as (select id from public.states where code = 'WA'),
src as (select id from public.sources where url = 'https://www.eregulations.com/washington/hunting/deer-general-seasons'),
rows_to_add (species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  ('deer', 'Statewide', 'firearm', 'General Modern Firearm', date '2026-10-17', date '2026-11-01',
   '1.', 'Black-tailed Oct 17 – Nov 1; white-tailed Oct 17 – 27/30; mule deer Oct 17 – 27 (3-pt min). Varies by GMU. Late general seasons in select GMUs.'),
  ('deer', 'Statewide', 'archery', 'Early Archery', date '2026-09-01', date '2026-09-25',
   '1.', 'Some GMUs close Sep 20 – 22; legal deer vary by GMU. Late archery in select GMUs.'),
  ('elk', 'Eastern WA', 'firearm', 'General Modern Firearm', date '2026-10-31', date '2026-11-08',
   '1.', 'Most Eastern GMUs; some run through Nov 15. Legal elk varies by GMU.'),
  ('elk', 'Western WA', 'firearm', 'General Modern Firearm', date '2026-11-07', date '2026-11-18',
   '1.', 'Most Western GMUs; mostly 3-pt minimum.'),
  ('turkey', 'Statewide', 'general', 'Fall General Turkey', date '2026-09-01', date '2026-12-31',
   'Varies by GMU group; fall seasonal limit 4.', 'Open only in listed GMUs.'),
  ('dove', 'Statewide', 'general', null, date '2026-09-01', date '2026-10-30', '15 per day.', null),
  ('duck', 'Statewide', 'general', 'Duck', date '2026-10-17', date '2027-01-31',
   '7 per day.', 'Split: Oct 17 – 25, closed Oct 26 – 27, reopens Oct 28 – Jan 31. Scaup closed Oct 17 – Nov 6.'),
  ('goose', 'Statewide', 'general', 'Goose', date '2026-10-17', date '2027-01-31',
   'Typically 3 Canada per day.', 'Dates and closures vary by Goose Management Area — check the pamphlet for your GMA.'),
  ('ruffed-grouse', 'Statewide', 'general', 'Forest Grouse (ruffed/dusky/sooty/spruce)', date '2026-09-15', date '2027-01-15',
   '4 per day with species sub-limits.', null),
  ('pheasant', 'Eastern WA', 'general', 'Pheasant (cocks only)', date '2026-10-17', date '2027-01-18',
   '3 per day.', 'Western WA release-site season Sep 19 – Nov 30, 2 either-sex, permit required. Youth Sep 12 – 13.'),
  ('western-quail', 'Eastern WA', 'general', 'California Quail', date '2026-10-03', date '2027-01-18',
   '10 per day.', 'Western WA: Sep 19 – Nov 30.'),
  ('rabbit', 'Statewide', 'general', 'Cottontail & Snowshoe Hare', date '2026-09-01', date '2027-03-15',
   '5 per day straight or mixed.', 'Jackrabbit and pygmy rabbit closed.')
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
