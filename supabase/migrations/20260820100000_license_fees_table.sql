-- v1.4 "What it costs": license fee schedules per state/species.
-- Shape informed by the South + West fee crews:
--   kind 'base'  = the license everyone needs (annual hunting / combo)
--   kind 'tag'   = species tag/permit (the CO elk license, WV deer stamps)
--   kind 'addon' = required stamps/prerequisites (CO habitat stamp, MT
--                  conservation license + AIS pass, WV conservation stamp)
--   kind 'application' = draw application fees
--   kind 'combo' = bundles that cover several species (AR Sportsman's,
--                  MT big game combination, VA deer/turkey license) — the
--                  covers_species array lists the species keys included.
-- resident/nonresident amounts in cents; null = not offered or unknown.
-- required=true rows join the "ALL IN" math on the species page.

create table public.license_fees (
  id uuid primary key default gen_random_uuid(),
  state_id uuid not null references public.states(id) on delete cascade,
  species_id uuid references public.species(id) on delete cascade,
  kind text not null check (kind in ('base', 'tag', 'addon', 'application', 'combo')),
  label text not null,
  resident_cents integer,
  nonresident_cents integer,
  required boolean not null default false,
  covers_species text[],
  notes text,
  license_year text not null default '2026-27',
  source_id uuid references public.sources(id),
  last_verified_at timestamptz,
  status text not null default 'published',
  created_at timestamptz not null default now()
);

create unique index license_fees_dedupe
  on public.license_fees (state_id, kind, label, license_year);

create index license_fees_state_species
  on public.license_fees (state_id, species_id);

alter table public.license_fees enable row level security;

create policy "license fees are world readable"
  on public.license_fees for select
  using (status = 'published');
