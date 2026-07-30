-- 20260730120000_ga_quota_windows.sql
-- Georgia 2026-27 WMA quota-hunt APPLICATION DEADLINES, from the official guide
-- (26GAAB-LR.pdf, guide page 25 "General Quota Hunt Applications" table, plus
-- per-category application periods on guide pages 24-27 and the alligator page).
--
-- Scope decision (David, 2026-07-30): capture quota application DEADLINES as
-- application_windows (small, high-value, on-mission — quota hunts are draws),
-- but NOT the per-WMA season dates (300+ rows of noise; parked for v1.2+).
-- All windows are statewide applications submitted via GoOutdoorsGeorgia.com;
-- deadlines are 11:59 p.m. EST on the listed date. Priority points apply.
--
-- Dedupe key matches the extractor: (state, species, season_year, name).

with ga as (
  select id from public.states where code = 'GA'
),
src as (
  select id from public.sources
  where url = 'https://www.eregulations.com/assets/docs/resources/GA/26GAAB-LR.pdf'
),
wins (species_key, name, opens_at, closes_at, notes) as (
  values
  ('deer', 'WMA Quota Hunts', null::date, date '2026-09-01',
   'Includes State Park deer quota hunts. Applications with up to 5 hunters. Hunts run Sep-Jan on selected WMAs.'),
  ('deer', 'Dog-Deer Quota Hunts', null, date '2026-09-30',
   'Administrator + assistant apply; selected parties up to 20 members.'),
  ('bear', 'Dog-Bear Quota Hunts', date '2026-08-01', date '2026-08-15',
   'Chattahoochee & Chestatee WMAs, hunts Oct 3-11. Party up to 10; max 5 bears per party.'),
  ('turkey', 'WMA Quota Hunts', date '2026-06-01', date '2027-02-15',
   'Hunts run Apr-May 2027 on selected WMAs. Applications with up to 3 hunters. Youth turkey quota shares this deadline.'),
  ('dove', 'Quota Dove Fields', null, date '2026-08-15',
   'Applications with up to 5 hunters. Youth dove quota shares this deadline. Hunts start Sep 5.'),
  ('duck', 'Waterfowl Quota Hunts', date '2026-06-01', date '2026-10-15',
   'No group applications; selected hunters may bring up to 2. Youth waterfowl quota shares this deadline. Hunts Nov-Jan.'),
  ('bobwhite', 'Quail Quota Hunts', date '2026-09-01', date '2026-10-15',
   'Selected hunters may bring up to 2. Youth quail quota shares this deadline.'),
  ('rabbit', 'Rabbit Quota Hunts', date '2026-09-01', date '2026-10-15',
   'Selected hunters may bring up to 2.'),
  ('wild-hog', 'Feral Hog Quota Hunts', null, date '2026-10-15',
   'Applications with up to 5 hunters.'),
  ('alligator', 'Alligator Quota Permit', date '2026-06-01', date '2026-07-15',
   'Harvest by permit only; up to 3 hunters per application. 2026 application period has closed; reopens ~June 2027.')
)
insert into public.application_windows
  (state_id, species_id, zone_id, season_year, name, opens_at, closes_at,
   results_expected_at, fee_summary, application_url, source_id, last_verified_at, status)
select
  ga.id,
  sp.id,
  null,
  2026,
  w.name,
  w.opens_at,
  w.closes_at,
  null,
  null,
  'https://gooutdoorsgeorgia.com/',
  src.id,
  now(),
  'published'
from wins w
cross join ga
cross join src
join public.species sp on sp.key = w.species_key
where not exists (
  select 1 from public.application_windows a
  where a.state_id = ga.id
    and a.species_id = sp.id
    and a.season_year = 2026
    and a.name = w.name
);
