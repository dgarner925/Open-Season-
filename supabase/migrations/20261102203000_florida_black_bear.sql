-- Florida black bear — a season that did not exist when the matrix was built.
--
-- 20260719140000_species_matrix.sql listed 28 states for 'bear' and FL was
-- correctly not one of them: Florida had not held a regulated bear hunt since
-- 2015. That changed. FWC resumed the hunt in December 2025 and expanded it for
-- 2026 — 215 permits across four Bear Harvest Zones, up from 172 — so FL x bear
-- is now a followable pair with real dates, and the only reason the app says
-- otherwise is that the matrix is a snapshot of July 2026.
--
-- Nothing flagged this. audit_coverage.py only checks pairs that are ALREADY
-- followable, so a state that gains a species is invisible to it: the hole is
-- in state_species, not in seasons. Same blind spot the span sweep found from
-- the other side — the audit answers "do these dates exist", never "are these
-- the right dates" or "is this the right list".
--
-- Verified 2026-11-02 against myfwc.com/hunting/bear (FWC's own 2026 page,
-- harvest totals updated 11/2/26), Executive Order 26-30 (permit caps, signed
-- 2026-08-26) and F.A.C. 68A-12.012 (bag limit, reporting). Application and
-- permit-claim windows have all closed for 2026; the season itself opens
-- Dec 5. The $5 / $100 / $300 fee line is from press coverage, not the FWC
-- page — it matches 2025 and two outlets agree, but it is the one field here
-- not read off an agency document.

-- The 2026 bear page. The pre-existing FL bear row pointed at the generic
-- limited-entry apply page, which never carried bear dates.
insert into public.sources (agency_name, url, doc_type, state_id, notes, last_extracted_at)
select 'Florida Fish and Wildlife Conservation Commission',
       'https://myfwc.com/hunting/bear/', 'webpage'::source_doc_type, s.id,
       '2026 bear hunt: season dates, four Bear Harvest Zone boundaries, per-WMA windows, Private Lands Bear Harvest Program.',
       now()
from public.states s
where s.code = 'FL'
  and not exists (select 1 from public.sources x where x.url = 'https://myfwc.com/hunting/bear/');

-- The four Bear Harvest Zones. FWC's own term is "Bear Harvest Zone", not BMU
-- (the Bear Management Units are a separate, larger set used for population
-- objectives). Boundaries are roads and county lines, so county_group.
insert into public.zones (state_id, type, name, notes)
select s.id, 'county_group'::zone_type, v.name, v.notes
from (values
  ('East Panhandle Bear Zone',
   'Bounded by I-10 (north), the Aucilla River (east), the Gulf (south) and SR 79 (west). All or parts of Bay, Washington, Jackson, Calhoun, Gulf, Franklin, Liberty, Gadsden, Leon, Wakulla and Jefferson counties. Includes Apalachicola WMA.'),
  ('North Bear Zone',
   'Bounded by the Florida-Georgia line (north), SR 121 (east), CR 18 and SR 121 (south) and I-75 (west). Parts of Hamilton, Suwannee, Columbia, Union and Baker counties. Includes Osceola WMA.'),
  ('Central Bear Zone',
   'Bounded by SR 16 (north), I-95 (east), the St. Johns River and I-4 (south), and the Florida Turnpike, I-75 and US 301 (west). All or parts of Sumter, Marion, Alachua, Bradford, Clay, Putnam, Lake, Orange, Seminole, Volusia, Flagler and St. Johns counties. Includes Ocala WMA.'),
  ('South Bear Zone',
   'Bounded by the Lee and Hendry county lines (north), the Hendry and Collier county lines (east), the Collier County line (south) and I-75 (west). All or parts of Lee, Hendry and Collier counties. Does NOT include Big Cypress WMA.')
) as v(name, notes)
join public.states s on s.code = 'FL'
where not exists (select 1 from public.zones z where z.state_id = s.id and z.name = v.name);

-- Make the pair followable. Until this runs, a Florida hunter searching the app
-- for bear is told Florida does not have one.
insert into public.state_species (state_id, species_id)
select st.id, sp.id from public.states st, public.species sp
where st.code = 'FL' and sp.key = 'bear'
on conflict do nothing;

-- One row per zone. The dates are identical across all four — Dec 5-27 is set
-- statewide — but the zones are not interchangeable: a permit is drawn FOR a
-- zone, and the geography is the whole point. A single 'Statewide' row would
-- read as "bear is open everywhere in Florida", which is false for most of the
-- state.
--
-- Deliberately NOT a row: the Private Lands Bear Harvest Program (Oct 1 -
-- Dec 31). It is genuinely open right now, but only to 22 landowners with
-- 5,000+ contiguous acres and a biologist's management plan. A season row for
-- it would put "Black bear - OPEN" on the home screen of every Florida
-- follower through December, which is the same lie the summary-span rows tell.
-- It lives in notes instead.
with st as (select id from public.states where code = 'FL'),
src as (select id from public.sources where url = 'https://myfwc.com/hunting/bear/'),
rows_to_add (zone_name, label, bag, notes) as (
  values
  ('East Panhandle Bear Zone', 'East Panhandle Zone',
   'One bear per Bear Harvest Permit (daily, possession and season).',
   '88 permits: 78 statewide hunt, 10 private lands. Several WMAs run narrower windows inside Dec 5-27 — Apalachicola Bradwell Unit is Dec 5-7, 12-16, 22-24 and 26-27; Joe Budd is Dec 5-6, 11-13, 18-20 and 25-27; Tyndall is Fridays through Sundays only. Dogs may not be used to harvest bears in 2026. Report each bear within 24 hours. Private Lands Bear Harvest Program runs Oct 1 - Dec 31 on enrolled properties.'),
  ('North Bear Zone', 'North Zone',
   'One bear per Bear Harvest Permit (daily, possession and season).',
   '35 permits: 31 statewide hunt, 4 private lands. Big Shoals, Cypress Creek and Osceola WMAs run the full Dec 5-27. Dogs may not be used to harvest bears in 2026. Report each bear within 24 hours. Private Lands Bear Harvest Program runs Oct 1 - Dec 31 on enrolled properties.'),
  ('Central Bear Zone', 'Central Zone',
   'One bear per Bear Harvest Permit (daily, possession and season).',
   '25 permits: 21 statewide hunt, 4 private lands. Many WMAs run narrower windows inside Dec 5-27 — Deep Creek and Rice Creek open Dec 18, Silver Springs Forest Dec 19, and Belmore, Caravelle Ranch and the Lake George Dexter/Mary Farms Unit are Thursday through Sunday only. Dogs may not be used to harvest bears in 2026. Report each bear within 24 hours. Private Lands Bear Harvest Program runs Oct 1 - Dec 31 on enrolled properties.'),
  ('South Bear Zone', 'South Zone',
   'One bear per Bear Harvest Permit (daily, possession and season).',
   '67 permits: 63 statewide hunt, 4 private lands. CREW, Dinner Island Ranch, Okaloacoochee Slough, Picayune Strand and Spirit-of-the-Wild WMAs run the full Dec 5-27; the Dinner Island Ranch Caracara Unit is Dec 5-6, 19-20 and 26-27. Big Cypress WMA is closed to bear hunting. Dogs may not be used to harvest bears in 2026. Report each bear within 24 hours. Private Lands Bear Harvest Program runs Oct 1 - Dec 31 on enrolled properties.')
)
insert into public.seasons
  (state_id, species_id, zone_id, season_year, method, label, open_date, close_date,
   bag_limit_summary, notes, source_id, last_verified_at, status)
select st.id, sp.id, z.id, 2026, 'general'::season_method, r.label,
       date '2026-12-05', date '2026-12-27',
       r.bag, r.notes, src.id, now(), 'published'
from rows_to_add r cross join st cross join src
join public.species sp on sp.key = 'bear'
join public.zones z on z.state_id = st.id and z.name = r.zone_name
where not exists (
  select 1 from public.seasons s
  where s.state_id = st.id and s.species_id = sp.id and s.zone_id = z.id
    and s.season_year = 2026 and coalesce(s.label, '') = r.label
);

-- The stub that was already there. An extraction in July 2026 read the generic
-- limited-entry page and wrote a bear row named "Phase I Applications" with
-- NULL on both dates — invisible while the pair was unfollowable, and a
-- permanent "TBD" the moment it becomes followable. It gets the real window.
update public.application_windows w
set name = '2026 Bear Harvest Permit Application',
    opens_at = date '2026-09-11',
    closes_at = date '2026-09-21',
    fee_summary = '$5 per application entry; permit $100 resident / $300 nonresident, plus handling.',
    application_url = 'https://myfwc.com/hunting/bear/',
    notes = 'Random drawing. 193 statewide-hunt permits drawn from 156,283 entries by 9,091 applicants. Permit claim rounds ran Sept 25 - Oct 5, Oct 9-19 and Oct 23 - Nov 2. Applicants had to be 18 by Oct 1; nonresidents capped at 10% of permits.',
    source_id = (select id from public.sources where url = 'https://myfwc.com/hunting/bear/'),
    last_verified_at = now(),
    status = 'published'
from public.states st, public.species sp
where w.state_id = st.id and w.species_id = sp.id
  and st.code = 'FL' and sp.key = 'bear' and w.season_year = 2026
  and w.opens_at is null and w.closes_at is null;

-- ---------------------------------------------------------------------------
-- Kentucky, South Carolina, Nevada — the same hole, found from the other side.
--
-- Looking for Florida turned up the inverse check nobody runs: season rows and
-- draw windows whose (state, species) pair is NOT in state_species. There are
-- 26 such rows live across 14 pairs, and 15 of them are bear. KY has nine
-- PUBLISHED bear seasons — Chase-
-- Only, Archery/Crossbow and Firearms across three zones, with Firearms
-- opening Dec 12 — and not one of them can be reached in the app. SC has three
-- (Still Hunt, now closed). NV has two draw deadlines and no season rows.
--
-- These are mapping errors, not data errors: all three states genuinely hunt
-- black bear, the dates were extracted and approved, and the only thing
-- missing is the row that makes the species appear for the state. Adding NV
-- will open a coverage gap, because we hold its draw windows and no season —
-- that is the correct outcome. The watchdog should be the thing that says so.
--
-- The other ten orphaned pairs are other species (CA snowshoe-hare, CO/NM/SC
-- ruffed-grouse, CT/DE bobwhite, ME/NH pheasant, OH chukar, VA tundra-swan)
-- and some of them look like extraction mistakes rather than mapping ones.
-- They need verifying one at a time and are deliberately left alone here.
insert into public.state_species (state_id, species_id)
select st.id, sp.id from public.states st, public.species sp
where sp.key = 'bear' and st.code in ('KY', 'SC', 'NV')
on conflict do nothing;

-- Guards. Four zones, four published seasons on the right dates, and no bear
-- row left with null dates.
do $$
declare
  n_zones int;
  n_seasons int;
  n_null int;
  n_pair int;
  n_orphan int;
begin
  select count(*) into n_zones
  from public.zones z join public.states st on st.id = z.state_id
  where st.code = 'FL' and z.name like '%Bear Zone';

  select count(*) into n_seasons
  from public.seasons s
  join public.states st on st.id = s.state_id
  join public.species sp on sp.id = s.species_id
  where st.code = 'FL' and sp.key = 'bear' and s.status = 'published'
    and s.open_date = date '2026-12-05' and s.close_date = date '2026-12-27';

  select count(*) into n_null
  from public.application_windows w
  join public.states st on st.id = w.state_id
  join public.species sp on sp.id = w.species_id
  where st.code = 'FL' and sp.key = 'bear' and w.closes_at is null;

  select count(*) into n_pair
  from public.state_species ss
  join public.states st on st.id = ss.state_id
  join public.species sp on sp.id = ss.species_id
  where st.code = 'FL' and sp.key = 'bear';

  -- No bear row anywhere may still be stranded outside state_species.
  select count(*) into n_orphan
  from public.seasons s
  join public.species sp on sp.id = s.species_id
  where sp.key = 'bear'
    and not exists (
      select 1 from public.state_species ss
      where ss.state_id = s.state_id and ss.species_id = s.species_id
    );

  if n_zones <> 4 or n_seasons <> 4 or n_null <> 0 or n_pair <> 1 or n_orphan <> 0 then
    raise exception 'FL bear: expected 4 zones / 4 seasons / 0 dateless windows / 1 pair / 0 orphan bear rows, got % / % / % / % / %',
      n_zones, n_seasons, n_null, n_pair, n_orphan;
  end if;
end $$;
