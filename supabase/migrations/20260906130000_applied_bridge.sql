-- 20260906130000_applied_bridge.sql
-- "Applied" was two unrelated facts (David + buddy, Sep 6): the ledger's
-- user_applications.status and the party's party_members.applied_at never
-- talked, so David's app said Applied while his buddy's roster said he
-- hadn't. This bridges them both ways and backfills the divergence:
--   1. Ledger changes flow to every party of that window (trigger).
--   2. The party's "I applied" toggle flows into the ledger (creating a
--      minimal ledger row if none exists — same fact, one book).
--   3. One-time backfill for rows that already diverged.

-- 1. Ledger -> parties.
create or replace function public._sync_application_to_party()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.window_id is null then
    return new;
  end if;
  if new.status in ('applied', 'successful', 'unsuccessful') then
    -- They submitted (win or lose) — the roster should say so.
    update public.party_members pm
    set applied_at = coalesce(pm.applied_at, coalesce(new.applied_on::timestamptz, now()))
    from public.parties p
    where p.id = pm.party_id and p.window_id = new.window_id and pm.user_id = new.user_id;
  elsif new.status = 'planned' then
    update public.party_members pm
    set applied_at = null
    from public.parties p
    where p.id = pm.party_id and p.window_id = new.window_id and pm.user_id = new.user_id
      and pm.applied_at is not null;
  end if;
  return new;
end;
$$;

drop trigger if exists user_applications_sync_party on public.user_applications;
create trigger user_applications_sync_party
after insert or update of status, window_id, applied_on on public.user_applications
for each row execute function public._sync_application_to_party();

-- 2. Party toggle -> ledger (and, via the trigger above, every other party
--    of the same window).
create or replace function public.set_party_applied(p_party_id uuid, p_applied boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window uuid;
begin
  update public.party_members
  set applied_at = case when p_applied then now() else null end
  where party_id = p_party_id and user_id = auth.uid();

  select window_id into v_window from public.parties where id = p_party_id;
  if v_window is null then
    return; -- season parties have no application to book-keep
  end if;

  if p_applied then
    update public.user_applications
    set status = 'applied', applied_on = coalesce(applied_on, current_date)
    where user_id = auth.uid() and window_id = v_window and status = 'planned';
    if not exists (
      select 1 from public.user_applications where user_id = auth.uid() and window_id = v_window
    ) then
      insert into public.user_applications
        (user_id, state_id, species_id, window_id, title, status, applied_on, results_on, application_url)
      select auth.uid(), w.state_id, w.species_id, w.id,
             trim(coalesce(st.code || ' ', '') || coalesce(sp.name, 'Draw') || coalesce(' — ' || w.name, '')),
             'applied', current_date, w.results_expected_at, w.application_url
      from public.application_windows w
      left join public.states st on st.id = w.state_id
      left join public.species sp on sp.id = w.species_id
      where w.id = v_window;
    end if;
  else
    update public.user_applications
    set status = 'planned', applied_on = null
    where user_id = auth.uid() and window_id = v_window and status = 'applied';
  end if;
end;
$$;

-- 3. Backfill: anyone whose ledger says applied but whose roster rows don't.
update public.party_members pm
set applied_at = coalesce(ua.applied_on::timestamptz, ua.created_at)
from public.parties p, public.user_applications ua
where p.id = pm.party_id
  and pm.applied_at is null
  and p.window_id is not null
  and ua.user_id = pm.user_id
  and ua.window_id = p.window_id
  and ua.status in ('applied', 'successful', 'unsuccessful');
