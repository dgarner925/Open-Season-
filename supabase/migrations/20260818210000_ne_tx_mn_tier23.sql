-- Coverage burn-down batch H: PA/MD/DE/CT/MA/RI + TX/MN tier 2-3.
-- Filled 2026-08-18 from official sources (PGC, eRegulations MD/DE, CT DEEP,
-- mass.gov, RI codified rules, TPWD, MN DNR).
-- Matrix prune #2 included: bobcat closed/protected in MD, DE, CT, RI;
-- TX desert bighorn is permit-only with no public season.
-- NOTPUBLISHED (follow-ups): TX crow (page 404'd — verify before adding).

-- Prune #2
delete from public.state_species ss
using public.states st, public.species sp
where ss.state_id = st.id and ss.species_id = sp.id
  and ((st.code in ('MD','DE','CT','RI') and sp.key = 'bobcat')
    or (st.code = 'TX' and sp.key = 'bighorn-sheep'));

insert into public.sources (agency_name, url, doc_type, state_id, notes, last_extracted_at)
select v.agency, v.url, 'webpage'::source_doc_type, s.id, 'Burn-down fill 2026-08-18 (batch H).', now()
from (values
  ('Pennsylvania Game Commission', 'https://www.pa.gov/agencies/pgc/huntingandtrapping/regulations/seasons-and-bag-limits', 'PA'),
  ('Maryland Department of Natural Resources', 'https://www.eregulations.com/maryland/hunting/furbearer-seasons-limits', 'MD'),
  ('Delaware Division of Fish and Wildlife', 'https://www.eregulations.com/delaware/hunting/furbearer-trapping-hunting', 'DE'),
  ('Connecticut DEEP Wildlife Division', 'https://portal.ct.gov/deep/hunting/2026-connecticut-hunting-and-trapping-guide/furbearer-trapping-seasons', 'CT'),
  ('MassWildlife', 'https://www.mass.gov/info-details/trapping-seasons', 'MA'),
  ('Rhode Island Department of Environmental Management', 'https://rules.sos.ri.gov/regulations/part/250-60-00-9#9.9', 'RI'),
  ('Texas Parks & Wildlife Department', 'https://tpwd.texas.gov/regulations/outdoor-annual/hunting/nongame-and-other-species', 'TX'),
  ('Minnesota Department of Natural Resources', 'https://www.dnr.state.mn.us/hunting/trapping/seasons.html', 'MN')
) as v(agency, url, code)
join public.states s on s.code = v.code
where not exists (select 1 from public.sources x where x.url = v.url);

insert into public.zones (state_id, name)
select s.id, v.zone
from (values
  ('PA','Permit WMUs'),
  ('MD','Charles & Dorchester Counties'),('MD','Eastern Shore Counties'),('MD','Western & Central Counties'),
  ('MA','Zones 1-8'),
  ('MN','Northwest Zone'),('MN','North Furbearer Zone'),('MN','Permit Areas (NW)'),('MN','Northwest Goose Zone'),
  ('TX','Zone A'),('TX','Zone B'),('TX','Zone C'),('TX','North Javelina Zone'),('TX','South Javelina Zone'),
  ('TX','East Texas Counties'),('TX','Other Counties')
) as v(code, zone)
join public.states s on s.code = v.code
where not exists (select 1 from public.zones z where z.state_id = s.id and z.name = v.zone);

with rows_to_add (state_code, species_key, zone_name, label, open_date, close_date, bag, notes) as (
  values
  -- PENNSYLVANIA
  ('PA','bobwhite','Statewide','Quail (released birds)', date '2026-09-01', date '2027-03-31',
   'No limit.', 'Wild bobwhite extirpated; season targets released birds. Closed in the Letterkenny Recovery Area. Closed Christmas Day.'),
  ('PA','ruffed-grouse','Statewide',null, date '2026-10-17', date '2026-12-24', '2 per day.', null),
  ('PA','woodcock','Statewide',null, date '2026-10-17', date '2026-12-08', '3 per day.', 'HIP required.'),
  ('PA','snowshoe-hare','Statewide','Six-day Season', date '2026-12-26', date '2026-12-31', '1 per day; 3 per season.', null),
  ('PA','fisher','Permit WMUs','Trapping (permit)', date '2026-12-19', date '2027-01-10',
   '1 per license year.', 'Trapping only; listed WMUs only.'),
  ('PA','rabbit','Statewide',null, date '2026-10-17', date '2027-02-28', '4 per day.', 'Closed Christmas Day.'),
  ('PA','squirrel','Statewide',null, date '2026-09-12', date '2027-02-28', '6 per day combined.', 'Closed Christmas Day.'),
  ('PA','snipe','Statewide',null, date '2026-10-17', date '2026-12-08', '8 per day.', null),
  ('PA','coyote','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30', 'No limit.', null),
  ('PA','crow','Statewide','Thu – Sun only', date '2026-08-20', date '2027-03-21',
   'No limit.', 'New Thu-Sun structure with the 2026-27 Sunday expansion.'),
  ('PA','fox','Statewide',null, date '2026-10-24', date '2027-02-21', 'No limit.', 'Furtaker license.'),
  ('PA','raccoon','Statewide',null, date '2026-10-24', date '2027-02-21', 'No limit.', 'Furtaker license.'),
  ('PA','bobcat','Permit WMUs','Hunting (permit)', date '2027-01-09', date '2027-02-03',
   '1 per license year combined.', 'Trapping season Dec 19 – Jan 10 same WMUs; permit required.'),
  -- MARYLAND
  ('MD','coyote','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Day and night; Furbearer Permit required.'),
  ('MD','crow','Statewide','Wed – Sat only', date '2026-08-15', date '2027-03-15', 'No limit.', null),
  ('MD','fox','Charles & Dorchester Counties','Year-round', date '2026-08-01', date '2027-07-31',
   'No limit.', 'Hunting and trapping share dates. Furbearer Permit required.'),
  ('MD','fox','Eastern Shore Counties',null, date '2026-11-14', date '2027-02-28', 'No limit.', null),
  ('MD','fox','Western & Central Counties',null, date '2026-10-31', date '2027-02-15', 'No limit.', null),
  ('MD','raccoon','Statewide',null, date '2026-10-15', date '2027-03-15',
   'No limit.', 'Day and night, dogs allowed. Chase-only outside these dates.'),
  -- DELAWARE
  ('DE','coyote','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'New for 2026-27. Deer-legal firearms required during deer seasons. Trapping Nov 1 – Mar 10.'),
  ('DE','crow','Statewide','Fri – Sun only', date '2026-07-03', date '2027-03-26', 'No limit.', null),
  ('DE','fox','Statewide','Red Fox Season', date '2026-11-01', date '2027-02-28',
   'No limit.', 'Red fox only; gray fox has no directed season (limited collateral take south of the C&D Canal). Chase-only outside harvest dates.'),
  ('DE','raccoon','Statewide',null, date '2026-11-01', date '2027-02-28',
   'No limit.', 'Chase-only Aug – Oct and March. Trapping Dec 1 – Mar 10.'),
  -- CONNECTICUT
  ('CT','fisher','Statewide','Trapping', date '2026-11-20', date '2026-12-31',
   '2 per season.', 'Trapping only; mandatory carcass submission and pelt tagging.'),
  ('CT','coyote','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Also trappable in season windows.'),
  ('CT','crow','Statewide','Three Seasons (day-of-week rules)', date '2026-08-08', date '2027-03-20',
   'No limit.', 'Early Aug 8 – Oct 9 and late Oct 17 – Nov 28 (Wed/Fri/Sat only); winter Dec 21 – Mar 20 (Mon – Sat).'),
  ('CT','fox','Statewide','Red & Gray Fox', date '2026-10-17', date '2027-02-28',
   '3 per day, 30 per season combined.', 'Jan – Feb portion per the annual cycle (2027 guide).'),
  ('CT','raccoon','Statewide',null, date '2026-10-17', date '2027-01-17',
   '5 per day.', 'Night hunting permitted; restricted during firearms deer season.'),
  -- MASSACHUSETTS
  ('MA','fisher','Statewide','Trapping', date '2026-11-01', date '2026-11-22',
   null, 'Trapping only; report within 4 working days of season end.'),
  ('MA','snipe','Statewide',null, date '2026-09-01', date '2026-12-15', '8 per day.', 'HIP required.'),
  ('MA','coyote','Statewide',null, date '2026-10-17', date '2027-03-08',
   'No limit.', 'No Sunday hunting; closed during shotgun deer season. Harvest check required.'),
  ('MA','crow','Statewide','Mon/Fri/Sat only', date '2026-07-01', date '2027-04-10',
   'No limit.', 'Closed during shotgun deer season.'),
  ('MA','fox','Statewide',null, date '2026-11-02', date '2027-02-27',
   'No limit.', 'No Sunday hunting; closed during shotgun deer season. Trapping Nov 1 – 30.'),
  ('MA','raccoon','Statewide',null, date '2026-10-01', date '2027-01-30',
   'No limit.', 'No Sunday hunting; closed during shotgun deer season.'),
  ('MA','bobcat','Zones 1-8',null, date '2026-12-21', date '2027-03-08',
   null, 'Zones 1-8 only; physical check station within 4 working days of season end. Trapping Nov 1 – 30.'),
  -- RHODE ISLAND
  ('RI','fisher','Statewide','Trapping (special permit)', date '2026-12-01', date '2026-12-24',
   '1 per season.', 'New limited season; no-fee Special Fisher Trapping Permit + trapping license.'),
  ('RI','coyote','Statewide','Year-round on private land', date '2026-07-01', date '2027-06-30',
   'No limit.', 'State lands: Sep 15 – end of Feb plus spring turkey season. Daylight only.'),
  ('RI','crow','Statewide','Three Seasons (day-of-week rules)', date '2026-08-14', date '2027-04-03',
   'No limit.', 'Summer Aug 14 – Oct 4 (Fri-Sun); fall Oct 17 – Dec 7 (daily); winter Dec 18 – Apr 3 (Fri-Sun).'),
  ('RI','fox','Statewide','Red & Gray Fox', date '2026-11-07', date '2026-12-31',
   'No limit.', 'Trapping runs separately Nov 1 – end of Jan.'),
  ('RI','raccoon','Statewide',null, date '2026-10-01', date '2027-02-28',
   'No limit.', 'Opens 6 p.m. Oct 1.'),
  -- TEXAS
  ('TX','mountain-lion','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Nongame. New rules: 36-hour trap check; canned hunting prohibited.'),
  ('TX','western-quail','Statewide','Quail (all species combined)', date '2026-11-01', date '2027-02-28',
   '15 per day combined.', 'Scaled and Gambel''s share the statewide quail season. Upland Game Bird Endorsement required.'),
  ('TX','sandhill-crane','Zone A',null, date '2026-10-31', date '2027-01-31',
   '3 per day.', 'Federal crane permit + Migratory Game Bird Endorsement + HIP required.'),
  ('TX','sandhill-crane','Zone B',null, date '2026-11-27', date '2027-01-31', '3 per day.', null),
  ('TX','sandhill-crane','Zone C',null, date '2026-12-12', date '2027-01-17', '2 per day.', null),
  ('TX','javelina','North Javelina Zone',null, date '2026-10-01', date '2027-02-28',
   '2 per year.', '49 counties; 155 Texas counties have no open javelina season.'),
  ('TX','javelina','South Javelina Zone','Year-round season', date '2026-09-01', date '2027-08-31',
   '2 per year.', '50 counties; season runs Sep 1 – Aug 31.'),
  ('TX','ringtail','Statewide','Year-round (fur-bearing)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Recreational harvest year-round; trapper''s license to sell pelts.'),
  ('TX','wild-hog','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'No hunting license required on private property with landowner authorization.'),
  ('TX','nutria','Statewide','Year-round (fur-bearing)', date '2026-07-01', date '2027-06-30', 'No limit.', null),
  ('TX','rabbit','Statewide','Year-round (nongame)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Hunting license required.'),
  ('TX','squirrel','East Texas Counties',null, date '2026-10-01', date '2027-02-28',
   '10 per day.', '51 counties; also a May 1 – 31 spring segment.'),
  ('TX','squirrel','Other Counties','Year-round', date '2026-07-01', date '2027-06-30',
   'No limit.', '203 counties.'),
  ('TX','snipe','Statewide',null, date '2026-11-07', date '2027-02-21',
   '8 per day.', 'Migratory Game Bird Endorsement + HIP.'),
  ('TX','coyote','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Live coyotes may not be transported (rabies quarantine).'),
  ('TX','fox','Statewide','Year-round (fur-bearing)', date '2026-07-01', date '2027-06-30', 'No limit.', null),
  ('TX','raccoon','Statewide','Year-round (fur-bearing)', date '2026-07-01', date '2027-06-30', 'No limit.', null),
  ('TX','bobcat','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'CITES pelt tag required for pelts leaving Texas.'),
  -- MINNESOTA
  ('MN','sharptail-grouse','Northwest Zone',null, date '2026-09-19', date '2026-11-30',
   '3 per day.', 'Northwest zone only; east-central zone closed.'),
  ('MN','gray-partridge','Statewide',null, date '2026-09-19', date '2027-01-03', '5 per day.', null),
  ('MN','ruffed-grouse','Statewide',null, date '2026-09-19', date '2027-01-03',
   '5 per day combined with spruce grouse.', null),
  ('MN','spruce-grouse','Statewide',null, date '2026-09-19', date '2027-01-03',
   'Max 2 per day within the 5-bird combined limit.', null),
  ('MN','prairie-chicken','Permit Areas (NW)','Lottery Only', date '2026-09-26', date '2026-10-04',
   '2 per season.', 'Residents 21+ by lottery (117 licenses, 13 permit areas).'),
  ('MN','sandhill-crane','Northwest Goose Zone',null, date '2026-09-12', date '2026-10-18',
   '2 per day.', 'NW goose zone only; small-game license + $3 crane permit.'),
  ('MN','snowshoe-hare','Statewide',null, date '2026-09-19', date '2027-02-28',
   '10 per day combined with cottontail.', null),
  ('MN','fisher','North Furbearer Zone','Trapping Only (9 days)', date '2026-12-12', date '2026-12-20',
   'Small season limit.', 'Hunting fisher/marten prohibited by statute; registration required.'),
  ('MN','rabbit','Statewide','Cottontail', date '2026-09-19', date '2027-02-28', '10 per day.', null),
  ('MN','squirrel','Statewide',null, date '2026-09-19', date '2027-02-28', '7 per day combined.', null),
  ('MN','snipe','Statewide',null, date '2026-09-01', date '2026-12-16', '8 per day.', 'HIP required.'),
  ('MN','coyote','Statewide','Year-round (unprotected)', date '2026-07-01', date '2027-06-30', 'No limit.', null),
  ('MN','crow','Statewide','Fall Segment', date '2026-09-01', date '2026-10-31',
   'No limit.', 'No license required; damage take allowed any time.'),
  ('MN','crow','Statewide','Winter Segment', date '2026-12-15', date '2027-01-15', 'No limit.', null),
  ('MN','crow','Statewide','Spring Segment', date '2027-03-01', date '2027-03-31', 'No limit.', null),
  ('MN','fox','North Zone','Hunting & Trapping', date '2026-10-17', date '2027-03-15',
   'No limit.', 'Red and gray fox.'),
  ('MN','fox','South Zone','Hunting & Trapping', date '2026-10-24', date '2027-03-15', 'No limit.', null),
  ('MN','raccoon','North Zone','Hunting & Trapping', date '2026-10-17', date '2027-03-15', 'No limit.', null),
  ('MN','raccoon','South Zone','Hunting & Trapping', date '2026-10-24', date '2027-03-15', 'No limit.', null),
  ('MN','bobcat','North Furbearer Zone','Hunting & Trapping', date '2026-12-12', date '2027-01-17',
   'Season limit applies.', 'North furbearer zone only; whole-carcass registration.')
)
insert into public.seasons
  (state_id, species_id, zone_id, season_year, method, label, open_date, close_date,
   bag_limit_summary, notes, source_id, last_verified_at, status)
select st.id, sp.id, z.id, 2026, 'general'::season_method, r.label, r.open_date, r.close_date,
       r.bag, r.notes,
       (select id from public.sources so where so.state_id = st.id
          and so.notes = 'Burn-down fill 2026-08-18 (batch H).' limit 1),
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
