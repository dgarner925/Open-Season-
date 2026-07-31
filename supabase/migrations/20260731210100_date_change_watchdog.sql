-- 20260731210100_date_change_watchdog.sql
-- The regs watchdog: when a PUBLISHED season or draw date is revised (an agency
-- moves an opener, extends a deadline, shifts a results date), log it and push
-- an alert to everyone following that (state, species) — "the app noticed the
-- change so you don't have to."
--
-- Pieces:
--   1. date_changes — trigger-fed log of real date revisions (old -> new, both
--      non-null; null->value backfills and value->null retractions are ignored,
--      so data loading never spams anyone).
--   2. Triggers on seasons + application_windows.
--   3. notifications_due() gains a 4th branch (subject 'date_change', dedup per
--      change row via sent_notifications) and two routing columns so a tapped
--      push still opens the underlying hunt in the app.

-- ---------------------------------------------------------------------------
-- 1. Change log
-- ---------------------------------------------------------------------------
create table if not exists public.date_changes (
  id            uuid primary key default gen_random_uuid(),
  target_table  text not null check (target_table in ('seasons', 'application_windows')),
  target_id     uuid not null,
  field         text not null,          -- open_date | close_date | closes_at | results_expected_at
  old_date      date not null,
  new_date      date not null,
  created_at    timestamptz not null default now()
);
-- A repeat of the identical transition (extractor re-applying the same diff)
-- must not produce a second alert.
create unique index if not exists date_changes_transition_uniq
  on public.date_changes (target_table, target_id, field, old_date, new_date);

alter table public.date_changes enable row level security;
-- Readable by signed-in users: the app's notification history labels its
-- "date changed" entries from this log. Content is public-reference dates only.
drop policy if exists date_changes_read on public.date_changes;
create policy date_changes_read on public.date_changes
  for select to authenticated using (true);
grant select on public.date_changes to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Triggers
-- ---------------------------------------------------------------------------
create or replace function public.log_season_date_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'published' and new.status = 'published' then
    if old.open_date is not null and new.open_date is not null
       and old.open_date is distinct from new.open_date then
      insert into public.date_changes (target_table, target_id, field, old_date, new_date)
      values ('seasons', new.id, 'open_date', old.open_date, new.open_date)
      on conflict do nothing;
    end if;
    if old.close_date is not null and new.close_date is not null
       and old.close_date is distinct from new.close_date then
      insert into public.date_changes (target_table, target_id, field, old_date, new_date)
      values ('seasons', new.id, 'close_date', old.close_date, new.close_date)
      on conflict do nothing;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists seasons_log_date_change on public.seasons;
create trigger seasons_log_date_change
  after update on public.seasons
  for each row execute function public.log_season_date_change();

create or replace function public.log_window_date_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'published' and new.status = 'published' then
    if old.closes_at is not null and new.closes_at is not null
       and old.closes_at is distinct from new.closes_at then
      insert into public.date_changes (target_table, target_id, field, old_date, new_date)
      values ('application_windows', new.id, 'closes_at', old.closes_at, new.closes_at)
      on conflict do nothing;
    end if;
    if old.results_expected_at is not null and new.results_expected_at is not null
       and old.results_expected_at is distinct from new.results_expected_at then
      insert into public.date_changes (target_table, target_id, field, old_date, new_date)
      values ('application_windows', new.id, 'results_expected_at', old.results_expected_at, new.results_expected_at)
      on conflict do nothing;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists windows_log_date_change on public.application_windows;
create trigger windows_log_date_change
  after update on public.application_windows
  for each row execute function public.log_window_date_change();

-- ---------------------------------------------------------------------------
-- 3. notifications_due(): add the change branch + routing columns.
--    route_type/route_id tell the push where a tap should land (the underlying
--    season/window), independent of the dedup identity (the change row).
-- ---------------------------------------------------------------------------
drop function if exists public.notifications_due();
create or replace function public.notifications_due()
returns table (
  user_id uuid,
  subject_type notification_subject_type,
  subject_id uuid,
  offset_days smallint,
  scheduled_for date,
  title text,
  body text,
  tokens text[],
  route_type text,
  route_id uuid
)
language sql
security definer
set search_path = public
stable
as $$
  -- Season openers
  select
    f.user_id,
    'season_opener'::notification_subject_type,
    s.id,
    off::smallint,
    s.open_date,
    format('%s opens in %s day%s', sp.name, off, case when off = 1 then '' else 's' end),
    format('%s %s (%s) opens %s', st.code, sp.name, s.method, to_char(s.open_date, 'Mon DD')),
    array_agg(distinct dt.token),
    'season_opener',
    s.id
  from public.seasons s
  join public.states st on st.id = s.state_id
  join public.species sp on sp.id = s.species_id
  join public.follows f on f.state_id = s.state_id and f.species_id = s.species_id
  join public.alert_preferences ap on ap.follow_id = f.id
  cross join lateral unnest(ap.opener_offsets) as off
  join public.device_push_tokens dt on dt.user_id = f.user_id
  where s.status = 'published'
    and s.open_date = current_date + off
    and not exists (
      select 1 from public.sent_notifications sn
      where sn.user_id = f.user_id and sn.subject_type = 'season_opener'
        and sn.subject_id = s.id and sn.offset_days = off
    )
  group by f.user_id, s.id, off, s.open_date, sp.name, st.code, s.method

  union all

  -- Application deadlines
  select
    f.user_id,
    'application_deadline'::notification_subject_type,
    w.id,
    off::smallint,
    w.closes_at,
    format('%s tag deadline in %s day%s', sp.name, off, case when off = 1 then '' else 's' end),
    format('%s %s %s closes %s', st.code, sp.name, coalesce(w.name, 'draw'), to_char(w.closes_at, 'Mon DD')),
    array_agg(distinct dt.token),
    'application_deadline',
    w.id
  from public.application_windows w
  join public.states st on st.id = w.state_id
  join public.species sp on sp.id = w.species_id
  join public.follows f on f.state_id = w.state_id and f.species_id = w.species_id
  join public.alert_preferences ap on ap.follow_id = f.id
  cross join lateral unnest(ap.deadline_offsets) as off
  join public.device_push_tokens dt on dt.user_id = f.user_id
  where w.status = 'published'
    and w.closes_at = current_date + off
    and not exists (
      select 1 from public.sent_notifications sn
      where sn.user_id = f.user_id and sn.subject_type = 'application_deadline'
        and sn.subject_id = w.id and sn.offset_days = off
    )
  group by f.user_id, w.id, off, w.closes_at, sp.name, st.code, w.name

  union all

  -- Draw results
  select
    f.user_id,
    'application_results'::notification_subject_type,
    w.id,
    off::smallint,
    w.results_expected_at,
    case when off = 0
      then format('%s draw results expected today', sp.name)
      else format('%s draw results in %s day%s', sp.name, off, case when off = 1 then '' else 's' end)
    end,
    format('%s %s %s results expected %s', st.code, sp.name, coalesce(w.name, 'draw'), to_char(w.results_expected_at, 'Mon DD')),
    array_agg(distinct dt.token),
    'application_results',
    w.id
  from public.application_windows w
  join public.states st on st.id = w.state_id
  join public.species sp on sp.id = w.species_id
  join public.follows f on f.state_id = w.state_id and f.species_id = w.species_id
  join public.alert_preferences ap on ap.follow_id = f.id
  cross join lateral unnest(ap.results_offsets) as off
  join public.device_push_tokens dt on dt.user_id = f.user_id
  where w.status = 'published'
    and w.results_expected_at is not null
    and w.results_expected_at = current_date + off
    and not exists (
      select 1 from public.sent_notifications sn
      where sn.user_id = f.user_id and sn.subject_type = 'application_results'
        and sn.subject_id = w.id and sn.offset_days = off
    )
  group by f.user_id, w.id, off, w.results_expected_at, sp.name, st.code, w.name

  union all

  -- Season date changes (watchdog) — always on for followers; deduped per
  -- change row; only while the hunt is still upcoming/current.
  select
    f.user_id,
    'date_change'::notification_subject_type,
    dc.id,
    0::smallint,
    dc.new_date,
    format('%s season dates changed', sp.name),
    format('%s %s (%s): %s %s → %s', st.code, sp.name, s.method,
           case dc.field when 'open_date' then 'opens' else 'closes' end,
           to_char(dc.old_date, 'Mon DD'), to_char(dc.new_date, 'Mon DD')),
    array_agg(distinct dt.token),
    'season_opener',
    s.id
  from public.date_changes dc
  join public.seasons s on s.id = dc.target_id and dc.target_table = 'seasons'
  join public.states st on st.id = s.state_id
  join public.species sp on sp.id = s.species_id
  join public.follows f on f.state_id = s.state_id and f.species_id = s.species_id
  join public.device_push_tokens dt on dt.user_id = f.user_id
  where s.status = 'published'
    and dc.created_at >= now() - interval '14 days'
    and greatest(dc.new_date, dc.old_date) >= current_date
    and not exists (
      select 1 from public.sent_notifications sn
      where sn.user_id = f.user_id and sn.subject_type = 'date_change'
        and sn.subject_id = dc.id and sn.offset_days = 0
    )
  group by f.user_id, dc.id, dc.new_date, dc.field, dc.old_date, sp.name, st.code, s.method, s.id

  union all

  -- Draw date changes (watchdog)
  select
    f.user_id,
    'date_change'::notification_subject_type,
    dc.id,
    0::smallint,
    dc.new_date,
    case dc.field
      when 'closes_at' then format('%s draw deadline changed', sp.name)
      else format('%s draw results date changed', sp.name)
    end,
    format('%s %s %s: %s → %s', st.code, sp.name, coalesce(w.name, 'draw'),
           to_char(dc.old_date, 'Mon DD'), to_char(dc.new_date, 'Mon DD')),
    array_agg(distinct dt.token),
    'application_deadline',
    w.id
  from public.date_changes dc
  join public.application_windows w on w.id = dc.target_id and dc.target_table = 'application_windows'
  join public.states st on st.id = w.state_id
  join public.species sp on sp.id = w.species_id
  join public.follows f on f.state_id = w.state_id and f.species_id = w.species_id
  join public.device_push_tokens dt on dt.user_id = f.user_id
  where w.status = 'published'
    and dc.created_at >= now() - interval '14 days'
    and greatest(dc.new_date, dc.old_date) >= current_date
    and not exists (
      select 1 from public.sent_notifications sn
      where sn.user_id = f.user_id and sn.subject_type = 'date_change'
        and sn.subject_id = dc.id and sn.offset_days = 0
    )
  group by f.user_id, dc.id, dc.new_date, dc.field, dc.old_date, sp.name, st.code, w.name, w.id;
$$;

revoke all on function public.notifications_due() from public;
grant execute on function public.notifications_due() to service_role;
