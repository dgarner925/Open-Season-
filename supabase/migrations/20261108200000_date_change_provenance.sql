-- 20261108200000_date_change_provenance.sql
-- Phase 1 of the public change feed: give date_changes enough provenance to be
-- published, and make it impossible to publish the rows we cannot vouch for.
--
-- WHY THIS IS SMALLER THAN IT LOOKS
--   The correction-vs-revision distinction already exists. A quiet apply
--   (20261101120000) writes no date_changes row at all, so the table is
--   already meant to hold only genuine agency moves. This migration does not
--   add that judgement — it records what each row was about, and fences off
--   the rows written before that judgement existed.
--
-- WHAT IT ADDS
--   1. state_id / species_id on date_changes. The feed is "what changed in
--      Georgia", and answering that today means joining back to two different
--      target tables through an untyped target_id. The triggers have both ids
--      in hand; storing them makes the feed one indexed read.
--   2. cause. 'agency_revision' for anything the triggers log from here on,
--      'unknown' for everything logged before quiet apply went live. Clearing
--      the 2026-10-31 backlog would have produced 373 "dates changed" alerts
--      for dates that never moved in the real world; those rows must never
--      reach a public page, and before the quiet flag existed we cannot tell
--      them apart from real ones.
--   3. agency_date_changes — the view the feed reads. Joins state, species and
--      the source document, and exposes only revisions we can cite.
--
-- KNOWN LIMITATION, stated rather than papered over
--   A date edited by hand in the Supabase dashboard (not through
--   apply_review_item) gets logged as 'agency_revision', because the trigger
--   cannot see who called it. Closing that needs apply_review_item() to stamp
--   its review id into a transaction-local GUC the trigger reads — a one-line
--   change inside a 137-line security-definer function, which is not worth
--   bundling into a migration applied by hand. Until then: do not hand-edit a
--   PUBLISHED date outside the review queue, and read the feed's volume as an
--   upper bound on real agency movement.
--
-- SAFETY
--   Additive and re-runnable. No column is dropped, no existing row's dates
--   change, and the two trigger functions are replaced with bodies identical
--   to 20261101120000 apart from the three new columns.

-- ---------------------------------------------------------------------------
-- 1. Columns
--
--    Left nullable on purpose: a date_changes row outlives its target (there
--    is no FK to seasons), so a change whose season was later deleted keeps
--    its history with null ids rather than disappearing. The view filters
--    those out instead.
-- ---------------------------------------------------------------------------
alter table public.date_changes
  add column if not exists state_id   uuid references public.states(id)  on delete cascade,
  add column if not exists species_id uuid references public.species(id) on delete restrict,
  add column if not exists cause      text;

-- ---------------------------------------------------------------------------
-- 2. Backfill
--
--    The cutoff is when quiet apply went live, set a day after that
--    migration's timestamp on purpose: marking a real revision 'unknown'
--    costs one unpublished entry, marking one of our own corrections
--    'agency_revision' costs the feed its credibility. Move it later if quiet
--    apply reached production after 2026-11-02.
-- ---------------------------------------------------------------------------
update public.date_changes d
   set state_id = s.state_id, species_id = s.species_id
  from public.seasons s
 where d.target_table = 'seasons'
   and d.target_id = s.id
   and d.state_id is null;

update public.date_changes d
   set state_id = w.state_id, species_id = w.species_id
  from public.application_windows w
 where d.target_table = 'application_windows'
   and d.target_id = w.id
   and d.state_id is null;

update public.date_changes
   set cause = case
                 when created_at < timestamptz '2026-11-02T00:00:00Z' then 'unknown'
                 else 'agency_revision'
               end
 where cause is null;

alter table public.date_changes
  alter column cause set default 'agency_revision',
  alter column cause set not null;

alter table public.date_changes
  drop constraint if exists date_changes_cause_check;
alter table public.date_changes
  add constraint date_changes_cause_check
  check (cause in ('agency_revision', 'unknown', 'manual'));

-- ---------------------------------------------------------------------------
-- 3. Triggers — same bodies as 20261101120000 plus the new columns
-- ---------------------------------------------------------------------------
create or replace function public.log_season_date_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  -- A correction to our own data is not news. See quiet_apply_active().
  if public.quiet_apply_active() then
    return new;
  end if;

  if old.status = 'published' and new.status = 'published' then
    if old.open_date is not null and new.open_date is not null
       and old.open_date is distinct from new.open_date then
      insert into public.date_changes
        (target_table, target_id, field, old_date, new_date, state_id, species_id)
      values ('seasons', new.id, 'open_date', old.open_date, new.open_date,
              new.state_id, new.species_id)
      on conflict do nothing;
    end if;
    if old.close_date is not null and new.close_date is not null
       and old.close_date is distinct from new.close_date then
      insert into public.date_changes
        (target_table, target_id, field, old_date, new_date, state_id, species_id)
      values ('seasons', new.id, 'close_date', old.close_date, new.close_date,
              new.state_id, new.species_id)
      on conflict do nothing;
    end if;
  end if;
  return new;
end;
$fn$;

create or replace function public.log_window_date_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if public.quiet_apply_active() then
    return new;
  end if;

  if old.status = 'published' and new.status = 'published' then
    if old.closes_at is not null and new.closes_at is not null
       and old.closes_at is distinct from new.closes_at then
      insert into public.date_changes
        (target_table, target_id, field, old_date, new_date, state_id, species_id)
      values ('application_windows', new.id, 'closes_at', old.closes_at, new.closes_at,
              new.state_id, new.species_id)
      on conflict do nothing;
    end if;
    if old.results_expected_at is not null and new.results_expected_at is not null
       and old.results_expected_at is distinct from new.results_expected_at then
      insert into public.date_changes
        (target_table, target_id, field, old_date, new_date, state_id, species_id)
      values ('application_windows', new.id, 'results_expected_at',
              old.results_expected_at, new.results_expected_at,
              new.state_id, new.species_id)
      on conflict do nothing;
    end if;
  end if;
  return new;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 4. The feed's read model
--
--    security_invoker so the caller's RLS applies to the joined tables rather
--    than the view owner's — a view that quietly reads past RLS is how two of
--    the holes found in the 2026-09 audit got there. The feed runs as
--    service_role inside an edge function and is unaffected; nothing here is
--    granted to anon.
--
--    A row reaches this view only if it is an agency revision, still has a
--    state and species, and sits on a row that is published. Sourced or not
--    published: the feed's only value is that a reader can check it.
-- ---------------------------------------------------------------------------
drop view if exists public.agency_date_changes;

create view public.agency_date_changes
with (security_invoker = true)
as
  select d.id,
         d.created_at,
         st.code                                   as state_code,
         st.name                                   as state_name,
         sp.name                                   as species_name,
         sp.key                                    as species_key,
         'seasons'::text                           as kind,
         s.season_year,
         s.method::text                            as method,
         s.label,
         d.field,
         d.old_date,
         d.new_date,
         coalesce(src.agency_name, st.agency_name) as agency_name,
         src.url                                   as source_url
    from public.date_changes d
    join public.seasons s  on s.id  = d.target_id
    join public.states  st on st.id = d.state_id
    join public.species sp on sp.id = d.species_id
    left join public.sources src on src.id = s.source_id
   where d.target_table = 'seasons'
     and d.cause = 'agency_revision'
     and s.status = 'published'

  union all

  select d.id,
         d.created_at,
         st.code,
         st.name,
         sp.name,
         sp.key,
         'application_window'::text,
         w.season_year,
         null::text,
         w.name,
         d.field,
         d.old_date,
         d.new_date,
         coalesce(src.agency_name, st.agency_name),
         coalesce(src.url, w.application_url)
    from public.date_changes d
    join public.application_windows w on w.id = d.target_id
    join public.states  st on st.id = d.state_id
    join public.species sp on sp.id = d.species_id
    left join public.sources src on src.id = w.source_id
   where d.target_table = 'application_windows'
     and d.cause = 'agency_revision'
     and w.status = 'published';

comment on view public.agency_date_changes is
  'Publishable date revisions: agency moves only, on published rows, with the source document joined. Phase 1 of the public change feed.';

-- ---------------------------------------------------------------------------
-- 5. Indexes — the feed reads one state at a time, newest first
-- ---------------------------------------------------------------------------
create index if not exists date_changes_state_recent_idx
  on public.date_changes (state_id, created_at desc)
  where cause = 'agency_revision';

create index if not exists date_changes_target_idx
  on public.date_changes (target_table, target_id);

-- ---------------------------------------------------------------------------
-- 6. Grants. Unchanged posture: signed-in users only, nothing to anon.
-- ---------------------------------------------------------------------------
grant select on public.agency_date_changes to authenticated;
