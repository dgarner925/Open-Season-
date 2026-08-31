-- 20260830120000_season_parties.sql
-- Parties beyond the draw (David, 2026-08-30: "the party option should be
-- available for more than just quota hunts"). A party now targets EITHER an
-- application window (the original draw party, with "I applied" tracking) OR
-- a season (the deer-camp crew). Invite codes, rosters, auto-follow, and the
-- membership-gated access model are shared.

alter table public.parties alter column window_id drop not null;
alter table public.parties
  add column season_id uuid references public.seasons(id) on delete cascade;
alter table public.parties
  add constraint parties_one_target check (num_nonnulls(window_id, season_id) = 1);

-- One party per season per owner, mirroring unique (window_id, owner_id)
-- (which still holds for window parties; NULLs are distinct so it ignores
-- season parties).
create unique index parties_season_owner_key
  on public.parties (season_id, owner_id) where season_id is not null;

-- Auto-follow whichever hunt the party is for.
create or replace function public._party_autofollow_target(p_window_id uuid, p_season_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.follows (user_id, state_id, species_id)
  select auth.uid(), t.state_id, t.species_id
  from (
    select w.state_id, w.species_id from public.application_windows w where w.id = p_window_id
    union all
    select s.state_id, s.species_id from public.seasons s where s.id = p_season_id
  ) t
  on conflict (user_id, state_id, species_id) do nothing;
$$;
revoke all on function public._party_autofollow_target(uuid, uuid) from public;

-- create_party grows a second optional target. Old clients call it with only
-- p_window_id (named args), which still resolves against the defaults.
drop function public.create_party(uuid);
create function public.create_party(p_window_id uuid default null, p_season_id uuid default null)
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
  if num_nonnulls(p_window_id, p_season_id) <> 1 then
    raise exception 'exactly one of p_window_id or p_season_id is required';
  end if;

  select id, parties.invite_code into v_id, v_code
  from public.parties
  where owner_id = auth.uid()
    and (window_id = p_window_id or season_id = p_season_id);

  if v_id is null then
    v_code := upper(encode(gen_random_bytes(4), 'hex'));
    insert into public.parties (window_id, season_id, owner_id, invite_code)
    values (p_window_id, p_season_id, auth.uid(), v_code)
    returning id into v_id;
  end if;

  insert into public.party_members (party_id, user_id)
  values (v_id, auth.uid())
  on conflict do nothing;

  perform public._party_autofollow_target(p_window_id, p_season_id);
  return query select v_id, v_code;
end;
$$;
revoke all on function public.create_party(uuid, uuid) from public;
grant execute on function public.create_party(uuid, uuid) to authenticated;

-- join_party: auto-follow whichever target the joined party has.
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

  perform public._party_autofollow_target(v_party.window_id, v_party.season_id);
  return v_party.id;
end;
$$;

-- The window-only autofollow is superseded.
drop function if exists public._party_autofollow(uuid);
