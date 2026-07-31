-- 20260731153000_tn_elk_dedupe.sql
-- Two fixes:
-- 1. application_windows never had a notes column (seasons does), so the
--    context notes written in the GA/SE quota migrations silently didn't land.
--    Add the column; the window-detail screen can render it in a future build.
-- 2. Wave-1 SE added 'Elk Quota Hunt' (TN) unaware an extractor-created
--    'Elk Quota Permit Draw' already covered the same Feb 4-25, 2026 draw under
--    a different name. Keep the original row, enrich it, drop the duplicate.

alter table public.application_windows add column if not exists notes text;

with tn as (select id from public.states where code = 'TN'),
elk as (select id from public.species where key = 'elk')
update public.application_windows a
set notes = '2026 application period has closed (runs each February). 19 permits for Elk Hunt Zones on North Cumberland WMA and nearby private lands; individual applications only, up to 4 zone choices.',
    application_url = coalesce(a.application_url, 'https://gooutdoorstennessee.com/'),
    last_verified_at = now()
from tn, elk
where a.state_id = tn.id and a.species_id = elk.id
  and a.season_year = 2026 and a.name = 'Elk Quota Permit Draw';

with tn as (select id from public.states where code = 'TN'),
elk as (select id from public.species where key = 'elk')
delete from public.application_windows a
using tn, elk
where a.state_id = tn.id and a.species_id = elk.id
  and a.season_year = 2026 and a.name = 'Elk Quota Hunt';
