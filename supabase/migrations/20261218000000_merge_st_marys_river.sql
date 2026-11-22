-- St. Mary's River is one river, not two, and the audit script could not see it.
--
-- ===========================================================================
-- THE PAIR
--
--   saint-mary-s-river   "Saint Mary's River"   extent "and its tributaries"
--                        1 rule: 22-inch striped bass minimum, two fish
--   st-mary-s-river      "St. Mary's River"     no extent, 0 rules
--                        (curly apostrophe)
--
-- The same river, transcribed twice under Georgia's two spellings of it. The
-- state uses both: the General Regulations page writes "Saint Mary's River"
-- in the striped bass list, the daily-limits table and the Florida agreement
-- write "St. Mary's River", and the DNR forecasts page writes "St. Marys".
--
-- No rules, no seasons, no stockings, no followers and no children hang off
-- the duplicate -- verified on production 2026-11-22 against all five
-- referencing tables -- so this is a delete and a rename, with nothing to
-- re-point.
--
-- ===========================================================================
-- WHY THE DUPLICATE AUDIT MISSED IT, AND WHAT THAT COSTS
--
-- scripts/audit_duplicate_waters.py compares name tokens. "saint mary s
-- river" against "st mary s river" shares three tokens of four, so Jaccard
-- is 0.50 -- under the 0.70 same-stretch threshold -- and containment is 0.75,
-- under 0.90. It fails both gates and is not even reported for review.
--
-- The detector is doing what it was built to do. The gap is that "Saint" and
-- "St." are the same word and no amount of token overlap will discover that;
-- it needs an abbreviation table, which is a change to the script and not to
-- the data. Added to the script in the same commit so the next pair of
-- spellings is caught rather than noticed by eye.
--
-- The cost while it stood: the Waters tab listed the river twice, once with
-- its rule and once without, the second reading "we have not transcribed
-- rules for this water yet". Two entries, one of them saying we do not know
-- something we do know.
--
-- ===========================================================================
-- THE SURVIVOR AND THE NAME
--
-- `saint-mary-s-river` survives because it holds the rule -- the slug is the
-- less common spelling, but a slug is an identifier and the published web
-- pages may link to it, while moving a rule between waters is a real risk for
-- no gain.
--
-- The NAME becomes "St. Mary's River (Saint Marys)", carrying both spellings,
-- and that is not decoration. filterWatersList normalises a query by deleting
-- apostrophes and collapsing punctuation to spaces, so "St. Mary's River"
-- indexes as "st marys river" and a reader typing "saint marys" -- which is
-- how the General Regulations page spells it -- matches nothing. The
-- parenthetical is what makes both spellings findable from one row, and it is
-- cheaper and more honest than keeping a second row to be searchable.

do $$
declare
  v_state  uuid;
  v_keep   uuid;
  v_drop   uuid;
  n_blocked int;
begin
  select id into v_state from states where code = 'GA';

  select id into v_keep from waters
   where state_id = v_state and slug = 'saint-mary-s-river';
  select id into v_drop from waters
   where state_id = v_state and slug = 'st-mary-s-river';

  if v_keep is null then
    raise notice 'survivor absent; nothing to merge (already run, or the slug moved)';
    return;
  end if;

  if v_drop is not null then
    -- Refuse rather than cascade. fishing_rules, fishing_rule_species,
    -- stockings and user_waters all CASCADE from waters, so a plain delete
    -- would silently destroy anything that arrived on the duplicate between
    -- the measurement above and this migration running -- including a user's
    -- followed water. 20261211000000 learned this the same way.
    select (select count(*) from fishing_rules where water_id = v_drop)
         + (select count(*) from seasons     where water_id = v_drop)
         + (select count(*) from stockings   where water_id = v_drop)
         + (select count(*) from user_waters where water_id = v_drop)
         + (select count(*) from waters where parent_water_id = v_drop)
      into n_blocked;

    if n_blocked > 0 then
      raise exception
        'st-mary-s-river now has % dependent rows; refusing to delete. '
        'Re-point them onto saint-mary-s-river first.', n_blocked;
    end if;

    delete from waters where id = v_drop;
    raise notice 'duplicate st-mary-s-river deleted';
  else
    raise notice 'duplicate already gone';
  end if;

  update waters
     set name = 'St. Mary''s River (Saint Marys)',
         extent_note = coalesce(extent_note, 'and its tributaries'),
         updated_at = now()
   where id = v_keep;

  raise notice 'survivor renamed so both of Georgia''s spellings find it';
end $$;

-- PROVE IT: exactly one St. Mary's row in Georgia, and it is the one with the
-- rule.
do $$
declare
  n int;
  detail text;
begin
  select count(*), string_agg(w.slug || ' (' || w.name || ', ' ||
           (select count(*) from fishing_rules r where r.water_id = w.id)::text
           || ' rules)', '; ' order by w.slug)
    into n, detail
    from waters w join states st on st.id = w.state_id
   where st.code = 'GA'
     and (w.slug like '%mary%' or w.name ilike '%mary%');

  raise notice 'Georgia St. Mary''s rows: % -- %', n, coalesce(detail, '(none)');
  if n <> 1 then
    raise warning 'expected exactly 1 row, found %', n;
  end if;
end $$;
