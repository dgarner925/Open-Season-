-- Coverage burn-down batch E: MN goose/dove/turkey, NE pronghorn, SD
-- goose/dove/fall turkey/pronghorn. Filled 2026-08-18 from official sources
-- (MN DNR season tables, outdoornebraska.gov, SD GFP key dates).

insert into public.sources (agency_name, url, doc_type, state_id, notes, last_extracted_at)
select v.agency, v.url, 'webpage'::source_doc_type, s.id, 'Burn-down fill 2026-08-18 (batch E).', now()
from (values
  ('Minnesota Department of Natural Resources', 'https://www.dnr.state.mn.us/hunting/waterfowl/index.html', 'MN'),
  ('Nebraska Game and Parks Commission', 'https://outdoornebraska.gov/hunt/hunting-seasons/#antelope', 'NE'),
  ('South Dakota Game, Fish and Parks', 'https://gfp.sd.gov/seasons-and-dates/', 'SD')
) as v(agency, url, code)
join public.states s on s.code = v.code
where not exists (select 1 from public.sources x where x.url = v.url);

insert into public.zones (state_id, name)
select s.id, v.zone
from (values
  ('MN','North Zone'),('MN','Central Zone'),('MN','South Zone'),
  ('NE','Draw Units'),('NE','Open Units'),
  ('SD','Goose Unit 1'),('SD','Goose Unit 2')
) as v(code, zone)
join public.states s on s.code = v.code
where not exists (select 1 from public.zones z where z.state_id = s.id and z.name = v.zone);

with rows_to_add (state_code, species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  -- MINNESOTA
  ('MN','goose','Statewide','general','Early September Canada Goose', date '2026-09-05', date '2026-09-20',
   '5 dark geese combined; 20 light.', 'All zones.'),
  ('MN','goose','North Zone','general','Regular Season', date '2026-09-26', date '2026-12-25',
   '5 dark geese combined per day.', 'Continuous.'),
  ('MN','goose','Central Zone','general','Regular Season (split)', date '2026-09-26', date '2026-12-30',
   '5 dark geese combined per day.', 'Split: Sep 26 – Oct 4, then Oct 10 – Dec 30.'),
  ('MN','goose','South Zone','general','Regular Season (split)', date '2026-09-26', date '2027-01-06',
   '5 dark geese combined per day.', 'Split: Sep 26 – Oct 4, then Oct 17 – Jan 6.'),
  ('MN','dove','Statewide','general',null, date '2026-09-01', date '2026-11-29',
   '15 per day.', 'HIP certification required.'),
  ('MN','turkey','Statewide','general','Fall Turkey', date '2026-10-03', date '2026-11-01',
   '1 either-sex.', 'Firearm or archery; over the counter.'),
  ('MN','turkey','Statewide','archery','Spring 2027 — Archery (full season)', date '2027-04-14', date '2027-05-31',
   '1 bearded.', null),
  ('MN','turkey','Statewide','firearm','Spring 2027 — Seasons A-F', date '2027-04-14', date '2027-05-31',
   '1 bearded.', 'Hunt periods A – F roughly weekly; WMA lottery deadline Feb 12.'),
  -- NEBRASKA pronghorn
  ('NE','pronghorn','Statewide','archery','Archery Antelope', date '2026-08-20', date '2026-12-31',
   '1 per permit.', 'OTC archery permits; closed during firearm season in open units.'),
  ('NE','pronghorn','Draw Units','muzzleloader','Muzzleloader Antelope', date '2026-09-19', date '2026-10-04',
   '1 per permit.', 'Draw permit; varies by unit.'),
  ('NE','pronghorn','Draw Units','firearm','Firearm Antelope', date '2026-10-10', date '2026-10-25',
   '1 per permit.', 'Draw permit; quota adjustments for 2026.'),
  ('NE','pronghorn','Open Units','firearm','Late Doe/Fawn', date '2026-11-01', date '2027-01-31',
   '1 doe/fawn per permit.', 'Antlerless only.'),
  -- SOUTH DAKOTA headline gaps
  ('SD','goose','Statewide','general','Early Canada Goose', date '2026-09-01', date '2026-09-30',
   null, 'August Management Take runs Aug 15 – 31 in designated areas.'),
  ('SD','goose','Goose Unit 1','general','Canada Goose Regular', date '2026-10-01', date '2026-12-16', null, null),
  ('SD','goose','Goose Unit 2','general','Canada Goose Regular', date '2026-11-02', date '2027-02-14', null, null),
  ('SD','goose','Statewide','general','White-fronted & Light Geese', date '2026-09-26', date '2027-01-08',
   null, 'White-fronted closes Dec 8; light goose runs to Jan 8.'),
  ('SD','dove','Statewide','general',null, date '2026-09-01', date '2026-11-09', null, null),
  ('SD','turkey','Statewide','general','Fall Turkey', date '2026-11-01', date '2027-01-31', null, null),
  ('SD','pronghorn','Statewide','archery','Archery Antelope', date '2026-08-15', date '2026-10-31',
   '1 per license.', null),
  ('SD','pronghorn','Statewide','firearm','Firearms Antelope (draw)', date '2026-10-03', date '2026-10-18',
   '1 per license.', 'Limited draw.')
)
insert into public.seasons
  (state_id, species_id, zone_id, season_year, method, label, open_date, close_date,
   bag_limit_summary, notes, source_id, last_verified_at, status)
select st.id, sp.id, z.id, 2026, r.method::season_method, r.label, r.open_date, r.close_date,
       r.bag, r.notes,
       (select id from public.sources so where so.state_id = st.id
          and so.notes = 'Burn-down fill 2026-08-18 (batch E).' limit 1),
       now(), 'published'
from rows_to_add r
join public.states st on st.code = r.state_code
join public.species sp on sp.key = r.species_key
join public.zones z on z.state_id = st.id and z.name = r.zone_name
where not exists (
  select 1 from public.seasons s
  where s.state_id = st.id and s.species_id = sp.id and s.zone_id = z.id
    and s.method = r.method::season_method and s.season_year = 2026
    and coalesce(s.label, '') = coalesce(r.label, '')
);
