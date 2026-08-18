-- Coverage burn-down batch A: AL, AR, FL, ND, SD tier 2-3 species
-- (woodcock/snipe/crane/small game/furbearers/draw big game).
-- Filled 2026-08-18 from official sources (outdooralabama.com, agfc.com,
-- myfwc.com, gf.nd.gov, gfp.sd.gov 2026 handbook PDF).
-- Year-round species use the 2026-07-01..2027-06-30 license-year convention.
-- Skipped on purpose: FL fox (illegal to take — matrix prune list),
-- AL coyote night season (defined relative to deer seasons, no fixed dates),
-- AR hog on WMAs (per-WMA rules, private-land year-round row covers the pair).

insert into public.sources (agency_name, url, doc_type, state_id, notes, last_extracted_at)
select v.agency, v.url, (case when v.url like '%.pdf' then 'pdf' else 'webpage' end)::source_doc_type, s.id, 'Tier 2-3 coverage fill 2026-08-18.', now()
from (values
  ('Alabama Department of Conservation and Natural Resources',
   'https://www.outdooralabama.com/bobcat-coyote-feral-swine-and-fox-seasons', 'AL'),
  ('Arkansas Game & Fish Commission',
   'https://www.agfc.com/hunting/more-game/furbearers/hunting-season-dates-and-bag-limits/', 'AR'),
  ('Florida Fish and Wildlife Conservation Commission',
   'https://myfwc.com/hunting/season-dates/', 'FL'),
  ('North Dakota Game and Fish Department',
   'https://gf.nd.gov/regulations/small-game', 'ND'),
  ('South Dakota Game, Fish and Parks',
   'https://gfp.sd.gov/UserDocs/docs/huntingandtrappinghandbook.pdf', 'SD')
) as v(agency, url, code)
join public.states s on s.code = v.code
where not exists (select 1 from public.sources x where x.url = v.url);

insert into public.zones (state_id, name)
select s.id, v.zone
from (values
  ('AL','North Alabama Zone'),
  ('ND','Badlands (Zone 1)'),('ND','Zone 2'),('ND','West of US 281'),('ND','East of US 281'),('ND','Western ND'),('ND','Eastern ND'),
  ('SD','Custer State Park'),('SD','Black Hills'),('SD','Black Hills Units'),('SD','Western Open Unit'),('SD','West River'),('SD','East River & Black Hills'),('SD','Prairie (outside Black Hills)')
) as v(code, zone)
join public.states s on s.code = v.code
where not exists (select 1 from public.zones z where z.state_id = s.id and z.name = v.zone);

with rows_to_add (state_code, species_key, zone_name, label, open_date, close_date, bag, notes) as (
  values
  -- ALABAMA
  ('AL','woodcock','Statewide', null, date '2026-12-18', date '2027-01-31', '3 per day.', 'HIP required.'),
  ('AL','sandhill-crane','North Alabama Zone', 'Draw Season — Segment 1', date '2026-11-27', date '2027-01-03',
   '3 per permit (season total).', 'Limited-quota draw (~750 permits); Alabama residents/lifetime license holders. Zone north of I-20/east of I-65/north of I-22.'),
  ('AL','sandhill-crane','North Alabama Zone', 'Draw Season — Segment 2', date '2027-01-11', date '2027-01-25',
   '3 per permit (season total).', 'Second split of the same draw permit.'),
  ('AL','nutria','Statewide', 'Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Daylight hours only.'),
  ('AL','snipe','Statewide', null, date '2026-11-07', date '2027-02-21', '8 per day.', 'HIP required.'),
  ('AL','coyote','Statewide', 'Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Daytime year-round. A separate nighttime season on private land runs from the end of gun deer season to the start of archery season (special license required).'),
  ('AL','crow','Statewide', 'Year-round (no closed season)', date '2026-07-01', date '2027-06-30', 'No limit.', 'Daylight hours only.'),
  ('AL','fox','Statewide', 'Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Daytime hunting. Trapping season Oct 31 – Feb 28.'),
  ('AL','raccoon','Statewide', 'Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit private; 5/party on open-permit public land.', 'Trapping also year-round.'),
  ('AL','bobcat','Statewide', 'Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Daytime hunting; carcass tagging within 14 days. Trapping season Oct 31 – Feb 28.'),
  -- ARKANSAS
  ('AR','woodcock','Statewide', null, date '2026-11-07', date '2026-12-21', '3 per day.', 'HIP required for 16+.'),
  ('AR','bobwhite','Statewide', 'Quail', date '2026-11-01', date '2027-02-07',
   '6 per day.', 'Private land statewide; WMA dates may differ. End date per AGFC page — confirm in the 2026-27 digest.'),
  ('AR','wild-hog','Statewide', 'Year-round on private land', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Day or night on private land with landowner permission. On WMAs: only during open daylight hunting seasons, per-WMA rules.'),
  ('AR','rabbit','Statewide', null, date '2026-09-01', date '2027-02-28', '8 per day.', null),
  ('AR','squirrel','Statewide', null, date '2026-05-15', date '2027-02-28', '12 per day.', 'Dogs permitted.'),
  ('AR','snipe','Statewide', null, date '2026-11-01', date '2027-02-15', '8 per day.', 'HIP required.'),
  ('AR','coyote','Statewide', 'Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Night hunting requires a free predator control permit; dogs restricted during turkey season.'),
  ('AR','crow','Statewide', 'Thursdays – Mondays only', date '2026-09-03', date '2027-02-21',
   'No limit.', 'Open Thu – Mon each week; no hunting over bait.'),
  ('AR','fox','Statewide', null, date '2026-09-01', date '2027-02-28', '2 per day.', 'Gray and red fox; day hunting only.'),
  ('AR','raccoon','Statewide', 'Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Day or night; dogs required for night hunts.'),
  ('AR','bobcat','Statewide', null, date '2026-09-01', date '2027-02-28', '2 per day.', 'Sunrise to sunset; dog rules vary during deer seasons.'),
  -- FLORIDA
  ('FL','woodcock','Statewide', null, date '2026-12-18', date '2027-01-31', '3 per day.', null),
  ('FL','bobwhite','Statewide', 'Quail', date '2026-11-14', date '2027-03-07', '12 per day.', null),
  ('FL','wild-hog','Statewide', 'Year-round on private land', date '2026-07-01', date '2027-06-30',
   'No limit.', 'WMA-specific rules apply on public land.'),
  ('FL','nutria','Statewide', 'Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Non-protected wildlife; may be taken all year.'),
  ('FL','rabbit','Statewide', 'Year-round (no closed season)', date '2026-07-01', date '2027-06-30', '12 per day.', null),
  ('FL','squirrel','Statewide', 'Gray Squirrel — year-round', date '2026-07-01', date '2027-06-30',
   '12 per day.', 'Fox squirrels may NOT be taken.'),
  ('FL','snipe','Statewide', null, date '2026-11-01', date '2027-02-15', '8 per day.', null),
  ('FL','coyote','Statewide', 'Year-round (no closed season)', date '2026-07-01', date '2027-06-30', 'No limit.', null),
  ('FL','crow','Statewide', 'Segment 1 (weekends only)', date '2026-08-08', date '2026-10-25',
   'No limit.', 'Saturdays and Sundays only.'),
  ('FL','crow','Statewide', 'Segment 2', date '2026-11-11', date '2027-02-18', 'No limit.', null),
  ('FL','raccoon','Statewide', 'Year-round (no closed season)', date '2026-07-01', date '2027-06-30', 'No limit.', null),
  ('FL','bobcat','Statewide', null, date '2026-12-01', date '2027-03-31', 'No limit.', null),
  -- NORTH DAKOTA
  ('ND','bighorn-sheep','Statewide', 'Once-in-a-lifetime Draw', date '2026-10-30', date '2026-12-31',
   '1 per lifetime license.', 'Lottery only (drawn ~Sep 1 after surveys). Two periods: Oct 30 – Nov 13 and Nov 14 – Dec 31, units B1-B5.'),
  ('ND','mountain-lion','Badlands (Zone 1)', 'Early Season', date '2026-09-04', date '2026-11-22',
   '1.', 'Zone 1 early-season harvest limit 8 lions; closes early if reached. Furbearer certificate required.'),
  ('ND','mountain-lion','Badlands (Zone 1)', 'Late Season (dogs allowed)', date '2026-11-23', date '2027-03-31',
   '1.', 'Late-season limit 7 lions or 3 females, whichever first.'),
  ('ND','mountain-lion','Zone 2', null, date '2026-09-04', date '2027-03-31', '1.', 'No harvest limit in Zone 2.'),
  ('ND','sharptail-grouse','Statewide', null, date '2026-09-12', date '2027-01-03',
   '3 per day.', 'Closed in the far northeast corner.'),
  ('ND','gray-partridge','Statewide', 'Hungarian Partridge', date '2026-09-12', date '2027-01-03', '3 per day.', null),
  ('ND','ruffed-grouse','Statewide', null, date '2026-09-12', date '2027-01-03', '3 per day.', null),
  ('ND','sandhill-crane','West of US 281', 'Unit 1', date '2026-09-19', date '2026-11-15',
   '3 per day.', 'Crane permit required in addition to small game license.'),
  ('ND','sandhill-crane','East of US 281', 'Unit 2', date '2026-09-19', date '2026-11-15', '2 per day.', null),
  ('ND','snipe','Statewide', null, date '2026-09-12', date '2026-11-29', '8 per day.', null),
  ('ND','coyote','Statewide', 'Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Night hunting Nov 23 – May 31 (on foot only).'),
  ('ND','crow','Statewide', 'Fall Season', date '2026-08-15', date '2026-11-02', 'No limit.', null),
  ('ND','crow','Statewide', 'Spring Season', date '2027-03-13', date '2027-04-25', 'No limit.', null),
  ('ND','fox','Statewide', 'Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Red and gray fox; hunting and trapping year-round.'),
  ('ND','raccoon','Statewide', 'Year-round (no closed season)', date '2026-07-01', date '2027-06-30', 'No limit.', null),
  ('ND','bobcat','Western ND', 'Hunting & Trapping', date '2026-11-07', date '2027-03-15',
   'No harvest limit.', 'Furbearer license; pelt tagging required.'),
  ('ND','bobcat','Eastern ND', 'Hunting & Trapping (quota)', date '2026-11-23', date '2027-03-15',
   '1.', 'Zone quota of 8 bobcats — closes when reached.'),
  -- SOUTH DAKOTA
  ('SD','bighorn-sheep','Black Hills Units', 'Once-in-a-lifetime Draw', date '2026-09-01', date '2026-12-31',
   '1 per lifetime license.', 'Resident-only lottery; very few licenses.'),
  ('SD','mountain-lion','Black Hills', null, date '2026-12-26', date '2027-04-30',
   '1.', 'Resident only. Closes early at 60 lions or 40 females. Dogs by permit only.'),
  ('SD','mountain-lion','Prairie (outside Black Hills)', 'Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   '1.', 'Open year-round outside the Black Hills Fire Protection District; resident only.'),
  ('SD','sharptail-grouse','Statewide', 'Prairie Grouse', date '2026-09-19', date '2027-01-31',
   '3 per day combined (sharptail + prairie chicken + ruffed).', null),
  ('SD','gray-partridge','Statewide', 'Partridge & Chukar', date '2026-09-19', date '2027-01-31', '5 per day combined.', null),
  ('SD','ruffed-grouse','Statewide', null, date '2026-09-19', date '2027-01-31',
   '3 per day combined grouse limit.', 'Black Hills is the practical range.'),
  ('SD','prairie-chicken','Statewide', null, date '2026-09-19', date '2027-01-31',
   '3 per day combined with sharptail.', null),
  ('SD','sandhill-crane','Western Open Unit', null, date '2026-09-26', date '2026-11-22',
   '3 per day.', 'Western SD open unit only; non-toxic shot; State Migratory Bird Certificate required.'),
  ('SD','bison','Custer State Park', 'Non-trophy (draw only)', date '2026-10-05', date '2026-11-13',
   '1 per license.', 'Custer State Park limited draw/auction; resident-only.'),
  ('SD','bison','Custer State Park', 'Trophy (draw/auction only)', date '2026-11-16', date '2027-01-15',
   '1 per license.', null),
  ('SD','rabbit','Statewide', 'Cottontail', date '2026-09-01', date '2027-03-31',
   '10 per day.', 'Landowners may take year-round on their own land.'),
  ('SD','squirrel','Statewide', 'Tree Squirrel', date '2026-09-01', date '2027-03-31', '5 per day.', null),
  ('SD','snipe','Statewide', null, date '2026-09-01', date '2026-10-31',
   '5 per day.', 'Non-toxic shot; State Migratory Bird Certificate required.'),
  ('SD','coyote','Statewide', 'Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Predator/varmint license qualifies.'),
  ('SD','crow','Statewide', 'Fall Season', date '2026-09-01', date '2026-10-31', 'No limit.', null),
  ('SD','crow','Statewide', 'Spring Season', date '2027-03-01', date '2027-04-30', 'No limit.', null),
  ('SD','fox','Statewide', 'Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Red and gray fox.'),
  ('SD','raccoon','Statewide', 'Year-round (residents)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Nonresidents: Dec 1 – Mar 15 only.'),
  ('SD','bobcat','West River', 'Hunting & Trapping', date '2026-12-26', date '2027-02-15',
   'No season limit.', 'Outside the Black Hills. Nonresidents Jan 9 – Feb 15 only. Pelt tagging required.'),
  ('SD','bobcat','East River & Black Hills', 'Hunting & Trapping', date '2026-12-26', date '2027-02-15',
   '1 per season.', null)
)
insert into public.seasons
  (state_id, species_id, zone_id, season_year, method, label, open_date, close_date,
   bag_limit_summary, notes, source_id, last_verified_at, status)
select st.id, sp.id, z.id, 2026, 'general'::season_method, r.label, r.open_date, r.close_date,
       r.bag, r.notes,
       (select id from public.sources so where so.state_id = st.id
        and so.notes = 'Tier 2-3 coverage fill 2026-08-18.' limit 1),
       now(), 'published'
from rows_to_add r
join public.states st on st.code = r.state_code
join public.species sp on sp.key = r.species_key
join public.zones z on z.state_id = st.id and z.name = r.zone_name
where not exists (
  select 1 from public.seasons s
  where s.state_id = st.id and s.species_id = sp.id and s.zone_id = z.id
    and s.method = 'general'::season_method and s.season_year = 2026
    and coalesce(s.label, '') = coalesce(r.label, '')
);
