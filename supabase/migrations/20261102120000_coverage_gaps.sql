-- Coverage gaps — the watchdog's working memory.
--
-- scripts/audit_coverage.py has always been able to COUNT the holes, but a
-- count is not actionable: on 2026-11-02 it read 106 gaps, and the honest
-- answer for most of them was "the agency has not published next season yet,
-- which is fine". The few that mattered (duck in IA/MT/OH/SC/WV, goose in
-- MD/SC/WV — seasons open RIGHT NOW) were buried in the noise, and had been
-- for weeks, because nothing classified them and nothing ran the script.
--
-- So the gaps get a table. coverage-watch classifies each one, extract-source
-- reads it to decide what to re-fetch, and a human only ever sees the rows
-- that are actually wrong.

create table if not exists public.coverage_gaps (
  id          uuid primary key default gen_random_uuid(),
  state_id    uuid not null references public.states(id) on delete cascade,
  species_id  uuid not null references public.species(id) on delete cascade,

  -- never_covered     — no season row has EVER existed for this pair.
  -- stale_in_season   — last year's dates say this should be open or opening
  --                     soon, and we have nothing. The hole that hurts.
  -- out_of_season     — out of season; next year's dates aren't published
  --                     anywhere yet. Expected, and not worth anyone's time.
  -- not_huntable      — the pair looks like a state_species mapping error:
  --                     the state does not actually offer this season.
  kind        text not null check (kind in
                ('never_covered', 'stale_in_season', 'out_of_season', 'not_huntable')),

  -- Where last year's dates say the next opener lands. Null when we have no
  -- history to project from.
  projected_open date,
  -- One line of reasoning, for the admin screen. Written by the classifier.
  detail      text,
  -- The source most likely to answer this gap — what extract-source re-fetches.
  source_id   uuid references public.sources(id) on delete set null,
  -- Higher = fetch sooner. stale_in_season outranks never_covered.
  priority    int not null default 0,
  checked_at  timestamptz not null default now(),

  -- One row per pair: this is current state, not a log.
  unique (state_id, species_id)
);

create index if not exists coverage_gaps_triage
  on public.coverage_gaps (priority desc, checked_at)
  where kind in ('stale_in_season', 'never_covered');

alter table public.coverage_gaps enable row level security;

-- Operational data: admins read it, nothing else does. The watchdog and the
-- extractor both run as service_role, which bypasses RLS entirely.
drop policy if exists coverage_gaps_admin_read on public.coverage_gaps;
create policy coverage_gaps_admin_read on public.coverage_gaps
  for select using (public.is_admin());

comment on table public.coverage_gaps is
  'Classified coverage holes. Written by coverage-watch, read by extract-source gap mode and the admin screen.';
