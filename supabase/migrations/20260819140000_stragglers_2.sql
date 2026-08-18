-- Coverage burn-down batch O: direct-research stragglers.
--   MT turkey/bear/moose/pronghorn/dove (FWP fixed season structure)
--   ND pheasant (gf.nd.gov official 2026 dates), squirrel, cottontail
--   UT sharp-tailed grouse (permit draw, DWR announcement)
--   MN woodcock, TX pronghorn (formula-dated, noted)
-- Deliberately deferred (follow-ups): MT goose (2026-27 waterfowl adopted at
-- the Aug 19 commission meeting — confirm after), VT snipe (verify in the VT
-- migratory guide).

insert into public.sources (agency_name, url, doc_type, state_id, notes, last_extracted_at)
select v.agency, v.url, 'webpage'::source_doc_type, s.id, 'Burn-down fill 2026-08-19 (batch O).', now()
from (values
  ('Montana Fish, Wildlife & Parks', 'https://fwp.mt.gov/hunt/seasons', 'MT'),
  ('North Dakota Game and Fish Department', 'https://gf.nd.gov/node/8948', 'ND'),
  ('Utah Division of Wildlife Resources', 'https://wildlife.utah.gov/news/2026/06/26/apply-for-2026-permits-to-hunt-cranes-grouse-or-swans-in-utah', 'UT'),
  ('Minnesota Department of Natural Resources', 'https://www.dnr.state.mn.us/hunting/seasons.html', 'MN'),
  ('Texas Parks & Wildlife Department', 'https://tpwd.texas.gov/regulations/outdoor-annual/hunting/2026-2027-hunting-season-dates#pronghorn', 'TX')
) as v(agency, url, code)
join public.states s on s.code = v.code
where not exists (select 1 from public.sources x where x.url = v.url);

insert into public.zones (state_id, name)
select s.id, v.zone
from (values
  ('MT','Draw Units'),
  ('TX','Trans-Pecos & Panhandle'),
  ('UT','Open Sharp-tailed Units')
) as v(code, zone)
join public.states s on s.code = v.code
where not exists (select 1 from public.zones z where z.state_id = s.id and z.name = v.zone);

with rows_to_add (state_code, species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  ('MT','turkey','Statewide','general','Fall Turkey', date '2026-09-01', date '2027-01-01',
   null, 'License required; region availability varies.'),
  ('MT','turkey','Statewide','general','Spring Turkey 2027', date '2027-04-15', date '2027-05-31', null, null),
  ('MT','bear','Statewide','archery','Fall Archery', date '2026-09-05', date '2026-09-14', '1.', null),
  ('MT','bear','Statewide','firearm','Fall Season', date '2026-09-15', date '2026-11-29',
   '1.', 'Some districts have quotas — check FWP before hunting.'),
  ('MT','moose','Draw Units','archery','Archery (draw)', date '2026-09-05', date '2026-09-14', '1 per license.', null),
  ('MT','moose','Draw Units','firearm','General (draw)', date '2026-09-15', date '2026-11-29',
   '1 per license.', 'Draw only; varies by district.'),
  ('MT','pronghorn','Statewide','archery','Archery', date '2026-09-05', date '2026-10-09',
   '1 per license.', '900-series archery licenses run Aug 15 – Nov 8.'),
  ('MT','pronghorn','Statewide','firearm','General (draw)', date '2026-10-10', date '2026-11-08',
   '1 per license.', 'Draw only; varies by hunting district.'),
  ('MT','dove','Statewide','general',null, date '2026-09-01', date '2026-10-30',
   '15 per day.', 'MT Migratory Bird License required.'),
  ('ND','pheasant','Statewide','general','Regular Season (roosters only)', date '2026-10-10', date '2027-01-03',
   null, 'Youth season opens Oct 3.'),
  ('ND','squirrel','Statewide','general',null, date '2026-09-12', date '2027-02-28',
   null, 'Tree squirrel; confirm close in the small game guide.'),
  ('ND','rabbit','Statewide','general','Cottontail — Year-round', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Cottontail is open year-round in North Dakota.'),
  ('UT','sharptail-grouse','Open Sharp-tailed Units','general','Limited Permit (draw)', date '2026-09-26', date '2026-10-18',
   '2 per season permit.', 'Free permit via draw (applications June 30 – July 14).'),
  ('MN','woodcock','Statewide','general',null, date '2026-09-19', date '2026-11-02',
   '3 per day.', 'HIP required.'),
  ('TX','pronghorn','Trans-Pecos & Panhandle','firearm','Permit Season', date '2026-10-03', date '2026-10-11',
   '1 per permit.', 'Nine-day season by TPWD-issued landowner permit; experimental Panhandle seasons may differ — confirm in the Outdoor Annual.')
)
insert into public.seasons
  (state_id, species_id, zone_id, season_year, method, label, open_date, close_date,
   bag_limit_summary, notes, source_id, last_verified_at, status)
select st.id, sp.id, z.id, 2026, r.method::season_method, r.label, r.open_date, r.close_date,
       r.bag, r.notes,
       (select id from public.sources so where so.state_id = st.id
          and so.notes = 'Burn-down fill 2026-08-19 (batch O).' limit 1),
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
