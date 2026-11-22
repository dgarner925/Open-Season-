-- Georgia's border waters, and the agreement that governs them.
--
-- ===========================================================================
-- A WHOLE SOURCE PAGE WE WERE NOT READING
--
-- Georgia publishes six freshwater pages. We hold five of them as sources.
-- The missing one is "Agreements with Bordering States", and it opens with
-- this:
--
--     "Regulations under these agreements may differ from Georgia's general
--     laws and regulations. If this is the case, the laws and regulations of
--     the agreement explained in this section are to be followed."
--
-- It covers the biggest water in the state. Lake Hartwell, Clarks Hill
-- (J. Strom Thurmond), Richard B. Russell, Yonah and Tugaloo are shared with
-- South Carolina; Lake Chatuge with North Carolina; Bartletts Ferry, Goat
-- Rock, Oliver, George W. Andrews, Seminole, Walter F. George and West Point
-- with Alabama.
--
-- Two of the pages we DO hold point at it -- General Regulations says "Daily
-- limits differ on certain waters shared by Georgia and South Carolina. See
-- Agreements with Bordering States", and the daily-limits table says "See the
-- Fishing Regulations for shared waters for Georgia and South Carolina". Both
-- cross-references were transcribed as prose into notes and neither was
-- followed.
--
-- The cost of not following them, on the Georgia-South Carolina waters:
--
--   trout          statewide 8 per day. On border waters, 5.
--   white bass     statewide 15 for the striped/white/hybrid group, two of
--                  which may be 22 inches or longer. On border waters white
--                  bass is its own limit of 10, no size limit at all.
--   black bass     statewide 10 with only 5 of the named species. On border
--                  waters 10 across largemouth, spotted, redeye and
--                  smallmouth, with no sub-limit.
--   striped bass   statewide 15, two of which may be 22 inches or longer. On
--                  Hartwell and Clarks Hill, 10, only three over 26 inches.
--   all game fish  no statewide equivalent. 40 in aggregate on border waters,
--                  catfish excluded.
--
-- Every one of those is a number an angler is counting against. A reader
-- shown the statewide trout limit on Lake Hartwell is being told they may
-- keep three more trout than the law allows.
--
-- ===========================================================================
-- WHAT THIS MIGRATION DOES NOT DO, AND WHY
--
-- THE RIVERS ARE LEFT ALONE. The South Carolina agreement covers the Savannah
-- River, the Tugaloo River and the Chattooga River as well. We already hold
-- rows for all three, but each is an extent-specific stretch -- `savannah-
-- river` is "downstream of J. Strom Thurmond Dam", `chattooga-river` is the
-- delayed-harvest section from GA Hwy 28 to Reed Creek. The agreement covers
-- the whole river to the North Carolina line, minus "any flowing portions of
-- tributary streams". Hanging a whole-river limit on a row whose extent_note
-- says something narrower would misstate where it applies, and moving a
-- boundary is the one error this data cannot afford. Those three need their
-- own rows for the agreement's extent; left for a following pass, and that is
-- why they are NOT marked complete below.
--
-- STEVENS CREEK LAKE AND NEW SAVANNAH BLUFF are named by the agreement and
-- left out: both lie on the South Carolina side and neither is a water a
-- Georgia angler browses the Georgia list for.
--
-- THREE FACTS GO IN waters.notes RATHER THAN IN fishing_rules: the licence
-- reciprocity, Lake Chatuge's boats-only condition, and the 40-fish
-- aggregate. Each is explained at the statement that writes it, below. All
-- three are rendered by the Waters tab, which is the condition for writing
-- them down at all.
-- ===========================================================================

-- 1. THE SOURCE ------------------------------------------------------------
insert into sources (state_id, agency_name, url, doc_type, purpose)
select st.id,
       'Georgia Department of Natural Resources, Wildlife Resources Division',
       'https://www.eregulations.com/georgia/fishing/agreements-with-bordering-states',
       'webpage', 'fishing_rules'
  from states st where st.code = 'GA'
on conflict (url) do nothing;   -- sources_url_key

-- 2. THE WATERS ------------------------------------------------------------
--
-- Names and spellings are the agreement page's own, including its
-- parenthetical aliases, so a reader searching the name printed in the
-- regulations finds the row. "Tugaloo" is the page's spelling; the lake is
-- also signposted "Tugalo", which the alias in the name covers for search.
--
-- The rows first, as plain literals. The notes follow in their own
-- statements, by slug: a plpgsql variable inside a `(values ...)` subselect
-- has no target column to take its type from, and "could not determine data
-- type of parameter" is a bad way to find that out in production.
do $$
declare
  v_state uuid;
  v_src   uuid;
  n int;
begin
  select id into v_state from states where code = 'GA';
  select id into v_src from sources
   where state_id = v_state
     and url = 'https://www.eregulations.com/georgia/fishing/agreements-with-bordering-states';
  if v_src is null then
    raise exception 'agreements source missing; step 1 did not insert';
  end if;

  insert into waters (state_id, name, slug, kind, source_id,
                      last_verified_at, rules_complete_at, status)
  select v_state, x.name, x.slug, 'reservoir', v_src, now(), now(), 'published'
    from (values
      -- Georgia / South Carolina.
      ('lake-hartwell',         'Lake Hartwell'),
      ('clarks-hill-lake',      'Clarks Hill Lake (J. Strom Thurmond)'),
      ('lake-yonah',            'Lake Yonah'),
      ('tugaloo-lake',          'Tugaloo Lake (Tugalo)'),
      -- Georgia / Alabama. The agreement sets no limit or length on these
      -- four that differs from Georgia's statewide rules -- its only minimum
      -- lengths are on West Point and Walter F. George, both of which we
      -- already hold -- so they carry no rule and are complete at zero.
      ('bartletts-ferry-lake',  'Bartletts Ferry Lake (Harding)'),
      ('goat-rock-lake',        'Goat Rock Lake'),
      ('oliver-lake',           'Oliver Lake'),
      ('george-w-andrews-lake', 'George W. Andrews Lake'),
      -- Georgia / North Carolina.
      ('lake-chatuge',          'Lake Chatuge')
    ) as x(slug, name)
  on conflict (state_id, slug) do update set
    name             = excluded.name,
    source_id        = excluded.source_id,
    last_verified_at = excluded.last_verified_at,
    status           = excluded.status,
    updated_at       = now();

  get diagnostics n = row_count;
  raise notice 'border waters upserted: % (expected 9)', n;
  if n <> 9 then
    raise warning 'expected 9 border waters, touched %', n;
  end if;
end $$;

-- The notes. Each agreement's own subject, in the state's own terms.
--
-- THE LICENCE RECIPROCITY IS A NOTE AND NOT A RULE. It is the agreements'
-- main point -- a Georgia licence is good on the far bank -- and it is
-- neither a limit nor a length, has no field to live in, and would have to
-- borrow a restriction code to become a rule row. Borrowing one would put it
-- in front of readers as a fishing restriction, which it is the opposite of.
--
-- THE 40-FISH AGGREGATE IS HERE FOR A HARDER REASON. It is a limit across all
-- game fish rather than any species or group, and fishing_rules reaches
-- species only through fishing_rule_species -- so a rule with no species
-- attached matches nothing in the resolver and renders nowhere at all. A real
-- limit that renders nowhere is worse than one in prose, because nobody can
-- see that it is missing.
update waters set
  notes = 'Shared with South Carolina. A Georgia or South Carolina freshwater '
          'licence is valid on both banks. Limits here come from the '
          'reciprocal agreement rather than Georgia''s statewide rules, and '
          'an aggregate of 40 game fish per day applies across all species '
          'except catfish.',
  rules_complete_at = now(),
  updated_at = now()
 where state_id = (select id from states where code = 'GA')
   and slug in ('lake-hartwell', 'clarks-hill-lake', 'lake-yonah',
                'tugaloo-lake', 'lake-richard-b-russell');

update waters set
  notes = 'Shared with Alabama. A Georgia or Alabama licence is valid on both '
          'banks. Creel and possession limits are the same as Georgia''s '
          'statewide limits. It is illegal to possess or fish with live '
          'blueback herring in the Alabama waters covered by this agreement.',
  rules_complete_at = now(),
  updated_at = now()
 where state_id = (select id from states where code = 'GA')
   and slug in ('bartletts-ferry-lake', 'goat-rock-lake', 'oliver-lake',
                'george-w-andrews-lake');

-- LAKE CHATUGE GETS NO RESTRICTION ROW, deliberately. The agreement says
-- "Holders of a valid Georgia or North Carolina fishing license may fish with
-- hook and line in Lake Chatuge only from boats." That is a condition of
-- fishing the lake under the RECIPROCAL licence, not a ban on bank fishing
-- for a Georgia licence holder on the Georgia side. Encoding it as a
-- restriction would tell every reader that bank fishing on Chatuge is
-- unlawful, which the page does not say and which is not true. So it is
-- quoted close to the page's own wording and left for the reader to apply.
update waters set
  notes = 'Shared with North Carolina. Holders of a valid Georgia or North '
          'Carolina licence may fish with hook and line in Lake Chatuge only '
          'from boats, and boats may not be anchored to the shore or to a '
          'pier or dock connecting to the shore. Senior and youth licence '
          'exemptions from either state are honoured by both. All other '
          'Georgia rules apply to the Georgia portion.',
  rules_complete_at = now(),
  updated_at = now()
 where state_id = (select id from states where code = 'GA')
   and slug = 'lake-chatuge';

-- Lake Richard B. Russell was already in the table, from the daily-limits
-- page, and the UPDATE above has given it the South Carolina note and the
-- claim. Its name, kind and source_id are left exactly as they were: its
-- striped bass rule came from that other page and still does.

-- 3. THE GEORGIA - SOUTH CAROLINA CHART ------------------------------------
--
-- Four rows of the chart apply to "All border waters covered", and are
-- written once per impoundment rather than once, because a rule in this
-- schema attaches to one water and the resolver looks a water up by id.
--
-- Note which rules say `none` and which say `unknown`. The chart's SIZE LIMIT
-- column reads "No size limit" in as many words for white bass, trout and
-- walleye -- that is a statement, so `none`, and it cancels any statewide
-- minimum. The striped bass cell contains only the trophy clause and states
-- no minimum at all, so `unknown`, which defers to whatever Georgia sets
-- statewide. Migration 20261212000000 created that distinction; this is the
-- first data to use it in anger, and getting it backwards would report "no
-- size limit" on a water that has one.
do $$
declare
  v_state uuid;
  v_src   uuid;
  v_rule  uuid;
  w record;
  t record;
  n_rules int := 0;
begin
  select id into v_state from states where code = 'GA';
  select id into v_src from sources
   where state_id = v_state
     and url = 'https://www.eregulations.com/georgia/fishing/agreements-with-bordering-states';

  -- Idempotent: this source published nothing before, so the delete is a
  -- no-op on first run and a clean rewrite on any re-run. fishing_rule_species
  -- cascades on rule_id.
  delete from fishing_rules where state_id = v_state and source_id = v_src;

  for w in
    select id, slug from waters
     where state_id = v_state
       and slug in ('lake-hartwell', 'clarks-hill-lake',
                    'lake-richard-b-russell', 'lake-yonah', 'tugaloo-lake')
     order by slug
  loop
    for t in
      select * from (values
        (array['white-bass'],
         'none', null::numeric, 'count', 10::smallint,
         null::smallint, null::numeric, 'per_species',
         'Georgia-South Carolina border waters: white bass are their own '
         'limit of 10 here, not part of the statewide striped, white and '
         'hybrid group of 15. No size limit.'),

        (array['brook-trout', 'rainbow-trout', 'brown-trout'],
         'none', null::numeric, 'count', 5::smallint,
         null::smallint, null::numeric, 'aggregate',
         'Georgia-South Carolina border waters: 5 trout per day, not the '
         'statewide 8. No size limit.'),

        (array['largemouth-bass', 'spotted-bass', 'redeye-bass',
               'smallmouth-bass'],
         'unknown', null::numeric, 'count', 10::smallint,
         null::smallint, null::numeric, 'aggregate',
         'Georgia-South Carolina border waters: 10 bass per day across '
         'largemouth, spotted, redeye and smallmouth, with no sub-limit on '
         'any of them.'),

        (array['largemouth-bass'],
         'minimum', 12::numeric, 'unknown', null::smallint,
         null::smallint, null::numeric, 'per_species',
         'Georgia-South Carolina border waters: 12-inch minimum for '
         'largemouth bass under the agreement.'),

        (array['walleye', 'sauger'],
         'none', null::numeric, 'count', 8::smallint,
         null::smallint, null::numeric, 'aggregate',
         'Georgia-South Carolina border waters: 8 per day for walleye and '
         'sauger combined. No size limit.')
      ) as x(keys, size_rule, min_in, kind, cnt, trophy_n, trophy_in, basis, note)
    loop
      insert into fishing_rules (
        state_id, species_id, water_id, season_year, size_rule,
        min_length_inches, daily_limit_kind, daily_limit,
        trophy_allowance, trophy_min_length_inches,
        limit_basis, restrictions, notes, source_id, last_verified_at, status)
      values (
        v_state, null, w.id, 2026, t.size_rule,
        t.min_in, t.kind, t.cnt,
        t.trophy_n, t.trophy_in,
        t.basis, '{}', t.note, v_src, now(), 'published')
      returning id into v_rule;

      insert into fishing_rule_species (rule_id, species_id)
      select v_rule, s.id from species s
       where s.key = any (t.keys) and s.pursuit = 'fishing';

      n_rules := n_rules + 1;
    end loop;
  end loop;

  -- Striped bass is per-water, not "all border waters".
  --
  -- Hartwell and Clarks Hill only. Russell's own striper rule (2 per day, one
  -- over 34 inches) is already published from the daily-limits page and is
  -- NOT rewritten here -- a second copy of the same rule from a second source
  -- is exactly what 20261208000000 was written to stop. The chart and that
  -- page agree on Russell, which is some evidence both were read correctly.
  --
  -- "Only 3 may be over 26 inches" is a trophy allowance, not a minimum
  -- length: it caps how many big fish you may keep, it does not make small
  -- ones illegal. trophy_allowance/trophy_min_length_inches is the pair of
  -- fields for that, and size_rule stays `unknown` because the chart states
  -- no minimum for striped bass on these two lakes.
  for w in
    select id, slug from waters
     where state_id = v_state
       and slug in ('lake-hartwell', 'clarks-hill-lake')
     order by slug
  loop
    insert into fishing_rules (
      state_id, species_id, water_id, season_year, size_rule,
      daily_limit_kind, daily_limit, trophy_allowance,
      trophy_min_length_inches, limit_basis, restrictions, notes,
      source_id, last_verified_at, status)
    values (
      v_state, null, w.id, 2026, 'unknown',
      'count', 10::smallint, 3::smallint,
      26::numeric, 'aggregate', '{}',
      'Georgia-South Carolina border waters: 10 striped bass, hybrid bass or '
      'a combination per day, only three of which may be longer than 26 '
      'inches. Not the statewide 15.',
      v_src, now(), 'published')
    returning id into v_rule;

    insert into fishing_rule_species (rule_id, species_id)
    select v_rule, s.id from species s
     where s.key in ('striped-bass', 'hybrid-striped-bass')
       and s.pursuit = 'fishing';

    n_rules := n_rules + 1;
  end loop;

  raise notice 'border-water rules written: % (expected 27)', n_rules;
  if n_rules <> 27 then
    raise warning 'expected 27 rules (5 waters x 5 chart rows + 2 striper), got %', n_rules;
  end if;
end $$;

-- 4. PROVE IT --------------------------------------------------------------
do $$
declare
  rec record;
begin
  for rec in
    select w.slug,
           count(r.id) filter (where r.status = 'published') as rules,
           (w.rules_complete_at is not null) as claimed
      from waters w
      left join fishing_rules r on r.water_id = w.id
      join states st on st.id = w.state_id
     where st.code = 'GA'
       and w.slug in ('lake-hartwell', 'clarks-hill-lake',
                      'lake-richard-b-russell', 'lake-yonah', 'tugaloo-lake',
                      'lake-chatuge', 'bartletts-ferry-lake', 'goat-rock-lake',
                      'oliver-lake', 'george-w-andrews-lake')
     group by w.slug, w.rules_complete_at
     order by w.slug
  loop
    raise notice '% -- % rules, complete=%', rec.slug, rec.rules, rec.claimed;
  end loop;
end $$;
