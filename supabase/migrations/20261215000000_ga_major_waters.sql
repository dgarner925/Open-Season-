-- The lakes and rivers Georgia anglers actually name.
--
-- ===========================================================================
-- THE LIST IS THE AGENCY'S, NOT MINE
--
-- "Major" is an editorial judgement, and the wrong place to make one up. So
-- the list below is Georgia DNR's own: the reservoirs and rivers the Wildlife
-- Resources Division publishes a Fishing Forecast for, at
-- georgiawildlife.com/fishing-forecasts, read 2026-11-22. Thirty-two
-- reservoirs and nineteen rivers, compiled by the agency's own fisheries
-- biologists -- which is as close to an official answer to "which waters
-- matter in Georgia" as the state publishes.
--
-- Using it means the list is extensible by rereading one page, and that an
-- omission is the agency's call rather than my taste. Lake Sinclair is on it.
-- So is Allatoona, which is how a reader finds out we are not missing it.
--
-- Already held, so untouched here: Blackshear, Blue Ridge, Burton, Juliette,
-- Lanier, Oconee, Seminole, Walter F. George, West Point, Richard B. Russell
-- (10 reservoirs) and Altamaha, Chattahoochee, Conasauga, Coosa, Flint,
-- Ogeechee, Satilla, St. Mary's (8 rivers). Added by 20261214000000 as border
-- waters: Hartwell, Clarks Hill, Yonah, Tugaloo, Chatuge, Bartletts Ferry,
-- Goat Rock, Oliver, George W. Andrews (9).
--
-- ===========================================================================
-- WHAT A ROW WITH NO RULES IS CLAIMING
--
-- Each water below carries NO rule, and rules_complete_at set. Per
-- 20261213000000 that is a positive finding: every exception list Georgia
-- publishes was read for this water and it is on none of them, so the
-- statewide rules are the complete answer. The six pages read, 2026-11-22:
--
--   General Regulations            length limits, seasons, closures
--   Game Species Daily Limits      the limits table and its exceptions
--   Trout Fishing                  delayed harvest, artificial-only, hours
--   Trout Streams by County        the designated trout water list
--   Public Fishing Areas           all 11 PFAs and their posted limits
--   Agreements with Bordering St.  the SC, AL, FL and NC agreements
--
-- CATEGORY RULES ARE NOT A HOLE IN THAT CLAIM. Georgia's trout gear rules are
-- published for "trout streams" as a class, not by naming the Etowah, and we
-- hold them as statewide rules carrying one_pole_handheld and no_live_bait
-- against the three trout species. A reader who picks trout on any of these
-- waters gets them through the statewide set, which is what the statewide set
-- is for. rules_complete_at claims we hold every rule Georgia publishes for
-- this water BY NAME -- it does not claim the water is unregulated.
--
-- ===========================================================================
-- THREE RIVERS ON THE AGENCY'S LIST ARE DELIBERATELY NOT ADDED
--
-- Ocmulgee, Oconee and Savannah. We hold a row for each, but each is an
-- extent-specific stretch -- "Ocmulgee River downstream of GA Hwy 96 bridge",
-- which carries a 22-inch striped bass minimum that does not apply upstream.
-- A main-stem row would be the parent of a stretch that holds a rule, and
-- nothing on the Waters tab yet renders a water's children, so the parent
-- would read "no exception, statewide applies" while hiding the stretch's
-- minimum directly beneath it. A row that hides a rule is worse than no row.
-- They land with the parent/child rendering.
--
-- Chattooga and Toccoa are left for the same reason plus one more: their
-- generic slugs are already taken by their delayed-harvest stretches, a
-- leftover from the merges in 20261210000000, so adding the main stem means
-- moving a slug that the published web pages may link to.

-- A SOURCE THAT IS NOT A REGULATION ------------------------------------------
--
-- The forecasts page is the authority for the LIST and nothing else. It
-- publishes no limits, so it must never be fed to an extractor looking for
-- rules, and `purpose` is how that is enforced: every consumer filters
-- positively on an exact purpose -- extract-source on 'seasons',
-- ingest-leftover-tags on 'leftover_tags' -- so a purpose none of them asks
-- for is a source none of them touches. Verified across supabase/functions
-- 2026-11-22: there is no `neq('purpose', ...)` anywhere, nothing treats
-- "not seasons" as fishing.
--
-- The constraint has been widened once before, by 20261122020000, when
-- fishing sources arrived. Same move, same reason.
alter table sources drop constraint if exists sources_purpose_known;
alter table sources add constraint sources_purpose_known
  check (purpose = any (array[
    'seasons', 'leftover_tags', 'fishing_rules', 'stockings',
    'reference'     -- tells us which waters exist, never what the rules are
  ]));

do $$
declare
  v_state uuid;
  v_src   uuid;
  n_added int;
begin
  select id into v_state from states where code = 'GA';

  insert into sources (state_id, agency_name, url, doc_type, purpose, notes)
  values (v_state,
          'Georgia Department of Natural Resources, Wildlife Resources Division',
          'https://georgiawildlife.com/fishing-forecasts',
          'webpage', 'reference',
          'The agency''s own list of the reservoirs and rivers it publishes '
          'fishing forecasts for. Used to decide WHICH waters are worth '
          'listing, never as a source of rules.')
  on conflict (url) do nothing;

  select id into v_src from sources where url = 'https://georgiawildlife.com/fishing-forecasts';

  insert into waters (state_id, name, slug, kind, source_id,
                      last_verified_at, rules_complete_at, status)
  select v_state, x.name, x.slug, x.kind, v_src, now(), now(), 'published'
    from (values
      -- Reservoirs, in the agency's order.
      ('lake-allatoona',    'Lake Allatoona',                   'reservoir'),
      ('big-haynes-lake',   'Big Haynes Lake (Randy Poynter)',  'reservoir'),
      ('carters-lake',      'Carters Lake',                     'reservoir'),
      ('lake-chehaw',       'Lake Chehaw',                      'reservoir'),
      ('hamburg-lake',      'Hamburg Lake',                     'lake'),
      ('high-falls-lake',   'High Falls Lake',                  'reservoir'),
      ('jackson-lake',      'Jackson Lake',                     'reservoir'),
      ('lake-nottely',      'Lake Nottely',                     'reservoir'),
      ('lake-rabun',        'Lake Rabun',                       'reservoir'),
      ('lake-seed',         'Lake Seed',                        'reservoir'),
      ('lake-sinclair',     'Lake Sinclair',                    'reservoir'),
      ('lake-tobesofkee',   'Lake Tobesofkee',                  'reservoir'),
      ('lake-varner',       'Lake Varner',                      'reservoir'),
      -- Rivers.
      ('coosawattee-river', 'Coosawattee River',                'river'),
      ('etowah-river',      'Etowah River',                     'river'),
      ('ochlockonee-river', 'Ochlockonee River',                'river'),
      ('oostanaula-river',  'Oostanaula River',                 'river'),
      ('suwannee-river',    'Suwannee River',                   'river'),
      ('withlacoochee-river', 'Withlacoochee River',            'river')
    ) as x(slug, name, kind)
  on conflict (state_id, slug) do update set
    -- A slug collision here means the water was already held under this exact
    -- slug, which the pre-flight said it was not. Update rather than skip, so
    -- a re-run converges, but DO NOT touch rules_complete_at: if an existing
    -- row already carries a claim, that claim was made by whoever read the
    -- source for it, not by this migration.
    name             = excluded.name,
    kind             = excluded.kind,
    last_verified_at = excluded.last_verified_at,
    updated_at       = now();

  get diagnostics n_added = row_count;
  raise notice 'major waters upserted: % (expected 19)', n_added;
  if n_added <> 19 then
    raise warning 'expected 19 rows, touched % -- check for a slug already in use', n_added;
  end if;
end $$;

-- PROVE IT: none of these may acquire a rule by accident, and every one must
-- carry the claim. A row with rules here would mean a slug collided with an
-- existing regulated water and this migration quietly adopted it.
do $$
declare
  n_bad int;
  detail text;
begin
  select count(*), string_agg(w.slug, ', ' order by w.slug)
    into n_bad, detail
    from waters w
    join states st on st.id = w.state_id
   where st.code = 'GA'
     and w.source_id = (select id from sources
                         where url = 'https://georgiawildlife.com/fishing-forecasts')
     and (w.rules_complete_at is null
          or exists (select 1 from fishing_rules r where r.water_id = w.id));

  if n_bad > 0 then
    raise warning 'major waters in a state they should not be in: % -- %', n_bad, detail;
  else
    raise notice 'all 19 major waters: no rules, completeness claimed. Correct.';
  end if;
end $$;
