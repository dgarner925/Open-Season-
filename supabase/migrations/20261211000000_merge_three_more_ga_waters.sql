-- Open Season: the three duplicate waters the last migration's detector missed.
--
-- ===========================================================================
-- I SAID THE MERGE WAS DONE. IT WAS NOT, AND THE REASON IS THE SAME ONE.
--
-- 20261210000000 merged ten pairs and I reported the job finished. Then I
-- rendered the Waters tab to check it, and saw these sitting in plain sight:
--
--   Savannah River                                      "downstream of J. Strom Thurmond Dam"
--   Savannah River and its tributaries downstream of    "the Savannah River and its tributaries
--     J. Strom Thurmond Dam                              downstream of J. Strom Thurmond Dam"
--
-- Same reach. Same three species. Same limit (2/day aggregate). The second
-- row's extent is the first row's extent with the river's own name glued to
-- the front.
--
-- My btrim() detector could not see it, because it compared whole strings.
-- Worse, I had the pair in front of me during the last migration and wrote it
-- off in the "not touched" list as "a river and a genuine sub-reach", on the
-- strength of the NAMES -- which is precisely the error that migration's
-- header is about. I made the same mistake twice in one session, the second
-- time while documenting it.
--
-- A substring test does not catch them either. The Ocmulgee pair reads
-- "downstream of THE GA Hwy 96 bridge between Houston and Twiggs counties"
-- against "Ocmulgee River downstream of GA Hwy 96 bridge between Houston and
-- Twiggs counties" -- one stray article, and neither string contains the
-- other.
--
-- What works is token overlap with stop words removed, and it is now a
-- repo script rather than a query I retype: scripts/audit_duplicate_waters.py.
-- It exits non-zero while any same-stretch pair is live.
--
-- THE FALSE POSITIVE THAT KEPT THE THRESHOLD HONEST. Containment alone would
-- also have merged these two, and they are different regulations:
--
--   Smith Creek (downstream of Unicoi dam)  "downstream of Unicoi dam"
--   Smith Creek (Unicoi State Park)         "from Unicoi Dam downstream to the
--                                            Unicoi State Park property boundary"
--
-- Every word of the first is inside the second, so containment is 1.00 -- but
-- the first extent has no downstream bound and the second stops at the park
-- line, and their rules differ (daylight-only against catch-and-release).
-- Jaccard is 0.43. They are left alone, and so is a Tennessee pair the script
-- surfaced on the same run (two Tellico River reaches that overlap but start
-- at different confluences).
-- ===========================================================================

-- WHICH ROW SURVIVES, AND WHY IT IS NOT THE PRETTIER NAME ---------------------
--
--   Ocmulgee / Oconee  The bare row holds ZERO rules while its child holds the
--                      regulation, and the bare row's extent_note proves it is
--                      not a whole-river container -- it names the same single
--                      reach. So it is not a parent, it is a second copy with
--                      the content missing, and on screen it appeared under
--                      "Also listed", telling the reader we had no rules for a
--                      reach listed with its rule directly above.
--
--                      The survivor keeps its long name on purpose. Renaming
--                      it to "Ocmulgee River" would leave a whole-river name
--                      standing for one reach -- the exact fault the previous
--                      migration corrected on the Chattooga.
--
--   Savannah           Both carry the identical rule, so the tie breaks on the
--                      name: "Savannah River" with extent "downstream of
--                      J. Strom Thurmond Dam" says it once. The other says the
--                      river's name three times between its name and extent.
--
-- Deleting the Ocmulgee and Oconee rows sets parent_water_id to NULL on their
-- surviving children (that FK is ON DELETE SET NULL). That is correct: the
-- survivor has no parent left to point at, and a dangling self-reference would
-- be worse than none.
do $$
declare
  ga uuid;
  pairs text[][] := array[
    -- survivor (kept)                                                        duplicate (removed)
    ['ocmulgee-river-downstream-of-ga-hwy-96-bridge',                          'ocmulgee-river'],
    ['oconee-river-downstream-of-ga-hwy-22-in-milledgeville',                   'oconee-river'],
    ['savannah-river',                                                         'savannah-river-and-its-tributaries-downstream-of-j-strom-thurmond-dam']
  ];
  i int;
  removed int;
  total int := 0;
  lost_rules int;
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

    -- Refuse to delete a row that still holds a rule the survivor does not.
    -- The Savannah pair is identical so this passes; Ocmulgee and Oconee hold
    -- zero rules. If a future re-run found rules here, the data changed and
    -- this should stop rather than cascade them away.
    select count(*) into lost_rules
      from fishing_rules r
      join waters w on w.id = r.water_id
     where w.state_id = ga and w.slug = pairs[i][2] and r.status = 'published'
       and not exists (
         select 1 from fishing_rules k
          join waters kw on kw.id = k.water_id
         where kw.state_id = ga and kw.slug = pairs[i][1] and k.status = 'published'
           and k.daily_limit_kind = r.daily_limit_kind
           and coalesce(k.daily_limit, -1) = coalesce(r.daily_limit, -1)
           and k.limit_basis = r.limit_basis
       );
    if lost_rules > 0 then
      raise notice 'SKIPPED %: holds % rule(s) the survivor does not match', pairs[i][2], lost_rules;
      continue;
    end if;

    delete from waters where state_id = ga and slug = pairs[i][2];
    get diagnostics removed = row_count;
    total := total + removed;
    if removed > 0 then
      raise notice 'merged % into %', pairs[i][2], pairs[i][1];
    end if;
  end loop;

  raise notice 'duplicate waters removed: % of 3', total;
end $$;

-- PROVE IT -------------------------------------------------------------------
do $$
declare
  ga_waters int;
  ga_rules int;
  still int;
begin
  select count(*) into ga_waters from waters w join states st on st.id = w.state_id
   where st.code = 'GA' and w.status = 'published';
  select count(*) into ga_rules from fishing_rules r join states st on st.id = r.state_id
   where st.code = 'GA' and r.status = 'published';

  select count(*) into still from waters w join states st on st.id = w.state_id
   where st.code = 'GA' and w.slug in (
     'ocmulgee-river', 'oconee-river',
     'savannah-river-and-its-tributaries-downstream-of-j-strom-thurmond-dam');

  raise notice 'Georgia published waters: % (was 66, expected 63)', ga_waters;
  raise notice 'Georgia published rules:  % (expected 83 -- the Savannah copy had one)', ga_rules;
  raise notice 'duplicate rows still present: % (expected 0)', still;

  if still > 0 then
    raise warning 'a duplicate survived; run scripts/audit_duplicate_waters.py';
  end if;
end $$;
