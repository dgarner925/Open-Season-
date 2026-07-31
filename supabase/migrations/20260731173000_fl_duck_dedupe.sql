-- 20260731173000_fl_duck_dedupe.sql
-- Wave 2 added a generic 'Early Duck Permits Phase I' (FL) that duplicates the
-- extractor's more precise 'September Special Early Season - Phase I' (same
-- draw, same Jul 31 - Aug 10 window). Keep the precise pre-existing row.

with fl as (select id from public.states where code = 'FL'),
duck as (select id from public.species where key = 'duck')
delete from public.application_windows a
using fl, duck
where a.state_id = fl.id and a.species_id = duck.id
  and a.season_year = 2026 and a.name = 'Early Duck Permits Phase I';
