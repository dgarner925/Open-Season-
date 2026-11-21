-- Georgia freshwater fishing: the first state, transcribed by hand.
--
-- Read from eregulations.com/georgia/fishing on 2026-11-21, from the pages the
-- guide files under "Freshwater Fishing". Every page carried "Last Updated:
-- August 27, 2026" and the guide's own What's Changed panel names 2026 as the
-- new regulations, so season_year is 2026.
--
-- This is deliberately hand-written rather than extracted. Two reasons:
--   - it proves the schema against a real state before the extractor is built
--     on top of it, and it already forced three corrections (aggregate limits,
--     rule windows that are not seasons, restrictions that are not gear);
--   - it becomes the gold set the fishing extractor is graded against. We have
--     no way to measure an extractor except against data a person checked.
--
-- One trap worth recording: the page named "Finfish Seasons, Limits, Sizes" is
-- SALTWATER (amberjack, red drum, American eel), despite being the page anyone
-- would pick by name. Georgia's freshwater limits are under "Game Species
-- Daily Limits". A fishing extractor pointed at the obvious page would have
-- produced a confident, fully grounded, entirely wrong Georgia.

-- ---------------------------------------------------------------- sources ---
insert into sources (state_id, agency_name, url, doc_type, purpose, notes)
select st.id, 'Georgia DNR Wildlife Resources Division', v.url, 'webpage',
       'fishing_rules', v.note
  from states st
 cross join (values
   ('https://www.eregulations.com/georgia/fishing/game-species-daily-limits',
    'Statewide freshwater daily limits. The freshwater table -- NOT '
    '"Finfish Seasons, Limits, Sizes", which is saltwater.'),
   ('https://www.eregulations.com/georgia/fishing/trout-fishing',
    'Trout: season, hours, delayed harvest, artificial-only waters, '
    'per-water size limits.'),
   ('https://www.eregulations.com/georgia/fishing/general-regulations',
    'Statewide freshwater general regulations.'),
   ('https://www.eregulations.com/georgia/fishing/trout-streams-destinations-by-county',
    'Named trout streams by county -- the waters list.'),
   ('https://www.eregulations.com/georgia/fishing/public-fishing-areas',
    'Public Fishing Areas and their special limits.')
 ) as v(url, note)
 where st.code = 'GA'
on conflict (url) do update set
  purpose = excluded.purpose,
  notes   = excluded.notes;

-- ----------------------------------------------------------------- waters ---
-- A water row is a REGULATED UNIT, named as Georgia names it. Where the state
-- regulates a stretch, the stretch is the water and `extent_note` carries the
-- state's own wording -- those landmarks ("450 feet upstream of the Sandy
-- Bottom Canoe Access") are the regulation, and paraphrasing them would be
-- paraphrasing the law. The river itself exists as the parent so a stretch can
-- be found under it.
with ga as (select id from states where code = 'GA'),
src as (select id from sources
         where url = 'https://www.eregulations.com/georgia/fishing/trout-fishing'),
parents(slug, name, kind) as (values
  ('amicalola-creek',    'Amicalola Creek',    'creek'),
  ('chattahoochee-river','Chattahoochee River','river'),
  ('chattooga-river',    'Chattooga River',    'river'),
  ('smith-creek',        'Smith Creek',        'creek'),
  ('toccoa-river',       'Toccoa River',       'river'),
  ('coleman-river',      'Coleman River',      'river'),
  ('conasauga-river',    'Conasauga River',    'river'),
  ('moccasin-creek',     'Moccasin Creek',     'creek')
)
insert into waters (state_id, name, slug, kind, source_id, last_verified_at)
select ga.id, p.name, p.slug, p.kind, src.id, now()
  from parents p, ga, src
on conflict (state_id, slug) do nothing;

-- The regulated stretches and standalone waters.
with ga as (select id from states where code = 'GA'),
src as (select id from sources
         where url = 'https://www.eregulations.com/georgia/fishing/trout-fishing'),
w(slug, name, kind, parent_slug, extent) as (values
  -- Delayed harvest, five streams.
  ('amicalola-creek-delayed-harvest', 'Amicalola Creek (delayed harvest)',
   'creek', 'amicalola-creek',
   'From County Road 192 (Steele Bridge Road) downstream to GA Hwy 53.'),
  ('chattahoochee-river-delayed-harvest', 'Chattahoochee River (delayed harvest)',
   'river', 'chattahoochee-river',
   'From Sope Creek (off Columns Drive) downstream to US Hwy 41 (Cobb Parkway).'),
  ('chattooga-river-delayed-harvest', 'Chattooga River (delayed harvest)',
   'river', 'chattooga-river',
   'From GA Hwy 28 bridge upstream to the mouth of Reed Creek.'),
  ('smith-creek-delayed-harvest', 'Smith Creek (delayed harvest)',
   'creek', 'smith-creek',
   'On Unicoi State Park, from Unicoi Dam downstream to the Unicoi State Park '
   'property boundary.'),
  ('toccoa-river-delayed-harvest', 'Toccoa River (delayed harvest)',
   'river', 'toccoa-river',
   'On U.S. Forest Service land, from 0.4 miles above the Shallowford Bridge '
   'upstream to a point 450 feet upstream of the Sandy Bottom Canoe Access.'),

  -- Artificial lures only.
  ('chattahoochee-river-artificial-only', 'Chattahoochee River (artificial lures only)',
   'river', 'chattahoochee-river',
   'From GA Hwy 20 to the boat ramp at the National Park Service Medlock '
   'Bridge Park immediately upstream of GA Hwy 141.'),
  ('coleman-river-artificial-only', 'Coleman River and tributaries',
   'river', 'coleman-river',
   'From its junction with the Tallulah River upstream to Forest Service '
   'Bridge No. 54.'),
  ('conasauga-river-upper', 'Conasauga River and tributaries (upper)',
   'river', 'conasauga-river',
   'Upstream of the Georgia-Tennessee state line, except the Jacks River '
   'watershed.'),
  ('hoods-creek', 'Hoods Creek and tributaries', 'creek', null,
   'On the Warwoman WMA.'),
  ('jones-creek', 'Jones Creek and tributaries', 'creek', null,
   'On US Forest Service property.'),
  ('mountaintown-creek', 'Mountaintown Creek and tributaries', 'creek', null,
   'Upstream of Mountaintown Creek Watershed Structure No. 2 (Hills Lake).'),
  ('noontootla-creek', 'Noontootla Creek and tributaries', 'creek', null,
   'On Blue Ridge WMA.'),
  ('stanley-creek', 'Stanley Creek and tributaries', 'creek', null,
   'On the Rich Mountain WMA.'),
  ('walnut-fork-creek', 'Walnut Fork Creek and tributaries', 'creek', null,
   'On the Warwoman WMA.'),

  -- Named waters with their own rules.
  ('waters-creek', 'Waters Creek', 'creek', null, null),
  ('dukes-creek', 'Dukes Creek and tributaries', 'creek', null,
   'Within the Dukes Creek Conservation Area (Smithgall Woods), White County, '
   'including the GA Hwy 75 Alternate right-of-way.'),
  ('moccasin-creek-youth-seniors', 'Moccasin Creek (youth, seniors and disability)',
   'creek', 'moccasin-creek',
   'Between the Lake Burton Hatchery water intake and a sign marking the '
   'approximate normal pool level of Lake Burton.'),
  ('chattahoochee-river-buford-tailwater', 'Chattahoochee River (Buford Dam tailwater)',
   'tailwater', 'chattahoochee-river',
   'From Buford Dam to Peachtree Creek.'),
  ('dockery-lake', 'Dockery Lake', 'lake', null, null),
  ('rock-creek-lake', 'Rock Creek Lake', 'lake', null, null),
  ('lake-lindsay-grace', 'Lake Lindsay Grace', 'lake', null, 'Wayne County.')
)
insert into waters (state_id, name, slug, kind, extent_note, county,
                    parent_water_id, source_id, last_verified_at)
select ga.id, w.name, w.slug, w.kind, w.extent,
       case when w.slug = 'lake-lindsay-grace' then 'Wayne'
            when w.slug = 'dukes-creek'        then 'White' end,
       p.id, src.id, now()
  from w
  cross join ga
  cross join src
  -- Explicit joins throughout: a LEFT JOIN after a comma list binds only to
  -- the last item, so `w` would not be in scope in this ON clause.
  left join waters p
         on p.slug = w.parent_slug
        and p.state_id = ga.id
on conflict (state_id, slug) do update set
  name        = excluded.name,
  kind        = excluded.kind,
  extent_note = excluded.extent_note,
  county      = excluded.county,
  parent_water_id = excluded.parent_water_id,
  last_verified_at = now();

-- --------------------------------------------- statewide daily limits -------
-- Georgia's freshwater limits are aggregate across a group of species, which
-- is why `fishing_rules` carries a species SET. "10 black bass" means ten
-- fish between all of them, not ten of each.
do $$
declare
  v_state uuid;
  v_src   uuid;
  v_rule  uuid;
  -- (species keys, daily kind, count, trophy n, trophy inches, note)
  rec record;
begin
  select id into v_state from states where code = 'GA';
  select id into v_src from sources
   where url = 'https://www.eregulations.com/georgia/fishing/game-species-daily-limits';

  -- Clear any previous run of this migration's statewide rules so it is
  -- idempotent without needing a natural key on a free-shaped rule.
  delete from fishing_rules
   where state_id = v_state and source_id = v_src and water_id is null;

  for rec in
    select * from (values
      -- Black bass: 10 in total.
      (array['largemouth-bass','smallmouth-bass','spotted-bass','shoal-bass',
             'altamaha-bass','bartrams-bass','chattahoochee-bass','coosa-bass',
             'suwannee-bass','tallapoosa-bass'],
       'count', 10, null::smallint, null::numeric,
       'Total daily limit of 10 black bass, only 5 of which may be Altamaha, '
       'Bartrams, Chattahoochee, Coosa, Shoal, Smallmouth, Suwannee, Tallapoosa.'),

      -- The nested sub-limit, as its own rule over the subset.
      (array['altamaha-bass','bartrams-bass','chattahoochee-bass','coosa-bass',
             'shoal-bass','smallmouth-bass','suwannee-bass','tallapoosa-bass'],
       'count', 5, null, null,
       'Of the 10 black bass daily limit, only 5 may be these species.'),

      (array['channel-catfish','flathead-catfish'],
       'no_limit', null, null, null, 'No daily limit.'),

      (array['black-crappie','white-crappie'],
       'count', 30, null, null, 'Black and/or white crappie, 30 in total.'),

      (array['chain-pickerel','grass-pickerel','redfin-pickerel'],
       'count', 15, null, null, 'Chain, grass and/or redfin pickerel, 15 in total.'),

      (array['american-shad','hickory-shad'],
       'count', 8, null, null, 'American and/or hickory shad, 8 in total.'),

      (array['striped-bass','white-bass','hybrid-striped-bass'],
       'count', 15, 2::smallint, 22::numeric,
       'Striped bass, white bass and/or hybrid white-striped bass: 15, only '
       'two of which can be 22 inches or longer. River-specific limits apply '
       'on several coastal rivers and on the Savannah River system.'),

      (array['bluegill','flier','redbreast-sunfish','redear-sunfish',
             'rock-bass','spotted-sunfish','warmouth','shadow-bass'],
       'count', 50, null, null, 'Sunfish or bream, 50 in total.'),

      (array['brook-trout','rainbow-trout','brown-trout'],
       'count', 8, null, null,
       'Brook, rainbow, brown trout and any hybrids of these species, 8 in '
       'total. Special limits apply on Amicalola Creek, the Chattahoochee, '
       'Chattooga, Smithgall Woods, Smith Creek, Toccoa River and Waters Creek.'),

      (array['walleye'], 'count', 8, null, null, 'Walleye, 8.'),

      (array['lake-sturgeon','shortnose-sturgeon','atlantic-sturgeon'],
       'prohibited', 0, null, null,
       'Sturgeon may not be taken in fresh or saltwater in Georgia.')
    ) as t(keys, kind, cnt, trophy_n, trophy_in, note)
  loop
    insert into fishing_rules (
      state_id, species_id, season_year, size_rule, daily_limit_kind,
      daily_limit, trophy_allowance, trophy_min_length_inches,
      limit_basis, notes, source_id, last_verified_at, status)
    values (
      v_state, null, 2026, 'none', rec.kind,
      rec.cnt::smallint, rec.trophy_n, rec.trophy_in,
      'aggregate', rec.note, v_src, now(), 'published')
    returning id into v_rule;

    insert into fishing_rule_species (rule_id, species_id)
    select v_rule, s.id from species s
     where s.key = any (rec.keys) and s.pursuit = 'fishing';
  end loop;
end $$;

-- ------------------------------------------------ per-water trout rules -----
do $$
declare
  v_state uuid;
  v_src   uuid;
  v_rule  uuid;
  rec record;
  trout text[] := array['brook-trout','rainbow-trout','brown-trout'];
begin
  select id into v_state from states where code = 'GA';
  select id into v_src from sources
   where url = 'https://www.eregulations.com/georgia/fishing/trout-fishing';

  delete from fishing_rules
   where state_id = v_state and source_id = v_src and water_id is not null;

  for rec in
    select * from (values
      -- Delayed harvest: a RULE WINDOW, not a season. The page says so in as
      -- many words: "These restrictions do not apply from May 15 - Oct. 31 of
      -- each year." The water is open all year.
      ('amicalola-creek-delayed-harvest',
       array['catch_and_release','artificial_only','single_hook'],
       'none', null::numeric, date '2026-11-01', date '2027-05-14', trout,
       'Delayed harvest: release all trout immediately; artificial lures only '
       'with one single hook per lure, Nov. 1 - May 14. Dropper lures are '
       'permitted if each carries one single hook.'),
      ('chattahoochee-river-delayed-harvest',
       array['catch_and_release','artificial_only','single_hook'],
       'none', null, date '2026-11-01', date '2027-05-14', trout,
       'Delayed harvest, Nov. 1 - May 14.'),
      ('chattooga-river-delayed-harvest',
       array['catch_and_release','artificial_only','single_hook'],
       'none', null, date '2026-11-01', date '2027-05-14', trout,
       'Delayed harvest, Nov. 1 - May 14.'),
      ('smith-creek-delayed-harvest',
       array['catch_and_release','artificial_only','single_hook'],
       'none', null, date '2026-11-01', date '2027-05-14', trout,
       'Delayed harvest, Nov. 1 - May 14.'),
      ('toccoa-river-delayed-harvest',
       array['catch_and_release','artificial_only','single_hook'],
       'none', null, date '2026-11-01', date '2027-05-14', trout,
       'Delayed harvest, Nov. 1 - May 14.'),

      -- Artificial lures only, all year.
      ('chattahoochee-river-artificial-only',
       array['artificial_only'], 'none', null, null, null, trout,
       'Artificial lures only. It is unlawful to possess any other type of '
       'bait on an artificial-lures-only stream.'),
      ('coleman-river-artificial-only',
       array['artificial_only'], 'none', null, null, null, trout,
       'Artificial lures only.'),
      ('hoods-creek', array['artificial_only'], 'none', null, null, null, trout,
       'Artificial lures only.'),
      ('jones-creek', array['artificial_only'], 'none', null, null, null, trout,
       'Artificial lures only.'),
      ('mountaintown-creek', array['artificial_only'], 'none', null, null, null, trout,
       'Artificial lures only.'),
      ('stanley-creek', array['artificial_only'], 'none', null, null, null, trout,
       'Artificial lures only.'),
      ('walnut-fork-creek', array['artificial_only'], 'none', null, null, null, trout,
       'Artificial lures only.'),

      -- Artificial only, but seasonal: Nov. 1 through the last Saturday in
      -- March. The last Saturday in March 2027 is the 27th.
      ('conasauga-river-upper',
       array['artificial_only'], 'none', null, date '2026-11-01', date '2027-03-27', trout,
       'Artificial lures only from Nov. 1 through the last Saturday in March '
       'each year. Excludes the Jacks River watershed.'),

      -- Minimum sizes, per water and per species group.
      ('noontootla-creek', array['artificial_only'], 'minimum', 16::numeric,
       null, null, trout,
       'Artificial lures only. Size limit 16 inches for all mountain trout; '
       'all trout under 16 inches must be released.'),

      -- Dukes Creek: everything goes back, and no trout may even be held.
      ('dukes-creek',
       array['reservation_required','artificial_only','barbless','catch_and_release'],
       'none', null, null, null, trout,
       'Open year round by reservation only (706 878-3087). Only artificial '
       'lures with barbless hooks. All fish must be released immediately, and '
       'no trout may be possessed while fishing on the Conservation Area.'),

      -- Moccasin Creek: a restriction on who may fish, not on tackle.
      ('moccasin-creek-youth-seniors',
       array['youth_senior_disabled_only'], 'none', null, null, null, trout,
       'Restricted to anglers under 12 years of age, licensed seniors 65 or '
       'older, and all ages holding a Georgia Disability License.'),

      -- Daylight-only waters.
      ('chattahoochee-river-buford-tailwater',
       array['daylight_only','no_night_fishing'], 'none', null, null, null, trout,
       'Fishing hours are 30 minutes before sunrise until 30 minutes after '
       'sunset. Night fishing is not allowed.'),
      ('dockery-lake',
       array['daylight_only','no_night_fishing'], 'none', null, null, null, trout,
       'Fishing hours are 30 minutes before sunrise until 30 minutes after '
       'sunset. Night fishing is not allowed. A trout licence is not required '
       'to fish for species other than trout here.'),
      ('rock-creek-lake',
       array['daylight_only','no_night_fishing'], 'none', null, null, null, trout,
       'Fishing hours are 30 minutes before sunrise until 30 minutes after '
       'sunset. Night fishing is not allowed. A trout licence is not required '
       'to fish for species other than trout here.')
    ) as t(water_slug, restr, size_rule, min_in, eff_from, eff_to, keys, note)
  loop
    -- Resolve the water first and fail loudly if it is missing. Going through
    -- INSERT ... SELECT would leave v_rule null on a slug typo and then blame
    -- the join table, which is a long way from the actual mistake.
    v_rule := null;
    if not exists (select 1 from waters
                    where state_id = v_state and slug = rec.water_slug) then
      raise exception 'no Georgia water with slug %', rec.water_slug;
    end if;

    insert into fishing_rules (
      state_id, species_id, water_id, season_year, size_rule,
      min_length_inches, restrictions, effective_from, effective_to,
      daily_limit_kind, limit_basis, notes, source_id, last_verified_at, status)
    select v_state, null, wv.id, 2026, rec.size_rule,
           rec.min_in, rec.restr, rec.eff_from, rec.eff_to,
           'unknown', 'aggregate', rec.note, v_src, now(), 'published'
      from waters wv
     where wv.state_id = v_state and wv.slug = rec.water_slug
    returning id into v_rule;

    insert into fishing_rule_species (rule_id, species_id)
    select v_rule, s.id from species s
     where s.key = any (rec.keys) and s.pursuit = 'fishing';
  end loop;
end $$;

-- Waters Creek has two different minimum sizes on the same water, so it is two
-- rules rather than one with a fudged number.
do $$
declare
  v_state uuid; v_src uuid; v_water uuid; v_rule uuid;
begin
  select id into v_state from states where code = 'GA';
  select id into v_src from sources
   where url = 'https://www.eregulations.com/georgia/fishing/trout-fishing';
  select id into v_water from waters
   where state_id = v_state and slug = 'waters-creek';

  insert into fishing_rules (state_id, species_id, water_id, season_year,
    size_rule, min_length_inches, daily_limit_kind, limit_basis, notes,
    source_id, last_verified_at, status)
  values (v_state, (select id from species where key = 'brown-trout'),
          v_water, 2026, 'minimum', 22, 'unknown', 'per_species',
          'Size limit 22 inches for brown and rainbow trout on Waters Creek. '
          'It is a violation to possess a trout smaller than this limit.',
          v_src, now(), 'published'),
         (v_state, (select id from species where key = 'rainbow-trout'),
          v_water, 2026, 'minimum', 22, 'unknown', 'per_species',
          'Size limit 22 inches for brown and rainbow trout on Waters Creek. '
          'It is a violation to possess a trout smaller than this limit.',
          v_src, now(), 'published'),
         (v_state, (select id from species where key = 'brook-trout'),
          v_water, 2026, 'minimum', 18, 'unknown', 'per_species',
          'Size limit 18 inches for brook trout on Waters Creek. It is a '
          'violation to possess a trout smaller than this limit.',
          v_src, now(), 'published');
end $$;

-- --------------------------------------------------------- state_species ----
-- Without these rows every rule above is invisible to the app and the site,
-- and the coverage count cannot see that it is missing. Only the species
-- Georgia actually regulates in freshwater.
insert into state_species (state_id, species_id)
select st.id, s.id
  from states st, species s
 where st.code = 'GA'
   and s.pursuit = 'fishing'
   and s.key in (
     'largemouth-bass','smallmouth-bass','spotted-bass','shoal-bass',
     'altamaha-bass','bartrams-bass','chattahoochee-bass','coosa-bass',
     'suwannee-bass','tallapoosa-bass',
     'channel-catfish','flathead-catfish','blue-catfish','bullhead',
     'black-crappie','white-crappie',
     'chain-pickerel','grass-pickerel','redfin-pickerel',
     'american-shad','hickory-shad',
     'striped-bass','white-bass','hybrid-striped-bass',
     'bluegill','flier','redbreast-sunfish','redear-sunfish','rock-bass',
     'spotted-sunfish','warmouth','shadow-bass',
     'brook-trout','rainbow-trout','brown-trout',
     'walleye',
     'lake-sturgeon','shortnose-sturgeon','atlantic-sturgeon')
on conflict (state_id, species_id) do nothing;
