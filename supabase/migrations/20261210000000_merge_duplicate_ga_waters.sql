-- Open Season: merge the duplicate Georgia waters.
--
-- ===========================================================================
-- WHAT IS ACTUALLY WRONG, WHICH IS NOT WHAT I FIRST REPORTED
--
-- I told David there were "at least 8 duplicate pairs" found by grouping on
-- base name. That grouping was wrong in both directions, and the correction
-- matters more than the count:
--
--   It called "Chattooga River" and "Chattooga River (delayed harvest)" a
--   duplicate pair on the strength of the names. Names are not evidence. It
--   happens that their extents ARE identical, so that pair is real -- but by
--   the same logic the grouping would have flagged "Flint River" and "Flint
--   River downstream of Warwick Dam", which are a river and a sub-reach of it.
--
--   My extent-based re-measurement then found only 3 groups, because
--   normalising "...GA Hwy 53." and "...GA Hwy 53" leaves a TRAILING SPACE on
--   one of them. btrim() raises it to 9 groups, 6 of them genuine.
--
-- The real pattern, measured on 2026-11-21: Georgia's waters were transcribed
-- by TWO passes with different conventions, and ten stretches were caught by
-- both.
--
--   pass A  extent in lowercase, no closing period, named for its extent or
--           bare. limit_basis = per_species. On catch-and-release water it
--           correctly sets daily_limit_kind = 'prohibited', daily_limit = 0.
--
--   pass B  extent Capitalised with a closing period, named for its
--           regulation ("(delayed harvest)"). limit_basis = aggregate, and
--           daily_limit_kind = 'unknown' on every row -- including the
--           catch-and-release ones, where harvest is not unknown, it is
--           forbidden.
--
-- In all ten pairs the species list, the restrictions array and the effective
-- dates are identical. The two rows are the same regulation on the same
-- stretch, transcribed twice.
--
-- SEVERITY, STATED HONESTLY: limitPhrase() returns null for 'unknown', so the
-- weaker copy prints silence, not a false limit. Nobody is being told they
-- may keep a fish they may not. The defect is that the Waters tab shows one
-- river twice, and the second card omits "May not be taken". That is
-- duplication plus an omission -- not the wrong-answer class of
-- [[openseason-span-rows]].
--
-- WHICH ROW SURVIVES: pass A, in all ten. It is never worse and in five pairs
-- it is strictly better (prohibited/0 where pass B says unknown).
--
-- EVERY STATEMENT IS SCOPED BY state_id, AND THAT IS NOT DEFENSIVE PADDING.
-- `waters.slug` is NOT globally unique: `chattooga-river` exists in Georgia
-- AND South Carolina, because the Chattooga is the state line. A rename keyed
-- on slug alone would have renamed South Carolina's river to "(delayed
-- harvest)" -- a different water with its own rules.
--
-- NOT TOUCHED, having been measured and found legitimate:
--
--   "and its tributaries"                 Altamaha, Saint Mary's, Satilla --
--                                         three different rivers sharing a
--                                         stock phrase.
--   "...on the Warwoman WMA"              Hoods Creek, Walnut Fork Creek.
--   "in and within 50 yards of the        FL: Salt Springs, Silver Glen
--    springs"                             Springs.
--   Silver Lake -> House Pond, Panic Pond  two different ponds.
--   Flint / Ocmulgee / Oconee / Savannah  a river and a genuine sub-reach.
--   Smith Creek (downstream of Unicoi     vaguer extent AND a different rule
--     dam)                                (daylight_only, no dates). Not a
--                                         duplicate of anything.
--   Smith Creek (bare, 0 rules, no        a container row. Empty is not the
--     extent)                             same as redundant.
--   Chattahoochee River (bare)            the striped-bass reach at Columbia
--                                         Lock and Dam, 200 miles from the
--                                         trout water. Parent of the six
--                                         trout reaches.
-- ===========================================================================

-- 1. THE MERGE ---------------------------------------------------------------
--
-- Delete is safe and complete here, verified against the catalogue rather
-- than assumed: waters -> fishing_rules is ON DELETE CASCADE and
-- fishing_rules -> fishing_rule_species is ON DELETE CASCADE, so no orphan
-- link survives. Pre-flight on 2026-11-21: all 10 targets exist, each holds
-- exactly 1 rule, none is referenced by `seasons` (that FK is ON DELETE
-- RESTRICT and would have aborted this migration), and none is a parent of
-- another water (that FK is ON DELETE SET NULL and would have silently
-- orphaned a child).
--
-- The survivor's existence is checked before each delete. Deleting a
-- duplicate because its survivor's slug was mistyped would destroy the
-- regulation instead of de-duplicating it, and I have already got one slug in
-- this feature wrong once.
do $$
declare
  ga uuid;
  pairs text[][] := array[
    -- survivor (pass A, kept)                              duplicate (pass B, removed)
    ['amicalola-creek',                                      'amicalola-creek-delayed-harvest'],
    ['chattooga-river',                                      'chattooga-river-delayed-harvest'],
    ['toccoa-river',                                         'toccoa-river-delayed-harvest'],
    ['chattahoochee-river-sope-creek-to-us-hwy-41',           'chattahoochee-river-delayed-harvest'],
    ['smith-creek-unicoi-state-park',                        'smith-creek-delayed-harvest'],
    ['chattahoochee-river-buford-dam-to-peachtree-creek',     'chattahoochee-river-buford-tailwater'],
    ['chattahoochee-river-ga-hwy-20-to-medlock-bridge-park',  'chattahoochee-river-artificial-only'],
    ['coleman-river',                                        'coleman-river-artificial-only'],
    ['conasauga-river',                                      'conasauga-river-upper'],
    ['moccasin-creek',                                       'moccasin-creek-youth-seniors']
  ];
  i int;
  removed int;
  total int := 0;
begin
  select id into ga from states where code = 'GA';
  if ga is null then
    raise exception 'no Georgia row in states; refusing to guess';
  end if;

  for i in 1 .. array_length(pairs, 1) loop
    if not exists (select 1 from waters where state_id = ga and slug = pairs[i][1]) then
      raise notice 'SKIPPED %: survivor % is not in the Georgia set', pairs[i][2], pairs[i][1];
      continue;
    end if;

    delete from waters where state_id = ga and slug = pairs[i][2];
    get diagnostics removed = row_count;
    total := total + removed;
    if removed > 0 then
      raise notice 'merged % into %', pairs[i][2], pairs[i][1];
    end if;
  end loop;

  raise notice 'duplicate waters removed: % of 10', total;
end $$;

-- 2. THE THREE SURVIVORS WHOSE NAME NOW LIES ---------------------------------
--
-- Only these three. Each is a bare river or creek name left standing for what
-- its own extent_note says is ONE regulated stretch -- "Chattooga River" for
-- the reach from the GA Hwy 28 bridge to the mouth of Reed Creek, which is
-- the delayed-harvest water and not the Chattooga. The deleted copy carried
-- the name Georgia anglers actually use, and that name is the one thing pass
-- B got right, so it is kept rather than thrown away with the row.
--
-- The other seven survivors are NOT renamed: their names already state a
-- specific reach ("Chattahoochee River (Sope Creek to US Hwy 41)"), or the
-- regulation is already carried by the rule's own restrictions array
-- (moccasin-creek holds youth_senior_disabled_only). Renaming those would be
-- taste, not correction.
--
-- Guarded on the current name, so re-running is a no-op and so this never
-- overwrites a name David has since edited by hand. The slug is deliberately
-- NOT changed: gauges.ts and anything else referencing a water does so by
-- slug, and a slug is an identifier, not a label.
update waters set name = 'Amicalola Creek (delayed harvest)', updated_at = now()
 where state_id = (select id from states where code = 'GA')
   and slug = 'amicalola-creek' and name = 'Amicalola Creek';

update waters set name = 'Chattooga River (delayed harvest)', updated_at = now()
 where state_id = (select id from states where code = 'GA')
   and slug = 'chattooga-river' and name = 'Chattooga River';

update waters set name = 'Toccoa River (delayed harvest)', updated_at = now()
 where state_id = (select id from states where code = 'GA')
   and slug = 'toccoa-river' and name = 'Toccoa River';

-- 3. THE GAUGE MAPPING I GOT WRONG LAST NIGHT --------------------------------
--
-- Migration 20261209000000, applied hours ago, mapped these two rows to two
-- DIFFERENT gauges:
--
--   chattahoochee-river-buford-tailwater              -> 02334430, 1000.0 cfs
--   chattahoochee-river-buford-dam-to-peachtree-creek -> 02335000, no threshold
--
-- They are the same reach. Both rows carry the extent "Buford Dam to
-- Peachtree Creek"; one simply capitalises it. I wrote justifications for the
-- split -- "the gauge is at the dam, which is this tailwater's head" and
-- "Norcross sits inside this reach" -- and both sentences describe the same
-- stretch of river. I invented a distinction to explain data I had not
-- compared, which is the error this whole migration is about.
--
-- The survivor takes 02334430 and the 1000 cfs threshold:
--   - it is the dam release gauge, and on a tailwater the release is what
--     decides whether the reach is wadeable at all;
--   - it reports water temperature (00010); 02335000 is intermittent and
--     returned nothing on one of two probes on 2026-11-21;
--   - 1000.0 is the threshold the Phase 1 brief used for this water, so
--     keeping it means the number does not quietly change meaning.
--
-- Not guarded on `usgs_site_no is null` -- unlike last time, the point here is
-- to OVERWRITE 02335000, which this migration has just orphaned.
update waters
   set usgs_site_no = '02334430',
       wadeable_cfs_max = 1000.0,
       updated_at = now()
 where state_id = (select id from states where code = 'GA')
   and slug = 'chattahoochee-river-buford-dam-to-peachtree-creek';

-- 4. SMITH CREEK KEEPS ITS PARENT --------------------------------------------
--
-- The row removed above (smith-creek-delayed-harvest) was the only child of
-- the bare smith-creek container. Its survivor, smith-creek-unicoi-state-park,
-- was parentless. Re-pointing it keeps the container from becoming a childless
-- stub and keeps the hierarchy saying what it said before the merge.
update waters
   set parent_water_id = (select id from waters
                           where state_id = (select id from states where code = 'GA')
                             and slug = 'smith-creek'),
       updated_at = now()
 where state_id = (select id from states where code = 'GA')
   and slug = 'smith-creek-unicoi-state-park'
   and parent_water_id is null;

-- 5. PROVE IT ----------------------------------------------------------------
--
-- Re-runs the detector that found the problem, with the btrim() that the
-- first attempt was missing. The three legitimate phrase collisions are
-- excluded by name, not by count, so a NEW collision would still raise.
do $$
declare
  leftover int;
  ga_count int;
  mapped text;
begin
  -- The two stock phrases are excluded row-side, in WHERE, not in HAVING:
  -- Postgres cannot see a select alias in HAVING, and filtering the rows is
  -- what is meant anyway.
  select count(*) into leftover from (
    select 1
      from waters w join states st on st.id = w.state_id
     where st.code = 'GA' and w.status = 'published'
       and btrim(regexp_replace(lower(coalesce(w.extent_note,'')), '[^a-z0-9]+', ' ', 'g'))
           not in ('', 'and its tributaries', 'and its tributaries on the warwoman wma')
     group by btrim(regexp_replace(lower(coalesce(w.extent_note,'')), '[^a-z0-9]+', ' ', 'g'))
    having count(*) > 1
  ) x;

  select count(*) into ga_count from waters w join states st on st.id = w.state_id
   where st.code = 'GA' and w.status = 'published';

  select string_agg(slug || ' -> ' || usgs_site_no, ', ' order by slug) into mapped
    from waters where usgs_site_no is not null;

  raise notice 'Georgia published waters: % (was 76, expected 66)', ga_count;
  raise notice 'unexplained duplicate extent groups remaining: % (expected 0)', leftover;
  raise notice 'gauge mappings: %', mapped;

  if leftover > 0 then
    raise warning 'a duplicate extent group survived the merge -- re-measure before trusting the Waters tab';
  end if;
end $$;
