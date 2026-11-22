-- Open Season: `size_rule` learns the difference between "no minimum" and
-- "the document never said".
--
-- ===========================================================================
-- THE SAME DEFECT daily_limit_kind WAS ALREADY FIXED FOR
--
-- `daily_limit_kind` has four values -- count, no_limit, prohibited, unknown
-- -- because one null was doing three jobs: "you may keep none", "you may
-- keep any number", and "nobody has read this page yet". Three different
-- answers that one field could not tell apart.
--
-- `size_rule` never got the same treatment. It has `none` and no `unknown`,
-- so `none` is currently doing two jobs that pull in opposite directions:
--
--   an OVERRIDE   Georgia names Lake Blue Ridge, Lake Burton and Lake
--                 Juliette as having NO minimum length on largemouth bass.
--                 That is a positive statement that cancels the statewide
--                 12-inch minimum. It is the whole content of the rule.
--
--   SILENCE       The Chattahoochee's Buford Dam reach carries a rule about
--                 daylight hours and night fishing. Its size_rule is `none`
--                 because the rule is not about size at all. The statewide
--                 trout limits still apply there in full.
--
-- 172 published rules say `none`, 37 of them on a Georgia water. Until this
-- migration there is no way to tell which of the two any of them means.
--
-- WHY IT BLOCKS THE State -> Water -> Fish RESOLVER
--
-- That screen has to answer "largemouth bass, Lake Burton" with ONE merged
-- rule: the statewide creel limit of 10 combined, and no minimum length.
-- Merging means deciding, per field, whether the water's rule overrides the
-- statewide one or defers to it. With `none` ambiguous, the resolver must
-- guess, and both guesses are wrong somewhere:
--
--   treat every `none` as an override  -> the Buford Dam reach reports no
--                                         size limit on trout. Permissive,
--                                         and the dangerous direction.
--   treat every `none` as silence      -> Lake Burton reports the statewide
--                                         12-inch minimum, which Georgia
--                                         explicitly removed there.
--
-- Neither is acceptable in a regulations app, which is why this lands before
-- the resolver rather than after it.
--
-- ===========================================================================
-- THIS MIGRATION CHANGES NOTHING ON SCREEN, DELIBERATELY
--
-- sizePhrase() in src/features/otw/format.ts reads:
--
--     case 'none':
--     default:
--       return null;
--
-- so `unknown` falls through the same default and renders exactly as `none`
-- does today: silence. Every row this migration rewrites looks identical in
-- the app afterwards. The migration only adds the capacity to tell the two
-- apart; teaching the screen to SAY "no minimum" for a real `none` is a code
-- change that follows separately, and can be reviewed on its own.
--
-- That is on purpose. A schema change and a display change landing together
-- would make it impossible to tell which one caused a wrong number.
-- ===========================================================================

-- 1. ALLOW THE NEW VALUE -----------------------------------------------------
--
-- fishing_rules_numbers_check is NOT touched. It is a CASE over size_rule
-- whose unmatched branch is `ELSE true`, verified on 2026-11-22, so an
-- unrecognised value passes it unchanged. Only the value list needs widening.
alter table fishing_rules drop constraint if exists fishing_rules_size_rule_check;
alter table fishing_rules add constraint fishing_rules_size_rule_check
  check (size_rule = any (array[
    'none',          -- the source states there is no size limit here
    'unknown',       -- the source did not address size. NOT the same thing.
    'minimum',
    'maximum',
    'slot_release',
    'slot_keep',
    'see_notes'
  ]));

-- 2. EVERY EXISTING `none` BECOMES `unknown` ---------------------------------
--
-- The safe direction, and the honest one. `none` was written by extractors
-- and transcribers that had no way to express "not stated", so the value
-- carries no evidence that anybody checked. Demoting all of it to `unknown`
-- asserts only what is true: we do not know what these rules say about size.
--
-- The three rows that ARE evidenced get promoted back in step 3, by name,
-- against a source somebody read. Nothing is promoted by pattern or by guess.
--
-- Scoped to size_rule = 'none' so re-running cannot touch a `minimum` or a
-- `slot_release`.
update fishing_rules
   set size_rule = 'unknown',
       updated_at = now()
 where size_rule = 'none';

-- 3. PROMOTE THE THREE GEORGIA LAKES THAT REALLY DO SAY "NO MINIMUM" ---------
--
-- Read off eregulations.com/georgia/fishing/general-regulations on
-- 2026-11-22. Largemouth bass are 12 inches statewide "except:" and the list
-- includes "Lake Blue Ridge: no minimum", "Lake Burton: no minimum" and
-- "Lake Juliette: no minimum".
--
-- Narrowed three ways, because this is the statement that will later let the
-- resolver cancel a statewide minimum:
--
--   by state      `lake-burton` is not unique across states -- waters.slug
--                 is not globally unique, which nearly renamed South
--                 Carolina's Chattooga River in 20261210000000.
--   by water      only these three lakes.
--   by SPECIES    only the largemouth bass rule. These lakes carry other
--                 rules, and Georgia's exception is about largemouth, not
--                 about everything that swims there.
--
-- Guarded on size_rule = 'unknown' so a later hand-correction is never
-- overwritten by a re-run.
update fishing_rules r
   set size_rule = 'none',
       updated_at = now()
  from waters w, states st
 where w.id = r.water_id
   and st.id = w.state_id
   and st.code = 'GA'
   and w.slug in ('lake-blue-ridge', 'lake-burton', 'lake-juliette')
   and r.status = 'published'
   and r.size_rule = 'unknown'
   and exists (
     select 1 from fishing_rule_species frs
       join species sp on sp.id = frs.species_id
      where frs.rule_id = r.id and sp.name ilike 'largemouth bass'
   );

-- 4. PROVE IT ----------------------------------------------------------------
--
-- A count of 3 is the number to look for. Zero would mean the slugs or the
-- species name moved; more than 3 would mean the species filter stopped
-- biting and a gear rule has been told it cancels a size limit.
do $$
declare
  n_none int;
  n_unknown int;
  n_ga_none int;
  detail text;
begin
  select count(*) into n_none    from fishing_rules where size_rule = 'none';
  select count(*) into n_unknown from fishing_rules where size_rule = 'unknown';

  select count(*), string_agg(w.name, ', ' order by w.name)
    into n_ga_none, detail
    from fishing_rules r
    join waters w on w.id = r.water_id
    join states st on st.id = w.state_id
   where st.code = 'GA' and r.size_rule = 'none';

  raise notice 'size_rule = none:    % (expected 3)', n_none;
  raise notice 'size_rule = unknown: % (expected 169)', n_unknown;
  raise notice 'Georgia waters stating no minimum: % -- %', n_ga_none, coalesce(detail, '(none)');

  if n_none <> 3 then
    raise warning 'expected exactly 3 evidenced "no minimum" rules, found % -- check before building the resolver on this', n_none;
  end if;
end $$;
