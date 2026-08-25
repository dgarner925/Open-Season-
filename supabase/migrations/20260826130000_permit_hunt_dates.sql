-- Best-effort dates for federal permit hunts, parsed from Recreation.gov
-- description text by scripts/ingest_recgov_permits.py with a strict freshness
-- gate (only current-season years are ever ingested). A hunt with rows here
-- gets real reminders; a hunt without stays a saveable bookmark.
create table if not exists public.federal_permit_hunt_dates (
  id          uuid primary key default gen_random_uuid(),
  permit_id   uuid not null references public.federal_permit_hunts(id) on delete cascade,
  label       text,
  open_date   date not null,
  close_date  date,
  created_at  timestamptz not null default now()
);
create index if not exists fph_dates_permit_idx on public.federal_permit_hunt_dates(permit_id);
create index if not exists fph_dates_open_idx on public.federal_permit_hunt_dates(open_date);

alter table public.federal_permit_hunt_dates enable row level security;
create policy fph_dates_world_read on public.federal_permit_hunt_dates
  for select using (true);

-- New notification subject for permit segment openers (used by the
-- notifications_due() recreation in the next migration — the value can't be
-- referenced in the transaction that adds it).
alter type public.notification_subject_type add value if not exists 'permit_opener';
