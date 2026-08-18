-- Coverage burn-down batch F: ND goose/dove/turkey/pronghorn/moose.
-- Filled 2026-08-18 from gf.nd.gov (season-dates, canada-geese, fall-turkey).
-- ND spring turkey 2027: NOTPUBLISHED (proclamation pending) — follow-up.
-- Goose bag limits intentionally blank (guide PDF carries them; not verified).

insert into public.sources (agency_name, url, doc_type, state_id, notes, last_extracted_at)
select 'North Dakota Game and Fish Department', 'https://gf.nd.gov/hunting/season-dates',
       'webpage'::source_doc_type, s.id, 'Burn-down fill 2026-08-18 (batch F).', now()
from public.states s
where s.code = 'ND'
  and not exists (select 1 from public.sources x where x.url = 'https://gf.nd.gov/hunting/season-dates');

insert into public.zones (state_id, name)
select s.id, v.zone
from (values ('Missouri River Zone'),('Western Zone'),('Eastern Zone'),('Draw Units'),('21 Units (draw)')) as v(zone)
join public.states s on s.code = 'ND'
where not exists (select 1 from public.zones z where z.state_id = s.id and z.name = v.zone);

with rows_to_add (species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  ('goose','Statewide','general','Early Canada Goose', date '2026-08-15', date '2026-09-22',
   null, 'Closes vary by zone: Missouri River Sep 7, Western Sep 15, Eastern Sep 22.'),
  ('goose','Missouri River Zone','general','Regular Canada Goose', date '2026-09-26', date '2027-01-01',
   null, 'Resident opener Sep 26; nonresidents begin Oct 5.'),
  ('goose','Western Zone','general','Regular Canada Goose', date '2026-09-26', date '2026-12-24',
   null, 'Nonresidents begin Oct 5.'),
  ('goose','Eastern Zone','general','Regular Canada Goose', date '2026-09-26', date '2026-12-19',
   null, 'Nonresidents begin Oct 5.'),
  ('goose','Statewide','general','White-fronted Goose', date '2026-09-26', date '2026-12-06',
   null, 'Nonresidents begin Oct 5.'),
  ('goose','Statewide','general','Light Goose — Fall', date '2026-09-26', date '2027-01-03',
   null, 'Goose shooting hours extend to sunset from Nov 29. Spring conservation order publishes separately.'),
  ('dove','Statewide','general',null, date '2026-09-01', date '2026-11-29',
   '15 per day.', 'HIP registration required.'),
  ('turkey','21 Units (draw)','general','Fall Turkey (resident draw)', date '2026-10-10', date '2027-01-03',
   '1 per license.', '3,700 licenses; application deadline Sep 2. Spring 2027 proclamation not yet published.'),
  ('pronghorn','Draw Units','archery','Pronghorn Bow (draw)', date '2026-09-04', date '2026-09-27',
   '1 per license.', 'Draw only; varies by unit.'),
  ('pronghorn','Draw Units','firearm','Pronghorn Gun (draw)', date '2026-10-02', date '2026-10-18',
   '1 per license.', 'Gun or bow during this period; draw only.'),
  ('moose','Draw Units','archery','Moose Bow (once-in-a-lifetime draw)', date '2026-09-04', date '2026-09-27',
   '1 per license.', null),
  ('moose','Draw Units','firearm','Moose Regular (once-in-a-lifetime draw)', date '2026-10-09', date '2026-11-01',
   '1 per license.', null)
)
insert into public.seasons
  (state_id, species_id, zone_id, season_year, method, label, open_date, close_date,
   bag_limit_summary, notes, source_id, last_verified_at, status)
select st.id, sp.id, z.id, 2026, r.method::season_method, r.label, r.open_date, r.close_date,
       r.bag, r.notes,
       (select id from public.sources so where so.url = 'https://gf.nd.gov/hunting/season-dates' limit 1),
       now(), 'published'
from rows_to_add r
cross join (select id from public.states where code = 'ND') st
join public.species sp on sp.key = r.species_key
join public.zones z on z.state_id = st.id and z.name = r.zone_name
where not exists (
  select 1 from public.seasons s
  where s.state_id = st.id and s.species_id = sp.id and s.zone_id = z.id
    and s.method = r.method::season_method and s.season_year = 2026
    and coalesce(s.label, '') = coalesce(r.label, '')
);
