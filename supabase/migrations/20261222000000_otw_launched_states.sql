-- Which states On the Water has actually launched in.
--
-- ===========================================================================
-- WHY A COLUMN AND NOT A COUNT
--
-- The Woods/Water toggle sits in the hunting Home header with no gate, so
-- every angler in all fifty states can switch to a fishing section that has
-- published rules in six of them. The obvious fix is to gate on "does this
-- state have any fishing rules", and it is wrong. Measured 2026-11-23:
--
--   state   waters   regulated   statewide rules
--   GA          90          53                16     launch
--   MS          41          22                 9     launch
--   SC          38          12                 4     launch
--   TN          34          21                10     launch
--   AL          25          23                 5     launch
--   FL          17          14                 4     launch
--   NC           2           0                 3     NOT launched
--
-- North Carolina holds three statewide rules and two waters with no rules at
-- all. It would pass any "has fishing data" test while giving a reader
-- essentially nothing -- the worst of both, because a state that opens and
-- then has no answers reads as a broken app rather than an absent feature.
--
-- Any threshold that excludes NC and admits the other six is a number picked
-- to produce the answer we already wanted. So the answer is recorded
-- directly: launching a state is an editorial judgement about whether its
-- data is good enough to stand behind, and this column is where that
-- judgement lives. Adding the seventh state is then one UPDATE, not a
-- re-argued threshold and not a client release.
--
-- ===========================================================================
-- WHAT IT DOES NOT DO
--
-- This is not a security boundary and must not be mistaken for one. The
-- fishing tables stay world-readable for published rows -- `anon` can read
-- North Carolina's three rules today and that is fine, they are published
-- regulations. The column decides whether the APP OFFERS the fishing
-- section, which is a product decision, not an access one.
--
-- It is also deliberately not `is_active`. That column gates whether a state
-- appears at all, for hunting too; overloading it would hide Ohio's deer
-- seasons to avoid offering Ohio a fishing tab.

alter table states
  add column if not exists otw_launched boolean not null default false;

comment on column states.otw_launched is
  'Has On the Water launched in this state: an editorial judgement about '
  'whether the fishing data is good enough to stand behind, NOT a row count. '
  'North Carolina has three published rules and would pass any count-based '
  'test while answering almost nothing. Gates whether the app offers the '
  'Woods/Water toggle and the (otw) route group; it is not a security '
  'boundary, and published fishing rules stay world-readable in every state.';

-- The six, by name, so the diff is the decision.
update states set otw_launched = true
 where code in ('GA', 'AL', 'FL', 'TN', 'MS', 'SC');

do $$
declare
  n_launched int;
  v_codes text;
  n_nc int;
begin
  select count(*), string_agg(code, ',' order by code)
    into n_launched, v_codes
    from states where otw_launched;

  select count(*) into n_nc from states where code = 'NC' and otw_launched;

  raise notice 'On the Water launched in % states: % (expected 6: AL,FL,GA,MS,SC,TN)',
    n_launched, v_codes;

  if n_launched <> 6 then
    raise warning 'expected 6 launched states, found %', n_launched;
  end if;
  if n_nc <> 0 then
    raise warning 'North Carolina is marked launched and holds almost no data';
  end if;
end $$;
