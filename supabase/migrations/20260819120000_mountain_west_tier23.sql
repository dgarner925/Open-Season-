-- Coverage burn-down batch M: CO/WY/UT/NV tier 2-3 remainder.
-- Filled 2026-08-19 from official sources (CPW 2026 brochures, WGFD Ch. 11 +
-- pages, Utah DWR 2026-27 guidebook + furbearer book, NDOW CR 26-13/26-10/
-- 25-07, NAC 503). CO rows already added by the earlier CO refresh are
-- deliberately omitted here.
-- Matrix prune #6: WY spruce-grouse (not a WY species), UT + NV tree squirrel
-- (no seasons), NV marten (no season).
-- NOTPUBLISHED follow-up: WY sandhill crane (Ch. 14 PDF not yet retrievable).

delete from public.state_species ss
using public.states st, public.species sp
where ss.state_id = st.id and ss.species_id = sp.id
  and ((st.code = 'WY' and sp.key = 'spruce-grouse')
    or (st.code in ('UT','NV') and sp.key = 'squirrel')
    or (st.code = 'NV' and sp.key = 'marten'));

insert into public.sources (agency_name, url, doc_type, state_id, notes, last_extracted_at)
select v.agency, v.url, (case when v.url like '%.pdf' then 'pdf' else 'webpage' end)::source_doc_type, s.id, 'Burn-down fill 2026-08-19 (batch M).', now()
from (values
  ('Colorado Parks & Wildlife', 'https://cpw.widen.net/s/m27g5rnwwq/colorado-sheep-and-goat-brochure', 'CO'),
  ('Wyoming Game & Fish Department', 'https://wgfd.wyo.gov/media/32326/download?inline=', 'WY'),
  ('Utah Division of Wildlife Resources', 'https://wildlife.utah.gov/guidebooks/2025-26_furbearer.pdf', 'UT'),
  ('Nevada Department of Wildlife', 'https://www.ndow.org/wp-content/uploads/2026/07/CR26-13-Upland-Furbearer-Seasons.pdf', 'NV')
) as v(agency, url, code)
join public.states s on s.code = v.code
where not exists (select 1 from public.sources x where x.url = v.url and x.notes = 'Burn-down fill 2026-08-19 (batch M).');

insert into public.zones (state_id, name)
select s.id, v.zone
from (values
  ('CO','Southern GMUs'),('CO','Northeast Colorado'),
  ('WY','East of Continental Divide'),('WY','Trophy Game Area (NW)'),('WY','Predator Zone'),('WY','Area 2 (Jackson)'),('WY','Marten Areas'),
  ('UT','Cache & Rich Counties'),('UT','East Box Elder County'),('UT','Uintah Basin'),('UT','Open Sage-Grouse Units'),('UT','Southern Zone'),
  ('NV','Units 101-103'),('NV','Open Sage-Grouse Units')
) as v(code, zone)
join public.states s on s.code = v.code
where not exists (select 1 from public.zones z where z.state_id = s.id and z.name = v.zone);

with rows_to_add (state_code, species_key, zone_name, label, open_date, close_date, bag, notes) as (
  values
  -- COLORADO remainder
  ('CO','bighorn-sheep','Statewide','Draw Only (envelope)', date '2026-08-01', date '2026-12-31',
   '1 per license.', 'Most rifle hunts Sep 1 – Oct 8; desert bighorn Nov 1 – 30; archery from Aug 1 in select units. Varies by unit.'),
  ('CO','mountain-goat','Statewide','Draw Only', date '2026-09-01', date '2026-11-01',
   '1.', 'Most hunts in Sep 8 – Oct 8 windows. Varies by unit.'),
  ('CO','mountain-lion','Statewide',null, date '2026-11-23', date '2027-03-31',
   '1 per license year.', 'Harvest-limit quotas by unit; April extension possible where quotas unfilled.'),
  ('CO','snowshoe-hare','Statewide',null, date '2026-10-01', date '2027-02-28', '10 per day.', null),
  ('CO','ptarmigan','Statewide','Season 1', date '2026-09-12', date '2026-10-04',
   '3 per day.', '$5 permit required; excludes Season-2 GMUs.'),
  ('CO','ptarmigan','Southern GMUs','Season 2', date '2026-09-12', date '2026-11-22',
   '3 per day.', '$5 permit required.'),
  ('CO','band-tailed-pigeon','Statewide',null, date '2026-09-01', date '2026-09-14',
   '2 per day.', '$5 permit + HIP required.'),
  ('CO','prairie-chicken','Northeast Colorado','Greater Prairie-Chicken', date '2026-10-01', date '2027-01-31',
   '2 per day; 6 per season.', 'Area-restricted (NE GMUs + Morgan County). Lesser prairie-chicken remains closed.'),
  ('CO','snipe','Statewide',null, date '2026-09-01', date '2026-12-16', '8 per day.', null),
  ('CO','coyote','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   '2 per day (new for 2026).', 'Small-game or furbearer license + HIP; night hunting allowed with conditions.'),
  ('CO','crow','Statewide',null, date '2026-11-01', date '2027-02-28', 'No limit.', 'Electronic calls legal.'),
  ('CO','fox','Statewide','Furbearer Season', date '2026-11-01', date '2027-02-28',
   '2 per day (new for 2026).', 'Red/gray/swift fox; furbearer license or small-game + harvest permit.'),
  ('CO','raccoon','Statewide','Furbearer Season', date '2026-11-01', date '2027-02-28',
   '2 per day (new for 2026).', 'Night hunting allowed with conditions.'),
  ('CO','bobcat','Statewide','Furbearer Season', date '2026-12-01', date '2027-02-28',
   '2 per day (new for 2026).', 'Mandatory CPW pelt sealing within 30 days.'),
  -- WYOMING
  ('WY','bighorn-sheep','Statewide','Limited Quota (draw)', date '2026-09-01', date '2026-10-31',
   '1 per license.', 'Some areas open Aug 15 or run into Nov – Dec. Varies by hunt area.'),
  ('WY','mountain-goat','Statewide','Limited Quota (draw)', date '2026-09-01', date '2026-10-31',
   '1 per license.', null),
  ('WY','mountain-lion','Statewide',null, date '2026-09-01', date '2027-03-31',
   '1 per license.', 'Per-area mortality limits close areas early.'),
  ('WY','sharptail-grouse','East of Continental Divide',null, date '2026-09-01', date '2026-12-31',
   '3 per day.', null),
  ('WY','snowshoe-hare','Statewide',null, date '2026-09-01', date '2027-03-31', '4 per day.', null),
  ('WY','gray-partridge','Statewide',null, date '2026-09-15', date '2027-01-31',
   '5 per day.', 'Chukar identical dates.'),
  ('WY','marten','Marten Areas','Trapping', date '2026-10-01', date '2027-03-01',
   null, 'Furbearer license. Area 1 opens Oct 1; Area 2 opens Dec 1.'),
  ('WY','wolf','Trophy Game Area (NW)','Trophy Game Season', date '2026-09-15', date '2026-12-31',
   '1 per license.', 'Per-area mortality quotas; Area 12 opens Oct 15; one area runs to Mar 31.'),
  ('WY','wolf','Predator Zone','Year-round (predatory animal)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'No license required outside the Trophy Game Area.'),
  ('WY','bison','Area 2 (Jackson)','Wild Bison (draw only)', date '2026-08-15', date '2027-01-31',
   '1 per license.', '2026: 30 any-bison + 70 cow/calf licenses. Area 3 closed for 2026.'),
  ('WY','snipe','Statewide',null, date '2026-09-01', date '2026-12-16',
   '8 per day.', 'Confirm in the 2026 migratory brochure.'),
  ('WY','coyote','Statewide','Year-round (predatory animal)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'No license required.'),
  ('WY','crow','Statewide','Fall + Winter Segments', date '2026-11-01', date '2027-02-28',
   'No limit.', 'Segments Nov 1 – Dec 31 and Jan 1 – Feb 28. No license required; ravens protected.'),
  ('WY','fox','Statewide','Year-round (predatory animal)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Red fox is a predatory animal in Wyoming.'),
  ('WY','raccoon','Statewide','Year-round (predatory animal)', date '2026-07-01', date '2027-06-30', 'No limit.', null),
  ('WY','bobcat','Statewide','Furbearer Season (hunt/trap)', date '2026-11-15', date '2027-03-01',
   null, 'Furbearer license; pelt registration by Mar 11.'),
  -- UTAH
  ('UT','bighorn-sheep','Once-in-a-Lifetime Units','Draw Only (envelope)', date '2026-09-01', date '2026-12-31',
   '1 per lifetime.', 'Desert bighorn units run into December. Varies by unit.'),
  ('UT','mountain-lion','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   '1 per season.', 'Hunting/combo license only — no permit. Harvest reporting required.'),
  ('UT','sandhill-crane','Cache & Rich Counties','Draw Hunt', date '2026-09-05', date '2026-09-13',
   '1 per permit.', '$40 permit via draw.'),
  ('UT','sandhill-crane','East Box Elder County','Draw Hunt', date '2026-09-05', date '2026-11-03',
   '1 per permit.', null),
  ('UT','sandhill-crane','Uintah Basin','Draw Hunts (three windows)', date '2026-09-26', date '2026-11-24',
   '1 per permit.', 'Windows: Sep 26 – Oct 15, Oct 16 – Nov 4, Nov 5 – 24.'),
  ('UT','gray-partridge','Statewide',null, date '2026-09-26', date '2027-02-15',
   '5 per day.', 'Youth hunt Sep 19 – 21.'),
  ('UT','marten','Statewide','Trapping (permit)', date '2026-09-15', date '2027-03-01',
   'No limit.', 'Free marten permit. Dates per 2025-26 pattern — confirm in the 2026-27 furbearer guidebook (~Sep).'),
  ('UT','bison','Once-in-a-Lifetime Units','Draw Only (envelope)', date '2026-08-01', date '2027-01-31',
   '1 per lifetime.', 'Henry Mountains / Book Cliffs; dates vary by unit.'),
  ('UT','sage-grouse','Open Sage-Grouse Units','Limited Permit', date '2026-09-26', date '2026-10-18',
   '2 per season permit.', 'Free permit via draw.'),
  ('UT','ptarmigan','Statewide','White-tailed Ptarmigan', date '2026-09-01', date '2026-10-31',
   '4 per day.', 'Free permit required.'),
  ('UT','band-tailed-pigeon','Statewide',null, date '2026-09-01', date '2026-09-14',
   '2 per day.', 'Free permit + HIP required.'),
  ('UT','snipe','Northern Zone',null, date '2026-10-03', date '2027-01-16',
   '8 per day.', 'Runs with the duck season. HIP required.'),
  ('UT','snipe','Southern Zone',null, date '2026-10-10', date '2027-01-23', '8 per day.', null),
  ('UT','coyote','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'No license to hunt; state bounty program exists.'),
  ('UT','crow','Statewide','Fall + Winter Segments', date '2026-09-01', date '2027-02-28',
   '10 per day.', 'Segments Sep 1 – 30 and Dec 1 – Feb 28. HIP required.'),
  ('UT','fox','Statewide','Red Fox — Year-round', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Gray/kit fox are furbearers with a Sep 15 – Mar 1 season.'),
  ('UT','raccoon','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', null),
  ('UT','bobcat','Statewide','Furbearer Season (permits)', date '2026-11-15', date '2027-03-01',
   'Up to 6 permits per season.', 'Dates per 2025-26 pattern — confirm in the 2026-27 furbearer guidebook.'),
  -- NEVADA
  ('NV','bighorn-sheep','Statewide','Draw Only (envelope)', date '2026-09-01', date '2027-01-01',
   '1 per tag.', 'California/Rocky Mountain bighorn mostly Sep – Oct; desert bighorn into January. Varies by unit.'),
  ('NV','mountain-goat','Units 101-103','Draw Only', date '2026-09-01', date '2026-10-31',
   '1 per tag.', 'Ruby Mountains / East Humboldts; very limited tags.'),
  ('NV','mountain-lion','Statewide','Continuous Season', date '2026-07-01', date '2027-06-30',
   '2 tags per person per year.', 'OTC tags; unit-group harvest limits — call the hotline before hunting.'),
  ('NV','gray-partridge','Statewide','Chukar & Hungarian Partridge', date '2026-10-17', date '2027-02-07',
   '6 per day aggregate.', 'Youth season Sep 26 – Oct 4.'),
  ('NV','sage-grouse','Open Sage-Grouse Units','Main Season', date '2026-09-19', date '2026-09-27',
   '2 per day.', 'Closed to nonresidents; some units 2-day season; Sheldon NWR special draw hunt.'),
  ('NV','pheasant','Statewide',null, date '2026-11-01', date '2026-11-30',
   '2 per day, cocks only.', null),
  ('NV','ringtail','Statewide','Year-round (unprotected)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Huntable without a hunting license; trapping license to trap.'),
  ('NV','snipe','Statewide','Zoned Seasons', date '2026-09-26', date '2027-01-31',
   '8 per day.', 'NE Zone Sep 26 – Dec 1 + Dec 12 – Jan 18; NW Zone Oct 17 – Jan 3 + Jan 6 – 31; South Zone Oct 17 – 25 + Oct 28 – Jan 31.'),
  ('NV','coyote','Statewide','Year-round (unprotected)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'No hunting license required.'),
  ('NV','crow','Statewide','Fall Segment', date '2026-09-01', date '2026-11-17',
   '10 per day.', 'Archery/shotgun/falconry only; ravens closed.'),
  ('NV','crow','Statewide','Spring Segment', date '2027-03-01', date '2027-04-15', '10 per day.', null),
  ('NV','fox','Statewide','Kit & Red Fox Furbearer Season', date '2026-10-01', date '2027-02-28',
   null, 'Gray fox separate: Nov 14 – Feb 21, closed to nonresidents. Trapping license required.'),
  ('NV','raccoon','Statewide','Year-round (unprotected)', date '2026-07-01', date '2027-06-30',
   'No limit.', null),
  ('NV','bobcat','Statewide','Hunt/Trap Season', date '2026-11-14', date '2027-02-21',
   null, 'Closed to nonresidents; mandatory pelt sealing.')
)
insert into public.seasons
  (state_id, species_id, zone_id, season_year, method, label, open_date, close_date,
   bag_limit_summary, notes, source_id, last_verified_at, status)
select st.id, sp.id, z.id, 2026, 'general'::season_method, r.label, r.open_date, r.close_date,
       r.bag, r.notes,
       (select id from public.sources so where so.state_id = st.id
          and so.notes = 'Burn-down fill 2026-08-19 (batch M).' limit 1),
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
