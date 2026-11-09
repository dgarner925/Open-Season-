-- 20261109021500_brief_uses_the_devices_day_and_names_the_zone.sql
-- The Daily Outlook was a day ahead of the rest of the app every evening.
--
-- THE BUG, seen on David's phone 2026-11-08 at 21:06 EST
--   Home's headline said "Black bear opens in 3 days."
--   The Daily Outlook, directly beneath it, said "opens in 2 days".
--
--   Both were computed correctly. They disagree because they do not agree on
--   what day it is. The headline counts from the device's local date; this
--   function counts from current_date, and the database runs in UTC. At 21:06
--   Eastern it was already 02:06 on the 9th in UTC, so the server was a day
--   ahead:
--
--     device  2026-11-08 -> Nov 11 is 3 days away
--     server  2026-11-09 -> Nov 11 is 2 days away
--
--   So every evening after 19:00 Eastern -- 16:00 Pacific -- the brief slips a
--   day. And because composeBrief renders 0 as "today" and 1 as "tomorrow",
--   a season opening tomorrow gets announced as opening TODAY. For an app
--   whose whole promise is telling people the right date, that is the worst
--   shape this bug could take.
--
--   Measured, same account, same moment:
--     server date   Black bear 2 days, Deer 2 days, Bobwhite quail 5 days
--     device date   Black bear 3 days, Deer 3 days, Bobwhite quail 6 days
--
--   Checked the blast radius: four functions reference current_date, and only
--   this one is affected in practice. notifications_due runs at 13:00 UTC,
--   which is the same calendar day in every US timezone, so pushes are sound.
--   prune_ai_answer_cache and set_party_applied are housekeeping.
--
-- THE FIX
--   p_today, supplied by the caller, defaulting to NULL. Every current_date
--   becomes coalesce(p_today, current_date), so the client passes the day the
--   user is actually having, and the cron keeps its old behaviour untouched.
--   The device is the only thing that knows what day it is where the user is
--   standing; guessing a timezone from their state would be a worse answer to
--   a question we can simply ask.
--
--   The old one-argument function is DROPped first, deliberately. Adding an
--   argument with a DEFAULT creates an OVERLOAD rather than replacing it, and
--   a one-argument call against both would be ambiguous -- the brief would
--   start failing rather than slipping a day. Existing one-argument callers
--   keep working against the new function via the default.
--
-- ALSO: the zone, which is why I was in here (David asked for it after the
--   Smithgall hunts landed). open_now and opening_soon now carry the zone
--   name, NULL when the season really is statewide, keyed on zone_type rather
--   than the zone's name. Without it the card said "Black bear ... open in
--   Georgia" and "Black bear opens in 2 days" in consecutive sentences --
--   both true, because statewide Northern Zone bear is open while the
--   Smithgall hunt is still ahead, and together nonsense to read.
--
-- HOW THIS WAS BUILT
--   Generated from pg_get_functiondef() of the deployed function, five named
--   edits plus the current_date substitution applied programmatically and
--   reversed again to prove nothing else moved. Executed read-only against
--   production both ways before writing -- the table above is that run.
--
-- NOTE: this changes the SHAPE of the brief payload (open_now and
--   opening_soon gain "zone"). The daily-brief Edge Function must be deployed
--   with it, or it will simply ignore a field it does not know about -- no
--   breakage, but no zone in the sentence either.

drop function if exists public.daily_brief_facts(uuid);

CREATE OR REPLACE FUNCTION public.daily_brief_facts(p_user_id uuid, p_today date DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with mine as (
    select f.state_id, f.species_id, f.id as follow_id
    from public.follows f
    where f.user_id = p_user_id
  ),
  -- Muting a method on a follow keeps it out of the brief, same as the
  -- Weekend Brief and the opener pushes.
  allowed as (
    select m.state_id, m.species_id, ap.methods
    from mine m
    left join public.alert_preferences ap on ap.follow_id = m.follow_id
  ),
  open_now as (
    select distinct sp.name as species, st.name as state, s.method::text as method, s.close_date,
           case when z.type is distinct from 'statewide'::zone_type then z.name end as zone
    from public.seasons s
    join allowed a on a.state_id = s.state_id and a.species_id = s.species_id
    join public.states st on st.id = s.state_id
    join public.species sp on sp.id = s.species_id
    left join public.zones z on z.id = s.zone_id
    where s.status = 'published'
      and s.open_date <= coalesce(p_today, current_date)
      and s.close_date >= coalesce(p_today, current_date)
      and (a.methods is null or s.method::text = any(a.methods))
  ),
  opening_soon as (
    select distinct sp.name as species, st.name as state, s.open_date,
           (s.open_date - coalesce(p_today, current_date)) as in_days,
           case when z.type is distinct from 'statewide'::zone_type then z.name end as zone
    from public.seasons s
    join allowed a on a.state_id = s.state_id and a.species_id = s.species_id
    join public.states st on st.id = s.state_id
    join public.species sp on sp.id = s.species_id
    left join public.zones z on z.id = s.zone_id
    where s.status = 'published'
      and s.open_date > coalesce(p_today, current_date)
      and s.open_date <= coalesce(p_today, current_date) + 7
      and (a.methods is null or s.method::text = any(a.methods))
  ),
  next_deadline as (
    select sp.name as species, st.name as state, w.closes_at,
           (w.closes_at - coalesce(p_today, current_date)) as in_days
    from public.application_windows w
    join mine m on m.state_id = w.state_id and m.species_id = w.species_id
    join public.states st on st.id = w.state_id
    join public.species sp on sp.id = w.species_id
    where w.status = 'published'
      and w.closes_at >= coalesce(p_today, current_date)
    order by w.closes_at asc
    limit 1
  )
  select jsonb_build_object(
    'today', coalesce(p_today, current_date),
    'open_now', coalesce(
      (select jsonb_agg(jsonb_build_object('species', species, 'state', state, 'method', method,
                                           'zone', zone)
                        order by species)
       from (select * from open_now order by species limit 6) o), '[]'::jsonb),
    'opening_soon', coalesce(
      (select jsonb_agg(jsonb_build_object('species', species, 'state', state,
                                           'open_date', open_date, 'in_days', in_days,
                                           'zone', zone)
                        order by open_date)
       from (select * from opening_soon order by open_date limit 6) os), '[]'::jsonb),
    'next_deadline', coalesce(
      (select jsonb_build_object('species', species, 'state', state,
                                 'closes_at', closes_at, 'in_days', in_days)
       from next_deadline), 'null'::jsonb),
    'counts', jsonb_build_object(
      'open_now', (select count(*) from open_now),
      'opening_soon', (select count(*) from opening_soon)
    )
  );
$function$;
