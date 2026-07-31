-- 20260731170000_se_quota_windows_wave2.sql
-- Southeastern quota/draw sweep, wave 2: Florida, North Carolina, Kentucky.
-- Verified against official agency pages (July 2026):
--   FL: myfwc.com/license/limited-entry/apply/ (2026-27 phase table)
--   NC: ncwildlife.gov permit-hunting-opportunities (tundra swan deadline
--       Sep 1; other permit hunts publish per-hunt deadlines in the portal)
--   KY: fw.ky.gov/Hunt/Pages/Quota-Hunts.aspx (Sep 1-30 quota window, dove
--       Aug 3-21) + the long-standing Jan 1 - Apr 30 elk lottery
-- NC also gets a new species: tundra swan (its permit draw is NC's marquee
-- waterfowl lottery and the species didn't exist in our matrix).
-- Dedupe key matches the extractor: (state, species, season_year, name).

-- 1. New species: tundra swan + NC availability ------------------------------
insert into public.species (key, name, category, sort_order)
select 'tundra-swan', 'Tundra swan', 'waterfowl',
       coalesce((select max(sort_order) + 1 from public.species), 999)
where not exists (select 1 from public.species where key = 'tundra-swan');

insert into public.state_species (state_id, species_id)
select st.id, sp.id
from public.states st, public.species sp
where st.code = 'NC' and sp.key = 'tundra-swan'
  and not exists (
    select 1 from public.state_species ss
    where ss.state_id = st.id and ss.species_id = sp.id
  );

-- 2. Sources ----------------------------------------------------------------
insert into public.sources (agency_name, url, doc_type, state_id, notes)
select v.agency, v.url, 'webpage'::source_doc_type, (select id from public.states where code = v.code), v.notes
from (values
  ('Florida Fish and Wildlife Conservation Commission',
   'https://myfwc.com/license/limited-entry/apply/',
   'FL', 'Limited-entry/quota application phase table, 2026-27.'),
  ('North Carolina Wildlife Resources Commission',
   'https://www.ncwildlife.gov/hunting/license-types-and-fees/permit-hunting-opportunities',
   'NC', 'Permit hunting opportunities; per-hunt deadlines in Go Outdoors NC portal.'),
  ('Kentucky Department of Fish and Wildlife Resources',
   'https://fw.ky.gov/Hunt/Pages/Quota-Hunts.aspx',
   'KY', 'Quota hunt application periods.')
) as v(agency, url, code, notes)
where not exists (select 1 from public.sources s where s.url = v.url);

-- 3. Application windows -----------------------------------------------------
with wins (state_code, species_key, name, opens_at, closes_at, results_at, app_url, notes) as (
  values
  -- FLORIDA — GoOutdoorsFlorida.com --------------------------------------------
  ('FL', 'deer', 'Fall Quota Hunts Phase I', date '2026-05-15', date '2026-06-15', null,
   'https://license.gooutdoorsflorida.com/',
   '2026 Phase I has closed (May 15 - Jun 15 annually; Phase II Jun 26 - Jul 6). Covers archery, general gun, muzzleloading, family, mobility-impaired, track, and wild hog quotas. Permits are free; a management area permit is required to apply.'),
  ('FL', 'deer', 'Fall Quota Hunts — Leftovers', date '2026-07-09', null, null,
   'https://license.gooutdoorsflorida.com/',
   'Leftover quota permits: first-come, first-served from Jul 9 until filled. Immediate-issuance permits for select areas (Lower Suwannee, St. Vincent, St. Marks) from early July.'),
  ('FL', 'dove', 'Dove Club Permits Phase I', date '2026-07-31', date '2026-08-10', null,
   'https://license.gooutdoorsflorida.com/',
   'Application phases begin 10 a.m. ET on the opening day and close midnight on the deadline.'),
  ('FL', 'duck', 'Early Duck Permits Phase I', date '2026-07-31', date '2026-08-10', null,
   'https://license.gooutdoorsflorida.com/',
   'Early-season duck permits. Regular-season waterfowl phases (Periods A/B/C) run September through December; military/veteran phases Nov 13 - Dec 7.'),
  ('FL', 'turkey', 'Spring Turkey Quota Phase I', date '2026-11-01', date '2026-11-30', null,
   'https://license.gooutdoorsflorida.com/',
   'Phase II Dec 4-14; leftovers from Dec 17. Includes youth spring turkey permits.'),
  ('FL', 'alligator', 'Statewide Alligator Harvest Permits', date '2026-05-08', date '2026-06-15', null,
   'https://license.gooutdoorsflorida.com/',
   '2026 phases have closed (Phase I May 8-18, II May 22 - Jun 1, III Jun 5-15); leftovers from Jun 18 until filled.'),
  -- NORTH CAROLINA — GoOutdoorsNorthCarolina.com -------------------------------
  ('NC', 'tundra-swan', 'Tundra Swan Permit Draw', date '2026-07-01', date '2026-09-01', null,
   'https://www.gooutdoorsnorthcarolina.com/',
   'NC''s marquee waterfowl lottery. $8 nonrefundable application; results in Go Outdoors NC, permits mailed ~45 days after the drawing. Other NC permit hunts (deer, bear, dove, waterfowl, turkey) publish per-hunt deadlines in the portal from Jul 1.'),
  -- KENTUCKY — app.fw.ky.gov ---------------------------------------------------
  ('KY', 'dove', 'Dove Quota Hunts', date '2026-08-03', date '2026-08-21', null,
   'https://app.fw.ky.gov/MentorHunt/DoveHunt.aspx',
   'Hunt dates Sep 1 and Sep 5; separate mentor/youth application. $3 per application.'),
  ('KY', 'deer', 'WMA & State Park Quota Hunts', date '2026-09-01', date '2026-09-30', date '2026-10-06',
   'https://app.fw.ky.gov/Quota/',
   '37 deer quota hunts across WMAs and state parks. $3 per application; results posted in My Profile as soon as Oct 6.'),
  ('KY', 'duck', 'Waterfowl Quota Hunts', date '2026-09-01', date '2026-09-30', date '2026-10-06',
   'https://app.fw.ky.gov/Quota/',
   'Waterfowl quota hunts at five public-land locations. $3 per application; results in My Profile.'),
  ('KY', 'pheasant', 'Pheasant Quota Hunts', date '2026-09-01', date '2026-09-30', date '2026-10-06',
   'https://app.fw.ky.gov/Quota/',
   'Green River Lake (from third Friday in November), Clay and Yellowbank (from first Friday in December). $3 per application.'),
  ('KY', 'sandhill-crane', 'Sandhill Crane Quota Hunts', date '2026-09-01', date '2026-09-30', date '2026-10-06',
   'https://app.fw.ky.gov/solar/',
   'Statewide permits; season Dec 7 - Jan 31. $3 per application.'),
  ('KY', 'elk', 'Elk Permit Lottery', date '2026-01-01', date '2026-04-30', null,
   'https://fw.ky.gov/Hunt/Pages/Elk-Hunting.aspx',
   '2026 application period has closed (runs Jan 1 - Apr 30 annually; drawing in May). One of the largest elk herds east of the Rockies.')
)
insert into public.application_windows
  (state_id, species_id, zone_id, season_year, name, opens_at, closes_at,
   results_expected_at, fee_summary, application_url, notes, source_id, last_verified_at, status)
select
  st.id,
  sp.id,
  null,
  2026,
  w.name,
  w.opens_at,
  w.closes_at,
  w.results_at,
  null,
  w.app_url,
  w.notes,
  (select s.id from public.sources s
    where s.state_id = st.id
      and s.url in (
        'https://myfwc.com/license/limited-entry/apply/',
        'https://www.ncwildlife.gov/hunting/license-types-and-fees/permit-hunting-opportunities',
        'https://fw.ky.gov/Hunt/Pages/Quota-Hunts.aspx')
    limit 1),
  now(),
  'published'
from wins w
join public.states st on st.code = w.state_code
join public.species sp on sp.key = w.species_key
where not exists (
  select 1 from public.application_windows a
  where a.state_id = st.id
    and a.species_id = sp.id
    and a.season_year = 2026
    and a.name = w.name
);
