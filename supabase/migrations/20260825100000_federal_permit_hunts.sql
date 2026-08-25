-- Federal permit hunts (Recreation.gov): USACE lake projects, USFWS refuge
-- hunts, USFS/NPS special hunts — bookable opportunities that exist in no
-- state season feed. Captured by scripts/ingest_recgov_permits.py; refreshed
-- by re-running it with --emit-migration (upserts on entity_id).

create table public.federal_permit_hunts (
  id uuid primary key default gen_random_uuid(),
  entity_id text not null unique,
  name text not null,
  agency text,
  state_code text,
  city text,
  description text,
  lat double precision,
  lng double precision,
  reservable boolean not null default false,
  url text not null,
  image_url text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create index federal_permit_hunts_state on public.federal_permit_hunts (state_code);

alter table public.federal_permit_hunts enable row level security;

create policy "federal permit hunts are world readable"
  on public.federal_permit_hunts for select
  using (true);
