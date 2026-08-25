-- permit_follows — a user follows a federal permit hunt (Recreation.gov entity),
-- e.g. a USACE managed hunt at Lake Allatoona. Mirrors public.follows: owner-only
-- rows keyed to auth.users, cascading both ways.
create table if not exists public.permit_follows (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  permit_id   uuid not null references public.federal_permit_hunts(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user_id, permit_id)
);
create index if not exists permit_follows_user_idx on public.permit_follows(user_id);

alter table public.permit_follows enable row level security;
create policy permit_follows_owner_all on public.permit_follows
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
