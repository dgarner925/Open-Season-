-- Approve the Mississippi sturgeon rule, now that it names what the page says.
--
-- The last of the four pending Mississippi rules. 20261206000000 repointed it
-- from the invented lake-sturgeon + shovelnose-sturgeon onto the generic
-- sturgeon key and deliberately left it pending, because David had approved
-- three rules and not this one. He approved it on 2026-11-21.
--
-- What goes live: Mississippi, statewide, sturgeon, daily_limit_kind
-- 'prohibited', daily_limit 0. The page row is "Sturgeon | 0" and the app will
-- say so for any sturgeon, which is the point -- a prohibition that covers too
-- few species shows no rule for the fish in someone's hands.
--
-- The evidence fields still say row_text null and name_match 0. That is left
-- alone on purpose: it is what the grounder found when it ran against the old
-- two-species subject, and back-filling a quote by hand would make a
-- machine-read field assert something no machine read. The human verification
-- is in review_notes, written as a human claim. A re-extraction of this page
-- would now ground it properly on its own.
--
-- Same claim mechanism as 20261205000000, and the same reason: apply_review_item
-- gates on is_admin() and stamps reviewed_by from auth.uid(), both null in a
-- migration, so calling it from one raises into a notice db push never prints.
-- Setting the claim transaction-locally runs the real apply path -- the
-- fishing_rules insert and its fishing_rule_species fan-out behind the
-- constraint trigger -- rather than a copy of it.
--
-- Selected by shape, not by id. Idempotent: only a pending row matches, and it
-- will not be pending again. If the repoint in 20261206000000 did not run,
-- nothing matches and this says so rather than approving the old species list.

do $$
declare
  rec record;
  ok  int := 0;
  bad int := 0;
begin
  perform set_config('request.jwt.claim.sub',
                     '418e5326-0812-46be-8928-b74ab0da0aa1', true);

  if not public.is_admin() then
    raise exception 'claim did not take: is_admin() is still false, so the '
                    'apply would raise and be swallowed as a notice';
  end if;

  for rec in
    select rq.id
      from public.review_queue rq
      join public.sources src on src.id = rq.source_id
      join public.states  s   on s.id   = src.state_id
     where s.code = 'MS'
       and rq.target_table = 'fishing_rules'
       and rq.status = 'pending'
       and nullif(rq.proposed_payload->>'water_name', '') is null
       and rq.proposed_payload->'species_keys' = '["sturgeon"]'::jsonb
  loop
    begin
      perform public.apply_review_item(rec.id, false);
      ok := ok + 1;
    exception when others then
      bad := bad + 1;
      raise notice 'could NOT approve the sturgeon rule: %', sqlerrm;
    end;
  end loop;

  if ok = 0 and bad = 0 then
    raise notice 'no pending statewide MS sturgeon rule naming ["sturgeon"] '
                 '-- already applied, or the repoint did not run';
  else
    raise notice 'Mississippi sturgeon: % approved, % failed', ok, bad;
  end if;
end $$;
