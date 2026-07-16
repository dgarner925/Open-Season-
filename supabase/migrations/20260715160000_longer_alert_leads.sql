-- 20260715160000_longer_alert_leads.sql
-- Alert reminders were capped at 30 days out (the check constraint only allowed
-- 1/3/7/14/30). Hunters plan draws and trips far ahead, so extend the cadence
-- ladder up to a full year, bump the defaults, and pull existing follows up to
-- the longer leads too.

alter table public.alert_preferences drop constraint if exists opener_offsets_allowed;
alter table public.alert_preferences drop constraint if exists deadline_offsets_allowed;
alter table public.alert_preferences
  add constraint opener_offsets_allowed
  check (opener_offsets <@ array[1,3,7,14,30,60,90,180,365]::smallint[]);
alter table public.alert_preferences
  add constraint deadline_offsets_allowed
  check (deadline_offsets <@ array[1,3,7,14,30,60,90,180,365]::smallint[]);

-- Longer defaults for follows created from here on.
alter table public.alert_preferences alter column opener_offsets   set default '{365,30,7,1}';
alter table public.alert_preferences alter column deadline_offsets set default '{365,90,30,7,1}';

-- Extend existing preferences so current follows also reach out a year (union in
-- the long leads; keep whatever cadences the user already had).
update public.alert_preferences
set opener_offsets = (
  select array_agg(distinct v order by v desc)
  from unnest(opener_offsets || array[365]::smallint[]) as v
);
update public.alert_preferences
set deadline_offsets = (
  select array_agg(distinct v order by v desc)
  from unnest(deadline_offsets || array[365, 90]::smallint[]) as v
);
