-- Coverage burn-down batch C: IDAHO + MONTANA tier 2-3 species.
-- Filled 2026-08-18 from official IDFG brochures and MT FWP 2026 date card /
-- regulation PDFs. MT wolf/marten/bobcat dates are from FWP's printed 2026
-- date card but formal commission adoption is 2026-08-19 — follow-up to
-- confirm. MT crow: REMOVE-PAIR (no crow season exists) — pruned separately.
-- MT wolf trapping: NOTPUBLISHED (pending adoption + court-order areas).

insert into public.sources (agency_name, url, doc_type, state_id, notes, last_extracted_at)
select v.agency, v.url, 'pdf'::source_doc_type, s.id, v.note, now()
from (values
  ('Idaho Department of Fish and Game',
   'https://idfg.idaho.gov/sites/default/files/2026-2027_uplandgame_web.pdf', 'ID',
   'Upland/furbearer/turkey 2026-27 brochure. Tier 2-3 fill 2026-08-18.'),
  ('Montana Fish, Wildlife & Parks',
   'https://fwp.mt.gov/binaries/content/assets/fwp/hunt/regulations/2026/2026-season-date-card-5x4.25-final.pdf', 'MT',
   '2026 season date card + upland/migratory PDFs. Tier 2-3 fill 2026-08-18. Wolf/marten/bobcat pending 8/19 commission adoption.')
) as v(agency, url, code, note)
join public.states s on s.code = v.code
where not exists (select 1 from public.sources x where x.url = v.url);

insert into public.zones (state_id, name)
select s.id, v.zone
from (values
  ('ID','Eastern Idaho Hunt Areas'),('ID','Eastern Idaho (Area 1)'),('ID','Northern Counties (Area 1)'),
  ('ID','Area 2 (Remainder)'),('ID','Area 2 (SE Counties)'),('ID','Area 3 (Panhandle)'),
  ('ID','Southern & Central Regions'),('ID','Panhandle & Clearwater Regions'),
  ('MT','Central Flyway'),('MT','Special License Areas'),('MT','Gardiner & West Yellowstone'),
  ('MT','Trapping Districts 1-3'),('MT','Trapping Districts 4-7'),('MT','East of Continental Divide')
) as v(code, zone)
join public.states s on s.code = v.code
where not exists (select 1 from public.zones z where z.state_id = s.id and z.name = v.zone);

with rows_to_add (state_code, species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  -- IDAHO
  ('ID','bighorn-sheep','Statewide','general','Controlled Hunt (draw) — dominant window', date '2026-08-30', date '2026-10-13',
   '1 ram.', 'Draw only, varies by hunt area; late hunts to Oct 31. 100 tags statewide. Mandatory horn check.'),
  ('ID','mountain-goat','Statewide','general','Controlled Hunt (draw)', date '2026-08-30', date '2026-11-12',
   '1.', 'Draw only; 40 tags statewide. Mandatory check.'),
  ('ID','mountain-lion','Statewide','general','Year-round (license year)', date '2026-07-01', date '2027-06-30',
   '1 per tag.', 'Take season Jul 1 – Jun 30 in all units; hound use restricted to unit windows. Mandatory check within 10 days.'),
  ('ID','sandhill-crane','Eastern Idaho Hunt Areas','general','September Hunts (tag required)', date '2026-09-01', date '2026-09-30',
   '2 per day; 2 per season.', '870 tags, first-come from Aug 3. Segments vary by hunt area. HIP required.'),
  ('ID','sandhill-crane','Eastern Idaho Hunt Areas','general','October Hunts (tag required)', date '2026-10-01', date '2026-10-30',
   '2 per day; 2 per season.', null),
  ('ID','sharptail-grouse','Eastern Idaho (Area 1)','general','Columbian Sharp-tailed (permit required)', date '2026-10-01', date '2026-11-08',
   '2 per day.', 'Season EXTENDED to Nov 8 for 2026-27. Remainder of state closed.'),
  ('ID','spruce-grouse','Northern Counties (Area 1)','general','Forest Grouse (dusky/ruffed/spruce)', date '2026-08-30', date '2027-01-31',
   '4 per day aggregate.', null),
  ('ID','spruce-grouse','Area 2 (Remainder)','general','Forest Grouse (dusky/ruffed/spruce)', date '2026-08-30', date '2026-12-31',
   '4 per day aggregate.', null),
  ('ID','snowshoe-hare','Statewide','general',null, date '2026-08-30', date '2027-03-31',
   '8 per day.', 'Pygmy rabbit closed.'),
  ('ID','gray-partridge','Statewide','general',null, date '2026-09-15', date '2027-01-31',
   '8 per day.', 'Separate limit from chukar.'),
  ('ID','marten','Statewide','general','Trapping Season (trapping only)', date '2026-11-01', date '2027-01-31',
   null, 'Trapping license + mandatory furtaker report.'),
  ('ID','wolf','Statewide','general','Hunting — year-round (license year)', date '2026-07-01', date '2027-06-30',
   'Per tags held.', 'Public-land unit rules split by date; private land statewide year-round. Mandatory check within 10 days.'),
  ('ID','wolf','Statewide','general','Trapping (dominant framework)', date '2026-12-01', date '2027-02-28',
   'Per tags held.', 'Unit variation is significant; litigation pending — confirm at idfg.idaho.gov/rules/big-game before setting.'),
  ('ID','snipe','Area 1','general',null, date '2026-10-19', date '2027-01-31', '8 per day.', 'Follows duck season areas. HIP required.'),
  ('ID','snipe','Area 2 (SE Counties)','general',null, date '2026-10-03', date '2027-01-15', '8 per day.', null),
  ('ID','snipe','Area 3 (Panhandle)','general',null, date '2026-10-10', date '2027-01-22', '8 per day.', null),
  ('ID','coyote','Statewide','general','Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Classified predatory wildlife; hunting license required.'),
  ('ID','crow','Statewide','general',null, date '2026-10-27', date '2027-02-28',
   'No limit.', 'No rifle/pistol/trap. Areas closed to upland birds are closed to crows.'),
  ('ID','fox','Southern & Central Regions','general','Hunting & Trapping — year-round', date '2026-07-01', date '2027-06-30',
   null, 'Red fox; year-round in 5 southern/central regions.'),
  ('ID','fox','Panhandle & Clearwater Regions','general','Hunting & Trapping', date '2026-10-10', date '2027-03-31',
   null, null),
  ('ID','raccoon','Statewide','general','Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Classified predatory wildlife in Idaho.'),
  ('ID','bobcat','Statewide','general','Hunting & Trapping', date '2026-12-14', date '2027-02-16',
   null, 'All regions; mandatory pelt check/CITES tag within 10 days of season close.'),
  -- MONTANA
  ('MT','bighorn-sheep','Statewide','archery','Archery (draw)', date '2026-09-05', date '2026-09-14',
   '1 per license.', 'Draw only, varies by unit.'),
  ('MT','bighorn-sheep','Statewide','firearm','General (draw)', date '2026-09-15', date '2026-11-29',
   '1 per license.', 'Draw only, varies by unit; some unlimited-license units.'),
  ('MT','mountain-goat','Statewide','archery','Archery (draw)', date '2026-09-05', date '2026-09-14',
   '1 per license.', 'Draw only.'),
  ('MT','mountain-goat','Statewide','firearm','General (draw)', date '2026-09-15', date '2026-11-29',
   '1 per license.', 'Draw only.'),
  ('MT','mountain-lion','Statewide','archery','Archery (no dogs)', date '2026-09-05', date '2026-10-18',
   '1 per license.', 'District quotas — may close early.'),
  ('MT','mountain-lion','Statewide','firearm','Fall Season (no dogs)', date '2026-10-24', date '2026-11-29',
   '1 per license.', null),
  ('MT','mountain-lion','Statewide','firearm','Winter Season (dogs allowed)', date '2026-12-01', date '2027-04-14',
   '1 per license.', 'Quotas fill quickly; report harvest within 12 hours.'),
  ('MT','sandhill-crane','Central Flyway','general','General (free OTC permit)', date '2026-10-03', date '2026-11-29',
   '3 per day.', 'Free permit from FWP; closed SW of I-90 except Carbon County.'),
  ('MT','sandhill-crane','Special License Areas','general','Special Drawing License', date '2026-09-01', date '2026-10-30',
   '2 per license.', 'Draw only; apply by June 1.'),
  ('MT','sharptail-grouse','Statewide','general',null, date '2026-09-01', date '2027-01-01',
   '4 per day.', 'Closed west of the Divide; nonresident public-land start Sep 11.'),
  ('MT','spruce-grouse','Statewide','general','Mountain Grouse (incl. Franklin''s)', date '2026-09-01', date '2027-01-01',
   '3 per day aggregate.', 'Aggregate with ruffed and dusky grouse.'),
  ('MT','ruffed-grouse','Statewide','general','Mountain Grouse', date '2026-09-01', date '2027-01-01',
   '3 per day aggregate.', null),
  ('MT','snowshoe-hare','Statewide','general','Year-round (nongame)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Nongame in Montana — no license or season; landowner permission on private land.'),
  ('MT','gray-partridge','Statewide','general',null, date '2026-09-01', date '2027-01-01',
   '8 per day aggregate with chukar.', 'Carbon County portion runs to Jan 10.'),
  ('MT','chukar','Statewide','general',null, date '2026-09-01', date '2027-01-01',
   '8 per day aggregate with gray partridge.', 'Core range Carbon County (portion to Jan 10).'),
  ('MT','marten','Statewide','general','Trapping', date '2026-12-01', date '2027-02-15',
   'Quota by district.', 'Formal 2026-27 adoption Aug 19, 2026 — confirm final regs.'),
  ('MT','wolf','Statewide','archery','Archery', date '2026-09-05', date '2026-09-14',
   'Per 2025 rule: up to 15.', 'Final 2026-27 quotas adopted Aug 19, 2026 — confirm.'),
  ('MT','wolf','Statewide','firearm','General', date '2026-09-15', date '2027-03-15',
   'Per 2025 rule: up to 15.', 'Final 2026-27 quotas adopted Aug 19, 2026 — confirm. Trapping dates pending adoption.'),
  ('MT','bison','Gardiner & West Yellowstone','general','General (draw only)', date '2026-11-15', date '2027-02-28',
   '1 per license.', 'HDs 385/395; apply by May 1; depends on bison migration out of Yellowstone.'),
  ('MT','sage-grouse','East of Continental Divide','general',null, date '2026-09-01', date '2026-09-30',
   '2 per day.', 'Free supplemental sage grouse permit required.'),
  ('MT','pheasant','Statewide','general',null, date '2026-10-10', date '2027-01-01',
   '3 cocks per day.', 'Nonresident public-land start Oct 20. Youth hunt Sep 19 – 20.'),
  ('MT','rabbit','Statewide','general','Year-round (nongame)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Rabbits/hares are nongame in Montana.'),
  ('MT','squirrel','Statewide','general','Year-round (nongame)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Tree squirrels are nongame in Montana.'),
  ('MT','snipe','Statewide','general',null, date '2026-09-01', date '2026-12-16',
   '8 per day.', 'MT Migratory Bird License required.'),
  ('MT','coyote','Statewide','general','Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Predator; no license required (Conservation License on State Trust lands).'),
  ('MT','fox','Statewide','general','Year-round (nongame)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Red fox is nongame. Swift fox has a separate quota-limited season (TD6 portion).'),
  ('MT','raccoon','Statewide','general','Year-round (nongame)', date '2026-07-01', date '2027-06-30',
   'No limit.', null),
  ('MT','bobcat','Trapping Districts 1-3','general','Hunting & Trapping', date '2026-12-01', date '2027-02-15',
   'Quota by district.', 'Confirm after Aug 19, 2026 adoption; closes early at quota.'),
  ('MT','bobcat','Trapping Districts 4-7','general','Hunting & Trapping', date '2026-12-01', date '2027-03-01',
   'Quota by district.', 'Confirm after Aug 19, 2026 adoption.')
)
insert into public.seasons
  (state_id, species_id, zone_id, season_year, method, label, open_date, close_date,
   bag_limit_summary, notes, source_id, last_verified_at, status)
select st.id, sp.id, z.id, 2026, r.method::season_method, r.label, r.open_date, r.close_date,
       r.bag, r.notes,
       (select id from public.sources so where so.state_id = st.id
          and so.notes like '%Tier 2-3 fill 2026-08-18%' limit 1),
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
