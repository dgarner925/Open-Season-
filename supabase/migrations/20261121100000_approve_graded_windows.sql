-- Publish the application windows that the row-aware grader verified.
--
-- Scope is deliberately application_windows only. 68 pending `seasons` rows
-- also sit above 0.85, but their confidence comes from the page-level check --
-- "this date is printed somewhere on this page" -- which was just shown to be
-- nearly free to satisfy. They are not verified in the sense this migration
-- means, so they stay pending until the seasons path gets the same treatment.

-- 1. Drop redundant copies. The extractor proposed Colorado's primary draw
--    four times and two Loxahatchee windows twice each; these are `create`
--    rows, so applying them all would publish duplicates.
with ranked as (
  select id,
         row_number() over (
           partition by source_id,
                        proposed_payload->>'name',
                        proposed_payload->>'opens_at',
                        proposed_payload->>'closes_at'
           order by created_at, id
         ) rn
    from review_queue
   where status = 'pending'
     and target_table = 'application_windows'
     and confidence >= 0.85
)
update review_queue r
   set status = 'rejected',
       review_notes = coalesce(r.review_notes || ' | ', '')
         || 'duplicate of an identical proposal from the same source',
       updated_at = now()
  from ranked
 where ranked.id = r.id
   and ranked.rn > 1;

-- 2. Apply the rest, one at a time so a single bad row cannot roll back the
--    others, and quietly: these are back-filled 2026/27 windows, most of them
--    already past, and they should not fire a burst of notifications.
do $$
declare
  rec record;
  ok int := 0;
  bad int := 0;
begin
  for rec in
    select id, proposed_payload->>'name' nm
      from review_queue
     where status = 'pending'
       and target_table = 'application_windows'
       and confidence >= 0.85
       and cardinality(validation_errors) = 0
     order by created_at, id
  loop
    begin
      perform apply_review_item(rec.id, true);
      ok := ok + 1;
    exception when others then
      bad := bad + 1;
      raise notice 'could not apply % (%): %', rec.id, rec.nm, sqlerrm;
    end;
  end loop;
  raise notice 'applied % window(s), % failed', ok, bad;
end $$;
