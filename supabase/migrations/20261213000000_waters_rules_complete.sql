-- A water with no rules learns to say which kind of nothing it is.
--
-- ===========================================================================
-- WHY A MAJOR-WATERS LIST NEEDS THIS COLUMN FIRST
--
-- `waters` has been an EXCEPTIONS table. A row exists because the state
-- publishes something unusual there; Georgia says so outright -- "There are no
-- minimum length limits on freshwater game fish unless they are listed below."
-- So Lake Sinclair, one of the most-fished reservoirs in the state, is
-- correctly absent: Georgia publishes no exception for it.
--
-- That is defensible for a table nobody browses and indefensible for a
-- State -> Water -> Fish screen, where a reader goes looking for the lake they
-- are standing on. The fix is to also list the waters people actually name.
-- But the moment a row can exist WITHOUT carrying a rule, "this water has no
-- rules" becomes ambiguous, and the two meanings pull opposite ways:
--
--   NO EXCEPTION EXISTS   Lake Sinclair. Somebody read Georgia's exception
--                         lists and this lake is not on any of them. The
--                         statewide rules are the complete answer. Saying so
--                         is the most useful thing the screen can do.
--
--   NOT READ YET          Lake Seminole. Georgia closes five marked fish
--                         refuges there to ALL fishing from May 1 - Oct 31,
--                         published on the General Regulations page. We hold
--                         zero rules for it. A reader told "the statewide
--                         rules apply here" would be told something false
--                         about a closed area.
--
-- Both are a water with no rules. Today the Waters tab shows both under "we
-- have not transcribed rules for them yet", which is wrong about Sinclair, and
-- after this migration's data would be wrong about every lake added.
--
-- ===========================================================================
-- WHY last_verified_at COULD NOT BE REUSED
--
-- It looked like the obvious home for this, and it is already taken. Measured
-- on production 2026-11-22: all 220 waters across all seven states have
-- last_verified_at set, Georgia 63 of 63 included. It records when the row was
-- last extracted, not what anybody checked.
--
-- Lake Seminole is the counterexample that settles it: last_verified_at is
-- set, it has no rules, and the state publishes a closure for it. If the
-- screen read that column as "no exception exists", it would announce
-- statewide rules over a seasonal closure.
--
-- That is the `size_rule = 'none'` mistake again -- one field doing two jobs
-- that disagree -- and migration 20261212000000 was the last one written to
-- undo it. A separate column is the whole point.
--
-- ===========================================================================
-- WHAT SETTING IT CLAIMS
--
--   rules_complete_at = <when>
--     On that date somebody read every exception list the state publishes --
--     for Georgia: General Regulations, Game Species Daily Limits, Trout
--     Fishing, Trout Streams by County, Public Fishing Areas, and Agreements
--     with Bordering States -- and what we hold for this water is everything
--     they publish for it. Zero rules plus this date means "no exception
--     exists", which is a finding, not a gap.
--
--   rules_complete_at IS NULL
--     Nobody has made that claim. There may be rules we do not hold. This is
--     the default and it stays the default: no backfill, no heuristic, no
--     "it has rules so it is probably complete". A claim about completeness
--     can only be made by reading the source, so the column is filled by the
--     migration that does the reading.
--
-- Deliberately NULL for all 220 existing rows, including the 63 Georgia
-- waters whose rules were read off the pages in 20261122030000. Those were
-- transcribed per-page, not per-water: the trout pass read the trout page and
-- had no occasion to check whether the same creek appears in the PFA list. We
-- do not know they are complete, so we do not say so.

alter table waters
  add column if not exists rules_complete_at timestamptz;

comment on column waters.rules_complete_at is
  'When the state''s exception lists were last read end-to-end for THIS water '
  'and what we hold was confirmed to be everything they publish for it. NULL '
  'means no such claim: there may be rules we do not hold. Zero rules plus a '
  'date means the state publishes no exception here and the statewide rules '
  'are the complete answer -- distinct from last_verified_at, which only '
  'records when the row itself was extracted.';

-- It cannot predate the row. A claim timestamped before the water existed is
-- not merely wrong, it is unreadable -- there is no way to tell whether the
-- date or the claim is the mistake.
--
-- "And not in the future" is NOT in here, though it is just as true, because
-- Postgres rejects a CHECK that calls now(): the planner needs the expression
-- to be IMMUTABLE and now() is only STABLE. A constraint that cannot be
-- written is better left out than faked with a hardcoded date, which would
-- quietly start rejecting honest writes the day it passed.
alter table waters drop constraint if exists waters_rules_complete_sane;
alter table waters add constraint waters_rules_complete_sane
  check (
    rules_complete_at is null
    or rules_complete_at >= created_at - interval '1 day'
  ) not valid;

-- `not valid` above skips the check for the 220 existing rows, which all hold
-- NULL and would pass anyway; validating separately keeps the ACCESS EXCLUSIVE
-- lock short on a table the app reads on every Waters tab open.
alter table waters validate constraint waters_rules_complete_sane;

-- Partial, because the only query that wants it asks for the waters where a
-- claim HAS been made, and that will stay the minority for a long time.
create index if not exists waters_rules_complete_idx
  on waters (state_id, rules_complete_at)
  where rules_complete_at is not null;

do $$
declare
  n_total int;
  n_claim int;
begin
  select count(*), count(rules_complete_at) into n_total, n_claim from waters;
  raise notice 'waters: % rows, % with a completeness claim (expected 0 here)',
    n_total, n_claim;
end $$;
