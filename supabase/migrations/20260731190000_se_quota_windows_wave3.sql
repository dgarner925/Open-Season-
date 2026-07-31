-- 20260731190000_se_quota_windows_wave3.sql
-- Southeastern quota/draw sweep, wave 3 (final): Virginia, Arkansas,
-- Mississippi, Louisiana. Verified July 2026 against:
--   VA: dwr.virginia.gov/hunting/quota-hunts/ (exact 2026 deadlines) +
--       dwr.virginia.gov elk lottery page (Feb 1 - Mar 31, passed)
--   AR: agfc.com permit-deadlines calendar (elk draw skipped — extractor
--       already carries 'Public Land Draw')
--   MS: mdwfp.com WMA draw hunts — the site is JS-rendered and blocks exact
--       scraping; published as honest "rounds open, deadlines in portal"
--       signposts rather than fabricated dates
--   LA: wlf.louisiana.gov/page/lottery-hunts — deer deadline Aug 31 (stable
--       across cycles); waterfowl/bear marked verify-in-portal in notes.
--       LA gains bear in its species matrix (limited December bear lottery).
-- Dedupe key matches the extractor: (state, species, season_year, name).

-- 1. LA black bear availability ---------------------------------------------
insert into public.state_species (state_id, species_id)
select st.id, sp.id
from public.states st, public.species sp
where st.code = 'LA' and sp.key = 'bear'
  and not exists (
    select 1 from public.state_species ss
    where ss.state_id = st.id and ss.species_id = sp.id
  );

-- 2. Sources ----------------------------------------------------------------
insert into public.sources (agency_name, url, doc_type, state_id, notes)
select v.agency, v.url, 'webpage'::source_doc_type, (select id from public.states where code = v.code), v.notes
from (values
  ('Virginia Department of Wildlife Resources',
   'https://dwr.virginia.gov/hunting/quota-hunts/',
   'VA', 'Quota hunt deadlines by series, 2026.'),
  ('Arkansas Game and Fish Commission',
   'https://www.agfc.com/resources/all-calendars/permit-deadlines/',
   'AR', 'Permit application deadline calendar.'),
  ('Mississippi Department of Wildlife, Fisheries, and Parks',
   'https://www.mdwfp.com/wildlife-hunting/wma-draw-hunts',
   'MS', 'WMA draw hunts; JS-rendered page, per-hunt deadlines in licensing portal.'),
  ('Louisiana Department of Wildlife and Fisheries',
   'https://www.wlf.louisiana.gov/page/lottery-hunts',
   'LA', 'Lottery hunt application periods.')
) as v(agency, url, code, notes)
where not exists (select 1 from public.sources s where s.url = v.url);

-- 3. Application windows -----------------------------------------------------
with wins (state_code, species_key, name, opens_at, closes_at, results_at, app_url, notes) as (
  values
  -- VIRGINIA — Go Outdoors Virginia, $7.50 per hunt ---------------------------
  ('VA', 'deer', 'Quota Deer Hunts', null::date, date '2026-08-28', null::date,
   'https://gooutdoorsvirginia.com/',
   'First deadline Aug 28 (includes multi-species hunts); some deer hunts run to Sep 25 — check your hunt''s listing. $7.50 nonrefundable per hunt; results by email and in your account.'),
  ('VA', 'duck', 'Quota Waterfowl Hunts', null, date '2026-09-25', null,
   'https://gooutdoorsvirginia.com/',
   'Most waterfowl hunts close Sep 25; Princess Anne WMA closes Aug 28. $7.50 per hunt.'),
  ('VA', 'turkey', 'Spring Gobbler Quota Hunts', null, date '2026-11-27', null,
   'https://gooutdoorsvirginia.com/',
   'All spring gobbler quota hunts close Nov 27. $7.50 per hunt.'),
  ('VA', 'elk', 'Elk Hunt Lottery', date '2026-02-01', date '2026-03-31', null,
   'https://dwr.virginia.gov/wildlife/elk/hunting/elk-lottery/',
   '2026 application period has closed (runs Feb 1 - Mar 31 annually). 5 antlered licenses in the Elk Management Zone; $15 resident / $20 nonresident to apply; winners notified by May 30.'),
  -- ARKANSAS — AGFC licensing portal ------------------------------------------
  ('AR', 'dove', 'Dove Permit Hunts', date '2026-08-01', date '2026-08-15', null,
   'https://ar-licensing.s3licensing.com/',
   'Managed dove field permits; $5 nonrefundable application.'),
  ('AR', 'alligator', 'Alligator Permit Draw', date '2026-07-01', date '2026-07-31', null,
   'https://ar-licensing.s3licensing.com/',
   'Public alligator harvest permits; applications close Jul 31.'),
  ('AR', 'deer', 'WMA Deer Permit Hunts', date '2026-06-01', date '2026-07-01', null,
   'https://ar-licensing.s3licensing.com/',
   '2026 application period has closed (Jun 1 - Jul 1 annually). One application per hunt type — youth, archery, alternative firearms, modern gun; $5 each; winners notified by email.'),
  ('AR', 'turkey', 'Turkey Permit Hunts', date '2026-01-15', date '2026-02-15', null,
   'https://ar-licensing.s3licensing.com/',
   '2026 application period has closed (Jan 15 - Feb 15 annually).'),
  -- MISSISSIPPI — MDWFP portal; per-hunt deadlines live in the portal ---------
  ('MS', 'deer', 'WMA Draw Hunts', date '2026-07-01', null, null,
   'https://licensing.outdoors.ms/',
   '2026-27 WMA draw hunt applications are open; deadlines vary by hunt and are listed in the MDWFP licensing portal (August drawings moved up two weeks this year). Free to apply with a WMA User Permit or exempt license.'),
  ('MS', 'duck', 'Teal & Waterfowl Draw Hunts', date '2026-07-01', null, null,
   'https://licensing.outdoors.ms/',
   'September teal and waterfowl draw hunts; application deadlines are listed per hunt in the MDWFP licensing portal.'),
  -- LOUISIANA — louisianaoutdoors.com lottery portal --------------------------
  ('LA', 'deer', 'WMA Deer Lottery Hunts', date '2026-07-15', date '2026-08-31', null,
   'https://louisianaoutdoors.com/lottery-applications',
   'Youth (10-17) and physically-challenged deer lotteries on select WMAs. $5 application + $3.50 transaction fee; WMA access permit or qualifying license required.'),
  ('LA', 'duck', 'Waterfowl Lottery Hunts', date '2026-07-15', date '2026-08-31', null,
   'https://louisianaoutdoors.com/lottery-applications',
   'Youth and Sherburne general waterfowl lotteries close late August — verify your hunt''s exact date in the portal (some waterfowl lotteries have run to Sep 30 in past cycles).'),
  ('LA', 'bear', 'Black Bear Lottery', date '2026-07-27', date '2026-08-31', null,
   'https://louisianaoutdoors.com/lottery-applications',
   'Louisiana''s limited December bear season is allocated by lottery; application window runs late July - late August — verify the exact closing date in the portal.')
)
insert into public.application_windows
  (state_id, species_id, zone_id, season_year, name, opens_at, closes_at,
   results_expected_at, fee_summary, application_url, notes, source_id, last_verified_at, status)
select
  st.id, sp.id, null, 2026, w.name, w.opens_at, w.closes_at, w.results_at,
  null, w.app_url, w.notes,
  (select s.id from public.sources s
    where s.state_id = st.id
      and s.url in (
        'https://dwr.virginia.gov/hunting/quota-hunts/',
        'https://www.agfc.com/resources/all-calendars/permit-deadlines/',
        'https://www.mdwfp.com/wildlife-hunting/wma-draw-hunts',
        'https://www.wlf.louisiana.gov/page/lottery-hunts')
    limit 1),
  now(), 'published'
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
