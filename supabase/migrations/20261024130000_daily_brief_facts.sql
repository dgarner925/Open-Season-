-- 20261024130000_daily_brief_facts.sql
-- Facts for the daily brief, assembled deterministically in SQL.
--
-- The model that phrases the brief never queries anything and never decides
-- what is true — it receives exactly this JSON and may only put it into a
-- sentence. Everything the hunter reads originates here.
--
-- Shape:
--   {
--     "today": "2026-10-24",
--     "open_now":     [{"species":"Deer","state":"Georgia","method":"archery"}],
--     "opening_soon": [{"species":"Deer","state":"Georgia","open_date":"2026-10-17","in_days":3}],
--     "next_deadline": {"species":"Elk","state":"Colorado","closes_at":"2026-11-05","in_days":12},
--     "counts": {"open_now":2,"opening_soon":1}
--   }

create or replace function public.daily_brief_facts(p_user_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
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
    select distinct sp.name as species, st.name as state, s.method::text as method, s.close_date
    from public.seasons s
    join allowed a on a.state_id = s.state_id and a.species_id = s.species_id
    join public.states st on st.id = s.state_id
    join public.species sp on sp.id = s.species_id
    where s.status = 'published'
      and s.open_date <= current_date
      and s.close_date >= current_date
      and (a.methods is null or s.method::text = any(a.methods))
  ),
  opening_soon as (
    select distinct sp.name as species, st.name as state, s.open_date,
           (s.open_date - current_date) as in_days
    from public.seasons s
    join allowed a on a.state_id = s.state_id and a.species_id = s.species_id
    join public.states st on st.id = s.state_id
    join public.species sp on sp.id = s.species_id
    where s.status = 'published'
      and s.open_date > current_date
      and s.open_date <= current_date + 7
      and (a.methods is null or s.method::text = any(a.methods))
  ),
  next_deadline as (
    select sp.name as species, st.name as state, w.closes_at,
           (w.closes_at - current_date) as in_days
    from public.application_windows w
    join mine m on m.state_id = w.state_id and m.species_id = w.species_id
    join public.states st on st.id = w.state_id
    join public.species sp on sp.id = w.species_id
    where w.status = 'published'
      and w.closes_at >= current_date
    order by w.closes_at asc
    limit 1
  )
  select jsonb_build_object(
    'today', current_date,
    'open_now', coalesce(
      (select jsonb_agg(jsonb_build_object('species', species, 'state', state, 'method', method)
                        order by species)
       from (select * from open_now order by species limit 6) o), '[]'::jsonb),
    'opening_soon', coalesce(
      (select jsonb_agg(jsonb_build_object('species', species, 'state', state,
                                           'open_date', open_date, 'in_days', in_days)
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
$$;

revoke all on function public.daily_brief_facts(uuid) from public;
grant execute on function public.daily_brief_facts(uuid) to service_role;
