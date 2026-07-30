-- 20260730130000_ga_chattahoochee_bear.sql
-- Chattahoochee & Chestatee WMAs bear firearms hunt, Sep 26 - Oct 2, 2026
-- (26GAAB guide, WMA listings pages 35-36). No quota — sign-in hunt.
--
-- Scope rule refined with David (2026-07-30): per-WMA season dates are still
-- excluded when they merely echo statewide seasons, but WMA hunts that fall
-- OUTSIDE the statewide envelope are included — this one opens 3 weeks before
-- any statewide bear firearms season (Northern Zone opens Oct 17).

with ga as (
  select id from public.states where code = 'GA'
)
insert into public.zones (state_id, name, type, notes)
select ga.id, 'Chattahoochee & Chestatee WMAs', 'county_group',
  'Two north-Georgia WMAs on US Forest Service land; hunts listed in the WMA section of the state guide.'
from ga
where not exists (
  select 1 from public.zones z
  where z.state_id = ga.id and z.name = 'Chattahoochee & Chestatee WMAs'
);

with ga as (
  select id from public.states where code = 'GA'
),
src as (
  select id from public.sources
  where url = 'https://www.eregulations.com/assets/docs/resources/GA/26GAAB-LR.pdf'
)
insert into public.seasons
  (state_id, species_id, zone_id, season_year, method, label, open_date, close_date,
   bag_limit_summary, notes, source_id, last_verified_at, status)
select
  ga.id,
  sp.id,
  z.id,
  2026,
  'firearm'::season_method,
  'WMA Firearms (no quota)',
  date '2026-09-26',
  date '2026-10-02',
  'Statewide bear limits apply (2 per season; see zone rules).',
  'Open sign-in hunt on Chattahoochee & Chestatee WMAs — opens 3 weeks before the statewide Northern Zone firearms season. US Forest Service land; no ATVs/UTVs. The separate Oct 3-11 dog-bear hunt on these WMAs requires the quota draw (apply by Aug 15).',
  src.id,
  now(),
  'published'
from ga
cross join src
join public.species sp on sp.key = 'bear'
join public.zones z on z.state_id = ga.id and z.name = 'Chattahoochee & Chestatee WMAs'
where not exists (
  select 1 from public.seasons s
  where s.state_id = ga.id
    and s.species_id = sp.id
    and s.zone_id = z.id
    and s.method = 'firearm'
    and s.season_year = 2026
    and coalesce(s.label, '') = 'WMA Firearms (no quota)'
);
