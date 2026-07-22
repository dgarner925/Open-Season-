-- 20260720170100_v11_features.sql
-- v1.1 feature bundle:
--   1. Draw-results reminders  — results_offsets on alert_preferences + a third
--      branch in notifications_due() for application_windows.results_expected_at.
--   2. Residency               — profiles.resident_state_id (the user's home state;
--      everything else is nonresident). Used for context labels in the app.
--   4. Report-a-bad-date       — date_reports table (user-submitted corrections),
--      RLS-locked to the reporter; admins can read all.

-- ---------------------------------------------------------------------------
-- 1. Draw-results reminder cadences (per follow, like opener/deadline offsets).
--    0 = the day results are expected. Default: day-of + the day after.
-- ---------------------------------------------------------------------------
alter table public.alert_preferences
  add column if not exists results_offsets smallint[] not null default '{1,0}';
alter table public.alert_preferences drop constraint if exists results_offsets_allowed;
alter table public.alert_preferences
  add constraint results_offsets_allowed
  check (results_offsets <@ array[0,1,3,7]::smallint[]);

-- Rebuild notifications_due() with a third branch for draw results. The opener
-- and deadline branches are unchanged from 20260713101000_notifications.sql.
create or replace function public.notifications_due()
returns table (
  user_id uuid,
  subject_type notification_subject_type,
  subject_id uuid,
  offset_days smallint,
  scheduled_for date,
  title text,
  body text,
  tokens text[]
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
    array_agg(distinct dt.token)
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
    array_agg(distinct dt.token)
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

  -- Draw results (only windows that carry an expected results date)
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
    array_agg(distinct dt.token)
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
  group by f.user_id, w.id, off, w.results_expected_at, sp.name, st.code, w.name;
$$;

revoke all on function public.notifications_due() from public;
grant execute on function public.notifications_due() to service_role;

-- ---------------------------------------------------------------------------
-- 2. Residency — the user's home state. Everything else is nonresident.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists resident_state_id uuid references public.states(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 4. Report-a-bad-date — lightweight user-submitted correction reports that feed
--    the admin review pipeline. RLS: a user sees/creates only their own; admins
--    read everything.
-- ---------------------------------------------------------------------------
create table if not exists public.date_reports (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  target_table  text not null,           -- 'seasons' | 'application_windows' | ...
  target_id     uuid,                     -- the row the user is flagging
  label         text,                     -- human context, e.g. 'CO Elk — Archery'
  detail        text,                     -- optional note from the user
  created_at    timestamptz not null default now()
);
create index if not exists date_reports_created_idx on public.date_reports(created_at desc);

alter table public.date_reports enable row level security;

drop policy if exists date_reports_insert_own on public.date_reports;
create policy date_reports_insert_own on public.date_reports
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists date_reports_select_own on public.date_reports;
create policy date_reports_select_own on public.date_reports
  for select to authenticated
  using (auth.uid() = user_id or public.is_admin());

grant select, insert on public.date_reports to authenticated;
