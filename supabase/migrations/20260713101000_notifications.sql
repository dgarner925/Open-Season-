-- 20260713101000_notifications.sql
-- Computes the notifications due to send today: for every published opener and
-- application deadline landing exactly N days out, find each user who follows
-- that state+species and has N in their offsets, hasn't already been notified
-- (sent_notifications), and has at least one device token. One row per
-- (user, event, offset) with the user's device tokens aggregated.
--
-- Called by the send-alerts Edge Function (service role). SECURITY DEFINER so it
-- can read across users; granted only to service_role.

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
  group by f.user_id, w.id, off, w.closes_at, sp.name, st.code, w.name;
$$;

revoke all on function public.notifications_due() from public;
grant execute on function public.notifications_due() to service_role;
