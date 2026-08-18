-- Coverage burn-down batch I: WI/MI/IN/OH tier 2-3.
-- Filled 2026-08-18 from official sources (WI DNR dates pages, MI DNR 2026
-- regulation summaries, IN DNR seasons PDF, ODNR 2026-27 season table).
-- Matrix prune #3: WI sharp-tailed grouse (season closed), OH bobcat
-- (protected). NOTPUBLISHED follow-up: OH ruffed grouse (statewide season
-- ELIMINATED for 2026-27 — controlled hunts only, dates via July permit draw).

delete from public.state_species ss
using public.states st, public.species sp
where ss.state_id = st.id and ss.species_id = sp.id
  and ((st.code = 'WI' and sp.key = 'sharptail-grouse')
    or (st.code = 'OH' and sp.key = 'bobcat'));

insert into public.sources (agency_name, url, doc_type, state_id, notes, last_extracted_at)
select v.agency, v.url, (case when v.url like '%.pdf' then 'pdf' else 'webpage' end)::source_doc_type, s.id, 'Burn-down fill 2026-08-18 (batch I).', now()
from (values
  ('Wisconsin Department of Natural Resources', 'https://dnr.wisconsin.gov/topic/hunt/dates', 'WI'),
  ('Michigan Department of Natural Resources', 'https://www.michigan.gov/dnr/managing-resources/laws/regulations/small-game', 'MI'),
  ('Indiana Department of Natural Resources', 'https://www.in.gov/dnr/fish-and-wildlife/files/fw-hunting_trapping_seasons.pdf', 'IN'),
  ('Ohio Department of Natural Resources', 'https://dam.assets.ohio.gov/image/upload/ohiodnr.gov/documents/wildlife/news/2026-27_Hunting_Seasons.pdf', 'OH')
) as v(agency, url, code)
join public.states s on s.code = v.code
where not exists (select 1 from public.sources x where x.url = v.url and x.notes = 'Burn-down fill 2026-08-18 (batch I).');

insert into public.zones (state_id, name)
select s.id, v.zone
from (values
  ('WI','Zone A'),('WI','Zone B'),('WI','Northern Zone'),('WI','Southern Zone'),('WI','Bobcat Zones (Hwy 64)'),
  ('MI','Sharp-tailed Grouse Unit (UP)'),('MI','Fisher/Marten Unit (UP)'),('MI','Bobcat Units'),
  ('IN','Designated Counties'),
  ('OH','Open Counties & Areas')
) as v(code, zone)
join public.states s on s.code = v.code
where not exists (select 1 from public.zones z where z.state_id = s.id and z.name = v.zone);

with rows_to_add (state_code, species_key, zone_name, label, open_date, close_date, bag, notes) as (
  values
  -- WISCONSIN
  ('WI','ruffed-grouse','Zone A',null, date '2026-09-12', date '2027-01-03', null, null),
  ('WI','ruffed-grouse','Zone B',null, date '2026-10-17', date '2026-12-08', null, null),
  ('WI','woodcock','Statewide',null, date '2026-09-19', date '2026-11-02', null, 'HIP required.'),
  ('WI','snowshoe-hare','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Small game license required.'),
  ('WI','fisher','Statewide','Trapping (draw permit only)', date '2026-10-17', date '2027-01-03',
   null, 'Permit by drawing (apply by Aug 1); may close early on zone quota.'),
  ('WI','bobwhite','Statewide','Quail', date '2026-10-17', date '2026-12-09', null, 'Opens 9 a.m.'),
  ('WI','rabbit','Northern Zone','Cottontail', date '2026-09-12', date '2027-02-28', null, null),
  ('WI','rabbit','Southern Zone','Cottontail', date '2026-10-17', date '2027-02-28',
   null, 'Opens 9 a.m.; Milwaukee County open year-round.'),
  ('WI','squirrel','Statewide',null, date '2026-09-12', date '2027-02-28', null, 'Gray and fox squirrel.'),
  ('WI','gray-partridge','Statewide',null, date '2026-10-17', date '2027-01-03',
   null, 'Closed in Clark, Marathon & Taylor counties.'),
  ('WI','snipe','Statewide',null, date '2026-09-01', date '2026-11-09', null, null),
  ('WI','coyote','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Trapping season Oct 17 – Feb 15.'),
  ('WI','crow','Statewide',null, date '2026-11-21', date '2027-03-24', null, null),
  ('WI','fox','Statewide','Hunting & Trapping', date '2026-10-17', date '2027-02-15', null, 'Red and gray fox.'),
  ('WI','raccoon','Statewide','Hunting & Trapping', date '2026-10-17', date '2027-02-15',
   null, 'Nonresident opener Oct 31.'),
  ('WI','bobcat','Bobcat Zones (Hwy 64)','Draw Permit Only (two periods)', date '2026-10-17', date '2027-01-31',
   null, 'Period 1 Oct 17 – Dec 25; Period 2 Dec 26 – Jan 31. Apply by Aug 1; may close early on quota.'),
  -- MICHIGAN
  ('MI','sharptail-grouse','Sharp-tailed Grouse Unit (UP)',null, date '2026-10-10', date '2026-10-31',
   '2 per day; 6 per season.', 'Eastern UP unit only; free stamp required.'),
  ('MI','ruffed-grouse','Statewide','Two Segments', date '2026-09-15', date '2027-01-01',
   '5/day Zones 1-2; 3/day Zone 3.', 'Segments Sep 15 – Nov 14 and Dec 1 – Jan 1.'),
  ('MI','woodcock','Statewide',null, date '2026-09-15', date '2026-10-29',
   '3 per day.', 'Free woodcock stamp + HIP.'),
  ('MI','snowshoe-hare','Statewide',null, date '2026-09-15', date '2027-03-31',
   '5 per day combined with cottontail.', null),
  ('MI','fisher','Fisher/Marten Unit (UP)','Trapping (kill tag)', date '2026-12-04', date '2026-12-13',
   '2 combined fisher + marten.', 'Residents only; free kill tag; mandatory registration.'),
  ('MI','rabbit','Statewide','Cottontail', date '2026-09-15', date '2027-03-31',
   '5 per day.', 'Private-land management season Apr 1 – Aug 31.'),
  ('MI','squirrel','Statewide',null, date '2026-09-15', date '2027-03-31',
   '5 per day.', 'Fox/gray incl. black phase; red squirrel year-round.'),
  ('MI','snipe','Statewide',null, date '2026-09-01', date '2026-11-09', null, 'HIP endorsement.'),
  ('MI','coyote','Statewide','Regular + Management Season', date '2026-10-15', date '2027-03-01',
   'No limit.', 'Regular Oct 15 – Mar 1 (night hunting allowed); management season Mar 2 – Oct 14 makes take effectively year-round with restrictions.'),
  ('MI','crow','Statewide','Segment 1', date '2026-08-01', date '2026-09-30', 'No limit.', null),
  ('MI','crow','Statewide','Segment 2', date '2027-02-01', date '2027-03-31', 'No limit.', null),
  ('MI','fox','Statewide','Hunting & Trapping', date '2026-10-15', date '2027-03-01',
   'No limit.', 'Red and gray; night hunting allowed.'),
  ('MI','raccoon','Statewide','Hunting & Trapping', date '2026-10-01', date '2027-03-31',
   'No limit.', 'Management season Apr 1 – Sep 30.'),
  ('MI','bobcat','Bobcat Units','Hunting (kill tag, residents)', date '2027-01-01', date '2027-03-01',
   '2 per season (2nd tag Unit A only).', 'Unit closes vary: A-C Mar 1; D Feb 1; G Jan 20; H Jan 11. Kill tags available May 1 – Oct 31 only.'),
  ('MI','bobcat','Bobcat Units','Trapping (kill tag, residents)', date '2026-11-01', date '2027-01-18',
   null, 'Units A/B: Nov 1 – 14 + Dec 1 – Jan 18. Units C/D/G: Dec 10 – 29. Unit H: Dec 10 – 20.'),
  -- INDIANA
  ('IN','pheasant','Statewide',null, date '2026-11-01', date '2026-12-15',
   '2 per day, cocks only.', null),
  ('IN','snipe','Statewide',null, date '2026-09-01', date '2026-12-16', '8 per day.', null),
  ('IN','coyote','Statewide','Hunting & Trapping', date '2026-10-15', date '2027-03-15',
   null, 'Landowners/tenants may take coyotes year-round on private land.'),
  ('IN','crow','Statewide','Summer Segment', date '2026-07-01', date '2026-08-15', 'No limit.', null),
  ('IN','crow','Statewide','Winter Segment', date '2026-12-13', date '2027-03-01', 'No limit.', null),
  ('IN','fox','Statewide','Hunting & Trapping', date '2026-10-15', date '2027-02-28',
   null, 'Trapping closes Jan 31.'),
  ('IN','raccoon','Statewide','Hunting & Trapping', date '2026-11-08', date '2027-01-31',
   null, 'Dog running (chase only) Feb 1 – Oct 25.'),
  ('IN','bobcat','Designated Counties','Trapping Only (quota)', date '2026-11-08', date '2027-01-31',
   '1 per season.', 'Statewide quota 250 — may close early. Southern designated counties only; no hunting season.'),
  -- OHIO
  ('OH','woodcock','Statewide',null, date '2026-10-16', date '2026-11-29', '3 per day.', null),
  ('OH','rabbit','Statewide','Cottontail', date '2026-11-06', date '2027-02-28',
   '4 per day.', 'Youth small game weekends Oct 24 – 25 and Oct 31 – Nov 1.'),
  ('OH','squirrel','Statewide',null, date '2026-09-01', date '2027-01-31', '6 per day.', null),
  ('OH','bobwhite','Open Counties & Areas','Quail', date '2026-11-06', date '2026-11-29',
   '2 per day.', 'Open in 16 counties and specific wildlife areas only.'),
  ('OH','snipe','Statewide','Two Segments', date '2026-09-01', date '2027-01-01',
   '8 per day.', 'Segments Sep 1 – Nov 25 and Dec 12 – Jan 1.'),
  ('OH','coyote','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30', 'No limit.', null),
  ('OH','crow','Statewide','Fri/Sat/Sun only', date '2026-08-18', date '2027-03-07',
   'No limit.', 'Season began Jun 5, 2026; Fri – Sun only.'),
  ('OH','fox','Statewide','Hunting & Trapping', date '2026-11-10', date '2027-01-31', 'No limit.', null),
  ('OH','raccoon','Statewide','Hunting & Trapping', date '2026-11-10', date '2027-01-31', 'No limit.', null)
)
insert into public.seasons
  (state_id, species_id, zone_id, season_year, method, label, open_date, close_date,
   bag_limit_summary, notes, source_id, last_verified_at, status)
select st.id, sp.id, z.id, 2026, 'general'::season_method, r.label, r.open_date, r.close_date,
       r.bag, r.notes,
       (select id from public.sources so where so.state_id = st.id
          and so.notes = 'Burn-down fill 2026-08-18 (batch I).' limit 1),
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
