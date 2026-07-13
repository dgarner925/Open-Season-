-- 0004_review_queue.sql
-- Phase 2 automated-refresh landing zone. The extraction pipeline NEVER
-- auto-publishes: proposed changes land here for an admin to approve/reject.

create table public.review_queue (
  id                uuid primary key default gen_random_uuid(),
  target_table      text not null,            -- 'seasons' | 'application_windows' | 'regulation_summaries'
  target_id         uuid,                     -- null for 'create', set for 'update'
  change_type       review_change_type not null,
  proposed_payload  jsonb not null,           -- the extracted row, shaped like the target table
  current_snapshot  jsonb,                     -- the existing row at extraction time (for 'update')
  diff              jsonb,                     -- optional precomputed field-level diff
  source_id         uuid references public.sources(id) on delete set null,
  extraction_run_id uuid,                      -- groups a batch from one Edge Function run
  confidence        numeric(3,2),              -- optional model confidence 0.00–1.00
  status            review_status not null default 'pending',
  reviewed_by       uuid references auth.users(id) on delete set null,
  reviewed_at       timestamptz,
  review_notes      text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint review_target_table_allowed check (
    target_table in ('seasons', 'application_windows', 'regulation_summaries')
  ),
  constraint review_update_needs_target check (
    change_type = 'create' or target_id is not null
  )
);
create trigger review_queue_set_updated_at
  before update on public.review_queue
  for each row execute function public.set_updated_at();
create index review_queue_status_idx on public.review_queue(status, created_at);
