-- 0002_reference.sql
-- Public reference data: the hunting-season knowledge base.
-- All of these are publicly readable ONLY where status = 'published'
-- (RLS in 0005). Writes are admin-only.

-- ---------------------------------------------------------------------------
-- sources — official agency documents backing every date/rule we publish.
-- Every season/window/reg points at one of these for the "official source" link.
-- ---------------------------------------------------------------------------
create table public.sources (
  id           uuid primary key default gen_random_uuid(),
  agency_name  text not null,                 -- e.g. 'Georgia DNR Wildlife Resources Division'
  url          text not null,
  doc_type     source_doc_type not null default 'webpage',
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger sources_set_updated_at
  before update on public.sources
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- states — all 50 seeded; is_active gates which appear in the app (V1 = 5).
-- ---------------------------------------------------------------------------
create table public.states (
  id          uuid primary key default gen_random_uuid(),
  code        char(2) not null unique,        -- 'GA', 'CO'
  name        text not null unique,           -- 'Georgia'
  agency_name text,                            -- default wildlife agency name
  is_active   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger states_set_updated_at
  before update on public.states
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- species — deer, elk, bear, duck. Extensible (turkey, pronghorn, ...).
-- ---------------------------------------------------------------------------
create table public.species (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,           -- 'deer' (stable machine key; drives color coding)
  name        text not null,                  -- 'Deer'
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- zones — first-class from day one. V1 mostly seeds 'statewide' rows.
-- Waterfowl uses zone_type = 'flyway_zone'; western draw units use 'gmu'.
-- ---------------------------------------------------------------------------
create table public.zones (
  id          uuid primary key default gen_random_uuid(),
  state_id    uuid not null references public.states(id) on delete cascade,
  type        zone_type not null default 'statewide',
  name        text not null,                  -- 'Statewide', 'Duck Zone 1', 'GMU 12'
  code        text,                           -- optional unit code, e.g. '12'
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (state_id, name)
);
create trigger zones_set_updated_at
  before update on public.zones
  for each row execute function public.set_updated_at();
create index zones_state_idx on public.zones(state_id);

-- ---------------------------------------------------------------------------
-- seasons — the core dataset. One row per (state, species, zone, method, split).
-- Waterfowl splits are just multiple rows sharing a zone (e.g. "Duck — Zone 1,
-- Split 2"). No special-case tables.
-- ---------------------------------------------------------------------------
create table public.seasons (
  id                 uuid primary key default gen_random_uuid(),
  state_id           uuid not null references public.states(id) on delete cascade,
  species_id         uuid not null references public.species(id) on delete restrict,
  zone_id            uuid not null references public.zones(id) on delete restrict,
  season_year        smallint not null,       -- 2026 = the 2026-27 license year
  method             season_method not null default 'general',
  label              text,                    -- optional display name, e.g. 'Archery — Split 1'
  open_date          date,                    -- nullable: leave NULL + TODO note if unverified
  close_date         date,
  bag_limit_summary  text,
  notes              text,                    -- zone notes, weapon restrictions, etc.
  source_id          uuid references public.sources(id) on delete set null,
  last_verified_at   timestamptz,
  status             content_status not null default 'draft',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- If both dates are present, close must not precede open.
  constraint seasons_date_order check (
    open_date is null or close_date is null or close_date >= open_date
  )
);
create trigger seasons_set_updated_at
  before update on public.seasons
  for each row execute function public.set_updated_at();
create index seasons_lookup_idx on public.seasons(state_id, species_id, status);
create index seasons_open_date_idx on public.seasons(open_date) where status = 'published';

-- ---------------------------------------------------------------------------
-- application_windows — draw/tag application periods. Deadlines are the
-- highest-urgency data in the app.
-- ---------------------------------------------------------------------------
create table public.application_windows (
  id                   uuid primary key default gen_random_uuid(),
  state_id             uuid not null references public.states(id) on delete cascade,
  species_id           uuid not null references public.species(id) on delete restrict,
  zone_id              uuid references public.zones(id) on delete set null, -- nullable per brief
  season_year          smallint not null,
  name                 text,                  -- 'Elk Limited Draw', 'Primary Draw'
  opens_at             date,
  closes_at            date,                  -- THE deadline
  results_expected_at  date,
  fee_summary          text,
  application_url      text,
  source_id            uuid references public.sources(id) on delete set null,
  last_verified_at     timestamptz,
  status               content_status not null default 'draft',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint app_window_date_order check (
    opens_at is null or closes_at is null or closes_at >= opens_at
  )
);
create trigger application_windows_set_updated_at
  before update on public.application_windows
  for each row execute function public.set_updated_at();
create index app_windows_lookup_idx on public.application_windows(state_id, species_id, status);
create index app_windows_closes_idx on public.application_windows(closes_at) where status = 'published';

-- ---------------------------------------------------------------------------
-- regulation_summaries — plain-English per state+species. At most one
-- published row per (state, species) enforced by a partial unique index.
-- ---------------------------------------------------------------------------
create table public.regulation_summaries (
  id                uuid primary key default gen_random_uuid(),
  state_id          uuid not null references public.states(id) on delete cascade,
  species_id        uuid not null references public.species(id) on delete restrict,
  body              text not null,            -- markdown
  source_id         uuid references public.sources(id) on delete set null,
  last_verified_at  timestamptz,
  status            content_status not null default 'draft',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger regulation_summaries_set_updated_at
  before update on public.regulation_summaries
  for each row execute function public.set_updated_at();
create unique index reg_summaries_one_published_idx
  on public.regulation_summaries(state_id, species_id)
  where status = 'published';
