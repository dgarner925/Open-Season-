-- 20260723170000_ga_2026_27_seasons.sql
-- Georgia 2026-27 seasons, filled manually from the official guide
-- (26GAAB-LR.pdf, published July 2026 on eRegulations — pages 16-17).
--
-- Why manual: the new guide is a 17 MB PDF (over the extract-source in-worker
-- cap) and eRegulations' GA HTML pages still serve the 2025-26 content (they
-- flipped ~Aug 8 last year). Rather than wait, this migration publishes the
-- statewide table directly. Future automated extractions dedupe against these
-- rows by (state, species, zone, method, season_year), so when the HTML mirror
-- catches up the extractor proposes no duplicates.
--
-- GA previously had only 3 partial season rows (thin first extraction), so this
-- is also a proper fill: deer, bear (3 zones), turkey, ducks, geese, dove,
-- quail, rabbit, squirrel, grouse, woodcock, snipe, fox, bobcat, raccoon, crow,
-- alligator.

-- 1. Register the official guide as a source (provenance for these rows).
--    last_extracted_at = now() sends it to the back of the round-robin; when the
--    cron does reach it, the oversized-PDF guard skips it harmlessly.
insert into public.sources (agency_name, url, doc_type, state_id, notes, last_extracted_at)
select
  'Georgia DNR Wildlife Resources Division',
  'https://www.eregulations.com/assets/docs/resources/GA/26GAAB-LR.pdf',
  'pdf',
  (select id from public.states where code = 'GA'),
  '2026-27 official regulations guide. 17 MB — exceeds in-worker extraction cap; seasons filled manually 2026-07-23.',
  now()
where not exists (
  select 1 from public.sources where url = 'https://www.eregulations.com/assets/docs/resources/GA/26GAAB-LR.pdf'
);

-- 2. Season rows. Keyed lookups by species key + zone name; guarded so re-runs
--    (and later extractor proposals) can't duplicate.
with ga as (
  select id from public.states where code = 'GA'
),
src as (
  select id from public.sources
  where url = 'https://www.eregulations.com/assets/docs/resources/GA/26GAAB-LR.pdf'
),
rows_to_add (species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  -- DEER ---------------------------------------------------------------------
  ('deer', 'Statewide', 'archery', 'Archery', date '2026-09-12', date '2026-10-09',
   '12 per season statewide; no more than 10 antlerless and 2 antlered. One antlered buck must have 4+ points on one side or a 15-inch outside spread.',
   'In Baker, Calhoun, Decatur, Early, Grady, Miller, Mitchell, Seminole & Thomas counties the first 2 weeks of archery are buck-only.'),
  ('deer', 'Statewide', 'muzzleloader', 'Primitive Weapons & Youth Firearms', date '2026-10-10', date '2026-10-16',
   null, 'Archery equipment, air bows, .30-cal+ air rifles, and muzzleloaders are legal.'),
  ('deer', 'Statewide', 'firearm', 'Firearms', date '2026-10-17', date '2027-01-10',
   null, 'Firearms deer hunting not allowed in Clayton, Cobb, DeKalb, Fulton (north of GA 92), and the Jekyll Island portion of Glynn County.'),
  ('deer', 'Extended Archery Counties', 'archery', 'Extended Archery', date '2026-09-12', date '2027-01-31',
   null, 'Extended archery in designated metro counties only — see guide page 11.'),
  -- BEAR ---------------------------------------------------------------------
  ('bear', 'Northern Zone', 'archery', 'Archery', date '2026-09-12', date '2026-10-09',
   '2 per season; no more than 1 from the Central or Southern zones.', null),
  ('bear', 'Northern Zone', 'muzzleloader', 'Primitive Weapons & Youth Firearms', date '2026-10-10', date '2026-10-16',
   null, null),
  ('bear', 'Northern Zone', 'firearm', 'Firearms', date '2026-10-17', date '2027-01-10',
   null, null),
  ('bear', 'Central Zone', 'firearm', 'Firearms (one day)', date '2026-12-19', date '2026-12-19',
   null, 'If fewer than 6 female bears are taken Dec 19, a second hunt day may open in January — check georgiawildlife.com after Dec 21.'),
  ('bear', 'Southern Zone', 'firearm', 'Firearms (select days)', date '2026-09-17', date '2026-10-10',
   null, 'Hunt days only: Sep 17-19, Sep 24-26, Oct 1-3, Oct 8-10.'),
  -- TURKEY -------------------------------------------------------------------
  ('turkey', 'Statewide', 'general', 'Special Opportunity (youth & mobility-impaired)', date '2027-03-20', date '2027-03-21',
   'Counts toward the 2-gobbler season limit.', 'Youth under 16 and mobility-impaired hunters only; private lands.'),
  ('turkey', 'Statewide', 'general', 'Private Lands', date '2027-03-27', date '2027-05-15',
   '2 gobblers per season; 1 per day.', null),
  ('turkey', 'Statewide', 'general', 'WMAs, VPAs & National Forest', date '2027-04-03', date '2027-05-15',
   '1 gobbler per area per person.', null),
  -- DUCKS --------------------------------------------------------------------
  ('duck', 'Statewide', 'general', 'Early Teal', date '2026-09-12', date '2026-09-20',
   '6 per day.', null),
  ('duck', 'Statewide', 'general', 'Youth, Military & Veterans Days', date '2026-11-14', date '2026-11-15',
   null, 'Youth under 16 (adult accompanying), plus active-duty military and veterans.'),
  ('duck', 'Statewide', 'general', 'Regular Season Segment 1', date '2026-11-21', date '2026-11-29',
   '6 per day; no more than 4 sea ducks.', null),
  ('duck', 'Statewide', 'general', 'Regular Season Segment 2', date '2026-12-12', date '2027-01-31',
   '6 per day; no more than 4 sea ducks.', null),
  -- GEESE (Canada goose segments; snow & white-fronted open Oct 10 onward) ---
  ('goose', 'Statewide', 'general', 'Canada Goose — September', date '2026-09-05', date '2026-09-27',
   '5 per day, combined.', null),
  ('goose', 'Statewide', 'general', 'Canada Goose — October', date '2026-10-10', date '2026-10-25',
   '5 per day, combined.', 'Snow and white-fronted goose seasons also open Oct 10-25.'),
  ('goose', 'Statewide', 'general', 'Canada Goose — November', date '2026-11-21', date '2026-11-29',
   '5 per day, combined.', null),
  ('goose', 'Statewide', 'general', 'Canada Goose — Winter', date '2026-12-12', date '2027-01-31',
   '5 per day, combined.', null),
  -- DOVE ---------------------------------------------------------------------
  ('dove', 'Statewide', 'general', 'Segment 1', date '2026-09-05', date '2026-10-11', '15 per day.', null),
  ('dove', 'Statewide', 'general', 'Segment 2', date '2026-11-21', date '2026-11-29', '15 per day.', null),
  ('dove', 'Statewide', 'general', 'Segment 3', date '2026-12-19', date '2027-01-31', '15 per day.', null),
  -- SMALL GAME & BIRDS -------------------------------------------------------
  ('bobwhite', 'Statewide', 'general', null, date '2026-11-14', date '2027-02-28',
   '12 per day (3 per day on WMAs, VPAs & National Forest).', null),
  ('rabbit', 'Statewide', 'general', null, date '2026-11-14', date '2027-02-28', '12 per day.', null),
  ('squirrel', 'Statewide', 'general', null, date '2026-08-15', date '2027-02-28', '12 per day.', null),
  ('ruffed-grouse', 'Statewide', 'general', null, date '2026-10-15', date '2027-02-28', '3 per day.', null),
  ('woodcock', 'Statewide', 'general', null, date '2026-12-05', date '2027-01-18', '3 per day.', null),
  ('snipe', 'Statewide', 'general', null, date '2026-11-15', date '2027-02-28', '8 per day.', null),
  -- FURBEARERS ---------------------------------------------------------------
  ('fox', 'Statewide', 'general', null, date '2026-12-01', date '2027-02-28', 'No limit.', null),
  ('bobcat', 'Statewide', 'general', null, date '2026-12-01', date '2027-02-28', 'No limit.', null),
  ('raccoon', 'Statewide', 'general', 'Public Lands', date '2026-08-15', date '2027-02-28',
   'No limit.', 'No closed season on private lands.'),
  ('crow', 'Statewide', 'general', null, date '2026-11-07', date '2027-02-28',
   'No limit.', 'May be taken outside these dates only when causing agricultural damage.'),
  -- ALLIGATOR (quota draw) ---------------------------------------------------
  ('alligator', 'Statewide', 'general', 'Zone & Quota Limited', date '2026-08-14', date '2026-10-05',
   '1 per quota permit holder.', 'Quota permit required (drawn). Opens at sunset Aug 14, closes at sunrise Oct 5.')
)
insert into public.seasons
  (state_id, species_id, zone_id, season_year, method, label, open_date, close_date,
   bag_limit_summary, notes, source_id, last_verified_at, status)
select
  ga.id,
  sp.id,
  z.id,
  2026,
  r.method::season_method,
  r.label,
  r.open_date,
  r.close_date,
  r.bag,
  r.notes,
  src.id,
  now(),
  'published'
from rows_to_add r
cross join ga
cross join src
join public.species sp on sp.key = r.species_key
join public.zones z on z.state_id = ga.id and z.name = r.zone_name
where not exists (
  select 1 from public.seasons s
  where s.state_id = ga.id
    and s.species_id = sp.id
    and s.zone_id = z.id
    and s.method = r.method::season_method
    and s.season_year = 2026
    and coalesce(s.label, '') = coalesce(r.label, '')
);
