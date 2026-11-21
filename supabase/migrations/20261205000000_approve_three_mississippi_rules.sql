-- Approve the three Mississippi rules whose numbers are verbatim on the page.
--
-- David reviewed the Mississippi queue on 2026-11-21 -- 41 waters and 32 rules
-- approved, 42 rejected -- leaving four rules pending. These are the three he
-- approved on 2026-11-21 after each was checked against the page:
--
--   walleye     3/day statewide     page row: "Walleye*** 3"
--   paddlefish  2/day, max 30in     page row: "2 Paddlefish* (must be less
--                                              than 30 inches)"
--   sauger      10/day statewide    page row: "Sauger 10"
--
-- The fourth, sturgeon, is NOT approved here. It names two species the page
-- does not; 20261206000000 repoints it and leaves it pending.
--
-- ---------------------------------------------------------------------------
-- THE ASTERISKS ARE NOT A DEFECT, THOUGH THEY LOOK LIKE ONE
--
-- Two of these rows carry footnote markers, and the footnotes are substantive:
--
--   ***  harvest and possession of walleye is PROHIBITED in Lake Lamar Bruce,
--        Elvis Presley Lake, Lake Monroe, the Old Tombigbee River and its
--        tributaries north of Hwy 278, and Choctaw Lake
--   *    no paddlefish harvest in the Tenn-Tom Waterway, the Tombigbee River
--        or its tributaries, or Pickwick Lake
--
-- A statewide "3/day" that silently dropped those would tell someone they may
-- keep a walleye on Choctaw Lake, where they may not. It does not drop them.
-- The extractor read each footnote and emitted its exceptions as their own
-- per-water rows -- walleye prohibited/0 on all five waters, paddlefish
-- prohibited/0 on all three, alligator gar on Bee Lake -- and all nine are
-- already approved and bound to the right water. A statewide number plus
-- per-water overrides is the correct shape for this schema.
--
-- Worth recording because the first read of this said the opposite. The
-- footnote text being absent from the statewide row looked like the same
-- swallowed-detail class that has cost several rounds here, and it was not:
-- the detail was in a sibling row the single-row view does not show.
--
-- ---------------------------------------------------------------------------
-- WHY THIS SETS A JWT CLAIM
--
-- apply_review_item() opens with `if not public.is_admin() then raise
-- exception 'not authorized'`, and both is_admin() and the reviewed_by stamp
-- read auth.uid(), which is null in a migration. So every call from a
-- migration raises. That is what happened to the 42 graded windows in
-- 20261121100000: the loop swallowed 42 'not authorized' notices, and
-- 20261121110000 had to hand-copy the insert to finish the job. Those 42 rows
-- still carry reviewed_by = null, which is how this was spotted.
--
-- Hand-copying is worse here than it was there. A fishing rule is two writes
-- -- fishing_rules, then the fishing_rule_species fan-out -- behind a
-- constraint trigger that requires the second. A copy of that is a second
-- code path to keep in step.
--
-- So instead the claim is set transaction-locally and the REAL apply path
-- runs. reviewed_by then records David, which is accurate: he reviewed these
-- three and asked for them. auth.uid() reads request.jwt.claim.sub first;
-- verified against the live function definition, not assumed.
--
-- ---------------------------------------------------------------------------
-- Selected by SHAPE, not by id: statewide rows whose species set is a subset
-- of those three. Re-running changes nothing, because only 'pending' rows are
-- eligible and these will not be pending again. Each is applied in its own
-- block so one failure cannot roll back the others.

do $$
declare
  rec record;
  ok  int := 0;
  bad int := 0;
begin
  perform set_config('request.jwt.claim.sub',
                     '418e5326-0812-46be-8928-b74ab0da0aa1', true);

  if not public.is_admin() then
    raise exception 'claim did not take: is_admin() is still false, so every '
                    'apply would raise and be swallowed as a notice';
  end if;

  for rec in
    select rq.id,
           (rq.proposed_payload->'species_keys')->>0 as sp
      from public.review_queue rq
      join public.sources src on src.id = rq.source_id
      join public.states  s   on s.id   = src.state_id
     where s.code = 'MS'
       and rq.target_table = 'fishing_rules'
       and rq.status = 'pending'
       and nullif(rq.proposed_payload->>'water_name', '') is null
       and (select array_agg(x)
              from jsonb_array_elements_text(rq.proposed_payload->'species_keys') t(x))
           <@ array['walleye', 'paddlefish', 'sauger']
     order by sp
  loop
    begin
      perform public.apply_review_item(rec.id, false);
      ok := ok + 1;
      raise notice 'approved %', rec.sp;
    exception when others then
      bad := bad + 1;
      raise notice 'could NOT approve %: %', rec.sp, sqlerrm;
    end;
  end loop;

  raise notice 'Mississippi: % approved, % failed', ok, bad;

  if ok = 0 and bad = 0 then
    raise notice 'nothing pending matched -- already applied';
  end if;
end $$;
