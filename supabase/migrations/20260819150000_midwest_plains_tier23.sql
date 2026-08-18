-- Coverage burn-down batch P: IA/MO/IL/NE/KS/OK tier 2-3.
-- Filled 2026-08-19 from official sources (Iowa DNR 2026-27 PDFs, MDC pages,
-- IDNR formulas + digest, NGPC pages, KDWP formulas, ODWC seasons page).
-- Matrix prune #8: OK prairie-chicken (lesser prairie-chicken closed,
-- federally listed; no ODWC season).
-- NOTPUBLISHED follow-ups: NE bighorn (Dec season, dates pending), NE crow
-- (split dates pending), NE mountain lion 2027 (approved ~late Aug).

delete from public.state_species ss
using public.states st, public.species sp
where ss.state_id = st.id and ss.species_id = sp.id
  and st.code = 'OK' and sp.key = 'prairie-chicken';

insert into public.sources (agency_name, url, doc_type, state_id, notes, last_extracted_at)
select v.agency, v.url, (case when v.url like '%download%' then 'pdf' else 'webpage' end)::source_doc_type, s.id, 'Burn-down fill 2026-08-19 (batch P).', now()
from (values
  ('Iowa Department of Natural Resources', 'https://www.iowadnr.gov/media/1701/download', 'IA'),
  ('Missouri Department of Conservation', 'https://mdc.mo.gov/hunting-trapping/seasons', 'MO'),
  ('Illinois Department of Natural Resources', 'https://dnr.illinois.gov/content/dam/soi/en/web/dnr/conservation/wildlife/documents/season-dates-rules-of-thumb.pdf', 'IL'),
  ('Nebraska Game and Parks Commission', 'https://outdoornebraska.gov/hunt/game/furbearers/', 'NE'),
  ('Kansas Department of Wildlife & Parks', 'https://ksoutdoors.gov/Hunting/When-to-Hunt/Furbearers', 'KS'),
  ('Oklahoma Department of Wildlife Conservation', 'https://www.wildlifedepartment.com/hunting/seasons#furbearer', 'OK')
) as v(agency, url, code)
join public.states s on s.code = v.code
where not exists (select 1 from public.sources x where x.url = v.url and x.notes = 'Burn-down fill 2026-08-19 (batch P).');

insert into public.zones (state_id, name)
select s.id, v.zone
from (values ('KS','East Unit (Greater Prairie-Chicken)')) as v(zone)
join public.states s on s.code = 'KS'
where not exists (select 1 from public.zones z where z.state_id = s.id and z.name = v.zone);

with rows_to_add (state_code, species_key, zone_name, label, open_date, close_date, bag, notes) as (
  values
  -- IOWA
  ('IA','gray-partridge','Statewide',null, date '2026-10-10', date '2027-01-31',
   '8 per day.', 'Shooting hours 8 a.m. – 4:30 p.m.'),
  ('IA','ruffed-grouse','Statewide',null, date '2026-10-03', date '2027-01-31', '3 per day.', null),
  ('IA','woodcock','Statewide',null, date '2026-10-03', date '2026-11-16', '3 per day.', null),
  ('IA','rabbit','Statewide','Cottontail', date '2026-09-05', date '2027-02-28',
   '10 per day.', 'Jackrabbit season closed.'),
  ('IA','squirrel','Statewide',null, date '2026-09-05', date '2027-01-31', '6 per day.', null),
  ('IA','snipe','Statewide',null, date '2026-09-05', date '2026-11-30', '8 per day.', null),
  ('IA','coyote','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Trapping Nov 7 – Feb 28.'),
  ('IA','crow','Statewide','Split Season', date '2026-10-15', date '2027-03-31',
   'No limit.', 'Segments Oct 15 – Nov 30 and Jan 14 – Mar 31.'),
  ('IA','fox','Statewide','Furharvester Season', date '2026-11-07', date '2027-02-28',
   'No limit.', 'Red and gray fox; opens 8 a.m.'),
  ('IA','raccoon','Statewide','Year-round on private land', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Public-land season Nov 7 – Feb 28; cage/dog-proof traps only outside the furharvester season.'),
  ('IA','bobcat','Statewide','Furharvester Season', date '2026-11-07', date '2027-02-28',
   'Zone quotas apply.', 'CITES tag within 24 hours.'),
  -- MISSOURI
  ('MO','woodcock','Statewide',null, date '2026-10-18', date '2026-12-01', '3 per day.', null),
  ('MO','rabbit','Statewide',null, date '2026-10-01', date '2027-02-15',
   '6 per day.', 'Swamp rabbit sub-limit; jackrabbit protected.'),
  ('MO','squirrel','Statewide',null, date '2026-05-23', date '2027-02-15', '10 per day.', null),
  ('MO','bobwhite','Statewide','Quail', date '2026-11-01', date '2027-01-15',
   '8 per day.', 'Youth weekend Oct 24 – 25.'),
  ('MO','snipe','Statewide',null, date '2026-09-01', date '2026-12-16', '8 per day.', null),
  ('MO','coyote','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Daytime restrictions during spring turkey and November firearms deer. Trapping Nov 15 – Feb 28.'),
  ('MO','crow','Statewide',null, date '2026-11-01', date '2027-03-03', 'No limit.', null),
  ('MO','fox','Statewide','Furbearer Season', date '2026-11-15', date '2027-01-31',
   'No limit.', 'Red and gray fox.'),
  ('MO','raccoon','Statewide','Furbearer Season (hunt & trap)', date '2026-11-15', date '2027-02-28',
   'No limit.', 'Early cage-trap period Aug 1 – Oct 15; extended private-land trapping Mar 1 – Apr 14.'),
  ('MO','bobcat','Statewide','Furbearer Season', date '2026-11-15', date '2027-02-28',
   'No limit.', 'Pelt registration required.'),
  -- ILLINOIS
  ('IL','woodcock','Statewide',null, date '2026-10-17', date '2026-11-30',
   '3 per day.', 'Formula-dated — confirm in the migratory insert.'),
  ('IL','rabbit','Statewide',null, date '2026-11-07', date '2027-02-15', '4 per day.', null),
  ('IL','squirrel','Statewide',null, date '2026-08-01', date '2027-02-15',
   '5 per day.', 'Closed during firearm deer seasons in open counties.'),
  ('IL','bobwhite','North Zone','Quail', date '2026-11-07', date '2027-01-08', '8 per day.', null),
  ('IL','bobwhite','South Zone','Quail', date '2026-11-07', date '2027-01-15', '8 per day.', null),
  ('IL','snipe','Statewide',null, date '2026-09-05', date '2026-12-20', '8 per day.', null),
  ('IL','coyote','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Closed during firearm deer seasons with exceptions. Trapping Nov 10 – Feb 15.'),
  ('IL','crow','Statewide',null, date '2026-10-28', date '2027-02-28', 'No limit.', null),
  ('IL','fox','Statewide','Hunting & Trapping', date '2026-11-10', date '2027-02-15',
   'No limit.', 'Closed during firearm deer seasons.'),
  ('IL','raccoon','Statewide','Hunting & Trapping', date '2026-11-10', date '2027-02-15', 'No limit.', null),
  ('IL','bobcat','Statewide','Permit Only (lottery)', date '2026-11-10', date '2027-02-15',
   '1 per permit.', 'Closed during firearm deer seasons.'),
  -- NEBRASKA
  ('NE','sharptail-grouse','Statewide','Prairie Grouse', date '2026-09-01', date '2027-01-31',
   '3 per day combined.', 'Combined bag with prairie-chicken.'),
  ('NE','prairie-chicken','Statewide','Prairie Grouse', date '2026-09-01', date '2027-01-31',
   '3 per day combined.', null),
  ('NE','gray-partridge','Statewide',null, date '2026-10-31', date '2027-01-31', '3 per day.', null),
  ('NE','snipe','Statewide',null, date '2026-09-01', date '2026-12-16', '8 per day.', null),
  ('NE','coyote','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30', 'No limit.', null),
  ('NE','fox','Statewide','Furbearer Season', date '2026-11-01', date '2027-02-28',
   'No limit.', 'Red and gray fox.'),
  ('NE','raccoon','Statewide','Hunting & Trapping', date '2026-09-01', date '2027-02-28',
   'No limit.', 'Hunting-only Sep 1 – Oct 31; hunting and trapping Nov 1 – Feb 28.'),
  ('NE','bobcat','Statewide','Furbearer Season', date '2026-12-01', date '2027-02-28',
   null, 'Pelt tagging required.'),
  ('NE','mountain-lion','Statewide','Lottery Season (Jan-Feb, dates pending)', date '2027-01-02', date '2027-02-28',
   '1 per permit.', '2027 season approval expected late August 2026; pattern is Jan 2 – Feb 28 in Pine Ridge/Niobrara/Wildcat Hills units — confirm.'),
  -- KANSAS
  ('KS','prairie-chicken','East Unit (Greater Prairie-Chicken)',null, date '2026-09-15', date '2027-01-31',
   '2 per day.', 'Greater prairie-chicken only; Southwest Unit closed (lesser).'),
  ('KS','snipe','Statewide',null, date '2026-09-01', date '2026-12-16', '8 per day.', null),
  ('KS','coyote','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Night-vision permit season Jan 1 – Mar 31.'),
  ('KS','crow','Statewide',null, date '2026-11-10', date '2027-03-10', 'No limit.', null),
  ('KS','fox','Statewide','Furbearer Season', date '2026-11-18', date '2027-02-28',
   'No limit.', 'Red/swift/gray fox.'),
  ('KS','raccoon','Statewide','Furbearer Season', date '2026-11-18', date '2027-02-28', 'No limit.', null),
  ('KS','bobcat','Statewide','Furbearer Season', date '2026-11-18', date '2027-02-28',
   'No limit.', 'Pelt tagging required.'),
  -- OKLAHOMA
  ('OK','western-quail','Statewide','Quail (combined)', date '2026-11-14', date '2027-02-15',
   '10 per day combined.', 'Scaled quail share the statewide quail season.'),
  ('OK','wild-hog','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Private land with landowner consent; public-land restrictions during some big-game seasons.'),
  ('OK','snipe','Statewide',null, date '2026-09-26', date '2027-01-10', '8 per day.', null),
  ('OK','coyote','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30', 'No limit.', null),
  ('OK','crow','Statewide','Split Season', date '2026-10-10', date '2027-03-04',
   'No limit.', 'Segments Oct 10 – Nov 16 and Dec 9 – Mar 4.'),
  ('OK','fox','Statewide','Furbearer Season', date '2026-12-01', date '2027-02-28',
   'No limit.', 'Red and gray fox.'),
  ('OK','raccoon','Statewide','Year-round hunting', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Trapping limited to Dec 1 – Feb 28.'),
  ('OK','bobcat','Statewide',null, date '2026-12-01', date '2027-02-28',
   'Season limit 20.', 'Pelt tagging required.')
)
insert into public.seasons
  (state_id, species_id, zone_id, season_year, method, label, open_date, close_date,
   bag_limit_summary, notes, source_id, last_verified_at, status)
select st.id, sp.id, z.id, 2026, 'general'::season_method, r.label, r.open_date, r.close_date,
       r.bag, r.notes,
       (select id from public.sources so where so.state_id = st.id
          and so.notes = 'Burn-down fill 2026-08-19 (batch P).' limit 1),
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
