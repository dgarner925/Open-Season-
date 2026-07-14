-- 20260714140000_notify_new_windows.sql
-- Adds a third notification trigger: "a new draw/deadline was just posted."
--
-- The original notifications_due() only did COUNTDOWN reminders (N days before an
-- opener or a deadline). Hunters also want to know the moment a new application
-- window becomes available, so they can apply early — not just as the clock runs
-- out. This rewrites notifications_due() to keep both countdown branches and add
-- a "newly posted window" branch.
--
-- The posted-branch is deduped with a SENTINEL offset of -1 (real reminder
-- offsets are always >= 0), so it coexists with the countdown rows in
-- sent_notifications' unique key (user_id, subject_type, subject_id, offset_days)
-- and each user is announced to exactly once per window. It only fires for
-- still-open windows (closes_at >= today), so publishing already-passed windows
-- sends nothing.

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
  -- Season openers (countdown)
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

  -- Application deadlines (countdown)
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

  -- Newly posted application windows: announce once, as soon as a draw is
  -- published and while it's still open, so hunters can get ahead of it. Not
  -- gated on a per-offset preference — a new draw is a first-class alert.
  -- Sentinel offset -1 keeps it distinct from the countdown rows above.
  select
    f.user_id,
    'application_deadline'::notification_subject_type,
    w.id,
    (-1)::smallint,
    w.closes_at,
    format('New %s draw posted in %s', sp.name, st.code),
    format('%s %s %s is open — applications close %s',
           st.code, sp.name, coalesce(w.name, 'draw'), to_char(w.closes_at, 'Mon DD')),
    array_agg(distinct dt.token)
  from public.application_windows w
  join public.states st on st.id = w.state_id
  join public.species sp on sp.id = w.species_id
  join public.follows f on f.state_id = w.state_id and f.species_id = w.species_id
  join public.device_push_tokens dt on dt.user_id = f.user_id
  where w.status = 'published'
    and w.closes_at >= current_date
    and not exists (
      select 1 from public.sent_notifications sn
      where sn.user_id = f.user_id and sn.subject_type = 'application_deadline'
        and sn.subject_id = w.id and sn.offset_days = -1
    )
  group by f.user_id, w.id, w.closes_at, sp.name, st.code, w.name;
$$;

revoke all on function public.notifications_due() from public;
grant execute on function public.notifications_due() to service_role;
