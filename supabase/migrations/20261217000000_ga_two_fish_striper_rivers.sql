-- A limit of two that the app was reading as fifteen.
--
-- ===========================================================================
-- THE MEASUREMENT
--
-- Georgia's Game Species Daily Limits page, read 2026-11-22:
--
--     "Limit taken from the North Newport River, Medway River including Mount
--     Hope Creek, Little Ogeechee River, Ogeechee River, Oconee River
--     downstream of GA Hwy 22 in Milledgeville, Ocmulgee River downstream of
--     the GA Hwy 96 bridge between Houston and Twiggs counties, Altamaha
--     River, St. Mary's River, Satilla River, and the tributaries to these
--     river sections; and from saltwater is a two fish limit, both of which
--     must be 22 inches in length or longer."
--
-- Two facts: a count of 2, and a minimum of 22 inches. We transcribed nine of
-- these rivers and got the 22 inches onto every one of them. The count landed
-- on exactly one, the Satilla, as a second rule. The other eight carry
-- daily_limit_kind = 'unknown'.
--
-- ===========================================================================
-- WHY THAT IS THE DANGEROUS KIND OF WRONG
--
-- 'unknown' means "this rule says nothing about how many you may keep", and
-- the resolver added in 20261212000000 handles it exactly as designed: a water
-- rule silent on limits leaves the statewide limit standing. Georgia's
-- statewide striped bass limit is 15.
--
-- So on the Altamaha, the Ogeechee, the Medway, the Little Ogeechee, the
-- North Newport, the lower Oconee, the lower Ocmulgee and St. Mary's, the app
-- shows a 22-inch minimum -- correct -- and a daily limit of 15, when the
-- law is 2. Seven and a half times the legal limit, and permissive, which is
-- the direction that gets a reader a citation rather than an inconvenience.
--
-- It is worth being precise about where the fault is. The resolver is right.
-- The rule row was wrong, and the resolver is what made it legible: before
-- it, these rules rendered a creel limit of nothing at all and nobody could
-- see which statewide number was filling the hole. The merge step did not
-- create this bug; it surfaced it on its first pass over real data.
--
-- The Savannah River is NOT in this list and is already correct: its rule is
-- the separate 27-inch, two-fish rule for water downstream of J. Strom
-- Thurmond Dam, and it carries both numbers.
--
-- ===========================================================================
-- PART 1: PUT THE COUNT BACK
--
-- Matched on the shape of the defect rather than on a list of slugs: a
-- published Georgia rule, on a water, with a 22-inch minimum over the
-- striped/white/hybrid trio, that states no count. That is this rule and
-- nothing else, and it will not match any of them twice.
--
-- Deliberately NOT matched by slug list, because the slug list is exactly
-- what went wrong the first time -- a transcriber working down a prose
-- sentence of nine river names and dropping a clause from the end.
do $$
declare
  v_state uuid;
  n_fixed int;
  detail  text;
begin
  select id into v_state from states where code = 'GA';

  with target as (
    select r.id
      from fishing_rules r
     where r.state_id = v_state
       and r.status = 'published'
       and r.water_id is not null
       and r.size_rule = 'minimum'
       and r.min_length_inches = 22
       and r.daily_limit_kind = 'unknown'
       -- Exactly the three species the sentence governs. Not a superset:
       -- `@>` alone would also match a rule covering more species, which
       -- would be a different rule.
       and (select array_agg(sp.key order by sp.key)
              from fishing_rule_species frs
              join species sp on sp.id = frs.species_id
             where frs.rule_id = r.id)
           = array['hybrid-striped-bass', 'striped-bass', 'white-bass']
  )
  update fishing_rules r
     set daily_limit_kind = 'count',
         daily_limit = 2,
         -- aggregate, because the sentence is one limit of two fish across
         -- striped, white and hybrid together, not two of each.
         limit_basis = 'aggregate',
         notes = trim(coalesce(r.notes || ' ', '')
                      || 'Two fish per day, both of which must be 22 inches '
                      || 'or longer. This replaces the statewide limit of 15.'),
         updated_at = now()
    from target t
   where r.id = t.id;

  get diagnostics n_fixed = row_count;

  select string_agg(w.slug, ', ' order by w.slug) into detail
    from fishing_rules r join waters w on w.id = r.water_id
   where r.state_id = v_state and r.status = 'published'
     and r.size_rule = 'minimum' and r.min_length_inches = 22
     and r.daily_limit_kind = 'count' and r.daily_limit = 2;

  raise notice 'two-fish limit restored on % rules (expected 9)', n_fixed;
  raise notice 'rivers now carrying it: %', coalesce(detail, '(none)');

  if n_fixed <> 9 then
    raise warning 'expected 9 rules (8 rivers plus the Satilla''s second row), got % -- check the species sets', n_fixed;
  end if;
end $$;

-- ===========================================================================
-- PART 2: THE SATILLA'S SECOND ROW IS NOW A DUPLICATE
--
-- The Satilla had both halves of the sentence, as two rules: one with the
-- count and no note, one with the 22-inch minimum and the "Applies to
-- tributaries of these river sections" note. Part 1 just gave the second one
-- the count too, so they now say the same thing and a reader would see the
-- limit twice.
--
-- The NOTED row survives, which breaks with 20261208000000's keep-the-
-- earliest convention and does so on purpose: that migration was deduping
-- byte-identical rows, where "earliest" is an arbitrary but harmless
-- tie-break. These two are not identical. One of them carries the extent --
-- that the rule reaches the river's tributaries -- and the other does not.
-- Keeping the row that knows less, to honour a tie-break rule, would throw
-- away a fact about where the rule applies.
--
-- Guarded so it can only ever delete a row that is redundant: the survivor
-- must exist, be on the same water, cover the same species, and agree on
-- every number.
do $$
declare
  v_state uuid;
  n_del int;
begin
  select id into v_state from states where code = 'GA';

  delete from fishing_rules victim
   where victim.state_id = v_state
     and victim.status = 'published'
     and victim.notes is null
     -- Confined to the exact shape Part 1 just created. Without these four
     -- lines the predicate below would delete any unnoted Georgia rule that
     -- happens to have a noted twin, across every water and species in the
     -- state -- a far wider delete than this migration is entitled to, and
     -- one whose blast radius the raise warning afterwards could only report,
     -- not prevent.
     and victim.size_rule = 'minimum'
     and victim.min_length_inches = 22
     and victim.daily_limit_kind = 'count'
     and victim.daily_limit = 2
     and exists (
       select 1 from fishing_rules keep
        where keep.id <> victim.id
          and keep.state_id = victim.state_id
          and keep.water_id = victim.water_id
          and keep.status = 'published'
          and keep.notes is not null
          and keep.size_rule = victim.size_rule
          and keep.min_length_inches is not distinct from victim.min_length_inches
          and keep.max_length_inches is not distinct from victim.max_length_inches
          and keep.daily_limit_kind = victim.daily_limit_kind
          and keep.daily_limit is not distinct from victim.daily_limit
          and keep.limit_basis = victim.limit_basis
          and keep.restrictions = victim.restrictions
          and keep.effective_from is not distinct from victim.effective_from
          and keep.effective_to is not distinct from victim.effective_to
          and (select array_agg(sp.key order by sp.key) from fishing_rule_species f
                 join species sp on sp.id = f.species_id where f.rule_id = keep.id)
            = (select array_agg(sp.key order by sp.key) from fishing_rule_species f
                 join species sp on sp.id = f.species_id where f.rule_id = victim.id)
     );

  get diagnostics n_del = row_count;
  raise notice 'redundant unnoted copies deleted: % (expected 1, the Satilla)', n_del;
  if n_del <> 1 then
    raise warning 'expected to delete exactly 1 row, deleted %', n_del;
  end if;
end $$;

-- ===========================================================================
-- PROVE IT: no Georgia water may still carry a 22-inch striped bass minimum
-- without a count. That is the defect, stated as a query.
do $$
declare
  n_left int;
  detail text;
begin
  select count(*), string_agg(w.slug, ', ' order by w.slug)
    into n_left, detail
    from fishing_rules r
    join waters w on w.id = r.water_id
    join states st on st.id = w.state_id
   where st.code = 'GA' and r.status = 'published'
     and r.size_rule = 'minimum' and r.min_length_inches = 22
     and r.daily_limit_kind = 'unknown';

  if n_left > 0 then
    raise warning 'still silent on the count, so still falling back to 15: % -- %', n_left, detail;
  else
    raise notice 'every 22-inch striper river now states its own limit. Correct.';
  end if;
end $$;
