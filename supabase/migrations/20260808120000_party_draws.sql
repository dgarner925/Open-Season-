-- 20260808120000_party_draws.sql
-- Party draws (v1.2 headline): a party is a group of users coordinating one
-- application window (draw). Members see the shared deadline, each other, and
-- who has applied. Joining auto-follows the draw's (state, species), so every
-- member inherits the existing reminder machine (deadline countdowns, date-
-- change watchdog, results day) with zero new notification infrastructure.
--
-- Access model: membership-gated. All writes go through SECURITY DEFINER RPCs
-- (create/join/applied/leave); the invite code is the joining credential.

create table public.parties (
  id           uuid primary key default gen_random_uuid(),
  window_id    uuid not null references public.application_windows(id) on delete cascade,
  owner_id     uuid not null references auth.users(id) on delete cascade,
  invite_code  text not null unique,
  created_at   timestamptz not null default now(),
  unique (window_id, owner_id)              -- one party per draw per owner (create is idempotent)
);

create table public.party_members (
  party_id    uuid not null references public.parties(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  joined_at   timestamptz not null default now(),
  applied_at  timestamptz,                  -- set when the member marks "I applied"
  primary key (party_id, user_id)
);
create index party_members_user_idx on public.party_members(user_id);

-- Membership check as SECURITY DEFINER to avoid RLS self-recursion on
-- party_members policies.
create or replace function public.is_party_member(p_party_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.party_members
    where party_id = p_party_id and user_id = auth.uid()
  );
$$;
revoke all on function public.is_party_member(uuid) from public;
grant execute on function public.is_party_member(uuid) to authenticated;

alter table public.parties enable row level security;
create policy parties_member_read on public.parties
  for select to authenticated using (public.is_party_member(id));

alter table public.party_members enable row level security;
create policy party_members_fellow_read on public.party_members
  for select to authenticated using (public.is_party_member(party_id));

grant select on public.parties, public.party_members to authenticated;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Follow the draw's (state, species) for the current user; the existing
-- follows trigger creates default alert preferences.
create or replace function public._party_autofollow(p_window_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.follows (user_id, state_id, species_id)
  select auth.uid(), w.state_id, w.species_id
  from public.application_windows w
  where w.id = p_window_id
  on conflict (user_id, state_id, species_id) do nothing;
$$;
revoke all on function public._party_autofollow(uuid) from public;

-- Create (or return) my party for a draw. Idempotent per (window, owner).
create or replace function public.create_party(p_window_id uuid)
returns table (party_id uuid, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  select id, parties.invite_code into v_id, v_code
  from public.parties
  where window_id = p_window_id and owner_id = auth.uid();

  if v_id is null then
    v_code := upper(encode(gen_random_bytes(4), 'hex'));
    insert into public.parties (window_id, owner_id, invite_code)
    values (p_window_id, auth.uid(), v_code)
    returning id into v_id;
  end if;

  insert into public.party_members (party_id, user_id)
  values (v_id, auth.uid())
  on conflict do nothing;

  perform public._party_autofollow(p_window_id);
  return query select v_id, v_code;
end;
$$;
revoke all on function public.create_party(uuid) from public;
grant execute on function public.create_party(uuid) to authenticated;

-- Join by invite code. Returns the party id; raises on a bad code.
create or replace function public.join_party(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_party public.parties%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  select * into v_party from public.parties
  where upper(invite_code) = upper(trim(p_code));
  if v_party.id is null then
    raise exception 'invalid invite code';
  end if;

  insert into public.party_members (party_id, user_id)
  values (v_party.id, auth.uid())
  on conflict do nothing;

  perform public._party_autofollow(v_party.window_id);
  return v_party.id;
end;
$$;
revoke all on function public.join_party(text) from public;
grant execute on function public.join_party(text) to authenticated;

-- Toggle my own "I applied" flag.
create or replace function public.set_party_applied(p_party_id uuid, p_applied boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update public.party_members
  set applied_at = case when p_applied then now() else null end
  where party_id = p_party_id and user_id = auth.uid();
$$;
revoke all on function public.set_party_applied(uuid, boolean) from public;
grant execute on function public.set_party_applied(uuid, boolean) to authenticated;

-- Leave a party. If the owner leaves, the party dissolves (cascade).
create or replace function public.leave_party(p_party_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.parties where id = p_party_id and owner_id = auth.uid()) then
    delete from public.parties where id = p_party_id;
  else
    delete from public.party_members where party_id = p_party_id and user_id = auth.uid();
  end if;
end;
$$;
revoke all on function public.leave_party(uuid) from public;
grant execute on function public.leave_party(uuid) to authenticated;

-- Roster with display names (profiles are own-read under RLS, so names come
-- through this membership-gated definer function; falls back to 'Hunter').
create or replace function public.party_roster(p_party_id uuid)
returns table (user_id uuid, display_name text, joined_at timestamptz, applied_at timestamptz, is_owner boolean)
language sql
security definer
set search_path = public
stable
as $$
  select
    pm.user_id,
    coalesce(nullif(trim(pr.display_name), ''), 'Hunter'),
    pm.joined_at,
    pm.applied_at,
    (pm.user_id = p.owner_id)
  from public.party_members pm
  join public.parties p on p.id = pm.party_id
  left join public.profiles pr on pr.id = pm.user_id
  where pm.party_id = p_party_id
    and public.is_party_member(p_party_id)
  order by pm.joined_at;
$$;
revoke all on function public.party_roster(uuid) from public;
grant execute on function public.party_roster(uuid) to authenticated;
