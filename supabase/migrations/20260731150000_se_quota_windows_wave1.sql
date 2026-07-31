-- 20260731150000_se_quota_windows_wave1.sql
-- Southeastern quota/draw application deadlines, wave 1: Alabama, South
-- Carolina, Tennessee. Verified against official agency pages (July 2026):
--   AL: outdooralabama.com/hunting/special-opportunity-areas (2026-27 SOA
--       registration periods, incl. published drawing-results dates)
--   SC: SCDNR lottery hunts — deer deadline Aug 15, 2026 (Go Outdoors SC);
--       alligator May 1 - Jun 15 (annual, passed for 2026)
--   TN: TWRA quota hunts (via eRegulations mirror; tn.gov blocks datacenter
--       fetches) — WMA big game Jun 10 - Jul 22, elk Feb 4-25 (both passed for
--       2026; recorded for reference and next-cycle continuity)
-- SC waterfowl/quail lotteries (~mid-Sep to mid-Oct) and TN sandhill crane /
-- fall turkey rounds are NOT included yet — exact 2026 dates unpublished;
-- revisit in September.
-- Dedupe key matches the extractor: (state, species, season_year, name).

-- 1. Register official sources for provenance -------------------------------
insert into public.sources (agency_name, url, doc_type, state_id, notes)
select v.agency, v.url, 'webpage'::source_doc_type, (select id from public.states where code = v.code), v.notes
from (values
  ('Alabama Department of Conservation and Natural Resources',
   'https://www.outdooralabama.com/hunting/special-opportunity-areas',
   'AL', 'SOA draw registration periods, 2026-27.'),
  ('South Carolina Department of Natural Resources',
   'https://www.dnr.sc.gov/hunting/deerlotterysites.html',
   'SC', 'Public lottery hunts; apply via Go Outdoors SC.'),
  ('Tennessee Wildlife Resources Agency',
   'https://www.eregulations.com/tennessee/hunting/quota-hunts',
   'TN', 'Quota hunt application periods (eReg mirror; tn.gov blocks datacenter fetches).')
) as v(agency, url, code, notes)
where not exists (select 1 from public.sources s where s.url = v.url);

-- 2. Application windows -----------------------------------------------------
with wins (state_code, species_key, name, opens_at, closes_at, results_at, app_url, notes) as (
  values
  -- ALABAMA — SOA draws, 2026-27 (registration at public.dcnr.alabama.gov) ---
  ('AL', 'deer', 'SOA Deer Hunts', date '2026-09-01', date '2026-09-14', date '2026-09-15',
   'https://public.dcnr.alabama.gov/puvHunts80',
   'Covers SOA deer draws statewide (Cedar Creek, Portland Landing, Fred T. Stimpson & more), dog-deer hunts (Geneva State Forest & Blue Spring), and the youth small game hunt. Closes 1:00 p.m.; results Sep 15. Hunting + WMA license required before registering.'),
  ('AL', 'dove', 'SOA Dove Hunts', date '2026-09-01', date '2026-09-14', date '2026-09-15',
   'https://public.dcnr.alabama.gov/puvHunts80',
   'Two rounds: first closes Sep 8 (results Sep 9), second closes Sep 14 (results Sep 15).'),
  ('AL', 'duck', 'Swan Creek Dewatering Unit Draw', date '2026-09-01', date '2026-09-21', date '2026-09-22',
   'https://public.dcnr.alabama.gov/puvHunts80',
   'Season-long waterfowl draw for the Swan Creek dewatering units. Closes 8:00 a.m.; results Sep 22.'),
  ('AL', 'duck', 'SOA Waterfowl Hunts', date '2026-10-13', date '2026-10-26', date '2026-10-27',
   'https://public.dcnr.alabama.gov/puvHunts80',
   'Adult waterfowl, woodcock & quail SOA draws (Crow Creek, Uchee Creek, Portland Landing, Cedar Creek). Youth waterfowl (Crow Creek) has a separate Dec 1-14 round. Closes 1:00 p.m.; results Oct 27.'),
  ('AL', 'bobwhite', 'SOA Quail Hunts', date '2026-10-13', date '2026-10-26', date '2026-10-27',
   'https://public.dcnr.alabama.gov/puvHunts80',
   'Part of the adult waterfowl/woodcock/quail SOA registration window. Results Oct 27.'),
  ('AL', 'turkey', 'SOA Turkey Hunts', date '2026-12-01', date '2026-12-14', date '2026-12-15',
   'https://public.dcnr.alabama.gov/puvHunts80',
   'Spring turkey & small game SOA draws (Cedar Creek, Portland Landing, Uchee Creek & more). Closes 1:00 p.m.; results Dec 15.'),
  ('AL', 'wild-hog', 'SOA Feral Swine Hunts', date '2026-12-01', date '2026-12-14', date '2026-12-15',
   'https://public.dcnr.alabama.gov/puvHunts80',
   'Portland Landing & Thigpen Hill SOAs. Closes 1:00 p.m.; results Dec 15.'),
  -- SOUTH CAROLINA — lottery hunts (Go Outdoors SC) ---------------------------
  ('SC', 'deer', 'Deer Lottery Hunts', null, date '2026-08-15', null,
   'https://www.gooutdoorssouthcarolina.com/',
   'Adult and youth deer lotteries — Multi-site, Unrestricted Multi-site, Webb Gun, Webb Archery, and South Fenwick Archery run as independent drawings with separate preference points. Hunt fees due at application.'),
  ('SC', 'alligator', 'Public Alligator Lottery', date '2026-05-01', date '2026-06-15', null,
   'https://www.gooutdoorssouthcarolina.com/',
   '2026 application period has closed; the lottery runs May 1 - Jun 15 annually.'),
  -- TENNESSEE — quota hunts (Go Outdoors Tennessee); 2026 rounds passed -------
  ('TN', 'deer', 'WMA Big Game Quota Hunts', date '2026-06-10', date '2026-07-22', null,
   'https://gooutdoorstennessee.com/',
   '2026 application period has closed (Jun 10 - Jul 22 annually). Covers WMA deer, turkey, and bear quota hunts; $12 per drawing; priority points apply.'),
  ('TN', 'elk', 'Elk Quota Hunt', date '2026-02-04', date '2026-02-25', null,
   'https://gooutdoorstennessee.com/',
   '2026 application period has closed (runs each February). 19 permits for Elk Hunt Zones on North Cumberland WMA and nearby private lands; individual applications only, up to 4 zone choices.')
)
insert into public.application_windows
  (state_id, species_id, zone_id, season_year, name, opens_at, closes_at,
   results_expected_at, fee_summary, application_url, source_id, last_verified_at, status)
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
  (select s.id from public.sources s
    where s.state_id = st.id
      and s.url in (
        'https://www.outdooralabama.com/hunting/special-opportunity-areas',
        'https://www.dnr.sc.gov/hunting/deerlotterysites.html',
        'https://www.eregulations.com/tennessee/hunting/quota-hunts')
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
