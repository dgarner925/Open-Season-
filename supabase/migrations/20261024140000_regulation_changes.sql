-- 20261024140000_regulation_changes.sql
-- "What changed this year" — year-over-year regulation differences.
--
-- Distinct from date_changes, which watches a PUBLISHED row being revised
-- mid-year and pushes an alert. This table compares one license year against
-- the last at the record level: seasons that moved, were added, or disappeared,
-- plus bag-limit changes. The diff is computed deterministically in code; the
-- note is phrased by a model that cannot introduce a date the diff didn't
-- contain, and falls back to a plainly-composed sentence when it tries.

create table if not exists public.regulation_changes (
  id            uuid primary key default gen_random_uuid(),
  state_id      uuid not null references public.states(id) on delete cascade,
  species_id    uuid references public.species(id) on delete set null,
  target_table  text not null default 'seasons'
                check (target_table in ('seasons', 'application_windows')),
  change_type   text not null check (change_type in ('added', 'removed', 'modified')),
  -- Loose references on purpose: the old year's row may be pruned later, and
  -- losing the note with it would be worse than a dangling id.
  old_id        uuid,
  new_id        uuid,
  old_year      smallint,
  new_year      smallint,
  field_diffs   jsonb not null default '[]'::jsonb,
  note          text,                       -- plain-English, model-phrased or composed
  note_phrased  boolean not null default false,  -- false = deterministic fallback
  note_model    text,
  published     boolean not null default true,
  -- Re-running the diff must update rows, not duplicate them.
  dedupe_key    text not null unique,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists regulation_changes_state_idx
  on public.regulation_changes (state_id, new_year desc, created_at desc);
create index if not exists regulation_changes_new_id_idx
  on public.regulation_changes (new_id) where new_id is not null;

create trigger regulation_changes_set_updated_at
  before update on public.regulation_changes
  for each row execute function public.set_updated_at();

alter table public.regulation_changes enable row level security;

-- Public reference content, same posture as date_changes: any signed-in
-- hunter may read it; only the pipeline (service_role) writes.
drop policy if exists regulation_changes_read on public.regulation_changes;
create policy regulation_changes_read on public.regulation_changes
  for select to authenticated using (published);
grant select on public.regulation_changes to authenticated;
