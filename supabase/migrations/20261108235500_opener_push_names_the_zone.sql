-- 20261108235500_opener_push_names_the_zone.sql
-- The season-opener push claimed every zoned season was statewide.
--
-- THE BUG
--   The season-opener body was
--     format('%s %s (%s) opens %s', st.code, sp.name, s.method, open_date)
--   state, species, method, date. Never the zone. So a season scoped to one
--   property, one county group or one GMU list went out as though the whole
--   state were opening:
--
--     "GA Deer (muzzleloader) opens Nov 11"
--
--   That row is four days at one state park near Helen. Statewide Georgia
--   firearms deer has been open since Oct 17 and runs to Jan 10. Anyone
--   following GA + Deer reads that as a statewide opener, and it is not.
--
--   This was not a Smithgall problem. 17 published Georgia seasons alone are
--   zone-scoped -- the Chattahoochee & Chestatee WMA bear hunt, the nine-county
--   southern deer group, Extended Archery, every bear zone -- and every one of
--   them pushed as statewide. Nationally it is 1097 season-opener rows.
--
--   It was found twice in one evening by writing suppression rows to work
--   around it: 380 for the Smithgall deer hunts, 246 for the bear. Cheaper to
--   fix the sentence than to keep muzzling it.
--
--   The season date-change watchdog had it too, and was found while fixing
--   the opener:
--     "GA Deer (muzzleloader): opens Nov 11 -> Nov 14"
--   Same shape, same silence about scope. Both are fixed here. Leaving the
--   twin in the same function would only have meant a third migration for the
--   identical reason.
--
-- THE FIX
--   Name the zone unless the season really is statewide:
--
--     "GA Deer (muzzleloader) opens Nov 11 at Smithgall Woods State Park"
--     "GA Deer (archery) opens Sep 12"            <- statewide, unchanged
--
--   Keyed on zone_type, not on the zone's name, so a zone called "Statewide"
--   is not what decides it. Six edits, three in each of the two season-based
--   arms: the format() call, a left join to zones, and z.type/z.name added to
--   the group by (they are not functionally dependent on s.id, which is the
--   only grouped primary key). The three draw-based arms are untouched --
--   application deadlines, draw results and the window watchdog already name
--   the draw through w.name.
--
--   Washington's GMU lists run to 160 characters, which would have made a
--   198-character push body, so the zone clause is capped at 48 with an
--   ellipsis. A truncated unit list still says "specific units, not the whole
--   state", which is the entire point, and the season page carries the full
--   list. Worst case nationally is now 89 characters, from 198.
--
-- HOW THIS WAS BUILT
--   Generated from pg_get_functiondef() of the deployed function, with the
--   six edits applied programmatically and reversed again to prove nothing
--   else moved, same method as 20261108210000. CRLF normalised to LF; no other
--   line differs. Verified read-only against production before writing: the
--   function body is itself a single SELECT, so the whole thing -- all five
--   arms, not just the two edited -- was executed as written (7 rows due
--   today), then again with the opener date gate relaxed so 1097 rows flow
--   through the edited arm and its aggregate is genuinely exercised. Longest
--   body it can now produce is 89 characters, down from 198.
--
--   Strictly a text change. No row is selected or skipped that was not before:
--   the join is a LEFT join on a NOT NULL column, and the added group-by keys
--   are functionally dependent on a key already grouped.

CREATE OR REPLACE FUNCTION public.notifications_due()
 RETURNS TABLE(user_id uuid, subject_type notification_subject_type, subject_id uuid, offset_days smallint, scheduled_for date, title text, body text, tokens text[], route_type text, route_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Season openers
  select
    f.user_id,
    'season_opener'::notification_subject_type,
    s.id,
    off::smallint,
    s.open_date,
    format('%s opens in %s day%s', sp.name, off, case when off = 1 then '' else 's' end),
    format('%s %s (%s) opens %s%s', st.code, sp.name, s.method, to_char(s.open_date, 'Mon DD'),
      -- Name the zone unless the season really is statewide. Washington's
      -- GMU lists reach 160 characters, so cap the clause: a truncated
      -- unit list still says "specific units, not the whole state", which
      -- is the whole point, and the season page carries the full list.
      case when z.type is distinct from 'statewide'::zone_type
           then ' at ' || case when length(z.name) > 48
                              then left(z.name, 45) || '...'
                              else z.name end
           else '' end),
    array_agg(distinct dt.token),
    'season_opener',
    s.id
  from public.seasons s
  join public.states st on st.id = s.state_id
  join public.species sp on sp.id = s.species_id
  left join public.zones z on z.id = s.zone_id
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
  group by f.user_id, s.id, off, s.open_date, sp.name, st.code, s.method, z.type, z.name

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
    format('%s %s (%s): %s %s → %s%s', st.code, sp.name, s.method,
           case dc.field when 'open_date' then 'opens' else 'closes' end,
           to_char(dc.old_date, 'Mon DD'), to_char(dc.new_date, 'Mon DD'),
           case when z.type is distinct from 'statewide'::zone_type
                then ' at ' || case when length(z.name) > 48
                                   then left(z.name, 45) || '...'
                                   else z.name end
                else '' end),
    array_agg(distinct dt.token),
    'season_opener',
    s.id
  from public.date_changes dc
  join public.seasons s on s.id = dc.target_id and dc.target_table = 'seasons'
  join public.states st on st.id = s.state_id
  join public.species sp on sp.id = s.species_id
  left join public.zones z on z.id = s.zone_id
  join public.follows f on f.state_id = s.state_id and f.species_id = s.species_id
  left join public.alert_preferences ap on ap.follow_id = f.id
  join public.device_push_tokens dt on dt.user_id = f.user_id
  join public.profiles pr on pr.id = f.user_id and pr.is_premium
  where s.status = 'published'
    and dc.created_at >= now() - interval '14 days'
    and dc.created_at >= f.created_at
    and greatest(dc.new_date, dc.old_date) >= current_date
    and (ap.methods is null or s.method::text = any(ap.methods))
    and not exists (
      select 1 from public.sent_notifications sn
      where sn.user_id = f.user_id and sn.subject_type = 'date_change'
        and sn.subject_id = dc.id and sn.offset_days = 0
    )
  group by f.user_id, dc.id, dc.new_date, dc.field, dc.old_date, sp.name, st.code, s.method, s.id, z.type, z.name

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
    and dc.created_at >= f.created_at
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
      select distinct u.user_id, u.priority, u.d, u.line
      from (
      select * from (
        select
          f.user_id,
          1 as priority,
          s.open_date as d,
          format('%s %s %s in %s', sp.name,
                 case when sp.name in ('Geese', 'Ducks') then 'open' else 'opens' end,
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
          format('%s %s %s in %s — the last days', sp.name,
                 case when sp.name in ('Geese', 'Ducks') then 'close' else 'closes' end,
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
      union all
      -- Priority 4: discovery - weekend openers in the user's states for
      -- species they don't follow. Lowest priority, so it only fills room the
      -- user's own hunts left in the 3-line cap.
      select * from (
        select
          x.user_id,
          4 as priority,
          x.d,
          x.line,
          row_number() over (partition by x.user_id order by x.d, x.line) as rn
        from (
          select distinct
            ts.user_id,
            s.open_date as d,
            format('%s %s %s in %s', sp.name,
                   case when sp.name in ('Geese', 'Ducks') then 'open' else 'opens' end,
                   case s.open_date - current_date when 0 then 'today' when 1 then 'Saturday' else 'Sunday' end,
                   st.name) as line
          from (
            select f.user_id, f.state_id from public.follows f
            union
            select p.id, p.resident_state_id from public.profiles p where p.resident_state_id is not null
          ) ts
          join public.seasons s on s.state_id = ts.state_id
          join public.states st on st.id = s.state_id
          join public.species sp on sp.id = s.species_id
          where s.status = 'published'
            and s.open_date between current_date and current_date + 2
            and not exists (
              select 1 from public.follows f2
              where f2.user_id = ts.user_id and f2.state_id = s.state_id and f2.species_id = s.species_id
            )
        ) x
      ) disc where disc.rn <= 3
      ) u
      ) lines
    ) capped
    where capped.overall_rn <= 3
    group by capped.user_id
  ) b
  join public.profiles pr on pr.id = b.user_id and pr.is_premium and pr.weekend_brief
  where extract(isodow from current_date) = 5
    and b.tokens is not null
    and not exists (
      select 1 from public.sent_notifications sn
      where sn.user_id = b.user_id and sn.subject_type = 'weekend_brief'
        and sn.subject_id = md5(b.user_id::text || current_date::text)::uuid
        and sn.offset_days = 0
    );
$function$;
