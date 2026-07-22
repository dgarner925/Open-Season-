-- 20260719200000_user_locations.sql
-- Saved hunting locations (state + optional game-management unit) that a hunter
-- can switch between, per the Midnight redesign's location model. Each user keeps
-- several; profiles.active_location_id points at the one currently in focus.
-- Units come from public.zones (type 'gmu'); where a state has none, a location
-- is state-only (zone_id null = "Statewide").

create table if not exists public.user_locations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  state_id   uuid not null references public.states(id) on delete cascade,
  zone_id    uuid references public.zones(id) on delete set null,
  created_at timestamptz not null default now()
);

-- One row per (user, state, unit). Two partial indexes because NULLs aren't
-- deduped by a plain unique constraint (a state-only location must be unique too).
create unique index if not exists user_locations_uniq_unit
  on public.user_locations (user_id, state_id, zone_id) where zone_id is not null;
create unique index if not exists user_locations_uniq_statewide
  on public.user_locations (user_id, state_id) where zone_id is null;

alter table public.user_locations enable row level security;
drop policy if exists user_locations_own on public.user_locations;
create policy user_locations_own on public.user_locations
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- The location currently in focus (drives the dashboard chip + default scope).
alter table public.profiles
  add column if not exists active_location_id uuid references public.user_locations(id) on delete set null;
