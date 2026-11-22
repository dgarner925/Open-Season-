-- Georgia states one black bass limit. We held it three times.
--
-- ===========================================================================
-- WHAT THE PAGE ACTUALLY SAYS
--
-- The Game Species Daily Limits table, read 2026-11-22, has ONE bass row:
--
--   SPECIES       All black bass species (Genus Micropterus).
--   DAILY LIMIT   10
--   EXCEPTIONS    Total daily limit of 10 black bass, only 5 of which may be
--                 Altamaha, Bartrams, Chattahoochee, Coosa, Shoal,
--                 Smallmouth, Suwannee, Tallapoosa.
--                 Lake Lindsay Grace (Wayne Co.) - Only one bass may be
--                 greater than 22 inches.
--
-- That is a ten-fish aggregate with a five-fish sub-aggregate inside it. Two
-- rules express it exactly, and we have them: ten across all twelve
-- Micropterus species, five across the eight named ones. Both bind at once,
-- which is why resolve.ts keeps every statewide limit instead of picking one
-- -- "10/day combined, 5/day combined" on shoal bass is not a contradiction,
-- it is the regulation.
--
-- The third row is the problem. The same ten-fish limit was transcribed a
-- second time, carrying the exceptions sentence as its notes and an
-- INCOMPLETE species list -- ten species, missing Guadalupe and redeye bass.
-- So a reader opening largemouth bass in Georgia read:
--
--   10/day combined   -   10/day combined   -   12 inch minimum
--
-- The number was right and said twice, which is its own kind of wrong: a
-- reader who sees a limit stated twice looks for the difference between them.
-- There is none.
--
-- ===========================================================================
-- THE SAME DEFECT IN THE STRIPER ROW
--
-- Striped bass, white bass and hybrids carry two statewide rules for the same
-- three species:
--
--   52afd369   15/day, trophy 2 over 22"      the whole rule
--   8e86290e   size_rule see_notes, trophy 2 over 22", no number, no length
--
-- The second says nothing the first does not, so the screen printed "only 2
-- over 22 inches" twice. It is deleted rather than merged, because its notes
-- sentence is already in the surviving rule's notes.
--
-- ===========================================================================
-- AND THE ONE THAT WAS NOT A DUPLICATE BUT A WRONG COLUMN
--
-- Lake Lindsay Grace has two rules, and they say different things:
--
--   6783a557   slot_release 15-22   "Bass between 15 and 22 inches must be
--                                    released immediately."
--   20af08ad   see_notes            "Only one bass may be greater than 22
--                                    inches."
--
-- Both are real. But 20af08ad's content is a TROPHY ALLOWANCE, which it
-- already carries correctly in trophy_allowance/trophy_min_length_inches --
-- it states no length of its own, and size_rule = 'see_notes' claims it
-- states a size. Since size has one winner, that claim put it in competition
-- with the slot, and the winner was whichever row the query returned first.
-- Half the time Lake Lindsay Grace showed "special size rule" and the slot
-- that tells a reader which fish to put back was dropped entirely.
--
-- resolve.ts is fixed in the same change as this migration, so the numbers
-- win regardless of row order and the loser renders as displaced rather than
-- as nothing. This migration fixes the cause: the rule says nothing about
-- size, so it should say `unknown` and let the slot govern unopposed.
--
-- ===========================================================================
-- NOT FIXED HERE, ON PURPOSE
--
-- Noontootla Creek holds two rules that both say "16-inch minimum" for brook,
-- brown and rainbow trout, from the same page -- one phrased as the general
-- mountain-trout size limit, one as the section's release rule. Identical
-- numbers, so no reader sees a wrong answer and the resolver's choice between
-- them cannot matter. Left alone: it is tidiness, not a defect, and the two
-- sentences are both true.
--
-- Guadalupe bass stays in the twelve-species list. Georgia's rule is "all
-- black bass species (Genus Micropterus)" and Guadalupe bass is one, so the
-- transcription is faithful to the page. Whether the fish occurs in Georgia
-- is a question about distribution, which this schema does not model and
-- which is not what a limit asserts. It does mean Guadalupe bass appears on
-- every Georgia water's species list, which is noise worth revisiting -- but
-- removing it would be our ichthyology overriding the agency's wording.

-- 1. THE SECOND COPY OF THE TEN-FISH LIMIT -----------------------------------
--
-- The exceptions sentence moves to the survivor first, so nothing the page
-- says is lost when the row goes. Matched on shape, not on id: a rule for
-- this state, no water, ten fish, whose species set is a strict SUBSET of
-- another ten-fish rule's. The subset test is what makes "which is the
-- redundant one" a fact rather than a guess -- the row with fewer species is
-- the incomplete transcription.
do $$
declare
  v_ga uuid;
  v_keep uuid;
  v_drop uuid;
  n_del int;
begin
  select id into v_ga from states where code = 'GA';

  with sets as (
    select r.id,
           (select array_agg(sp.key order by sp.key)
              from fishing_rule_species f join species sp on sp.id = f.species_id
             where f.rule_id = r.id) as spp
      from fishing_rules r
     where r.state_id = v_ga and r.status = 'published'
       and r.water_id is null and r.daily_limit_kind = 'count' and r.daily_limit = 10
  )
  select big.id, small.id into v_keep, v_drop
    from sets big
    join sets small
      on small.id <> big.id
     and small.spp <@ big.spp
     and array_length(small.spp, 1) < array_length(big.spp, 1)
   limit 1;

  if v_keep is null then
    raise notice 'no redundant ten-fish bass rule found; nothing to do';
  else
    update fishing_rules
       set notes = 'All black bass species (Genus Micropterus). Total daily '
                || 'limit of 10 black bass, only 5 of which may be Altamaha, '
                || 'Bartrams, Chattahoochee, Coosa, Shoal, Smallmouth, '
                || 'Suwannee or Tallapoosa bass -- those eight carry their '
                || 'own five-fish rule, and both limits bind at once.'
     where id = v_keep;

    delete from fishing_rules where id = v_drop;
    get diagnostics n_del = row_count;
    raise notice 'redundant ten-fish bass rule deleted: % (kept %)', n_del, v_keep;
  end if;
end $$;

-- 2. THE STRIPER RULE THAT ONLY REPEATED A TROPHY ALLOWANCE -------------------
--
-- Guarded hard: it goes only if a rule exists for the SAME species set that
-- carries the same trophy allowance AND an actual daily limit, so the
-- surviving row says everything this one did.
do $$
declare
  v_ga uuid;
  n_del int;
begin
  select id into v_ga from states where code = 'GA';

  with sets as (
    select r.id, r.size_rule, r.min_length_inches, r.max_length_inches,
           r.daily_limit_kind, r.trophy_allowance, r.trophy_min_length_inches,
           (select array_agg(sp.key order by sp.key)
              from fishing_rule_species f join species sp on sp.id = f.species_id
             where f.rule_id = r.id) as spp
      from fishing_rules r
     where r.state_id = v_ga and r.status = 'published' and r.water_id is null
  )
  delete from fishing_rules
   where id in (
     select victim.id
       from sets victim
       join sets keep
         on keep.id <> victim.id
        and keep.spp = victim.spp
        and keep.trophy_allowance = victim.trophy_allowance
        and keep.trophy_min_length_inches = victim.trophy_min_length_inches
        and keep.daily_limit_kind = 'count'
      where victim.size_rule = 'see_notes'
        and victim.min_length_inches is null
        and victim.max_length_inches is null
        and victim.daily_limit_kind = 'unknown'
        and victim.trophy_allowance is not null
   );

  get diagnostics n_del = row_count;
  raise notice 'size-less duplicate trophy rules deleted: % (expected 1)', n_del;
  if n_del <> 1 then
    raise warning 'expected 1, deleted % -- look before assuming this is fine', n_del;
  end if;
end $$;

-- 3. A TROPHY ALLOWANCE IS NOT A SIZE RULE -----------------------------------
--
-- Narrow on purpose, and narrower than the first draft of it.
--
-- The condition that matters is competition for the SAME SPECIES, because
-- that is the granularity resolve.ts picks a single size winner at. Written
-- as "another length-bearing rule on the same water" it also caught Lake
-- Richard B. Russell's striped bass rule, whose only same-water company is a
-- 12-inch largemouth minimum -- a different fish, competing for nothing.
-- Russell is left exactly as it is: one see_notes rule with a trophy clause
-- displaces nothing and hides nothing.
do $$
declare
  n_fix int;
begin
  with competing as (
    select victim.id
      from fishing_rules victim
      join fishing_rule_species vf on vf.rule_id = victim.id
      join fishing_rules other
        on other.id <> victim.id
       and other.status = 'published'
       and other.water_id = victim.water_id
       and (other.min_length_inches is not null or other.max_length_inches is not null)
      join fishing_rule_species of_ on of_.rule_id = other.id
     where victim.status = 'published'
       and victim.size_rule = 'see_notes'
       and victim.min_length_inches is null
       and victim.max_length_inches is null
       and victim.trophy_allowance is not null
       and victim.water_id is not null
       and of_.species_id = vf.species_id
     group by victim.id
  )
  update fishing_rules
     set size_rule = 'unknown'
   where id in (select id from competing);

  get diagnostics n_fix = row_count;
  raise notice 'see_notes rules that state no size corrected to unknown: % (expected 1)', n_fix;
  if n_fix <> 1 then
    raise warning 'expected 1, changed % -- check which rows before trusting this', n_fix;
  end if;
end $$;

-- 4. PROVE IT ----------------------------------------------------------------
do $$
declare
  v_ga uuid;
  n_lmb_statewide int;
  n_striper_statewide int;
  n_competing int;
  n_total int;
begin
  select id into v_ga from states where code = 'GA';

  -- Largemouth bass: exactly one statewide rule that states a number.
  select count(*) into n_lmb_statewide
    from fishing_rules r
    join fishing_rule_species f on f.rule_id = r.id
    join species sp on sp.id = f.species_id
   where r.state_id = v_ga and r.status = 'published' and r.water_id is null
     and sp.key = 'largemouth-bass' and r.daily_limit_kind = 'count';

  select count(*) into n_striper_statewide
    from fishing_rules r
    join fishing_rule_species f on f.rule_id = r.id
    join species sp on sp.id = f.species_id
   where r.state_id = v_ga and r.status = 'published' and r.water_id is null
     and sp.key = 'striped-bass';

  -- The class, not the instance: any water+species covered by two rules that
  -- both claim to state a size. resolve.ts now orders these deterministically
  -- and shows the loser, but a pair where both carry DIFFERENT lengths is
  -- still a transcription to go and look at.
  with sized as (
    select r.id, r.water_id, f.species_id,
           (r.min_length_inches is not null or r.max_length_inches is not null) as has_len
      from fishing_rules r
      join fishing_rule_species f on f.rule_id = r.id
     where r.status = 'published' and r.water_id is not null and r.size_rule <> 'unknown'
  )
  select count(*) into n_competing from (
    select water_id, species_id from sized
     group by water_id, species_id
    having count(*) > 1 and count(*) filter (where has_len) > 1
  ) x;

  select count(*) into n_total from fishing_rules
   where state_id = v_ga and status = 'published';

  raise notice 'GA statewide largemouth count-rules: % (expected 1)', n_lmb_statewide;
  raise notice 'GA statewide striped bass rules: % (expected 1)', n_striper_statewide;
  raise notice 'water+species pairs with two length-bearing size rules: % (Noontootla''s 3, identical numbers)', n_competing;
  raise notice 'GA published rules: %', n_total;

  if n_lmb_statewide <> 1 then
    raise warning 'largemouth bass still has % statewide limits', n_lmb_statewide;
  end if;
end $$;
