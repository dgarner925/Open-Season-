-- Preview gate: the Weekend Brief push goes to ADMIN accounts only until David
-- approves it on TestFlight ("I would like to see it on my testflight before
-- we launch anything"). Remove pr.is_admin from the brief branch to launch.
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
  join public.profiles pr on pr.id = f.user_id and pr.is_premium
  where s.status = 'published'
    and s.open_date = current_date + off
    and (ap.methods is null or s.method::text = any(ap.methods))
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
  join public.profiles pr on pr.id = f.user_id and pr.is_premium
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
  join public.profiles pr on pr.id = f.user_id and pr.is_premium
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

  -- Season date changes (watchdog)
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
  left join public.alert_preferences ap on ap.follow_id = f.id
  join public.device_push_tokens dt on dt.user_id = f.user_id
  join public.profiles pr on pr.id = f.user_id and pr.is_premium
  where s.status = 'published'
    and dc.created_at >= now() - interval '14 days'
    and greatest(dc.new_date, dc.old_date) >= current_date
    and (ap.methods is null or s.method::text = any(ap.methods))
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
  join public.profiles pr on pr.id = f.user_id and pr.is_premium
  where w.status = 'published'
    and dc.created_at >= now() - interval '14 days'
    and greatest(dc.new_date, dc.old_date) >= current_date
    and not exists (
      select 1 from public.sent_notifications sn
      where sn.user_id = f.user_id and sn.subject_type = 'date_change'
        and sn.subject_id = dc.id and sn.offset_days = 0
    )
  group by f.user_id, dc.id, dc.new_date, dc.field, dc.old_date, sp.name, st.code, w.name, w.id

  union all

  -- Federal permit hunt openers — following the permit is the opt-in.
  select
    pf.user_id,
    'permit_opener'::notification_subject_type,
    d.id,
    off::smallint,
    d.open_date,
    format('Permit hunt opens in %s day%s', off, case when off = 1 then '' else 's' end),
    format('%s%s opens %s · details on Recreation.gov', p.name,
           case when coalesce(d.label, '') = '' then '' else format(' (%s)', d.label) end,
           to_char(d.open_date, 'Mon DD')),
    array_agg(distinct dt.token),
    'permit_opener',
    p.id
  from public.federal_permit_hunt_dates d
  join public.federal_permit_hunts p on p.id = d.permit_id
  join public.permit_follows pf on pf.permit_id = p.id
  cross join lateral unnest(array[30, 7, 1]) as off
  join public.device_push_tokens dt on dt.user_id = pf.user_id
  join public.profiles pr on pr.id = pf.user_id and pr.is_premium
  where d.open_date = current_date + off
    and not exists (
      select 1 from public.sent_notifications sn
      where sn.user_id = pf.user_id and sn.subject_type = 'permit_opener'
        and sn.subject_id = d.id and sn.offset_days = off
    )
  group by pf.user_id, d.id, off, d.open_date, d.label, p.name, p.id

  union all

  -- The Weekend Brief — Fridays only; one composed row per Pro user with
  -- brief-worthy content. Lines (priority order, max 3): openers Fri-Sun,
  -- closers Fri-Sun (last chance), draw deadlines within 7 days. Silent when
  -- empty. Weekly dedupe key = md5(user_id, date) as uuid.
  select
    b.user_id,
    'weekend_brief'::notification_subject_type,
    md5(b.user_id::text || current_date::text)::uuid,
    0::smallint,
    current_date,
    'Your weekend, in season.',
    b.body,
    b.tokens,
    'weekend_brief',
    b.user_id
  from (
    select
      capped.user_id,
      string_agg(capped.line, ' · ' order by capped.priority, capped.d) as body,
      (select array_agg(distinct dt.token) from public.device_push_tokens dt where dt.user_id = capped.user_id) as tokens
    from (
      select lines.*, row_number() over (partition by lines.user_id order by lines.priority, lines.d) as overall_rn
      from (
      select * from (
        select
          f.user_id,
          1 as priority,
          s.open_date as d,
          format('%s opens %s in %s', sp.name,
                 case s.open_date - current_date when 0 then 'today' when 1 then 'Saturday' else 'Sunday' end,
                 st.name) as line,
          row_number() over (partition by f.user_id order by s.open_date, sp.name) as rn
        from public.seasons s
        join public.states st on st.id = s.state_id
        join public.species sp on sp.id = s.species_id
        join public.follows f on f.state_id = s.state_id and f.species_id = s.species_id
        left join public.alert_preferences ap on ap.follow_id = f.id
        where s.status = 'published'
          and s.open_date between current_date and current_date + 2
          and (ap.methods is null or s.method::text = any(ap.methods))
      ) o where o.rn <= 3
      union all
      select * from (
        select
          f.user_id,
          2 as priority,
          s.close_date as d,
          format('%s closes %s in %s — the last days', sp.name,
                 case s.close_date - current_date when 0 then 'today' when 1 then 'Saturday' else 'Sunday' end,
                 st.name) as line,
          row_number() over (partition by f.user_id order by s.close_date, sp.name) as rn
        from public.seasons s
        join public.states st on st.id = s.state_id
        join public.species sp on sp.id = s.species_id
        join public.follows f on f.state_id = s.state_id and f.species_id = s.species_id
        left join public.alert_preferences ap on ap.follow_id = f.id
        where s.status = 'published'
          and s.close_date between current_date and current_date + 2
          and s.open_date <= current_date
          and (ap.methods is null or s.method::text = any(ap.methods))
      ) c where c.rn <= 3
      union all
      select * from (
        select
          f.user_id,
          3 as priority,
          w.closes_at as d,
          format('The %s %s draw closes %s', st.name, lower(sp.name),
                 case w.closes_at - current_date
                   when 0 then 'today' when 1 then 'tomorrow'
                   when 7 then format('next %s', trim(to_char(w.closes_at, 'Day')))
                   else trim(to_char(w.closes_at, 'Day')) end) as line,
          row_number() over (partition by f.user_id order by w.closes_at, sp.name) as rn
        from public.application_windows w
        join public.states st on st.id = w.state_id
        join public.species sp on sp.id = w.species_id
        join public.follows f on f.state_id = w.state_id and f.species_id = w.species_id
        where w.status = 'published'
          and w.closes_at between current_date and current_date + 7
      ) dl where dl.rn <= 3
      ) lines
    ) capped
    where capped.overall_rn <= 3
    group by capped.user_id
  ) b
  join public.profiles pr on pr.id = b.user_id and pr.is_premium and pr.weekend_brief and pr.is_admin
  where extract(isodow from current_date) = 5
    and b.tokens is not null
    and not exists (
      select 1 from public.sent_notifications sn
      where sn.user_id = b.user_id and sn.subject_type = 'weekend_brief'
        and sn.subject_id = md5(b.user_id::text || current_date::text)::uuid
        and sn.offset_days = 0
    );
$$;

revoke all on function public.notifications_due() from public;
grant execute on function public.notifications_due() to service_role;
