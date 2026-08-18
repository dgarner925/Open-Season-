-- Coverage burn-down batch D: AR full refresh (deer/duck/goose/dove/turkey) +
-- MO/IA/IL goose-dove-turkey + MS/SC/LA spring 2027 turkey.
-- Filled 2026-08-18 from official sources (AGFC, MDC releases, Iowa DNR,
-- IDNR 2026-2030 waterfowl PDF, MDWFP 2026-27 PDF, eRegulations SC, LDWF).
-- NOTPUBLISHED (follow-ups): MO spring turkey 2027 (~late 2026),
-- IL spring turkey 2027, AR alt-firearms closed in Zones 4/5 (by rule).

insert into public.sources (agency_name, url, doc_type, state_id, notes, last_extracted_at)
select v.agency, v.url, (case when v.url like '%.pdf' then 'pdf' else 'webpage' end)::source_doc_type, s.id, 'Burn-down fill 2026-08-18.', now()
from (values
  ('Arkansas Game & Fish Commission', 'https://www.agfc.com/hunting/deer/deer-seasons-and-limits-by-zone/', 'AR'),
  ('Missouri Department of Conservation', 'https://mdc.mo.gov/newsroom/mdc-sets-upcoming-migratory-game-bird-waterfowl-seasons-4', 'MO'),
  ('Iowa Department of Natural Resources', 'https://www.iowadnr.gov/things-do/hunting-trapping/iowa-hunting-seasons', 'IA'),
  ('Illinois Department of Natural Resources', 'https://dnr.illinois.gov/hunting/waterfowlhunting.html', 'IL'),
  ('Mississippi Department of Wildlife, Fisheries, and Parks', 'https://www.mdwfp.com/sites/default/files/2026-06/2026-2027%20hunting%20seasons.pdf', 'MS'),
  ('South Carolina Department of Natural Resources', 'https://www.eregulations.com/southcarolina/hunting/turkey-regulations', 'SC'),
  ('Louisiana Department of Wildlife and Fisheries', 'https://support.louisianaoutdoors.com/hc/en-us/articles/40887814037524-Turkey-Hunting-Schedule-Areas', 'LA')
) as v(agency, url, code)
join public.states s on s.code = v.code
where not exists (select 1 from public.sources x where x.url = v.url);

insert into public.zones (state_id, name)
select s.id, v.zone
from (values
  ('AR','Zones 1-3, 6-8, 10-11'),('AR','Zones 4A, 5A, 14-15'),('AR','Zones 9, 12-13'),('AR','Zones 16, 16A, 17'),('AR','Zones 4 & 5'),
  ('AR','Turkey Zone 1'),('AR','Turkey Zone 1A'),('AR','Turkey Zone 2'),('AR','Turkey Zone 2A'),('AR','Turkey Zone 3'),
  ('IA','North Zone'),('IA','Central Zone'),('IA','South Zone'),('IA','Metro Zones'),
  ('IL','North Zone'),('IL','Central Zone'),('IL','South Zone'),('IL','Open Counties'),
  ('MO','Open Counties'),
  ('LA','Area A'),('LA','Area B'),('LA','Area C')
) as v(code, zone)
join public.states s on s.code = v.code
where not exists (select 1 from public.zones z where z.state_id = s.id and z.name = v.zone);

with rows_to_add (state_code, species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  -- ARKANSAS deer
  ('AR','deer','Statewide','archery','Early Buck-only Archery', date '2026-08-29', date '2026-08-31', '1 buck.', null),
  ('AR','deer','Statewide','archery','Archery', date '2026-09-26', date '2027-02-28',
   '4 deer, max 2 bucks (most zones).', null),
  ('AR','deer','Zones 1-3, 6-8, 10-11','muzzleloader','Alternative Firearms', date '2026-10-17', date '2026-10-25',
   null, 'Second split Dec 12 – 14.'),
  ('AR','deer','Zones 4A, 5A, 14-15','muzzleloader','Alternative Firearms', date '2026-10-17', date '2026-10-25',
   null, 'Second split Dec 19 – 21.'),
  ('AR','deer','Zones 9, 12-13','muzzleloader','Alternative Firearms', date '2026-10-17', date '2026-10-25',
   null, 'No December segment in Zones 9/12/13/16/16A/17. Closed in Zones 4 & 5.'),
  ('AR','deer','Zones 1-3, 6-8, 10-11','firearm','Modern Gun', date '2026-11-14', date '2026-12-06',
   null, 'Plus Dec 26 – 28 reopening. Youth weekends Nov 7 – 8 and Jan 2 – 3.'),
  ('AR','deer','Zones 4 & 5','firearm','Modern Gun', date '2026-11-14', date '2026-11-22', null, 'Plus Dec 26 – 28.'),
  ('AR','deer','Zones 4A, 5A, 14-15','firearm','Modern Gun', date '2026-11-14', date '2026-12-13', null, 'Plus Dec 26 – 28.'),
  ('AR','deer','Zones 9, 12-13','firearm','Modern Gun', date '2026-11-14', date '2026-12-20', null, 'Plus Dec 26 – 28.'),
  ('AR','deer','Zones 16, 16A, 17','firearm','Modern Gun', date '2026-11-14', date '2026-12-28', null, 'Continuous.'),
  -- ARKANSAS waterfowl/dove/turkey
  ('AR','duck','Statewide','general','Early Teal', date '2026-09-19', date '2026-09-27', '6 per day.', null),
  ('AR','duck','Statewide','general','Regular Season (3 splits)', date '2026-11-21', date '2027-01-31',
   '6 per day (max 4 mallards).', 'Splits: Nov 21 – 29, Dec 10 – 23, Dec 26 – Jan 31. Veteran/youth days Feb 6 – 7.'),
  ('AR','goose','Statewide','general','Early Canada Goose', date '2026-09-01', date '2026-10-15', '5 per day.', null),
  ('AR','goose','Statewide','general','Canada Goose Regular', date '2026-11-21', date '2027-01-31',
   '2 per day.', 'Runs with duck splits.'),
  ('AR','goose','Statewide','general','White-fronted & Light Geese', date '2026-10-31', date '2027-01-31',
   'White-fronted 2/day; light 20/day.', 'Splits Oct 31 – Nov 8, Nov 21 – 29, Dec 10 – 23, Dec 26 – Jan 31.'),
  ('AR','goose','Statewide','general','Light Goose Conservation Order', date '2027-02-01', date '2027-04-25',
   'No limit.', 'Segments Feb 1 – 5 and Feb 8 – Apr 25.'),
  ('AR','dove','Statewide','general','Segment 1', date '2026-09-05', date '2026-10-25', '15 per day.', null),
  ('AR','dove','Statewide','general','Segment 2', date '2026-12-08', date '2027-01-15', '15 per day.', null),
  ('AR','turkey','Turkey Zone 1','general','Spring Season', date '2027-04-19', date '2027-05-09',
   '2 per season.', 'No fall turkey season in Arkansas. Youth hunt Apr 10 – 11.'),
  ('AR','turkey','Turkey Zone 1A','general','Spring Season', date '2027-04-19', date '2027-04-27', '1.', null),
  ('AR','turkey','Turkey Zone 2','general','Spring Season', date '2027-04-12', date '2027-05-02', '2.', null),
  ('AR','turkey','Turkey Zone 2A','general','Spring Season', date '2027-04-12', date '2027-04-20', '1.', null),
  ('AR','turkey','Turkey Zone 3','general','Spring Season', date '2027-04-05', date '2027-04-25', '2.', null),
  -- MISSOURI
  ('MO','dove','Statewide','general',null, date '2026-09-01', date '2026-11-29',
   '15 per day.', 'Mourning, Eurasian collared, and white-winged aggregate.'),
  ('MO','goose','Statewide','general','Canada Goose — Early', date '2026-10-03', date '2026-10-10', '3 per day.', null),
  ('MO','goose','Statewide','general','Regular Goose Season', date '2026-11-11', date '2027-02-06',
   'Canada 3; white-fronted 2; light 20 per day.', null),
  ('MO','goose','Statewide','general','Light Goose Conservation Order', date '2027-02-07', date '2027-04-30', 'No limit.', null),
  ('MO','turkey','Statewide','archery','Fall Archery', date '2026-09-15', date '2027-01-15',
   null, 'Splits Sep 15 – Nov 13 and Nov 25 – Jan 15 (runs with archery deer). Spring 2027 dates publish late 2026.'),
  ('MO','turkey','Open Counties','firearm','Fall Firearms', date '2026-10-01', date '2026-10-31', null, 'Open counties only.'),
  -- IOWA
  ('IA','dove','Statewide','general',null, date '2026-09-01', date '2026-11-29', '15 per day.', null),
  ('IA','goose','North Zone','general','Goose (3 splits)', date '2026-09-26', date '2027-01-09',
   'Dark geese 5 per day.', 'Splits Sep 26 – Oct 11, Oct 17 – Dec 8, Dec 12 – Jan 9.'),
  ('IA','goose','Central Zone','general','Goose (3 splits)', date '2026-10-03', date '2027-01-16',
   'Dark geese 5 per day.', 'Splits Oct 3 – 18, Oct 24 – Dec 15, Dec 19 – Jan 16.'),
  ('IA','goose','South Zone','general','Goose (3 splits)', date '2026-10-10', date '2027-01-23',
   'Dark geese 5 per day.', 'Splits Oct 10 – 25, Oct 31 – Dec 22, Dec 26 – Jan 23.'),
  ('IA','goose','Metro Zones','general','September Metro Canada Goose', date '2026-09-12', date '2026-09-20',
   null, 'Des Moines and Cedar Rapids/Iowa City metro areas.'),
  ('IA','goose','Statewide','general','Light Goose Conservation Order', date '2027-01-24', date '2027-05-01', 'No limit.', null),
  ('IA','turkey','Statewide','firearm','Fall Gun/Bow', date '2026-10-12', date '2026-12-04', '1 per license.', null),
  ('IA','turkey','Statewide','archery','Fall Archery-only', date '2026-10-01', date '2027-01-10',
   '1 per license.', 'Splits Oct 1 – Dec 4 and Dec 21 – Jan 10.'),
  ('IA','turkey','Statewide','general','Spring Seasons 1-4', date '2027-04-12', date '2027-05-16',
   '1 per license per season.', 'Season 1 Apr 12 – 15; 2 Apr 16 – 20; 3 Apr 21 – 27; 4 Apr 28 – May 16. Youth Apr 9 – 11.'),
  ('IA','turkey','Statewide','archery','Spring Archery-only', date '2027-04-12', date '2027-05-16', '1 per license.', null),
  -- ILLINOIS
  ('IL','dove','Statewide','general','Segment 1', date '2026-09-01', date '2026-11-14', '15 per day.', null),
  ('IL','dove','Statewide','general','Segment 2', date '2026-12-26', date '2027-01-09', '15 per day.', null),
  ('IL','goose','Statewide','general','September Canada Goose', date '2026-09-01', date '2026-09-15', null, null),
  ('IL','goose','North Zone','general','Goose', date '2026-10-24', date '2027-01-26',
   null, 'Canada splits Oct 24 – 25 and Oct 31 – Jan 26; white-fronted from Oct 31. New 3-zone structure for 2026-2030.'),
  ('IL','goose','Central Zone','general','Goose', date '2026-10-31', date '2027-01-31',
   null, 'Splits Oct 31 – Dec 13 and Dec 19 – Jan 31.'),
  ('IL','goose','South Zone','general','Goose', date '2026-11-14', date '2027-01-31', null, 'Continuous.'),
  ('IL','turkey','Open Counties','firearm','Fall Shotgun', date '2026-10-24', date '2026-11-01',
   'Max 2 permits.', 'Spring 2027 dates not yet posted by IDNR.'),
  ('IL','turkey','Open Counties','archery','Fall Archery', date '2026-10-01', date '2027-01-17',
   'Max 2 permits.', 'Closed during firearm deer Nov 20 – 22 and Dec 3 – 6.'),
  -- MS / SC / LA spring turkey
  ('MS','turkey','Statewide','general','Spring Youth Season', date '2027-03-08', date '2027-03-14',
   '1 per day, 3 per season.', 'Private and authorized public lands.'),
  ('MS','turkey','Statewide','general','Spring Season', date '2027-03-15', date '2027-05-02',
   'Residents: 1 adult gobbler/day, 3/season.', 'No fall turkey season in Mississippi. Nonresident public-land limits apply before Apr 1.'),
  ('SC','turkey','Statewide','general','Spring Season', date '2027-04-03', date '2027-05-03',
   '2 gobblers per season, 1 per day.', 'Only 1 before Apr 10. Private and WMA lands (no Sunday hunting on WMAs). Youth weekends Mar 27 – 28 and May 8 – 9.'),
  ('LA','turkey','Area A','general','Spring Season', date '2027-04-03', date '2027-05-02', '2 per season, 1 per day.', null),
  ('LA','turkey','Area B','general','Spring Season', date '2027-04-03', date '2027-04-25', '2 per season, 1 per day.', null),
  ('LA','turkey','Area C','general','Spring Season', date '2027-04-03', date '2027-04-18', '2 per season, 1 per day.', null),
  ('LA','turkey','Statewide','general','Youth & Physically Challenged (private land)', date '2027-03-26', date '2027-03-28', '1.', null)
)
insert into public.seasons
  (state_id, species_id, zone_id, season_year, method, label, open_date, close_date,
   bag_limit_summary, notes, source_id, last_verified_at, status)
select st.id, sp.id, z.id, 2026, r.method::season_method, r.label, r.open_date, r.close_date,
       r.bag, r.notes,
       (select id from public.sources so where so.state_id = st.id
          and so.notes = 'Burn-down fill 2026-08-18.' limit 1),
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
