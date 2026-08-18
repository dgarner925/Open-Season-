-- Coverage burn-down batch B: COLORADO full 2026-27 refresh (original launch
-- state whose 2025-26 rows had expired). Filled 2026-08-18 from the adopted
-- CPW 2025-2029 Big Game Season Structure, the official 2026 Small Game &
-- Waterfowl brochure, and the 2026 Turkey brochure.
-- Spring turkey 2027: NOTPUBLISHED (brochure ~Jan 2027) — follow-up item.

insert into public.sources (agency_name, url, doc_type, state_id, notes, last_extracted_at)
select 'Colorado Parks & Wildlife', v.url, (case when v.url like '%.pdf' then 'pdf' else 'webpage' end)::source_doc_type, s.id, v.note, now()
from (values
  ('https://cpw.state.co.us/sites/default/files/dam/ifgylu070o/final_bgss2025-2029.pdf',
   'Adopted 2025-2029 big game season structure; 2026 dates. Filled 2026-08-18.'),
  ('https://cpw.widen.net/s/xlwj8zqr5l/colorado-small-game--waterfowl-brochure',
   '2026 Small Game & Waterfowl brochure. Filled 2026-08-18.')
) as v(url, note)
join public.states s on s.code = 'CO'
where not exists (select 1 from public.sources x where x.url = v.url);

insert into public.zones (state_id, name)
select s.id, v.zone
from (values
  ('West of I-25 & GMU 140'),('East of I-25'),('Northeast Zone'),('Southeast Zone'),
  ('Mountain/Foothills Zone'),('Western Zone'),('East (Central Flyway)'),('West (Pacific Flyway)'),
  ('Northwest GMUs'),('West of I-25'),('East of Continental Divide')
) as v(zone)
join public.states s on s.code = 'CO'
where not exists (select 1 from public.zones z where z.state_id = s.id and z.name = v.zone);

with src as (
  select big.id as big_id, small.id as small_id, st.id as state_id
  from public.states st
  join public.sources big on big.url = 'https://cpw.state.co.us/sites/default/files/dam/ifgylu070o/final_bgss2025-2029.pdf'
  join public.sources small on small.url = 'https://cpw.widen.net/s/xlwj8zqr5l/colorado-small-game--waterfowl-brochure'
  where st.code = 'CO'
),
rows_to_add (species_key, zone_name, method, label, open_date, close_date, bag, notes, use_big) as (
  values
  -- Big game (BGSS source)
  ('deer','West of I-25 & GMU 140','archery','Archery', date '2026-09-02', date '2026-09-30',
   '1 deer.', 'Limited licenses by GMU. Plains archery (east of I-25) Oct 1 – Dec 31 with closures during plains rifle seasons.', true),
  ('deer','Statewide','muzzleloader','Muzzleloader', date '2026-09-12', date '2026-09-20',
   '1 deer.', 'West of I-25; limited licenses. Plains muzzleloader Oct 10 – 18.', true),
  ('deer','West of I-25 & GMU 140','firearm','2nd Rifle (Deer/Elk Combined)', date '2026-10-24', date '2026-11-01',
   '1 deer.', 'Limited by GMU. Plains rifle deer Oct 24 – Nov 3.', true),
  ('deer','West of I-25 & GMU 140','firearm','3rd Rifle (Deer/Elk Combined)', date '2026-11-07', date '2026-11-15',
   '1 deer.', 'Limited by GMU.', true),
  ('deer','West of I-25 & GMU 140','firearm','4th Rifle (Deer/Elk Combined)', date '2026-11-18', date '2026-11-22',
   '1 deer.', 'Deer optional in 1st (Oct 14 – 18) and 4th seasons. Late plains rifle Dec 1 – 14.', true),
  ('elk','West of I-25 & GMU 140','archery','Archery', date '2026-09-02', date '2026-09-30',
   '1 elk.', 'Resident OTC archery elk in certain units; nonresident limited.', true),
  ('elk','Statewide','muzzleloader','Muzzleloader', date '2026-09-12', date '2026-09-20',
   '1 elk.', 'All limited by GMU.', true),
  ('elk','West of I-25 & GMU 140','firearm','1st Rifle (Elk)', date '2026-10-14', date '2026-10-18',
   '1 elk.', 'All elk rifle licenses limited.', true),
  ('elk','West of I-25 & GMU 140','firearm','2nd Rifle (Deer/Elk Combined)', date '2026-10-24', date '2026-11-01',
   '1 elk.', 'OTC antlered elk in certain units. Plains elk (east of I-25) Sep 1 – Jan 31 either-sex.', true),
  ('elk','West of I-25 & GMU 140','firearm','3rd Rifle (Deer/Elk Combined)', date '2026-11-07', date '2026-11-15',
   '1 elk.', 'OTC antlered elk in certain units.', true),
  ('elk','West of I-25 & GMU 140','firearm','4th Rifle (Deer/Elk Combined)', date '2026-11-18', date '2026-11-22',
   '1 elk.', 'All limited. Late antlerless seasons possible Nov 23 – Jan 31 by GMU.', true),
  ('pronghorn','Statewide','archery','Archery', date '2026-08-15', date '2026-09-20',
   '1 pronghorn.', 'Aug 15 – 31 bucks only; Sep 1 – 20 either-sex.', true),
  ('pronghorn','Statewide','muzzleloader','Muzzleloader', date '2026-09-21', date '2026-09-29',
   '1 pronghorn.', 'Limited statewide licenses; some units closed.', true),
  ('pronghorn','Statewide','firearm','1st Rifle', date '2026-10-03', date '2026-10-11',
   '1 pronghorn.', 'Limited by GMU. Optional 2nd rifle Oct 17 – 25 in select units; late doe seasons Nov 1 – Jan 31.', true),
  ('moose','Statewide','firearm','Rifle Moose (draw)', date '2026-10-01', date '2026-10-14',
   '1 moose.', 'Draw only; antlered is once-in-a-lifetime. Season-choice licenses also valid archery Sep 12 – 30 and muzzleloader Sep 12 – 20.', true),
  ('bear','Statewide','archery','Archery Bear', date '2026-09-02', date '2026-09-30',
   '1 bear.', 'Add-on with deer/elk license in reduce/suppress DAUs; limited bear-only also. Muzzleloader bear Sep 12 – 20.', true),
  ('bear','Statewide','firearm','September + Concurrent Rifle', date '2026-09-02', date '2026-11-22',
   '1 bear.', 'Sep rifle Sep 2 – 30 (limited). Concurrent rifle bear valid ONLY during open rifle deer/elk seasons (breaks closed). Plains rifle bear continuous Sep 2 – Nov 22.', true),
  ('turkey','Statewide','general','Fall Turkey (OTC + limited)', date '2026-09-01', date '2026-10-23',
   '1 either-sex.', 'OTC Sep 1 – Oct 4 west of I-25; Sep 1 – Oct 23 east of I-25. Late beardless season Dec 15 – Jan 15 (units 112/113). Spring 2027 dates publish ~January.', true),
  -- Small game & migratory (brochure source)
  ('dove','Statewide','general',null, date '2026-09-01', date '2026-11-29',
   '15 per day.', 'Eurasian collared-dove year-round, unlimited.', false),
  ('duck','East of I-25','general','September Teal', date '2026-09-12', date '2026-09-20',
   '6 teal per day.', 'East of I-25 plus Lake & Chaffee counties.', false),
  ('duck','Northeast Zone','general','Duck', date '2026-10-17', date '2027-01-31',
   '6 per day.', 'Split Oct 17 – Nov 29 and Dec 11 – Jan 31. East of I-25, north of I-70.', false),
  ('duck','Southeast Zone','general','Duck', date '2026-10-28', date '2027-01-31',
   '6 per day.', 'Continuous. East of I-25, south of I-70 plus listed counties.', false),
  ('duck','Mountain/Foothills Zone','general','Duck', date '2026-10-03', date '2027-01-31',
   '6 per day.', 'Split Oct 3 – Nov 29 and Dec 25 – Jan 31. West of I-25, east of the Divide.', false),
  ('duck','West (Pacific Flyway)','general','Duck', date '2026-10-03', date '2027-01-31',
   '7 per day.', 'Western Zone split Oct 3 – 20 and Nov 6 – Jan 31. Pacific Eastern Zone continuous Oct 3 – Jan 15.', false),
  ('goose','East (Central Flyway)','general','Dark Goose — Regular', date '2026-11-02', date '2027-02-14',
   '5 per day.', 'Light goose Oct 31 – Feb 14 (50/day) + conservation order Feb 15 – Apr 30 east of I-25. North Park/South Park/San Luis Valley special zones open Oct 3.', false),
  ('goose','West (Pacific Flyway)','general','Goose', date '2026-10-03', date '2027-01-31',
   '5 dark, 10 light per day.', 'Split Oct 3 – 11 and Nov 6 – Jan 31. Early Canada goose west of the Divide Sep 1 – 9.', false),
  ('pheasant','East of I-25','general',null, date '2026-11-14', date '2027-01-31',
   '3 cocks per day.', 'West of I-25: Nov 14 – Jan 3.', false),
  ('western-quail','Statewide','general','Scaled & Gambel''s Quail', date '2026-11-14', date '2027-01-31',
   '8 each per day.', 'Jan 31 close in the SE zone; other zones close Jan 3.', false),
  ('bobwhite','East of I-25','general',null, date '2026-11-14', date '2027-01-31',
   '8 per day.', 'South of I-70 closes Jan 31; north of I-70 closes Jan 3.', false),
  ('squirrel','Statewide','general','Fox & Pine Squirrel', date '2026-10-01', date '2027-02-28',
   '5 each per day.', 'Abert''s squirrel separate: Nov 15 – Jan 15 (2/day).', false),
  ('rabbit','Statewide','general','Cottontail', date '2026-10-01', date '2027-02-28',
   '10 per day.', 'Snowshoe hare and jackrabbit same dates, 10/day each.', false),
  ('sage-grouse','Northwest GMUs','general','Greater Sage-Grouse', date '2026-09-12', date '2026-09-18',
   '2 per day.', 'Listed NW GMUs; North Park units Sep 12 – 13 only. $5 permit required. Mountain sharp-tailed grouse Sep 1 – 20 in select GMUs.', false),
  ('ruffed-grouse','West of I-25','general','Dusky (Blue) Grouse', date '2026-09-01', date '2026-11-22',
   '3 per day.', 'Colorado''s forest grouse is dusky grouse. Chukar Sep 1 – Nov 30 statewide (4/day).', false),
  ('sandhill-crane','East of Continental Divide','general',null, date '2026-10-03', date '2026-11-29',
   '3 per day.', 'Excludes North Park and the San Luis Valley. Free crane permit via HIP.', false)
)
insert into public.seasons
  (state_id, species_id, zone_id, season_year, method, label, open_date, close_date,
   bag_limit_summary, notes, source_id, last_verified_at, status)
select src.state_id, sp.id, z.id, 2026, r.method::season_method, r.label, r.open_date, r.close_date,
       r.bag, r.notes, (case when r.use_big then src.big_id else src.small_id end), now(), 'published'
from rows_to_add r
cross join src
join public.species sp on sp.key = r.species_key
join public.zones z on z.state_id = src.state_id and z.name = r.zone_name
where not exists (
  select 1 from public.seasons s
  where s.state_id = src.state_id and s.species_id = sp.id and s.zone_id = z.id
    and s.method = r.method::season_method and s.season_year = 2026
    and coalesce(s.label, '') = coalesce(r.label, '')
);
