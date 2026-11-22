-- Two Georgia rules that were in the wrong place, found by reading the pages
-- the major-waters pass had to read anyway.
--
-- Neither is a new source and neither needs an extraction. Both are a rule we
-- already had, or already had the words for, sitting somewhere that makes the
-- app say something untrue.
--
-- ===========================================================================
-- PART 1: A PUBLIC-FISHING-AREA LIMIT WAS PUBLISHED AS A STATEWIDE ONE
--
-- Georgia's 17 statewide fishing rules include this one, measured 2026-11-22:
--
--     channel catfish, 5 per day. notes: "PFA default unless otherwise
--     posted." water_id: NULL.
--
-- water_id NULL means statewide. The note says what the rule actually is: the
-- default on the state's eleven Public Fishing Areas, off the Public Fishing
-- Areas page. On the rest of Georgia's 500,000 acres of lakes, channel
-- catfish have NO daily limit -- the daily-limits table says "No limit" in as
-- many words, and we hold that rule too, also statewide.
--
-- So the app held both of these as statewide, for the same species:
--
--     "No daily limit"        correct, from the daily-limits table
--     "5 per day"             a PFA rule wearing statewide's clothes
--
-- A reader picking channel catfish anywhere in Georgia was shown two rules
-- that contradict each other. Restrictive-and-wrong is the less dangerous
-- direction, but it is still a false number, and worse, it is the kind that
-- destroys trust in the four cards around it.
--
-- The fix is a move, not a delete. `waters` already holds the row the rule
-- belongs to -- "Public Fishing Area lakes operated by the Department of
-- Natural Resources", which carries the 14-inch largemouth minimum from the
-- same page. Pointing the rule at it makes the rule true and keeps it.
--
-- Matched on the note text rather than on species and count, because the note
-- is the thing that identifies it: a future statewide channel catfish rule of
-- 5 would be a real rule and must not be swept up by a re-run.
do $$
declare
  v_state uuid;
  v_pfa   uuid;
  n_moved int;
begin
  select id into v_state from states where code = 'GA';
  select id into v_pfa from waters
   where state_id = v_state
     and slug = 'public-fishing-area-lakes-operated-by-the-department-of-natural-resources';

  if v_pfa is null then
    raise exception 'the PFA water row is missing; not moving the rule to nowhere';
  end if;

  update fishing_rules
     set water_id = v_pfa,
         notes = 'Public Fishing Area default daily limit unless a different '
                 'limit is posted at the area. Statewide, channel catfish '
                 'have no daily limit.',
         updated_at = now()
   where state_id = v_state
     and water_id is null
     and notes = 'PFA default unless otherwise posted.';

  get diagnostics n_moved = row_count;
  raise notice 'PFA channel catfish rule moved off the statewide list: % (expected 1)', n_moved;
  if n_moved <> 1 then
    raise warning 'expected to move exactly 1 rule, moved % -- the note text may have changed', n_moved;
  end if;
end $$;

-- ===========================================================================
-- PART 2: LAKE SEMINOLE'S CLOSURE, AND WHY IT IS NOT A RULE ROW
--
-- Lake Seminole has been in `waters` with zero rules since the Georgia pass.
-- It is not a water with no exception -- Georgia publishes one for it, on the
-- General Regulations page we already hold:
--
--     "Lake Seminole: All fishing, including spear fishing, for any species
--     in the marked areas around five fish refuges in Lake Seminole is
--     prohibited from May 1 - October 31 each year."
--
-- That is the counterexample 20261213000000 was built around: a water with
-- last_verified_at set, no rules, and a real closure. Left as it is, the
-- Waters tab would eventually say the statewide rules are the whole answer on
-- a lake with five seasonally closed areas in it.
--
-- IT IS RECORDED IN notes, NOT AS A fishing_rules ROW, and that is the
-- careful choice rather than the lazy one. The closure applies to MARKED AREAS
-- AROUND FIVE REFUGES, not to Lake Seminole. `fishing_rules` can say "this
-- water, this species, this window" and has no way to say "these five marked
-- areas within this water". A row reading
--
--     Lake Seminole -- all fishing prohibited, May 1 to Oct 31
--
-- would be a far bigger error than the silence it replaced: it would close
-- one of the best bass lakes in the South for six months of every year.
-- There is no honest rule row to write here, so the state's own sentence goes
-- in notes, which the Waters tab now renders, and the extent stays in the
-- state's words where nobody can round it off.
--
-- Seminole also sits under two agreements -- Alabama's and Florida's -- and
-- both say Georgia's own creel and possession limits apply on the Georgia
-- portion, so neither adds a limit. With the closure recorded, Seminole is
-- complete.
do $$
declare
  v_state uuid;
  n int;
begin
  select id into v_state from states where code = 'GA';

  update waters
     set notes =
           'Fishing of any kind, spear fishing included, is prohibited from '
           'May 1 to October 31 each year in the marked areas around five '
           'fish refuges in the lake. The rest of the lake is open; the '
           'closure applies only inside those marked areas. '
           'Shared with Alabama and Florida: a Georgia, Alabama or Florida '
           'licence is valid under those agreements, and Georgia''s own creel '
           'and possession limits apply on the Georgia portion.',
         rules_complete_at = now(),
         updated_at = now()
   where state_id = v_state and slug = 'lake-seminole';

  get diagnostics n = row_count;
  raise notice 'Lake Seminole closure recorded: % row (expected 1)', n;
  if n <> 1 then
    raise warning 'Lake Seminole not found by slug; the closure is still unrecorded';
  end if;
end $$;

-- ===========================================================================
-- WHAT THIS MIGRATION DOES NOT FIX, SO IT IS WRITTEN DOWN SOMEWHERE
--
-- 1. SEVEN PUBLIC FISHING AREAS PUBLISH LIMITS WE DO NOT HOLD. Read off the
--    Public Fishing Areas page 2026-11-22, against our rows:
--
--      Ocmulgee PFA      largemouth bass are CATCH-AND-RELEASE   0 rules held
--      Dodge County      16-24" released; 5, only 1 over 24"     0 rules held
--      Evans County      12-16" released; 5, only 1 over 16"     0 rules held
--      Hugh M. Gillis    16-24" released; 5 total                0 rules held
--      Marben            5, only 1 may be 16" or longer          0 rules held
--      Paradise          5 hybrids; 5 bass, only 1 over 24"      0 rules held
--      Silver Lake       Panic Pond and House Pond each differ    0 rules held
--
--    This is NOT currently a wrong answer in the app, and the distinction
--    matters: all seven have rules_complete_at NULL, so the Waters tab says
--    we have not transcribed their rules and to check the regulations. That
--    is true. It becomes a wrong answer the moment anybody marks one of them
--    complete, which is why none of them is touched here.
--
--    The PFA default daily limits are missing too -- 5 largemouth, 15 bream,
--    against statewide 10 and 50 -- so the PFA water row holds a length limit
--    and a catfish limit and no bag limits.
--
-- 2. GEORGIA HAS TWO STATEWIDE BLACK BASS LIMITS OF 10, read off two
--    different pages, with different species lists (one includes redeye and
--    Guadalupe bass, the other does not) and different notes. 20261208000000
--    deleted byte-identical duplicates and left these, correctly by its own
--    fingerprint, but a reader picking largemouth sees "10 per day" twice.
--    Deciding which species list is right needs the two pages read side by
--    side against the Game Species table, which is its own job.
