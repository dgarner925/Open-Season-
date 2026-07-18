-- 20260717140000_point_balances.sql
-- Preference/bonus point tracker: a running points balance per (state, species,
-- type) that a hunter carries year to year toward a draw. Owner-only, like the
-- rest of the user data.

create table public.user_point_balances (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  state_id    uuid not null references public.states(id) on delete cascade,
  species_id  uuid not null references public.species(id) on delete cascade,
  point_type  text not null default 'preference',   -- 'preference' | 'bonus'
  points      smallint not null default 0,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint point_type_allowed check (point_type in ('preference', 'bonus')),
  constraint points_nonneg check (points >= 0),
  unique (user_id, state_id, species_id, point_type)
);
create index user_point_balances_user_idx on public.user_point_balances(user_id);

create trigger user_point_balances_set_updated_at
  before update on public.user_point_balances
  for each row execute function public.set_updated_at();

alter table public.user_point_balances enable row level security;
create policy point_balances_owner_all on public.user_point_balances
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
