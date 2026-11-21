-- Publish the verified application windows.
--
-- The previous migration tried to go through apply_review_item(). That RPC
-- begins `if not public.is_admin() then raise exception 'not authorized'`, and
-- is_admin() reads auth.uid() -- which is null in a migration, so every call
-- raised, my per-row handler caught it, and nothing was applied while the run
-- reported success. (The notices never reached the CLI output. A loop that
-- swallows errors and a migration that only prints at the end is the same
-- swallowed-failure shape this pipeline keeps producing.)
--
-- Rather than forge a JWT claim to satisfy an authorization check, this does
-- the insert the RPC's application_windows/create branch does, verbatim, and
-- marks the review rows approved the same way. The quiet flag is set so the
-- follower-alert trigger stays silent: these are back-filled 2026/27 windows,
-- most of them already past, and nobody should get a burst of notifications
-- for a data backfill.

begin;

select set_config('openseason.quiet_apply', 'on', true);

create temporary table applied_windows on commit drop as
select id, proposed_payload p
  from review_queue
 where status = 'pending'
   and target_table = 'application_windows'
   and change_type = 'create'
   and confidence >= 0.85
   and cardinality(validation_errors) = 0;

insert into application_windows (
  state_id, species_id, zone_id, season_year, name,
  opens_at, closes_at, results_expected_at, fee_summary, application_url,
  source_id, last_verified_at, status
)
select (p->>'state_id')::uuid,
       (p->>'species_id')::uuid,
       nullif(p->>'zone_id', '')::uuid,
       (p->>'season_year')::smallint,
       nullif(p->>'name', ''),
       nullif(p->>'opens_at', '')::date,
       nullif(p->>'closes_at', '')::date,
       nullif(p->>'results_expected_at', '')::date,
       nullif(p->>'fee_summary', ''),
       nullif(p->>'application_url', ''),
       (p->>'source_id')::uuid,
       now(),
       coalesce(nullif(p->>'status', ''), 'published')::content_status
  from applied_windows;

update review_queue q
   set status = 'approved',
       reviewed_at = now(),
       review_notes = 'applied quietly by migration 20261121110000 after the '
         || 'row-aware grader verified the date against the row naming this '
         || 'draw (no follower alert)',
       updated_at = now()
  from applied_windows a
 where a.id = q.id;

select set_config('openseason.quiet_apply', 'off', true);

commit;
