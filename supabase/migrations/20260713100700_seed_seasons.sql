-- 20260713100700_seed_seasons.sql
-- Seasons, application windows, and draft regs summaries for the V1 states.
-- GENERATED from researched official-source data. Every row is status=draft
-- with a source URL; last_verified_at is intentionally NULL until a human
-- verifies each row against the source and flips it to published.
-- Re-runnable. Requires 20260713100600_seed_reference.sql (states/species/zones) first.

-- ===========================================================================
-- AL — Alabama Department of Conservation and Natural Resources (license year 2025)
-- ===========================================================================
insert into public.zones (state_id, type, name) select st.id, 'county_group', $s$Zone A$s$ from public.states st where st.code = 'AL' on conflict (state_id, name) do nothing;
insert into public.zones (state_id, type, name) select st.id, 'county_group', $s$Zone B$s$ from public.states st where st.code = 'AL' on conflict (state_id, name) do nothing;
insert into public.zones (state_id, type, name) select st.id, 'county_group', $s$Zone C$s$ from public.states st where st.code = 'AL' on conflict (state_id, name) do nothing;
insert into public.zones (state_id, type, name) select st.id, 'county_group', $s$Zone D$s$ from public.states st where st.code = 'AL' on conflict (state_id, name) do nothing;
insert into public.zones (state_id, type, name) select st.id, 'county_group', $s$Zone E$s$ from public.states st where st.code = 'AL' on conflict (state_id, name) do nothing;
insert into public.zones (state_id, type, name) select st.id, 'county_group', $s$CWD Management Zone$s$ from public.states st where st.code = 'AL' on conflict (state_id, name) do nothing;
insert into public.sources (agency_name, url, doc_type) select $s$Alabama Department of Conservation and Natural Resources$s$, $s$https://www.outdooralabama.com/seasons-and-bag-limits/deer-season$s$, 'webpage' where not exists (select 1 from public.sources where url = $s$https://www.outdooralabama.com/seasons-and-bag-limits/deer-season$s$);
insert into public.sources (agency_name, url, doc_type) select $s$Alabama Department of Conservation and Natural Resources$s$, $s$https://outdooralabama.com/seasons-and-bag-limits/waterfowl-season$s$, 'webpage' where not exists (select 1 from public.sources where url = $s$https://outdooralabama.com/seasons-and-bag-limits/waterfowl-season$s$);

insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2025, 'archery', NULL, DATE '2025-10-15', DATE '2026-02-10', $s$Either sex; 3 antlered bucks/season (1/day, one must have 4+ pts)$s$, $s$Stalk hunting, either sex entire period.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
join public.zones z on z.state_id = st.id and z.name = $s$Zone A$s$
left join public.sources src on src.url = $s$https://www.outdooralabama.com/seasons-and-bag-limits/deer-season$s$
where st.code = 'AL';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2025, 'muzzleloader', NULL, DATE '2025-11-17', DATE '2025-11-21', $s$Either sex$s$, $s$Special Muzzleloader/Air Rifle season.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
join public.zones z on z.state_id = st.id and z.name = $s$Zone A$s$
left join public.sources src on src.url = $s$https://www.outdooralabama.com/seasons-and-bag-limits/deer-season$s$
where st.code = 'AL';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2025, 'firearm', NULL, DATE '2025-11-22', DATE '2026-02-10', $s$Either sex (private land, stalk)$s$, $s$Gun deer stalk, private land. Public land and dog-hunting have splits within this range.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
join public.zones z on z.state_id = st.id and z.name = $s$Zone A$s$
left join public.sources src on src.url = $s$https://www.outdooralabama.com/seasons-and-bag-limits/deer-season$s$
where st.code = 'AL';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2025, 'archery', NULL, DATE '2025-10-15', DATE '2026-02-10', $s$Antlered bucks only Oct 15-24, then either sex Oct 25-Feb 10$s$, $s$Stalk hunting.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
join public.zones z on z.state_id = st.id and z.name = $s$Zone B$s$
left join public.sources src on src.url = $s$https://www.outdooralabama.com/seasons-and-bag-limits/deer-season$s$
where st.code = 'AL';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2025, 'muzzleloader', NULL, DATE '2025-11-17', DATE '2025-11-21', $s$Either sex$s$, $s$Special Muzzleloader/Air Rifle season.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
join public.zones z on z.state_id = st.id and z.name = $s$Zone B$s$
left join public.sources src on src.url = $s$https://www.outdooralabama.com/seasons-and-bag-limits/deer-season$s$
where st.code = 'AL';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2025, 'firearm', NULL, DATE '2025-11-22', DATE '2026-02-10', $s$Either sex (private land, stalk)$s$, $s$Gun deer stalk, private land. Splits within this range.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
join public.zones z on z.state_id = st.id and z.name = $s$Zone B$s$
left join public.sources src on src.url = $s$https://www.outdooralabama.com/seasons-and-bag-limits/deer-season$s$
where st.code = 'AL';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2025, 'archery', NULL, DATE '2025-10-15', DATE '2026-02-10', $s$Either sex$s$, $s$Stalk hunting.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
join public.zones z on z.state_id = st.id and z.name = $s$Zone C$s$
left join public.sources src on src.url = $s$https://www.outdooralabama.com/seasons-and-bag-limits/deer-season$s$
where st.code = 'AL';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2025, 'muzzleloader', NULL, DATE '2025-11-17', DATE '2025-11-21', $s$Either sex$s$, $s$Special Muzzleloader/Air Rifle season.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
join public.zones z on z.state_id = st.id and z.name = $s$Zone C$s$
left join public.sources src on src.url = $s$https://www.outdooralabama.com/seasons-and-bag-limits/deer-season$s$
where st.code = 'AL';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2025, 'firearm', NULL, DATE '2025-11-22', DATE '2026-02-10', $s$Either sex / antlered-only splits; 1 unantlered + 1 buck per day$s$, $s$Gun deer, private land stalk: either sex Nov 22-30, bucks only Dec 1-12, either sex Dec 13-Jan 1, bucks only Jan 2-Feb 10.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
join public.zones z on z.state_id = st.id and z.name = $s$Zone C$s$
left join public.sources src on src.url = $s$https://www.outdooralabama.com/seasons-and-bag-limits/deer-season$s$
where st.code = 'AL';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2025, 'archery', NULL, DATE '2025-10-01', DATE '2026-01-27', $s$Either sex Oct 1-Jan 15, antlered bucks only Jan 16-27$s$, $s$Stalk hunting.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
join public.zones z on z.state_id = st.id and z.name = $s$Zone D$s$
left join public.sources src on src.url = $s$https://www.outdooralabama.com/seasons-and-bag-limits/deer-season$s$
where st.code = 'AL';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2025, 'muzzleloader', NULL, DATE '2025-11-03', DATE '2025-11-07', $s$Either sex$s$, $s$Special Muzzleloader/Air Rifle season.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
join public.zones z on z.state_id = st.id and z.name = $s$Zone D$s$
left join public.sources src on src.url = $s$https://www.outdooralabama.com/seasons-and-bag-limits/deer-season$s$
where st.code = 'AL';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2025, 'firearm', NULL, DATE '2025-11-08', DATE '2026-01-27', $s$Multiple antlered-only/either-sex splits$s$, $s$Gun deer, private land stalk: bucks Nov 8-21, either sex Nov 22-30, bucks Dec 1-12, either sex Dec 13-Jan 1, bucks Jan 2-27.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
join public.zones z on z.state_id = st.id and z.name = $s$Zone D$s$
left join public.sources src on src.url = $s$https://www.outdooralabama.com/seasons-and-bag-limits/deer-season$s$
where st.code = 'AL';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2025, 'archery', NULL, DATE '2025-10-01', DATE '2026-01-27', $s$Either sex Oct 1-Jan 15, antlered bucks only Jan 16-27$s$, $s$Stalk hunting.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
join public.zones z on z.state_id = st.id and z.name = $s$Zone E$s$
left join public.sources src on src.url = $s$https://www.outdooralabama.com/seasons-and-bag-limits/deer-season$s$
where st.code = 'AL';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2025, 'muzzleloader', NULL, DATE '2025-11-03', DATE '2025-11-07', $s$Either sex$s$, $s$Special Muzzleloader/Air Rifle season.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
join public.zones z on z.state_id = st.id and z.name = $s$Zone E$s$
left join public.sources src on src.url = $s$https://www.outdooralabama.com/seasons-and-bag-limits/deer-season$s$
where st.code = 'AL';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2025, 'firearm', NULL, DATE '2025-11-08', DATE '2026-01-27', $s$Either sex (private stalk) through Jan 15, bucks only Jan 16-27$s$, $s$Gun deer, private land stalk. Public land has splits.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
join public.zones z on z.state_id = st.id and z.name = $s$Zone E$s$
left join public.sources src on src.url = $s$https://www.outdooralabama.com/seasons-and-bag-limits/deer-season$s$
where st.code = 'AL';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2025, 'archery', NULL, DATE '2025-10-15', DATE '2026-02-10', $s$Either sex$s$, $s$CMZ covers designated NW Alabama counties with additional CWD rules.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
join public.zones z on z.state_id = st.id and z.name = $s$CWD Management Zone$s$
left join public.sources src on src.url = $s$https://www.outdooralabama.com/seasons-and-bag-limits/deer-season$s$
where st.code = 'AL';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2025, 'firearm', NULL, DATE '2025-11-22', DATE '2026-02-10', $s$Either sex (private land, stalk)$s$, $s$Gun deer stalk, private land. Public land has splits.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
join public.zones z on z.state_id = st.id and z.name = $s$CWD Management Zone$s$
left join public.sources src on src.url = $s$https://www.outdooralabama.com/seasons-and-bag-limits/deer-season$s$
where st.code = 'AL';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2025, 'general', NULL, DATE '2025-11-28', DATE '2025-11-29', $s$6 ducks/day (max 4 mallards, 3 wood ducks, 3 pintail, 2 canvasback, 1 scaup)$s$, $s$Duck/coot/merganser first split (Mississippi Flyway).$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'duck'
join public.zones z on z.state_id = st.id and z.name = $s$Statewide$s$
left join public.sources src on src.url = $s$https://outdooralabama.com/seasons-and-bag-limits/waterfowl-season$s$
where st.code = 'AL';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2025, 'general', NULL, DATE '2025-12-05', DATE '2026-01-31', $s$6 ducks/day$s$, $s$Duck/coot/merganser second (main) split.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'duck'
join public.zones z on z.state_id = st.id and z.name = $s$Statewide$s$
left join public.sources src on src.url = $s$https://outdooralabama.com/seasons-and-bag-limits/waterfowl-season$s$
where st.code = 'AL';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2025, 'general', NULL, DATE '2025-09-13', DATE '2025-09-21', $s$6 teal/day$s$, $s$Special early Teal season (blue-winged/green-winged teal only).$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'duck'
join public.zones z on z.state_id = st.id and z.name = $s$Statewide$s$
left join public.sources src on src.url = $s$https://outdooralabama.com/seasons-and-bag-limits/waterfowl-season$s$
where st.code = 'AL';


insert into public.regulation_summaries (state_id, species_id, body, source_id, status)
select st.id, sp.id, $s$## License
A valid AL hunting license and any deer permits, tags, or stamps required by the state are needed before hunting.

## Seasons & limits
Deer season dates, legal methods, zones, and bag limits vary. See the season entries in this app and confirm every detail against the official regulations before you hunt.

## Notes
Statewide antlered limit 3 bucks/season (1/day; one must have 4+ points). Deer divided into Zones A-E + CWD Management Zone, each with archery/muzzleloader/gun seasons split further by private/public land and stalk/dog hunting. No open bear season (protected). No elk.

_Draft summary — pending review against the official Alabama Department of Conservation and Natural Resources regulations._$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
left join public.sources src on src.url = $s$https://www.outdooralabama.com/seasons-and-bag-limits/deer-season$s$
where st.code = 'AL'
  and not exists (
    select 1 from public.regulation_summaries r
    join public.states st2 on st2.code = 'AL'
    join public.species sp2 on sp2.key = 'deer'
    where r.state_id = st2.id and r.species_id = sp2.id
  );
insert into public.regulation_summaries (state_id, species_id, body, source_id, status)
select st.id, sp.id, $s$## License
A valid AL hunting license and any duck permits, tags, or stamps required by the state are needed before hunting.

## Seasons & limits
Duck season dates, legal methods, zones, and bag limits vary. See the season entries in this app and confirm every detail against the official regulations before you hunt.

## Notes
Statewide antlered limit 3 bucks/season (1/day; one must have 4+ points). Deer divided into Zones A-E + CWD Management Zone, each with archery/muzzleloader/gun seasons split further by private/public land and stalk/dog hunting. No open bear season (protected). No elk.

_Draft summary — pending review against the official Alabama Department of Conservation and Natural Resources regulations._$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'duck'
left join public.sources src on src.url = $s$https://www.outdooralabama.com/seasons-and-bag-limits/deer-season$s$
where st.code = 'AL'
  and not exists (
    select 1 from public.regulation_summaries r
    join public.states st2 on st2.code = 'AL'
    join public.species sp2 on sp2.key = 'duck'
    where r.state_id = st2.id and r.species_id = sp2.id
  );

-- ===========================================================================
-- CO — Colorado Parks & Wildlife (license year 2026)
-- ===========================================================================
insert into public.sources (agency_name, url, doc_type) select $s$Colorado Parks & Wildlife$s$, $s$https://cpw.state.co.us/sites/default/files/dam/ifgylu070o/final_bgss2025-2029.pdf$s$, 'pdf' where not exists (select 1 from public.sources where url = $s$https://cpw.state.co.us/sites/default/files/dam/ifgylu070o/final_bgss2025-2029.pdf$s$);
insert into public.sources (agency_name, url, doc_type) select $s$Colorado Parks & Wildlife$s$, $s$https://cpw.state.co.us/activities/hunting/waterfowl-hunting$s$, 'webpage' where not exists (select 1 from public.sources where url = $s$https://cpw.state.co.us/activities/hunting/waterfowl-hunting$s$);
insert into public.sources (agency_name, url, doc_type) select $s$Colorado Parks & Wildlife$s$, $s$https://cpw.state.co.us/activities/hunting/big-game/primary-draw$s$, 'webpage' where not exists (select 1 from public.sources where url = $s$https://cpw.state.co.us/activities/hunting/big-game/primary-draw$s$);
insert into public.sources (agency_name, url, doc_type) select $s$Colorado Parks & Wildlife$s$, $s$https://cpw.state.co.us/activities/hunting/big-game/secondary-draw$s$, 'webpage' where not exists (select 1 from public.sources where url = $s$https://cpw.state.co.us/activities/hunting/big-game/secondary-draw$s$);

insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2026, 'archery', $s$Archery$s$, DATE '2026-09-02', DATE '2026-09-30', $s$Limited either-sex/antlered/antlerless by GMU/DAU; OTC either-sex in certain units$s$, $s$29-day archery, fixed Sep 2-30 (2025-2029). West of I-25 & GMU 140.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'elk'
join public.zones z on z.state_id = st.id and z.name = $s$Statewide$s$
left join public.sources src on src.url = $s$https://cpw.state.co.us/sites/default/files/dam/ifgylu070o/final_bgss2025-2029.pdf$s$
where st.code = 'CO';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2026, 'muzzleloader', $s$Muzzleloader$s$, DATE '2026-09-12', DATE '2026-09-20', $s$Limited by GMU/DAU$s$, $s$9-day season opening 2nd Saturday of September.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'elk'
join public.zones z on z.state_id = st.id and z.name = $s$Statewide$s$
left join public.sources src on src.url = $s$https://cpw.state.co.us/sites/default/files/dam/ifgylu070o/final_bgss2025-2029.pdf$s$
where st.code = 'CO';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2026, 'firearm', $s$1st Rifle$s$, DATE '2026-10-14', DATE '2026-10-18', $s$Limited either-sex/antlered by GMU/DAU$s$, $s$First regular rifle elk (deer optional); 5-day.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'elk'
join public.zones z on z.state_id = st.id and z.name = $s$Statewide$s$
left join public.sources src on src.url = $s$https://cpw.state.co.us/sites/default/files/dam/ifgylu070o/final_bgss2025-2029.pdf$s$
where st.code = 'CO';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2026, 'firearm', $s$2nd Rifle$s$, DATE '2026-10-24', DATE '2026-11-01', $s$Limited; OTC antlered in some units$s$, $s$Second combined deer & elk rifle season; 9-day.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'elk'
join public.zones z on z.state_id = st.id and z.name = $s$Statewide$s$
left join public.sources src on src.url = $s$https://cpw.state.co.us/sites/default/files/dam/ifgylu070o/final_bgss2025-2029.pdf$s$
where st.code = 'CO';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2026, 'firearm', $s$3rd Rifle$s$, DATE '2026-11-07', DATE '2026-11-15', $s$Limited; OTC antlered in some units$s$, $s$Third combined deer & elk rifle season; 9-day.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'elk'
join public.zones z on z.state_id = st.id and z.name = $s$Statewide$s$
left join public.sources src on src.url = $s$https://cpw.state.co.us/sites/default/files/dam/ifgylu070o/final_bgss2025-2029.pdf$s$
where st.code = 'CO';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2026, 'firearm', $s$4th Rifle$s$, DATE '2026-11-18', DATE '2026-11-22', $s$Limited by GMU/DAU$s$, $s$Fourth combined deer & elk rifle season (deer optional); 5-day.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'elk'
join public.zones z on z.state_id = st.id and z.name = $s$Statewide$s$
left join public.sources src on src.url = $s$https://cpw.state.co.us/sites/default/files/dam/ifgylu070o/final_bgss2025-2029.pdf$s$
where st.code = 'CO';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2026, 'archery', $s$Archery$s$, DATE '2026-09-02', DATE '2026-09-30', $s$Limited either-sex or limited buck by GMU/DAU$s$, $s$West of I-25 & GMU 140. Plains deer archery (east of I-25) runs Oct 1-Dec 31 with splits.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
join public.zones z on z.state_id = st.id and z.name = $s$Statewide$s$
left join public.sources src on src.url = $s$https://cpw.state.co.us/sites/default/files/dam/ifgylu070o/final_bgss2025-2029.pdf$s$
where st.code = 'CO';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2026, 'muzzleloader', $s$Muzzleloader$s$, DATE '2026-09-12', DATE '2026-09-20', $s$Limited by GMU/DAU$s$, $s$9-day. Plains muzzleloader deer differs: Oct 10-18.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
join public.zones z on z.state_id = st.id and z.name = $s$Statewide$s$
left join public.sources src on src.url = $s$https://cpw.state.co.us/sites/default/files/dam/ifgylu070o/final_bgss2025-2029.pdf$s$
where st.code = 'CO';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2026, 'firearm', $s$1st Rifle (deer optional)$s$, DATE '2026-10-14', DATE '2026-10-18', $s$Limited antlered/antlerless by GMU/DAU; deer optional$s$, $s$Deer optional in first regular rifle season.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
join public.zones z on z.state_id = st.id and z.name = $s$Statewide$s$
left join public.sources src on src.url = $s$https://cpw.state.co.us/sites/default/files/dam/ifgylu070o/final_bgss2025-2029.pdf$s$
where st.code = 'CO';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2026, 'firearm', $s$2nd Rifle$s$, DATE '2026-10-24', DATE '2026-11-01', $s$Limited antlered/antlerless by GMU/DAU$s$, $s$Plains rifle deer (east of I-25) runs Oct 24-Nov 3; late plains rifle deer Dec 1-14.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
join public.zones z on z.state_id = st.id and z.name = $s$Statewide$s$
left join public.sources src on src.url = $s$https://cpw.state.co.us/sites/default/files/dam/ifgylu070o/final_bgss2025-2029.pdf$s$
where st.code = 'CO';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2026, 'firearm', $s$3rd Rifle$s$, DATE '2026-11-07', DATE '2026-11-15', $s$Limited antlered/antlerless by GMU/DAU$s$, $s$Third combined deer & elk rifle season.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
join public.zones z on z.state_id = st.id and z.name = $s$Statewide$s$
left join public.sources src on src.url = $s$https://cpw.state.co.us/sites/default/files/dam/ifgylu070o/final_bgss2025-2029.pdf$s$
where st.code = 'CO';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2026, 'firearm', $s$4th Rifle$s$, DATE '2026-11-18', DATE '2026-11-22', $s$Limited either-sex/antlered/antlerless by GMU/DAU$s$, $s$Fourth combined deer & elk rifle season.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
join public.zones z on z.state_id = st.id and z.name = $s$Statewide$s$
left join public.sources src on src.url = $s$https://cpw.state.co.us/sites/default/files/dam/ifgylu070o/final_bgss2025-2029.pdf$s$
where st.code = 'CO';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2026, 'archery', $s$Archery$s$, DATE '2026-09-02', DATE '2026-09-30', $s$Add-on with archery deer/elk license or limited bear-only by DAU/GMU$s$, $s$Fixed Sep 2-30 annually.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'bear'
join public.zones z on z.state_id = st.id and z.name = $s$Statewide$s$
left join public.sources src on src.url = $s$https://cpw.state.co.us/sites/default/files/dam/ifgylu070o/final_bgss2025-2029.pdf$s$
where st.code = 'CO';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2026, 'muzzleloader', $s$Muzzleloader$s$, DATE '2026-09-12', DATE '2026-09-20', $s$Add-on with muzzleloader deer/elk license or limited bear-only$s$, $s$9-day season concurrent with muzzleloader deer/elk.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'bear'
join public.zones z on z.state_id = st.id and z.name = $s$Statewide$s$
left join public.sources src on src.url = $s$https://cpw.state.co.us/sites/default/files/dam/ifgylu070o/final_bgss2025-2029.pdf$s$
where st.code = 'CO';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2026, 'firearm', $s$September Rifle (limited)$s$, DATE '2026-09-02', DATE '2026-09-30', $s$Limited rifle bear licenses by DAU/GMU$s$, $s$28-day September limited rifle bear season.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'bear'
join public.zones z on z.state_id = st.id and z.name = $s$Statewide$s$
left join public.sources src on src.url = $s$https://cpw.state.co.us/sites/default/files/dam/ifgylu070o/final_bgss2025-2029.pdf$s$
where st.code = 'CO';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2026, 'firearm', $s$Concurrent Rifle$s$, DATE '2026-10-14', DATE '2026-11-22', $s$Add-on with rifle deer/elk license or OTC bear-only rifle; valid only during open rifle deer/elk seasons$s$, $s$Concurrent with the four rifle seasons (Oct 14-18, Oct 24-Nov 1, Nov 7-15, Nov 18-22); no hunting during breaks. Separate plains rifle bear runs Sep 2-Nov 22.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'bear'
join public.zones z on z.state_id = st.id and z.name = $s$Statewide$s$
left join public.sources src on src.url = $s$https://cpw.state.co.us/sites/default/files/dam/ifgylu070o/final_bgss2025-2029.pdf$s$
where st.code = 'CO';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2026, 'general', NULL, NULL, NULL, NULL, $s$TODO: 2026-27 Colorado duck dates not yet published (CPW Small Game & Waterfowl brochure due Aug 2026). Set by zone (Mountain/Foothills, Northeast, Southeast) under federal flyway frameworks.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'duck'
join public.zones z on z.state_id = st.id and z.name = $s$Statewide$s$
left join public.sources src on src.url = $s$https://cpw.state.co.us/activities/hunting/waterfowl-hunting$s$
where st.code = 'CO';

insert into public.application_windows (state_id, species_id, zone_id, season_year, name, opens_at, closes_at, results_expected_at, fee_summary, application_url, source_id, status)
select st.id, sp.id, NULL, 2026, $s$Primary Draw$s$, DATE '2026-03-01', DATE '2026-04-07', NULL, $s$App fee $8.93 res / $11.49 nonres per species; $12.76 Habitat Stamp; qualifying license required. Closes Apr 7 at 8:00 p.m. MT. TODO: results date not published on official page.$s$, $s$https://www.cpwshop.com/$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'elk'
left join public.sources src on src.url = $s$https://cpw.state.co.us/activities/hunting/big-game/primary-draw$s$
where st.code = 'CO';
insert into public.application_windows (state_id, species_id, zone_id, season_year, name, opens_at, closes_at, results_expected_at, fee_summary, application_url, source_id, status)
select st.id, sp.id, NULL, 2026, $s$Secondary Draw$s$, DATE '2026-06-18', DATE '2026-06-30', NULL, $s$Leftover licenses; closes Jun 30 at 8:00 p.m. MT. Payment deadline Jul 21, 2026; licenses mailed Jul 27, 2026.$s$, $s$https://www.cpwshop.com/$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'elk'
left join public.sources src on src.url = $s$https://cpw.state.co.us/activities/hunting/big-game/secondary-draw$s$
where st.code = 'CO';
insert into public.application_windows (state_id, species_id, zone_id, season_year, name, opens_at, closes_at, results_expected_at, fee_summary, application_url, source_id, status)
select st.id, sp.id, NULL, 2026, $s$Primary Draw$s$, DATE '2026-03-01', DATE '2026-04-07', NULL, $s$App fee $8.93 res / $11.49 nonres per species; $12.76 Habitat Stamp; qualifying license required. Closes Apr 7 at 8:00 p.m. MT.$s$, $s$https://www.cpwshop.com/$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
left join public.sources src on src.url = $s$https://cpw.state.co.us/activities/hunting/big-game/primary-draw$s$
where st.code = 'CO';
insert into public.application_windows (state_id, species_id, zone_id, season_year, name, opens_at, closes_at, results_expected_at, fee_summary, application_url, source_id, status)
select st.id, sp.id, NULL, 2026, $s$Primary Draw$s$, DATE '2026-03-01', DATE '2026-04-07', NULL, $s$Limited bear licenses; app fee $8.93 res / $11.49 nonres; $12.76 Habitat Stamp; qualifying license required. Closes Apr 7 at 8:00 p.m. MT.$s$, $s$https://www.cpwshop.com/$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'bear'
left join public.sources src on src.url = $s$https://cpw.state.co.us/activities/hunting/big-game/primary-draw$s$
where st.code = 'CO';

insert into public.regulation_summaries (state_id, species_id, body, source_id, status)
select st.id, sp.id, $s$## License
A valid CO hunting license and any elk permits, tags, or stamps required by the state are needed before hunting.

## Seasons & limits
Elk season dates, legal methods, zones, and bag limits vary. See the season entries in this app and confirm every detail against the official regulations before you hunt.

## Notes
Big-game dates are statewide framework dates from CPW's 2025-2029 Big Game Season Structure. Elk and deer are combined in the four regular rifle seasons (deer optional in 1st & 4th). Eastern-plains deer/elk run a different structure (noted per season). Elk 'limited draw' = the Primary Draw (closes Apr 7, 2026). Duck 2026-27 dates pending (brochure Aug 2026).

_Draft summary — pending review against the official Colorado Parks & Wildlife regulations._$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'elk'
left join public.sources src on src.url = $s$https://cpw.state.co.us/sites/default/files/dam/ifgylu070o/final_bgss2025-2029.pdf$s$
where st.code = 'CO'
  and not exists (
    select 1 from public.regulation_summaries r
    join public.states st2 on st2.code = 'CO'
    join public.species sp2 on sp2.key = 'elk'
    where r.state_id = st2.id and r.species_id = sp2.id
  );
insert into public.regulation_summaries (state_id, species_id, body, source_id, status)
select st.id, sp.id, $s$## License
A valid CO hunting license and any deer permits, tags, or stamps required by the state are needed before hunting.

## Seasons & limits
Deer season dates, legal methods, zones, and bag limits vary. See the season entries in this app and confirm every detail against the official regulations before you hunt.

## Notes
Big-game dates are statewide framework dates from CPW's 2025-2029 Big Game Season Structure. Elk and deer are combined in the four regular rifle seasons (deer optional in 1st & 4th). Eastern-plains deer/elk run a different structure (noted per season). Elk 'limited draw' = the Primary Draw (closes Apr 7, 2026). Duck 2026-27 dates pending (brochure Aug 2026).

_Draft summary — pending review against the official Colorado Parks & Wildlife regulations._$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
left join public.sources src on src.url = $s$https://cpw.state.co.us/sites/default/files/dam/ifgylu070o/final_bgss2025-2029.pdf$s$
where st.code = 'CO'
  and not exists (
    select 1 from public.regulation_summaries r
    join public.states st2 on st2.code = 'CO'
    join public.species sp2 on sp2.key = 'deer'
    where r.state_id = st2.id and r.species_id = sp2.id
  );
insert into public.regulation_summaries (state_id, species_id, body, source_id, status)
select st.id, sp.id, $s$## License
A valid CO hunting license and any bear permits, tags, or stamps required by the state are needed before hunting.

## Seasons & limits
Bear season dates, legal methods, zones, and bag limits vary. See the season entries in this app and confirm every detail against the official regulations before you hunt.

## Notes
Big-game dates are statewide framework dates from CPW's 2025-2029 Big Game Season Structure. Elk and deer are combined in the four regular rifle seasons (deer optional in 1st & 4th). Eastern-plains deer/elk run a different structure (noted per season). Elk 'limited draw' = the Primary Draw (closes Apr 7, 2026). Duck 2026-27 dates pending (brochure Aug 2026).

_Draft summary — pending review against the official Colorado Parks & Wildlife regulations._$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'bear'
left join public.sources src on src.url = $s$https://cpw.state.co.us/sites/default/files/dam/ifgylu070o/final_bgss2025-2029.pdf$s$
where st.code = 'CO'
  and not exists (
    select 1 from public.regulation_summaries r
    join public.states st2 on st2.code = 'CO'
    join public.species sp2 on sp2.key = 'bear'
    where r.state_id = st2.id and r.species_id = sp2.id
  );
insert into public.regulation_summaries (state_id, species_id, body, source_id, status)
select st.id, sp.id, $s$## License
A valid CO hunting license and any duck permits, tags, or stamps required by the state are needed before hunting.

## Seasons & limits
Duck season dates, legal methods, zones, and bag limits vary. See the season entries in this app and confirm every detail against the official regulations before you hunt.

## Notes
Big-game dates are statewide framework dates from CPW's 2025-2029 Big Game Season Structure. Elk and deer are combined in the four regular rifle seasons (deer optional in 1st & 4th). Eastern-plains deer/elk run a different structure (noted per season). Elk 'limited draw' = the Primary Draw (closes Apr 7, 2026). Duck 2026-27 dates pending (brochure Aug 2026).

_Draft summary — pending review against the official Colorado Parks & Wildlife regulations._$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'duck'
left join public.sources src on src.url = $s$https://cpw.state.co.us/sites/default/files/dam/ifgylu070o/final_bgss2025-2029.pdf$s$
where st.code = 'CO'
  and not exists (
    select 1 from public.regulation_summaries r
    join public.states st2 on st2.code = 'CO'
    join public.species sp2 on sp2.key = 'duck'
    where r.state_id = st2.id and r.species_id = sp2.id
  );

-- ===========================================================================
-- GA — Georgia DNR Wildlife Resources Division (license year 2025)
-- ===========================================================================
insert into public.zones (state_id, type, name) select st.id, 'county_group', $s$Northern Zone$s$ from public.states st where st.code = 'GA' on conflict (state_id, name) do nothing;
insert into public.zones (state_id, type, name) select st.id, 'county_group', $s$Central Zone$s$ from public.states st where st.code = 'GA' on conflict (state_id, name) do nothing;
insert into public.zones (state_id, type, name) select st.id, 'county_group', $s$Southern Zone$s$ from public.states st where st.code = 'GA' on conflict (state_id, name) do nothing;
insert into public.sources (agency_name, url, doc_type) select $s$Georgia DNR Wildlife Resources Division$s$, $s$https://georgiawildlife.com/sites/default/files/wrd/pdf/hunting/Season%20Dates%20July%2025-26.pdf$s$, 'pdf' where not exists (select 1 from public.sources where url = $s$https://georgiawildlife.com/sites/default/files/wrd/pdf/hunting/Season%20Dates%20July%2025-26.pdf$s$);
insert into public.sources (agency_name, url, doc_type) select $s$Georgia DNR Wildlife Resources Division$s$, $s$https://georgiawildlife.com/sites/default/files/wrd/pdf/hunting/2025-26%20Migratory%20Bird%20Season%20Dates.pdf$s$, 'pdf' where not exists (select 1 from public.sources where url = $s$https://georgiawildlife.com/sites/default/files/wrd/pdf/hunting/2025-26%20Migratory%20Bird%20Season%20Dates.pdf$s$);

insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2025, 'archery', $s$Archery$s$, DATE '2025-09-13', DATE '2025-10-10', $s$12 per season statewide; max 10 antlerless, max 2 antlered (antler restrictions apply).$s$, $s$Either sex. Buck-only first two weeks in some SW counties. Extended archery in ~30 named counties through Jan 31.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
join public.zones z on z.state_id = st.id and z.name = $s$Statewide$s$
left join public.sources src on src.url = $s$https://georgiawildlife.com/sites/default/files/wrd/pdf/hunting/Season%20Dates%20July%2025-26.pdf$s$
where st.code = 'GA';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2025, 'muzzleloader', $s$Primitive Weapons$s$, DATE '2025-10-11', DATE '2025-10-17', $s$Counts toward the 12-per-season statewide deer limit.$s$, $s$'Primitive Weapons & Youth Only Firearms' week, either sex.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
join public.zones z on z.state_id = st.id and z.name = $s$Statewide$s$
left join public.sources src on src.url = $s$https://georgiawildlife.com/sites/default/files/wrd/pdf/hunting/Season%20Dates%20July%2025-26.pdf$s$
where st.code = 'GA';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2025, 'firearm', $s$Firearms$s$, DATE '2025-10-18', DATE '2026-01-11', $s$Counts toward the 12-per-season statewide deer limit.$s$, $s$Buck-only statewide; either-sex dates vary by county. Extended firearms in 9 SW counties through Jan 15. Firearms deer prohibited in parts of metro Atlanta and Jekyll Island.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
join public.zones z on z.state_id = st.id and z.name = $s$Statewide$s$
left join public.sources src on src.url = $s$https://georgiawildlife.com/sites/default/files/wrd/pdf/hunting/Season%20Dates%20July%2025-26.pdf$s$
where st.code = 'GA';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2025, 'archery', $s$Archery$s$, DATE '2025-09-13', DATE '2025-10-10', $s$2 per season; no more than 1 from the central or southern bear zones.$s$, NULL, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'bear'
join public.zones z on z.state_id = st.id and z.name = $s$Northern Zone$s$
left join public.sources src on src.url = $s$https://georgiawildlife.com/sites/default/files/wrd/pdf/hunting/Season%20Dates%20July%2025-26.pdf$s$
where st.code = 'GA';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2025, 'muzzleloader', $s$Primitive Weapons$s$, DATE '2025-10-11', DATE '2025-10-17', $s$2 per season; no more than 1 from the central or southern bear zones.$s$, $s$Primitive weapons season.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'bear'
join public.zones z on z.state_id = st.id and z.name = $s$Northern Zone$s$
left join public.sources src on src.url = $s$https://georgiawildlife.com/sites/default/files/wrd/pdf/hunting/Season%20Dates%20July%2025-26.pdf$s$
where st.code = 'GA';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2025, 'firearm', $s$Firearms$s$, DATE '2025-10-18', DATE '2026-01-11', $s$2 per season; no more than 1 from the central or southern bear zones.$s$, NULL, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'bear'
join public.zones z on z.state_id = st.id and z.name = $s$Northern Zone$s$
left join public.sources src on src.url = $s$https://georgiawildlife.com/sites/default/files/wrd/pdf/hunting/Season%20Dates%20July%2025-26.pdf$s$
where st.code = 'GA';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2025, 'firearm', $s$Firearms (single day)$s$, DATE '2025-12-20', DATE '2025-12-20', $s$2 per season; no more than 1 from the central or southern bear zones.$s$, $s$Single-day firearms season (Dec 20). PDF notes a possible second day — confirm with DNR.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'bear'
join public.zones z on z.state_id = st.id and z.name = $s$Central Zone$s$
left join public.sources src on src.url = $s$https://georgiawildlife.com/sites/default/files/wrd/pdf/hunting/Season%20Dates%20July%2025-26.pdf$s$
where st.code = 'GA';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2025, 'firearm', $s$Firearms (segments)$s$, DATE '2025-09-18', DATE '2025-10-11', $s$2 per season; no more than 1 from the central or southern bear zones.$s$, $s$NOT continuous — four 3-day segments: Sep 18-20, Sep 25-27, Oct 2-4, Oct 9-11. Span shown covers first and last segments only.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'bear'
join public.zones z on z.state_id = st.id and z.name = $s$Southern Zone$s$
left join public.sources src on src.url = $s$https://georgiawildlife.com/sites/default/files/wrd/pdf/hunting/Season%20Dates%20July%2025-26.pdf$s$
where st.code = 'GA';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2025, 'general', $s$Split 1$s$, DATE '2025-11-22', DATE '2025-11-30', $s$6 ducks/day, 18 in possession; species sublimits apply (2 mallards/1 hen, 1 pintail, 3 wood ducks, 1 scaup, 2 canvasback, 2 redheads).$s$, $s$First of two duck splits (Atlantic Flyway). Youth/military days Nov 15-16.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'duck'
join public.zones z on z.state_id = st.id and z.name = $s$Statewide$s$
left join public.sources src on src.url = $s$https://georgiawildlife.com/sites/default/files/wrd/pdf/hunting/2025-26%20Migratory%20Bird%20Season%20Dates.pdf$s$
where st.code = 'GA';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2025, 'general', $s$Split 2$s$, DATE '2025-12-06', DATE '2026-01-25', $s$6 ducks/day, 18 in possession; species sublimits apply (same as split 1).$s$, $s$Second of two duck splits. Early teal Sep 13-21.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'duck'
join public.zones z on z.state_id = st.id and z.name = $s$Statewide$s$
left join public.sources src on src.url = $s$https://georgiawildlife.com/sites/default/files/wrd/pdf/hunting/2025-26%20Migratory%20Bird%20Season%20Dates.pdf$s$
where st.code = 'GA';


insert into public.regulation_summaries (state_id, species_id, body, source_id, status)
select st.id, sp.id, $s$## License
A valid GA hunting license and any deer permits, tags, or stamps required by the state are needed before hunting.

## Seasons & limits
Deer season dates, legal methods, zones, and bag limits vary. See the season entries in this app and confirm every detail against the official regulations before you hunt.

## Notes
Dates are 2025-26 license year from official Georgia DNR PDFs (2026-27 published only as Publuu flip-books, not machine-verifiable — TODO: seed 2026-27 from those). Deer either-sex firearms dates vary by county; several counties have extended archery/firearms seasons. Bear seasons differ substantially by zone (Central = single day; Southern = four discontinuous 3-day segments). No elk season in Georgia.

_Draft summary — pending review against the official Georgia DNR Wildlife Resources Division regulations._$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
left join public.sources src on src.url = $s$https://georgiawildlife.com/sites/default/files/wrd/pdf/hunting/Season%20Dates%20July%2025-26.pdf$s$
where st.code = 'GA'
  and not exists (
    select 1 from public.regulation_summaries r
    join public.states st2 on st2.code = 'GA'
    join public.species sp2 on sp2.key = 'deer'
    where r.state_id = st2.id and r.species_id = sp2.id
  );
insert into public.regulation_summaries (state_id, species_id, body, source_id, status)
select st.id, sp.id, $s$## License
A valid GA hunting license and any bear permits, tags, or stamps required by the state are needed before hunting.

## Seasons & limits
Bear season dates, legal methods, zones, and bag limits vary. See the season entries in this app and confirm every detail against the official regulations before you hunt.

## Notes
Dates are 2025-26 license year from official Georgia DNR PDFs (2026-27 published only as Publuu flip-books, not machine-verifiable — TODO: seed 2026-27 from those). Deer either-sex firearms dates vary by county; several counties have extended archery/firearms seasons. Bear seasons differ substantially by zone (Central = single day; Southern = four discontinuous 3-day segments). No elk season in Georgia.

_Draft summary — pending review against the official Georgia DNR Wildlife Resources Division regulations._$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'bear'
left join public.sources src on src.url = $s$https://georgiawildlife.com/sites/default/files/wrd/pdf/hunting/Season%20Dates%20July%2025-26.pdf$s$
where st.code = 'GA'
  and not exists (
    select 1 from public.regulation_summaries r
    join public.states st2 on st2.code = 'GA'
    join public.species sp2 on sp2.key = 'bear'
    where r.state_id = st2.id and r.species_id = sp2.id
  );
insert into public.regulation_summaries (state_id, species_id, body, source_id, status)
select st.id, sp.id, $s$## License
A valid GA hunting license and any duck permits, tags, or stamps required by the state are needed before hunting.

## Seasons & limits
Duck season dates, legal methods, zones, and bag limits vary. See the season entries in this app and confirm every detail against the official regulations before you hunt.

## Notes
Dates are 2025-26 license year from official Georgia DNR PDFs (2026-27 published only as Publuu flip-books, not machine-verifiable — TODO: seed 2026-27 from those). Deer either-sex firearms dates vary by county; several counties have extended archery/firearms seasons. Bear seasons differ substantially by zone (Central = single day; Southern = four discontinuous 3-day segments). No elk season in Georgia.

_Draft summary — pending review against the official Georgia DNR Wildlife Resources Division regulations._$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'duck'
left join public.sources src on src.url = $s$https://georgiawildlife.com/sites/default/files/wrd/pdf/hunting/Season%20Dates%20July%2025-26.pdf$s$
where st.code = 'GA'
  and not exists (
    select 1 from public.regulation_summaries r
    join public.states st2 on st2.code = 'GA'
    join public.species sp2 on sp2.key = 'duck'
    where r.state_id = st2.id and r.species_id = sp2.id
  );

-- ===========================================================================
-- MT — Montana Fish, Wildlife & Parks (license year 2026)
-- ===========================================================================
insert into public.zones (state_id, type, name) select st.id, 'flyway_zone', $s$Pacific Flyway$s$ from public.states st where st.code = 'MT' on conflict (state_id, name) do nothing;
insert into public.zones (state_id, type, name) select st.id, 'flyway_zone', $s$Central Flyway Zone 1$s$ from public.states st where st.code = 'MT' on conflict (state_id, name) do nothing;
insert into public.zones (state_id, type, name) select st.id, 'flyway_zone', $s$Central Flyway Zone 2$s$ from public.states st where st.code = 'MT' on conflict (state_id, name) do nothing;
insert into public.sources (agency_name, url, doc_type) select $s$Montana Fish, Wildlife & Parks$s$, $s$https://fwp.mt.gov/binaries/content/assets/fwp/hunt/regulations/2026/2026-season-date-card-5x4.25-final.pdf$s$, 'pdf' where not exists (select 1 from public.sources where url = $s$https://fwp.mt.gov/binaries/content/assets/fwp/hunt/regulations/2026/2026-season-date-card-5x4.25-final.pdf$s$);
insert into public.sources (agency_name, url, doc_type) select $s$Montana Fish, Wildlife & Parks$s$, $s$https://fwp.mt.gov/hunt/seasons$s$, 'webpage' where not exists (select 1 from public.sources where url = $s$https://fwp.mt.gov/hunt/seasons$s$);
insert into public.sources (agency_name, url, doc_type) select $s$Montana Fish, Wildlife & Parks$s$, $s$https://fwp.mt.gov/binaries/content/assets/fwp/hunt/regulations/2026/2026-mig-bird--webless-final-for-web.pdf$s$, 'pdf' where not exists (select 1 from public.sources where url = $s$https://fwp.mt.gov/binaries/content/assets/fwp/hunt/regulations/2026/2026-mig-bird--webless-final-for-web.pdf$s$);
insert into public.sources (agency_name, url, doc_type) select $s$Montana Fish, Wildlife & Parks$s$, $s$https://fwp.mt.gov/buyandapply/hunting-licenses/application-drawing-dates$s$, 'webpage' where not exists (select 1 from public.sources where url = $s$https://fwp.mt.gov/buyandapply/hunting-licenses/application-drawing-dates$s$);

insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2026, 'archery', $s$Archery$s$, DATE '2026-09-05', DATE '2026-10-18', NULL, $s$General deer & elk archery. Backcountry HDs 150, 280, 316 differ (Sep 5-14; HD 316 has no archery-only season).$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'elk'
join public.zones z on z.state_id = st.id and z.name = $s$Statewide$s$
left join public.sources src on src.url = $s$https://fwp.mt.gov/binaries/content/assets/fwp/hunt/regulations/2026/2026-season-date-card-5x4.25-final.pdf$s$
where st.code = 'MT';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2026, 'general', $s$General (rifle)$s$, DATE '2026-10-24', DATE '2026-11-29', NULL, $s$General deer & elk rifle season. Backcountry HDs 150, 280, 316 run Sep 15-Nov 29. Elk shoulder seasons run separately (Aug 15-Feb 15) in select districts.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'elk'
join public.zones z on z.state_id = st.id and z.name = $s$Statewide$s$
left join public.sources src on src.url = $s$https://fwp.mt.gov/binaries/content/assets/fwp/hunt/regulations/2026/2026-season-date-card-5x4.25-final.pdf$s$
where st.code = 'MT';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2026, 'muzzleloader', $s$Heritage$s$, DATE '2026-12-12', DATE '2026-12-20', NULL, $s$Muzzleloader Heritage season for deer & elk (on FWP Hunting Seasons page, not the printed card).$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'elk'
join public.zones z on z.state_id = st.id and z.name = $s$Statewide$s$
left join public.sources src on src.url = $s$https://fwp.mt.gov/hunt/seasons$s$
where st.code = 'MT';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2026, 'archery', $s$Archery$s$, DATE '2026-09-05', DATE '2026-10-18', NULL, $s$General deer & elk archery season.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
join public.zones z on z.state_id = st.id and z.name = $s$Statewide$s$
left join public.sources src on src.url = $s$https://fwp.mt.gov/binaries/content/assets/fwp/hunt/regulations/2026/2026-season-date-card-5x4.25-final.pdf$s$
where st.code = 'MT';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2026, 'general', $s$General (rifle)$s$, DATE '2026-10-24', DATE '2026-11-29', NULL, $s$General deer & elk rifle season.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
join public.zones z on z.state_id = st.id and z.name = $s$Statewide$s$
left join public.sources src on src.url = $s$https://fwp.mt.gov/binaries/content/assets/fwp/hunt/regulations/2026/2026-season-date-card-5x4.25-final.pdf$s$
where st.code = 'MT';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2026, 'general', $s$Youth$s$, DATE '2026-10-15', DATE '2026-10-16', NULL, $s$Youth deer-only season (2-day).$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
join public.zones z on z.state_id = st.id and z.name = $s$Statewide$s$
left join public.sources src on src.url = $s$https://fwp.mt.gov/binaries/content/assets/fwp/hunt/regulations/2026/2026-season-date-card-5x4.25-final.pdf$s$
where st.code = 'MT';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2026, 'muzzleloader', $s$Heritage$s$, DATE '2026-12-12', DATE '2026-12-20', NULL, $s$Muzzleloader Heritage season for deer & elk (on FWP Hunting Seasons page, not the printed card).$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
join public.zones z on z.state_id = st.id and z.name = $s$Statewide$s$
left join public.sources src on src.url = $s$https://fwp.mt.gov/hunt/seasons$s$
where st.code = 'MT';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2026, 'general', $s$Spring$s$, DATE '2026-04-15', DATE '2026-06-15', NULL, $s$Spring black bear. Certain BMUs (e.g. 300, 301, 319, 580) may close early after May 31 if female-harvest threshold reached.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'bear'
join public.zones z on z.state_id = st.id and z.name = $s$Statewide$s$
left join public.sources src on src.url = $s$https://fwp.mt.gov/binaries/content/assets/fwp/hunt/regulations/2026/2026-season-date-card-5x4.25-final.pdf$s$
where st.code = 'MT';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2026, 'archery', $s$Fall archery$s$, DATE '2026-09-05', DATE '2026-09-14', NULL, $s$Fall black bear archery season.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'bear'
join public.zones z on z.state_id = st.id and z.name = $s$Statewide$s$
left join public.sources src on src.url = $s$https://fwp.mt.gov/binaries/content/assets/fwp/hunt/regulations/2026/2026-season-date-card-5x4.25-final.pdf$s$
where st.code = 'MT';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2026, 'general', $s$Fall$s$, DATE '2026-09-15', DATE '2026-11-29', NULL, $s$Fall black bear general season.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'bear'
join public.zones z on z.state_id = st.id and z.name = $s$Statewide$s$
left join public.sources src on src.url = $s$https://fwp.mt.gov/binaries/content/assets/fwp/hunt/regulations/2026/2026-season-date-card-5x4.25-final.pdf$s$
where st.code = 'MT';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2026, 'general', NULL, DATE '2026-10-03', DATE '2027-01-15', $s$7 ducks/mergansers daily; max 2 hen mallards, 3 pintail, 2 redheads, 2 canvasbacks, 2 scaup$s$, $s$Regular season Oct 3-Dec 27 (scaup closes Dec 27); ducks excluding scaup continue Dec 28-Jan 15, 2027. Youth days Sep 26-27.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'duck'
join public.zones z on z.state_id = st.id and z.name = $s$Pacific Flyway$s$
left join public.sources src on src.url = $s$https://fwp.mt.gov/binaries/content/assets/fwp/hunt/regulations/2026/2026-mig-bird--webless-final-for-web.pdf$s$
where st.code = 'MT';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2026, 'general', NULL, DATE '2026-10-03', DATE '2027-01-07', $s$6 ducks/mergansers daily; max 5 mallards (2 hens), 3 wood ducks, 3 pintail, 2 canvasbacks, 1 scaup; +2 blue-winged teal Oct 3-11$s$, $s$Zone 1 = northeastern/central counties (Blaine, Valley, Phillips, Fergus, etc.). Youth days Sep 26-27.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'duck'
join public.zones z on z.state_id = st.id and z.name = $s$Central Flyway Zone 1$s$
left join public.sources src on src.url = $s$https://fwp.mt.gov/binaries/content/assets/fwp/hunt/regulations/2026/2026-mig-bird--webless-final-for-web.pdf$s$
where st.code = 'MT';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2026, 'general', NULL, DATE '2026-10-03', DATE '2027-01-19', $s$6 ducks/mergansers daily; max 5 mallards (2 hens), 3 wood ducks, 3 pintail, 2 canvasbacks, 1 scaup; +2 blue-winged teal Oct 3-11$s$, $s$SPLIT: open Oct 3-11, closed, reopens Oct 24-Jan 19, 2027. Zone 2 = south-central counties (Yellowstone, Big Horn, Carbon, etc.). Youth days Sep 26-27.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'duck'
join public.zones z on z.state_id = st.id and z.name = $s$Central Flyway Zone 2$s$
left join public.sources src on src.url = $s$https://fwp.mt.gov/binaries/content/assets/fwp/hunt/regulations/2026/2026-mig-bird--webless-final-for-web.pdf$s$
where st.code = 'MT';

insert into public.application_windows (state_id, species_id, zone_id, season_year, name, opens_at, closes_at, results_expected_at, fee_summary, application_url, source_id, status)
select st.id, sp.id, NULL, 2026, $s$Elk Permit (special permit draw)$s$, DATE '2026-03-01', DATE '2026-04-01', NULL, $s$Elk permit application fee $9; base hunting license required separately. Opens Mar 1 5am MST; deadline Apr 1 11:45pm MST. Drawing mid-April (no exact date published).$s$, $s$https://ols.fwp.mt.gov$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'elk'
left join public.sources src on src.url = $s$https://fwp.mt.gov/buyandapply/hunting-licenses/application-drawing-dates$s$
where st.code = 'MT';
insert into public.application_windows (state_id, species_id, zone_id, season_year, name, opens_at, closes_at, results_expected_at, fee_summary, application_url, source_id, status)
select st.id, sp.id, NULL, 2026, $s$Elk B License Draw$s$, DATE '2026-03-01', DATE '2026-06-01', NULL, $s$Deadline Jun 1 11:45pm MST. Drawing mid-June (no exact date published).$s$, $s$https://ols.fwp.mt.gov$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'elk'
left join public.sources src on src.url = $s$https://fwp.mt.gov/buyandapply/hunting-licenses/application-drawing-dates$s$
where st.code = 'MT';
insert into public.application_windows (state_id, species_id, zone_id, season_year, name, opens_at, closes_at, results_expected_at, fee_summary, application_url, source_id, status)
select st.id, sp.id, NULL, 2026, $s$Deer Permit (special permit draw)$s$, DATE '2026-03-01', DATE '2026-04-01', NULL, $s$Opens Mar 1 5am MST; deadline Apr 1 11:45pm MST. Drawing mid-April (no exact date published).$s$, $s$https://ols.fwp.mt.gov$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
left join public.sources src on src.url = $s$https://fwp.mt.gov/buyandapply/hunting-licenses/application-drawing-dates$s$
where st.code = 'MT';
insert into public.application_windows (state_id, species_id, zone_id, season_year, name, opens_at, closes_at, results_expected_at, fee_summary, application_url, source_id, status)
select st.id, sp.id, NULL, 2026, $s$Deer B License Draw$s$, DATE '2026-03-01', DATE '2026-06-01', NULL, $s$Deadline Jun 1 11:45pm MST. Drawing mid-June (no exact date published).$s$, $s$https://ols.fwp.mt.gov$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
left join public.sources src on src.url = $s$https://fwp.mt.gov/buyandapply/hunting-licenses/application-drawing-dates$s$
where st.code = 'MT';
insert into public.application_windows (state_id, species_id, zone_id, season_year, name, opens_at, closes_at, results_expected_at, fee_summary, application_url, source_id, status)
select st.id, sp.id, NULL, 2026, $s$Black Bear License$s$, DATE '2026-03-01', DATE '2026-04-01', NULL, $s$Deadline Apr 1 11:45pm MST. Drawing date TBD.$s$, $s$https://ols.fwp.mt.gov$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'bear'
left join public.sources src on src.url = $s$https://fwp.mt.gov/buyandapply/hunting-licenses/application-drawing-dates$s$
where st.code = 'MT';

insert into public.regulation_summaries (state_id, species_id, body, source_id, status)
select st.id, sp.id, $s$## License
A valid MT hunting license and any elk permits, tags, or stamps required by the state are needed before hunting.

## Seasons & limits
Elk season dates, legal methods, zones, and bag limits vary. See the season entries in this app and confirm every detail against the official regulations before you hunt.

## Notes
2026 dates from official FWP 2026 Season Date Card + 2026 Migratory Bird regulations (Commission-adopted 4/17/2026). Elk & deer share archery (Sep 5-Oct 18) and general rifle (Oct 24-Nov 29); muzzleloader Heritage Dec 12-20. Montana spans Pacific & Central flyways; Central split into Zone 1 and Zone 2 (Zone 2 has a split season). Draw results dates published only as approximate windows, so left null.

_Draft summary — pending review against the official Montana Fish, Wildlife & Parks regulations._$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'elk'
left join public.sources src on src.url = $s$https://fwp.mt.gov/binaries/content/assets/fwp/hunt/regulations/2026/2026-season-date-card-5x4.25-final.pdf$s$
where st.code = 'MT'
  and not exists (
    select 1 from public.regulation_summaries r
    join public.states st2 on st2.code = 'MT'
    join public.species sp2 on sp2.key = 'elk'
    where r.state_id = st2.id and r.species_id = sp2.id
  );
insert into public.regulation_summaries (state_id, species_id, body, source_id, status)
select st.id, sp.id, $s$## License
A valid MT hunting license and any deer permits, tags, or stamps required by the state are needed before hunting.

## Seasons & limits
Deer season dates, legal methods, zones, and bag limits vary. See the season entries in this app and confirm every detail against the official regulations before you hunt.

## Notes
2026 dates from official FWP 2026 Season Date Card + 2026 Migratory Bird regulations (Commission-adopted 4/17/2026). Elk & deer share archery (Sep 5-Oct 18) and general rifle (Oct 24-Nov 29); muzzleloader Heritage Dec 12-20. Montana spans Pacific & Central flyways; Central split into Zone 1 and Zone 2 (Zone 2 has a split season). Draw results dates published only as approximate windows, so left null.

_Draft summary — pending review against the official Montana Fish, Wildlife & Parks regulations._$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
left join public.sources src on src.url = $s$https://fwp.mt.gov/binaries/content/assets/fwp/hunt/regulations/2026/2026-season-date-card-5x4.25-final.pdf$s$
where st.code = 'MT'
  and not exists (
    select 1 from public.regulation_summaries r
    join public.states st2 on st2.code = 'MT'
    join public.species sp2 on sp2.key = 'deer'
    where r.state_id = st2.id and r.species_id = sp2.id
  );
insert into public.regulation_summaries (state_id, species_id, body, source_id, status)
select st.id, sp.id, $s$## License
A valid MT hunting license and any bear permits, tags, or stamps required by the state are needed before hunting.

## Seasons & limits
Bear season dates, legal methods, zones, and bag limits vary. See the season entries in this app and confirm every detail against the official regulations before you hunt.

## Notes
2026 dates from official FWP 2026 Season Date Card + 2026 Migratory Bird regulations (Commission-adopted 4/17/2026). Elk & deer share archery (Sep 5-Oct 18) and general rifle (Oct 24-Nov 29); muzzleloader Heritage Dec 12-20. Montana spans Pacific & Central flyways; Central split into Zone 1 and Zone 2 (Zone 2 has a split season). Draw results dates published only as approximate windows, so left null.

_Draft summary — pending review against the official Montana Fish, Wildlife & Parks regulations._$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'bear'
left join public.sources src on src.url = $s$https://fwp.mt.gov/binaries/content/assets/fwp/hunt/regulations/2026/2026-season-date-card-5x4.25-final.pdf$s$
where st.code = 'MT'
  and not exists (
    select 1 from public.regulation_summaries r
    join public.states st2 on st2.code = 'MT'
    join public.species sp2 on sp2.key = 'bear'
    where r.state_id = st2.id and r.species_id = sp2.id
  );
insert into public.regulation_summaries (state_id, species_id, body, source_id, status)
select st.id, sp.id, $s$## License
A valid MT hunting license and any duck permits, tags, or stamps required by the state are needed before hunting.

## Seasons & limits
Duck season dates, legal methods, zones, and bag limits vary. See the season entries in this app and confirm every detail against the official regulations before you hunt.

## Notes
2026 dates from official FWP 2026 Season Date Card + 2026 Migratory Bird regulations (Commission-adopted 4/17/2026). Elk & deer share archery (Sep 5-Oct 18) and general rifle (Oct 24-Nov 29); muzzleloader Heritage Dec 12-20. Montana spans Pacific & Central flyways; Central split into Zone 1 and Zone 2 (Zone 2 has a split season). Draw results dates published only as approximate windows, so left null.

_Draft summary — pending review against the official Montana Fish, Wildlife & Parks regulations._$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'duck'
left join public.sources src on src.url = $s$https://fwp.mt.gov/binaries/content/assets/fwp/hunt/regulations/2026/2026-season-date-card-5x4.25-final.pdf$s$
where st.code = 'MT'
  and not exists (
    select 1 from public.regulation_summaries r
    join public.states st2 on st2.code = 'MT'
    join public.species sp2 on sp2.key = 'duck'
    where r.state_id = st2.id and r.species_id = sp2.id
  );

-- ===========================================================================
-- WY — Wyoming Game & Fish Department (license year 2026)
-- ===========================================================================
insert into public.zones (state_id, type, name) select st.id, 'flyway_zone', $s$Pacific Flyway$s$ from public.states st where st.code = 'WY' on conflict (state_id, name) do nothing;
insert into public.zones (state_id, type, name) select st.id, 'flyway_zone', $s$Central Flyway Zone C1$s$ from public.states st where st.code = 'WY' on conflict (state_id, name) do nothing;
insert into public.zones (state_id, type, name) select st.id, 'flyway_zone', $s$Central Flyway Zone C2$s$ from public.states st where st.code = 'WY' on conflict (state_id, name) do nothing;
insert into public.sources (agency_name, url, doc_type) select $s$Wyoming Game & Fish Department$s$, $s$https://wgfd.wyo.gov/media/33695/download?inline=$s$, 'webpage' where not exists (select 1 from public.sources where url = $s$https://wgfd.wyo.gov/media/33695/download?inline=$s$);
insert into public.sources (agency_name, url, doc_type) select $s$Wyoming Game & Fish Department$s$, $s$https://wgfd.wyo.gov/media/33694/download?inline=$s$, 'webpage' where not exists (select 1 from public.sources where url = $s$https://wgfd.wyo.gov/media/33694/download?inline=$s$);
insert into public.sources (agency_name, url, doc_type) select $s$Wyoming Game & Fish Department$s$, $s$https://wgfd.wyo.gov/media/33578/download?inline=$s$, 'webpage' where not exists (select 1 from public.sources where url = $s$https://wgfd.wyo.gov/media/33578/download?inline=$s$);
insert into public.sources (agency_name, url, doc_type) select $s$Wyoming Game & Fish Department$s$, $s$https://wgfd.wyo.gov/media/32327/download?inline=$s$, 'webpage' where not exists (select 1 from public.sources where url = $s$https://wgfd.wyo.gov/media/32327/download?inline=$s$);
insert into public.sources (agency_name, url, doc_type) select $s$Wyoming Game & Fish Department$s$, $s$https://wgfd.wyo.gov/media/31721/download?inline=$s$, 'webpage' where not exists (select 1 from public.sources where url = $s$https://wgfd.wyo.gov/media/31721/download?inline=$s$);
insert into public.sources (agency_name, url, doc_type) select $s$Wyoming Game & Fish Department$s$, $s$https://wgfd.wyo.gov/licenses-applications/application-dates-deadlines$s$, 'webpage' where not exists (select 1 from public.sources where url = $s$https://wgfd.wyo.gov/licenses-applications/application-dates-deadlines$s$);

insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2026, 'archery', $s$Special Archery$s$, DATE '2026-09-01', DATE '2026-09-30', NULL, $s$Special archery runs Sep 1-30 in most hunt areas (2026 Chapter 7); some areas differ (Sep 1-14, Sep 15-30, Sep 20-30). Requires elk license + archery license. Dates vary by hunt area — see WGFD Hunt Planner.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'elk'
join public.zones z on z.state_id = st.id and z.name = $s$Statewide$s$
left join public.sources src on src.url = $s$https://wgfd.wyo.gov/media/33695/download?inline=$s$
where st.code = 'WY';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2026, 'general', $s$General (rifle)$s$, NULL, NULL, NULL, $s$TODO: No statewide date — 2026 regular firearm elk seasons are set per hunt area (openers incl. Oct 1, Oct 15, Oct 25, Nov 1, Dec 1; closers Oct 20-Jan 31). Exact per-area dates in the regulation PDF and Hunt Planner.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'elk'
join public.zones z on z.state_id = st.id and z.name = $s$Statewide$s$
left join public.sources src on src.url = $s$https://wgfd.wyo.gov/media/33695/download?inline=$s$
where st.code = 'WY';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2026, 'archery', $s$Special Archery$s$, DATE '2026-09-01', DATE '2026-09-30', NULL, $s$Special archery Sep 1-30 in most general hunt areas (2026 Chapter 6); a few areas vary. Requires deer license + archery license.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
join public.zones z on z.state_id = st.id and z.name = $s$Statewide$s$
left join public.sources src on src.url = $s$https://wgfd.wyo.gov/media/33694/download?inline=$s$
where st.code = 'WY';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2026, 'general', $s$General (rifle)$s$, NULL, NULL, NULL, $s$TODO: No statewide date — 2026 regular deer seasons set per hunt area (common frameworks Oct 1-15 with Oct 16-Nov 30 continuation, or Nov 1-20). Exact per-area dates in the regulation PDF and Hunt Planner.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
join public.zones z on z.state_id = st.id and z.name = $s$Statewide$s$
left join public.sources src on src.url = $s$https://wgfd.wyo.gov/media/33694/download?inline=$s$
where st.code = 'WY';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2026, 'general', $s$Spring$s$, NULL, NULL, $s$Any black bear except dependent young and females with dependent young; managed by female mortality limits.$s$, $s$TODO: No statewide date — 2026 spring seasons vary by hunt area (openers Apr 15, May 1, May 15; most close Jun 15). Areas close early when female mortality quota is met (call 1-800-264-1280). Spring 2026 has already ended relative to today.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'bear'
join public.zones z on z.state_id = st.id and z.name = $s$Statewide$s$
left join public.sources src on src.url = $s$https://wgfd.wyo.gov/media/33578/download?inline=$s$
where st.code = 'WY';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2026, 'general', $s$Fall$s$, NULL, NULL, $s$Any black bear except dependent young and females with dependent young; managed by female mortality limits.$s$, $s$TODO: No statewide date — 2026 fall seasons vary by hunt area (frameworks incl. Sep 1-Oct 31, Sep 1-Nov 15, Aug 15-Oct 31, Oct 1-Oct 31). Areas close early when female mortality quota is met. Special archery seasons also exist per area.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'bear'
join public.zones z on z.state_id = st.id and z.name = $s$Statewide$s$
left join public.sources src on src.url = $s$https://wgfd.wyo.gov/media/33578/download?inline=$s$
where st.code = 'WY';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2025, 'general', NULL, DATE '2025-09-27', DATE '2026-01-09', $s$7 ducks/mergansers daily (max 2 hen mallard, 1 pintail, 2 canvasback, 2 redhead, 2 scaup; no scaup after Dec 21); 21 possession$s$, $s$West of the Continental Divide. These are 2025-26 dates — 2026-27 Wyoming migratory bird seasons were not yet published as of Jul 2026. TODO: update for 2026-27.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'duck'
join public.zones z on z.state_id = st.id and z.name = $s$Pacific Flyway$s$
left join public.sources src on src.url = $s$https://wgfd.wyo.gov/media/32327/download?inline=$s$
where st.code = 'WY';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2025, 'general', NULL, DATE '2025-09-27', DATE '2026-01-18', $s$6 ducks/mergansers daily; 18 possession$s$, $s$2025-26 split: Sep 27-Oct 14 and Nov 1-Jan 18. Zone C1 = Big Horn, Converse, Hot Springs, Natrona, Park, Washakie, part of Fremont. TODO: update for 2026-27.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'duck'
join public.zones z on z.state_id = st.id and z.name = $s$Central Flyway Zone C1$s$
left join public.sources src on src.url = $s$https://wgfd.wyo.gov/media/32327/download?inline=$s$
where st.code = 'WY';
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2025, 'general', NULL, DATE '2025-09-27', DATE '2026-01-12', $s$6 ducks/mergansers daily; 18 possession$s$, $s$2025-26 split: Sep 27-Dec 1 and Dec 13-Jan 12. Zone C2 = Albany, Campbell, Crook, Johnson, Laramie, Niobrara, Sheridan, Weston, part of Carbon. Zone C1A (Goshen, Platte) is separate. TODO: update for 2026-27.$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'duck'
join public.zones z on z.state_id = st.id and z.name = $s$Central Flyway Zone C2$s$
left join public.sources src on src.url = $s$https://wgfd.wyo.gov/media/32327/download?inline=$s$
where st.code = 'WY';

insert into public.application_windows (state_id, species_id, zone_id, season_year, name, opens_at, closes_at, results_expected_at, fee_summary, application_url, source_id, status)
select st.id, sp.id, NULL, 2026, $s$Nonresident Elk Draw (Full Price)$s$, DATE '2026-01-02', DATE '2026-02-02', DATE '2026-05-21', $s$Nonresident full-price elk ~$707; Special (40% set-aside) ~$1,965; reduced-price cow/calf ~$303 (youth $115). 2026 fee schedule; excludes processing fee. Verify against official brochure before publishing.$s$, $s$https://wgfd.wyo.gov/licenses-applications$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'elk'
left join public.sources src on src.url = $s$https://wgfd.wyo.gov/media/31721/download?inline=$s$
where st.code = 'WY';
insert into public.application_windows (state_id, species_id, zone_id, season_year, name, opens_at, closes_at, results_expected_at, fee_summary, application_url, source_id, status)
select st.id, sp.id, NULL, 2026, $s$Resident Elk Draw (limited quota)$s$, DATE '2026-01-02', DATE '2026-06-01', DATE '2026-06-18', $s$Resident limited-quota elk; resident general elk licenses sold OTC beginning Jul 16, 2026.$s$, $s$https://wgfd.wyo.gov/licenses-applications$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'elk'
left join public.sources src on src.url = $s$https://wgfd.wyo.gov/licenses-applications/application-dates-deadlines$s$
where st.code = 'WY';
insert into public.application_windows (state_id, species_id, zone_id, season_year, name, opens_at, closes_at, results_expected_at, fee_summary, application_url, source_id, status)
select st.id, sp.id, NULL, 2026, $s$Nonresident Deer Draw (Full Price)$s$, DATE '2026-01-02', DATE '2026-06-01', DATE '2026-06-18', $s$Nonresident full-price deer ~$389; Special (40% set-aside) ~$1,215; reduced-price doe/fawn ~$49/$34. 2026 fee schedule; excludes processing fee. Verify against official brochure before publishing.$s$, $s$https://wgfd.wyo.gov/licenses-applications$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
left join public.sources src on src.url = $s$https://wgfd.wyo.gov/media/31721/download?inline=$s$
where st.code = 'WY';
insert into public.application_windows (state_id, species_id, zone_id, season_year, name, opens_at, closes_at, results_expected_at, fee_summary, application_url, source_id, status)
select st.id, sp.id, NULL, 2026, $s$Resident Deer Draw (limited quota)$s$, DATE '2026-01-02', DATE '2026-06-01', DATE '2026-06-18', $s$Resident limited-quota deer; resident general deer licenses sold OTC beginning Jul 16, 2026.$s$, $s$https://wgfd.wyo.gov/licenses-applications$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
left join public.sources src on src.url = $s$https://wgfd.wyo.gov/licenses-applications/application-dates-deadlines$s$
where st.code = 'WY';

insert into public.regulation_summaries (state_id, species_id, body, source_id, status)
select st.id, sp.id, $s$## License
A valid WY hunting license and any elk permits, tags, or stamps required by the state are needed before hunting.

## Seasons & limits
Elk season dates, legal methods, zones, and bag limits vary. See the season entries in this app and confirm every detail against the official regulations before you hunt.

## Notes
Wyoming big-game seasons are set individually per hunt area — there is NO statewide general/regular season date for elk, deer, or bear, so those are null by design; only the Sep 1-30 special archery framework is consistent enough to report. Exact per-area dates live in the regulation PDFs and the WGFD Hunt Planner. Elk = 2026 Ch. 7, Deer = 2026 Ch. 6, Black Bear = 2026 Ch. 3. Duck reported is the most recent published 2025-26 (2026-27 not yet set). Nonresident fees read from the 2026 fee schedule — verify before publishing. Black bear is a general license (not a classic quota draw).

_Draft summary — pending review against the official Wyoming Game & Fish Department regulations._$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'elk'
left join public.sources src on src.url = $s$https://wgfd.wyo.gov/media/33695/download?inline=$s$
where st.code = 'WY'
  and not exists (
    select 1 from public.regulation_summaries r
    join public.states st2 on st2.code = 'WY'
    join public.species sp2 on sp2.key = 'elk'
    where r.state_id = st2.id and r.species_id = sp2.id
  );
insert into public.regulation_summaries (state_id, species_id, body, source_id, status)
select st.id, sp.id, $s$## License
A valid WY hunting license and any deer permits, tags, or stamps required by the state are needed before hunting.

## Seasons & limits
Deer season dates, legal methods, zones, and bag limits vary. See the season entries in this app and confirm every detail against the official regulations before you hunt.

## Notes
Wyoming big-game seasons are set individually per hunt area — there is NO statewide general/regular season date for elk, deer, or bear, so those are null by design; only the Sep 1-30 special archery framework is consistent enough to report. Exact per-area dates live in the regulation PDFs and the WGFD Hunt Planner. Elk = 2026 Ch. 7, Deer = 2026 Ch. 6, Black Bear = 2026 Ch. 3. Duck reported is the most recent published 2025-26 (2026-27 not yet set). Nonresident fees read from the 2026 fee schedule — verify before publishing. Black bear is a general license (not a classic quota draw).

_Draft summary — pending review against the official Wyoming Game & Fish Department regulations._$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'deer'
left join public.sources src on src.url = $s$https://wgfd.wyo.gov/media/33695/download?inline=$s$
where st.code = 'WY'
  and not exists (
    select 1 from public.regulation_summaries r
    join public.states st2 on st2.code = 'WY'
    join public.species sp2 on sp2.key = 'deer'
    where r.state_id = st2.id and r.species_id = sp2.id
  );
insert into public.regulation_summaries (state_id, species_id, body, source_id, status)
select st.id, sp.id, $s$## License
A valid WY hunting license and any bear permits, tags, or stamps required by the state are needed before hunting.

## Seasons & limits
Bear season dates, legal methods, zones, and bag limits vary. See the season entries in this app and confirm every detail against the official regulations before you hunt.

## Notes
Wyoming big-game seasons are set individually per hunt area — there is NO statewide general/regular season date for elk, deer, or bear, so those are null by design; only the Sep 1-30 special archery framework is consistent enough to report. Exact per-area dates live in the regulation PDFs and the WGFD Hunt Planner. Elk = 2026 Ch. 7, Deer = 2026 Ch. 6, Black Bear = 2026 Ch. 3. Duck reported is the most recent published 2025-26 (2026-27 not yet set). Nonresident fees read from the 2026 fee schedule — verify before publishing. Black bear is a general license (not a classic quota draw).

_Draft summary — pending review against the official Wyoming Game & Fish Department regulations._$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'bear'
left join public.sources src on src.url = $s$https://wgfd.wyo.gov/media/33695/download?inline=$s$
where st.code = 'WY'
  and not exists (
    select 1 from public.regulation_summaries r
    join public.states st2 on st2.code = 'WY'
    join public.species sp2 on sp2.key = 'bear'
    where r.state_id = st2.id and r.species_id = sp2.id
  );
insert into public.regulation_summaries (state_id, species_id, body, source_id, status)
select st.id, sp.id, $s$## License
A valid WY hunting license and any duck permits, tags, or stamps required by the state are needed before hunting.

## Seasons & limits
Duck season dates, legal methods, zones, and bag limits vary. See the season entries in this app and confirm every detail against the official regulations before you hunt.

## Notes
Wyoming big-game seasons are set individually per hunt area — there is NO statewide general/regular season date for elk, deer, or bear, so those are null by design; only the Sep 1-30 special archery framework is consistent enough to report. Exact per-area dates live in the regulation PDFs and the WGFD Hunt Planner. Elk = 2026 Ch. 7, Deer = 2026 Ch. 6, Black Bear = 2026 Ch. 3. Duck reported is the most recent published 2025-26 (2026-27 not yet set). Nonresident fees read from the 2026 fee schedule — verify before publishing. Black bear is a general license (not a classic quota draw).

_Draft summary — pending review against the official Wyoming Game & Fish Department regulations._$s$, src.id, 'draft'
from public.states st
join public.species sp on sp.key = 'duck'
left join public.sources src on src.url = $s$https://wgfd.wyo.gov/media/33695/download?inline=$s$
where st.code = 'WY'
  and not exists (
    select 1 from public.regulation_summaries r
    join public.states st2 on st2.code = 'WY'
    join public.species sp2 on sp2.key = 'duck'
    where r.state_id = st2.id and r.species_id = sp2.id
  );

