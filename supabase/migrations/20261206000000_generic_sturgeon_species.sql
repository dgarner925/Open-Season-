-- A generic "sturgeon", because that is what the page says.
--
-- Mississippi's creel table has one sturgeon row, and it reads:
--
--   Sturgeon | 0
--
-- No species. Zero means no sturgeon may be kept, of any kind. The proposal
-- read that as two species -- lake sturgeon and shovelnose sturgeon -- and
-- grounding scored it 0.40 with row_text null and name_match 0, because the
-- subject it went looking for ("lake sturgeon, shovelnose sturgeon") is not
-- on the page. Grounding was right, and right for the right reason: the
-- number was never in doubt, the species list was invented.
--
-- Both keys do resolve, so the rule would have applied cleanly and looked
-- fine. That is the problem with it.
--
-- ---------------------------------------------------------------------------
-- WHY NARROWING A PROHIBITION IS THE DANGEROUS DIRECTION
--
-- The species table holds five sturgeon: atlantic, lake, shortnose,
-- shovelnose and white. Mississippi waters hold lake and shovelnose, the Gulf
-- subspecies of Atlantic sturgeon in the coastal rivers, and pallid sturgeon
-- in the Mississippi River -- which is federally endangered and is not in our
-- table at all.
--
-- So the proposal covered two of the species the page prohibits. A rule that
-- covers too FEW species on a prohibition does not fail safe: someone lands a
-- pallid sturgeon, the app shows no rule for it, and they keep a federally
-- endangered fish. An over-broad "no sturgeon" costs an angler a fish it
-- turns out they could have kept. That asymmetry decides it.
--
-- The honest encoding of "Sturgeon: 0" is a species the page's own word maps
-- to. There was no such key, so this adds one. It is not a taxonomic claim --
-- it is the regulated unit as the state names it, which is the same principle
-- the waters table already follows (a water is the stretch the state
-- regulates, not the river a map shows).
--
-- Sort order 1499 puts it immediately before the four named sturgeon.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DOES NOT DO
--
-- It does not approve the row. David approved three Mississippi rules; this
-- one he did not. It is left PENDING, now naming one species that matches the
-- page, for him to approve or not.
--
-- It also does not touch the evidence. row_text stays null and name_match
-- stays 0, because that is what the grounder actually found when it ran, and
-- back-filling a quote by hand would make a machine-read field say something
-- no machine read. The verification is recorded in review_notes instead,
-- where a person wrote it and it reads as a person's claim.
--
-- Nothing in the app keys off a species slug, so adding one is a pure data
-- change -- checked, not assumed.

-- 1. The key itself. Same shape and conflict clause as the fishing seed in
--    20261122002000, so re-running corrects rather than duplicates.
insert into public.species (key, name, category, pursuit, sort_order) values
  ('sturgeon', 'Sturgeon (all species)', 'other_fish', 'fishing', 1499)
on conflict (key) do update set
  name       = excluded.name,
  category   = excluded.category,
  pursuit    = excluded.pursuit,
  sort_order = excluded.sort_order;

-- 2. Repoint the pending Mississippi proposal onto it.
--
--    Matched by shape -- a pending MS fishing rule naming either of the two
--    invented keys -- so it cannot hit the wrong row, and a re-extraction that
--    makes the same guess is caught again. Idempotent: once the keys are
--    ["sturgeon"] the ?| no longer matches and this is a no-op.
update public.review_queue rq
   set proposed_payload = jsonb_set(rq.proposed_payload,
                                    '{species_keys}',
                                    '["sturgeon"]'::jsonb),
       review_notes = 'Species list corrected 2026-11-21. The page row is '
                      '"Sturgeon | 0" with no species named, so the rule is '
                      'repointed from the proposed lake-sturgeon + '
                      'shovelnose-sturgeon onto the generic sturgeon key. '
                      'Page re-read and the row confirmed verbatim by hand; '
                      'the evidence fields are left as the grounder produced '
                      'them. Still pending: the number was never in question, '
                      'the species list was.',
       updated_at = now()
  from public.sources src
  join public.states  s on s.id = src.state_id
 where src.id = rq.source_id
   and s.code = 'MS'
   and rq.target_table = 'fishing_rules'
   and rq.status = 'pending'
   and (rq.proposed_payload->'species_keys') ?| array['lake-sturgeon',
                                                      'shovelnose-sturgeon'];
