-- Georgia's eleven Public Fishing Areas get their own answers, because until
-- now the app gave them the statewide ones and the statewide ones are wrong
-- there.
--
-- ===========================================================================
-- THE DEFECT
--
-- Open Ocmulgee PFA in the app today and largemouth bass reads "10/day, 12
-- inch minimum" -- Georgia's statewide black bass limit. Largemouth bass at
-- Ocmulgee PFA are catch-and-release. The app does not say "we have not
-- checked"; it states a number, and the number permits ten fish where the
-- agency permits none.
--
-- Every PFA was wrong in the same direction, by the same mechanism:
--
--   Big Lazer Creek     bass 10/day   really 5      bream 50   really 15
--   Dodge County        bass 10/day   really 5, and 16-24" must be released
--   Evans County        bass 10/day   really 5, and 12-16" must be released
--   Flat Creek          bass 10/day   really 5      bream 50   really 15
--   Hugh M. Gillis      bass 10/day   really 5, and 16-24" must be released
--   Marben PFA          bass 10/day   really 5, only one 16" or longer
--   McDuffie            bass 10/day   really 5      bream 50   really 15
--   Ocmulgee            bass 10/day   really ZERO -- catch-and-release
--   Paradise            bass 10/day   really 5, only one over 24"
--   Rocky Mountain      bass 10/day   really 5      bream 50   really 15
--   Silver Lake         bass 10/day   really 5      bream 50   really 15
--   Panic Pond          bass 10/day   really ONE, and only over 24"
--   House Pond          hybrid stripers: really one, and only over 18"
--
-- Channel catfish is worse than a wrong number: Georgia's statewide rule for
-- channel and flathead catfish is daily_limit_kind = 'no_limit'. So the app
-- told a reader standing on any PFA that there is no catfish limit. The PFA
-- limit is five.
--
-- ===========================================================================
-- WHY THE DATA WAS ALREADY THERE AND STILL DID NOT SHOW
--
-- The PFA defaults were not missing. They were on a row called "Public
-- Fishing Area lakes operated by the Department of Natural Resources" -- a
-- pseudo-water standing in for the regulation's own default tier.
--
-- resolve.ts merges a water's rules over the STATEWIDE set. It knows two
-- tiers, not three. A rule on the umbrella row therefore renders only when a
-- reader opens the umbrella row itself, which is not a place and not where
-- anybody looks. Eleven real PFAs sat beside it inheriting Georgia's
-- statewide answers.
--
-- Two ways out. Teach the resolver a third tier, or give each PFA the
-- complete answer. This migration does the second, for the same reason
-- 20261214000000 wrote the Georgia-South Carolina chart out as 27 literal
-- rules instead of a template: a tier that exists only in the data model is
-- a tier that renders nowhere, and 54 rows that are read correctly beat 4
-- rows that need code that does not exist yet. The duplication is real and
-- it is the cheaper mistake.
--
-- ===========================================================================
-- WHAT THE PAGE SAYS THAT THIS MIGRATION DELIBERATELY DOES NOT WRITE
--
-- "All other species" in the defaults list is a HYPERLINK, to Georgia's
-- statewide daily limits page. It is not a blank and it is not "no limit":
-- it says the statewide limits apply to everything the PFA section does not
-- name. That is already what the resolver does with an unmentioned species,
-- so the correct transcription of that line is no rule at all. Read as a
-- blank -- which is how it renders as text -- it would have become a
-- permission the agency never granted.
--
-- Day-of-week and seasonal closures stay in waters.notes, because
-- effective_from/effective_to is a date range for when a RULE is in force
-- and cannot express "Saturday through Monday" or "closed in July and
-- August". Writing a closure into a rule's window would invert its meaning.
-- Panic Pond and House Pond are the two affected.
--
-- ===========================================================================
-- THE ONE THING THE PAGE LEAVES GENUINELY OPEN
--
-- At Dodge County, Evans County and Hugh M. Gillis the agency details a
-- protected slot instead of the PFA's default 14-inch minimum. Whether a
-- bass under 14 inches may be kept at those three is not resolved by the
-- page: the defaults apply "unless different length limits are posted or
-- detailed in the information section for a specific PFA", and those
-- sections do detail one. At Evans the slot settles it -- "Bass up to 12
-- inches ... can be kept" explicitly permits a 12-inch fish, which a 14-inch
-- minimum would forbid -- so the slot plainly displaces the default. Dodge
-- and Gillis are worded the same way and are read the same way.
--
-- So those three carry the slot and no minimum, and each rule's notes carry
-- the agency's sentence verbatim, so a reader sees the wording rather than
-- our reading of it.
--
-- Panic Pond's "one fish greater than 24 inches" is stored as a 24-inch
-- minimum, the closest the schema gets. A fish of exactly 24.0 inches is
-- keepable under what we store and not under what the agency wrote. The
-- verbatim sentence is in the rule's notes.
--
-- ===========================================================================
-- A FINDING RECORDED HERE BECAUSE IT HAS NO BETTER HOME
--
-- The umbrella row is left published on purpose. Unpublishing a water does
-- NOT hide its rules: waterDetail.statewideRules treats a rule whose water
-- is absent from the fetched list as STATEWIDE, deliberately, so that a
-- published rule cannot vanish when RLS hides its water. The consequence is
-- that archiving a water silently promotes every rule attached to it to
-- state-wide force. Archiving the umbrella row alone would have applied the
-- PFA's 14-inch minimum and five-catfish limit to all of Georgia.
--
-- A water carrying rules must therefore never be unpublished without its
-- rules being unpublished in the same transaction.

-- 0. GRASS CARP IS A FISH WE DID NOT HAVE ------------------------------------
--
-- "Grass carp must be released immediately" was unwritable: there is no
-- grass-carp species row. Not mapped onto common-carp, which is a different
-- fish with no such rule.
insert into species (key, name, category, pursuit, sort_order)
values ('grass-carp', 'Grass carp', 'other_fish', 'fishing', 1514)
on conflict (key) do nothing;

-- 1. EVERY PFA CARRIES ITS OWN COMPLETE ANSWER -------------------------------
do $$
declare
  v_ga uuid;
  v_src uuid;
  v_water uuid;
  v_rule uuid;
  rec record;
  n_rules int := 0;
  n_links int := 0;
  n_want int;
begin
  select id into v_ga from states where code = 'GA';
  select id into v_src from sources
   where url = 'https://www.eregulations.com/georgia/fishing/public-fishing-areas';
  if v_ga is null then raise exception 'no GA state row'; end if;
  if v_src is null then raise exception 'the PFA source is not registered'; end if;

  -- Front guard rather than per-row upserts. These rules have no natural key
  -- -- a water plus a species set plus a number is not unique by
  -- construction -- so a re-run would duplicate rather than conflict. Big
  -- Lazer Creek holding any published rule means this already ran.
  if exists (
    select 1 from fishing_rules r
      join waters w on w.id = r.water_id
     where w.slug = 'big-lazer-creek' and w.state_id = v_ga and r.status = 'published'
  ) then
    raise notice 'PFA rules already present; skipping section 1';
    return;
  end if;

  for rec in
    select * from (values
      -- ---- Big Lazer Creek: no exception published, so the defaults stand
      ('big-lazer-creek', 'minimum', 14::numeric, null::numeric, 'count', 5::int,
       'aggregate', null::int, null::numeric, '{}'::text[],
       'Public Fishing Area default: 14-inch minimum and five per day unless otherwise posted at the site.',
       array['largemouth-bass']),
      ('big-lazer-creek', 'unknown', null, null, 'count', 15, 'aggregate', null, null, '{}',
       'Public Fishing Area default: fifteen bream or sunfish per day, of any one species or in combination.',
       array['bluegill','flier','redbreast-sunfish','redear-sunfish','rock-bass','shadow-bass','spotted-sunfish','warmouth']),
      ('big-lazer-creek', 'unknown', null, null, 'count', 5, 'aggregate', null, null, '{}',
       'Public Fishing Area default: five channel catfish per day. Georgia sets no statewide catfish limit, so this is stricter than the statewide rule, not looser.',
       array['channel-catfish']),
      ('big-lazer-creek', 'unknown', null, null, 'prohibited', 0, 'aggregate', null, null,
       array['catch_and_release'],
       'Grass carp must be released immediately.',
       array['grass-carp']),

      -- ---- Marben PFA (Charlie Elliott Wildlife Center)
      ('marben-pfa', 'minimum', 14, null, 'count', 5, 'aggregate', 1, 16, '{}',
       'Daily Bag Limit is five (5) largemouth bass, only one (1) of which can be 16 inches or longer.',
       array['largemouth-bass']),
      ('marben-pfa', 'unknown', null, null, 'count', 15, 'aggregate', null, null, '{}',
       'Public Fishing Area default: fifteen bream or sunfish per day, of any one species or in combination.',
       array['bluegill','flier','redbreast-sunfish','redear-sunfish','rock-bass','shadow-bass','spotted-sunfish','warmouth']),
      ('marben-pfa', 'unknown', null, null, 'count', 5, 'aggregate', null, null, '{}',
       'Public Fishing Area default: five channel catfish per day.',
       array['channel-catfish']),
      ('marben-pfa', 'unknown', null, null, 'prohibited', 0, 'aggregate', null, null,
       array['catch_and_release'], 'Grass carp must be released immediately.', array['grass-carp']),

      -- ---- Dodge County: protected slot, and it displaces the default minimum
      ('dodge-county', 'slot_release', 16, 24, 'count', 5, 'aggregate', 1, 24, '{}',
       'Largemouth bass between 16 and 24 inches must be released immediately. Bass up to 16 inches and over 24 inches can be kept (limit 5 total per person, only 1 over 24 inches).',
       array['largemouth-bass']),
      ('dodge-county', 'unknown', null, null, 'count', 15, 'aggregate', null, null, '{}',
       'Public Fishing Area default: fifteen bream or sunfish per day, of any one species or in combination.',
       array['bluegill','flier','redbreast-sunfish','redear-sunfish','rock-bass','shadow-bass','spotted-sunfish','warmouth']),
      ('dodge-county', 'unknown', null, null, 'count', 5, 'aggregate', null, null, '{}',
       'Public Fishing Area default: five channel catfish per day.',
       array['channel-catfish']),
      ('dodge-county', 'unknown', null, null, 'prohibited', 0, 'aggregate', null, null,
       array['catch_and_release'], 'Grass carp must be released immediately.', array['grass-carp']),

      -- ---- Evans County
      ('evans-county', 'slot_release', 12, 16, 'count', 5, 'aggregate', 1, 16, '{}',
       'Largemouth bass between 12 and 16 inches must be released immediately. Bass up to 12 inches and over 16 inches can be kept. Limit five (5) per person, with only one (1) over 16 inches.',
       array['largemouth-bass']),
      ('evans-county', 'unknown', null, null, 'count', 15, 'aggregate', null, null, '{}',
       'Public Fishing Area default: fifteen bream or sunfish per day, of any one species or in combination.',
       array['bluegill','flier','redbreast-sunfish','redear-sunfish','rock-bass','shadow-bass','spotted-sunfish','warmouth']),
      ('evans-county', 'unknown', null, null, 'count', 5, 'aggregate', null, null, '{}',
       'Public Fishing Area default: five channel catfish per day.',
       array['channel-catfish']),
      ('evans-county', 'unknown', null, null, 'prohibited', 0, 'aggregate', null, null,
       array['catch_and_release'], 'Grass carp must be released immediately.', array['grass-carp']),

      -- ---- Flat Creek
      ('flat-creek', 'minimum', 14, null, 'count', 5, 'aggregate', null, null, '{}',
       'Public Fishing Area default: 14-inch minimum and five per day unless otherwise posted at the site.',
       array['largemouth-bass']),
      ('flat-creek', 'unknown', null, null, 'count', 15, 'aggregate', null, null, '{}',
       'Public Fishing Area default: fifteen bream or sunfish per day, of any one species or in combination.',
       array['bluegill','flier','redbreast-sunfish','redear-sunfish','rock-bass','shadow-bass','spotted-sunfish','warmouth']),
      ('flat-creek', 'unknown', null, null, 'count', 5, 'aggregate', null, null, '{}',
       'Public Fishing Area default: five channel catfish per day.',
       array['channel-catfish']),
      ('flat-creek', 'unknown', null, null, 'prohibited', 0, 'aggregate', null, null,
       array['catch_and_release'], 'Grass carp must be released immediately.', array['grass-carp']),

      -- ---- Hugh M. Gillis: same slot as Dodge, but the agency states NO
      -- oversize allowance here. Not copied across; the difference is the
      -- agency's, and inventing the clause would invent a permission.
      ('hugh-m-gillis', 'slot_release', 16, 24, 'count', 5, 'aggregate', null, null, '{}',
       'Largemouth bass between 16 and 24 inches must be released immediately. Bass up to 16 inches and over 24 inches can be kept (limit 5 per person).',
       array['largemouth-bass']),
      ('hugh-m-gillis', 'unknown', null, null, 'count', 15, 'aggregate', null, null, '{}',
       'Public Fishing Area default: fifteen bream or sunfish per day, of any one species or in combination.',
       array['bluegill','flier','redbreast-sunfish','redear-sunfish','rock-bass','shadow-bass','spotted-sunfish','warmouth']),
      ('hugh-m-gillis', 'unknown', null, null, 'count', 5, 'aggregate', null, null, '{}',
       'Public Fishing Area default: five channel catfish per day.',
       array['channel-catfish']),
      ('hugh-m-gillis', 'unknown', null, null, 'prohibited', 0, 'aggregate', null, null,
       array['catch_and_release'], 'Grass carp must be released immediately.', array['grass-carp']),

      -- ---- McDuffie
      ('mcduffie', 'minimum', 14, null, 'count', 5, 'aggregate', null, null, '{}',
       'Public Fishing Area default: 14-inch minimum and five per day unless otherwise posted at the site.',
       array['largemouth-bass']),
      ('mcduffie', 'unknown', null, null, 'count', 15, 'aggregate', null, null, '{}',
       'Public Fishing Area default: fifteen bream or sunfish per day, of any one species or in combination.',
       array['bluegill','flier','redbreast-sunfish','redear-sunfish','rock-bass','shadow-bass','spotted-sunfish','warmouth']),
      ('mcduffie', 'unknown', null, null, 'count', 5, 'aggregate', null, null, '{}',
       'Public Fishing Area default: five channel catfish per day.',
       array['channel-catfish']),
      ('mcduffie', 'unknown', null, null, 'prohibited', 0, 'aggregate', null, null,
       array['catch_and_release'], 'Grass carp must be released immediately.', array['grass-carp']),

      -- ---- Ocmulgee: the one where the old answer was not merely wrong but
      -- permissive by ten fish
      ('ocmulgee', 'unknown', null, null, 'prohibited', 0, 'aggregate', null, null,
       array['catch_and_release'],
       'Largemouth bass are catch-and-release.',
       array['largemouth-bass']),
      ('ocmulgee', 'unknown', null, null, 'count', 15, 'aggregate', null, null, '{}',
       'Public Fishing Area default: fifteen bream or sunfish per day, of any one species or in combination.',
       array['bluegill','flier','redbreast-sunfish','redear-sunfish','rock-bass','shadow-bass','spotted-sunfish','warmouth']),
      ('ocmulgee', 'unknown', null, null, 'count', 5, 'aggregate', null, null, '{}',
       'Public Fishing Area default: five channel catfish per day.',
       array['channel-catfish']),
      ('ocmulgee', 'unknown', null, null, 'prohibited', 0, 'aggregate', null, null,
       array['catch_and_release'], 'Grass carp must be released immediately.', array['grass-carp']),

      -- ---- Paradise: two species stated, and the hybrid stripers get their
      -- own creel limit
      ('paradise', 'minimum', 14, null, 'count', 5, 'aggregate', 1, 24, '{}',
       'Largemouth bass daily limit is five (5) total per person, only one over 24 inches.',
       array['largemouth-bass']),
      ('paradise', 'unknown', null, null, 'count', 5, 'aggregate', null, null, '{}',
       'Hybrid striped bass daily creel limit is five (5) fish.',
       array['hybrid-striped-bass']),
      ('paradise', 'unknown', null, null, 'count', 15, 'aggregate', null, null, '{}',
       'Public Fishing Area default: fifteen bream or sunfish per day, of any one species or in combination.',
       array['bluegill','flier','redbreast-sunfish','redear-sunfish','rock-bass','shadow-bass','spotted-sunfish','warmouth']),
      ('paradise', 'unknown', null, null, 'count', 5, 'aggregate', null, null, '{}',
       'Public Fishing Area default: five channel catfish per day.',
       array['channel-catfish']),
      ('paradise', 'unknown', null, null, 'prohibited', 0, 'aggregate', null, null,
       array['catch_and_release'], 'Grass carp must be released immediately.', array['grass-carp']),

      -- ---- Rocky Mountain Recreation & PFA
      ('rocky-mountain-recreation-and-public-fishing-area', 'minimum', 14, null, 'count', 5,
       'aggregate', null, null, '{}',
       'Public Fishing Area default: 14-inch minimum and five per day unless otherwise posted at the site.',
       array['largemouth-bass']),
      ('rocky-mountain-recreation-and-public-fishing-area', 'unknown', null, null, 'count', 15,
       'aggregate', null, null, '{}',
       'Public Fishing Area default: fifteen bream or sunfish per day, of any one species or in combination.',
       array['bluegill','flier','redbreast-sunfish','redear-sunfish','rock-bass','shadow-bass','spotted-sunfish','warmouth']),
      ('rocky-mountain-recreation-and-public-fishing-area', 'unknown', null, null, 'count', 5,
       'aggregate', null, null, '{}',
       'Public Fishing Area default: five channel catfish per day.',
       array['channel-catfish']),
      ('rocky-mountain-recreation-and-public-fishing-area', 'unknown', null, null, 'prohibited', 0,
       'aggregate', null, null, array['catch_and_release'],
       'Grass carp must be released immediately.', array['grass-carp']),

      -- ---- Silver Lake PFA proper. Panic Pond and House Pond are two of its
      -- thirty ponds and are separate rows, below.
      ('silver-lake', 'minimum', 14, null, 'count', 5, 'aggregate', null, null, '{}',
       'Public Fishing Area default: 14-inch minimum and five per day unless otherwise posted at the site.',
       array['largemouth-bass']),
      ('silver-lake', 'unknown', null, null, 'count', 15, 'aggregate', null, null, '{}',
       'Public Fishing Area default: fifteen bream or sunfish per day, of any one species or in combination.',
       array['bluegill','flier','redbreast-sunfish','redear-sunfish','rock-bass','shadow-bass','spotted-sunfish','warmouth']),
      ('silver-lake', 'unknown', null, null, 'count', 5, 'aggregate', null, null, '{}',
       'Public Fishing Area default: five channel catfish per day.',
       array['channel-catfish']),
      ('silver-lake', 'unknown', null, null, 'prohibited', 0, 'aggregate', null, null,
       array['catch_and_release'], 'Grass carp must be released immediately.', array['grass-carp']),

      -- ---- Panic Pond: one bass, and only a big one
      ('panic-pond', 'minimum', 24, null, 'count', 1, 'aggregate', null, null, '{}',
       'The harvest for largemouth bass in Panic Pond is one fish greater than 24 inches per day. Stored as a 24-inch minimum, which is the closest this schema gets to "greater than 24".',
       array['largemouth-bass']),
      ('panic-pond', 'unknown', null, null, 'count', 15, 'aggregate', null, null, '{}',
       'Public Fishing Area default: fifteen bream or sunfish per day, of any one species or in combination.',
       array['bluegill','flier','redbreast-sunfish','redear-sunfish','rock-bass','shadow-bass','spotted-sunfish','warmouth']),
      ('panic-pond', 'unknown', null, null, 'count', 5, 'aggregate', null, null, '{}',
       'Public Fishing Area default: five channel catfish per day.',
       array['channel-catfish']),
      ('panic-pond', 'unknown', null, null, 'prohibited', 0, 'aggregate', null, null,
       array['catch_and_release'], 'Grass carp must be released immediately.', array['grass-carp']),

      -- ---- House Pond. It already holds the bluegill/redear/warmouth rule
      -- (five, 8-inch minimum), so the PFA bream default is written here for
      -- the OTHER five bream species only. Writing all eight would give
      -- bluegill two live limits -- fifteen and five -- and the resolver
      -- would show both.
      ('house-pond', 'minimum', 14, null, 'count', 5, 'aggregate', null, null, '{}',
       'Public Fishing Area default: 14-inch minimum and five per day unless otherwise posted at the site.',
       array['largemouth-bass']),
      ('house-pond', 'minimum', 18, null, 'count', 1, 'aggregate', null, null, '{}',
       'The harvest of hybrid striped bass in House Pond is one fish not less than 18 inches in total length.',
       array['hybrid-striped-bass']),
      ('house-pond', 'unknown', null, null, 'count', 15, 'aggregate', null, null, '{}',
       'Public Fishing Area default: fifteen bream or sunfish per day. Bluegill, redear sunfish and warmouth are five in combination at House Pond and are covered by their own rule.',
       array['flier','redbreast-sunfish','rock-bass','shadow-bass','spotted-sunfish']),
      ('house-pond', 'unknown', null, null, 'count', 5, 'aggregate', null, null, '{}',
       'Public Fishing Area default: five channel catfish per day.',
       array['channel-catfish']),
      ('house-pond', 'unknown', null, null, 'prohibited', 0, 'aggregate', null, null,
       array['catch_and_release'], 'Grass carp must be released immediately.', array['grass-carp'])
    ) as t(water_slug, size_rule, minl, maxl, lk, lim, basis, tal, tmin, restr, note, spp)
  loop
    select id into v_water from waters
     where slug = rec.water_slug and state_id = v_ga and status = 'published';
    if v_water is null then
      raise exception 'water % not found in GA', rec.water_slug;
    end if;

    insert into fishing_rules (
      state_id, water_id, size_rule, min_length_inches, max_length_inches,
      daily_limit_kind, daily_limit, limit_basis, trophy_allowance,
      trophy_min_length_inches, restrictions, notes, source_id,
      last_verified_at, status
    ) values (
      v_ga, v_water, rec.size_rule, rec.minl, rec.maxl,
      rec.lk, case when rec.lk = 'no_limit' then null else rec.lim end,
      rec.basis, rec.tal, rec.tmin, rec.restr, rec.note, v_src,
      now(), 'published'
    ) returning id into v_rule;

    insert into fishing_rule_species (rule_id, species_id)
    select v_rule, sp.id from species sp where sp.key = any(rec.spp);

    -- Every species key must resolve. A rule that silently names fewer
    -- species than intended renders under fewer headings, and nothing
    -- complains -- the failure mode 20261219000000 was written about.
    n_want := array_length(rec.spp, 1);
    if (select count(*) from fishing_rule_species where rule_id = v_rule) <> n_want then
      raise exception 'rule for % wanted % species but linked %: %',
        rec.water_slug, n_want,
        (select count(*) from fishing_rule_species where rule_id = v_rule), rec.spp;
    end if;

    n_rules := n_rules + 1;
    n_links := n_links + n_want;
  end loop;

  raise notice 'PFA rules written: % (expected 54), species links: % (expected 142)',
    n_rules, n_links;
  if n_rules <> 54 then
    raise warning 'expected 54 rules, wrote %', n_rules;
  end if;
end $$;

-- 2. THE NAMES, SO A DIRECTORY OF LAKES READS LIKE ONE -----------------------
--
-- "Ocmulgee" and "Ocmulgee River" sat next to each other in the waters list
-- as if they were the same kind of thing. "Paradise" and "Mcduffie" did not
-- read as places at all. Slugs are untouched -- they are the route key, and
-- renaming one breaks every link to it.
update waters w set name = v.name
  from (values
    ('big-lazer-creek', 'Big Lazer Creek PFA'),
    ('dodge-county', 'Dodge County PFA'),
    ('evans-county', 'Evans County PFA'),
    ('flat-creek', 'Flat Creek PFA'),
    ('hugh-m-gillis', 'Hugh M. Gillis PFA'),
    ('mcduffie', 'McDuffie PFA'),
    ('ocmulgee', 'Ocmulgee PFA'),
    ('paradise', 'Paradise PFA'),
    ('silver-lake', 'Silver Lake PFA'),
    ('panic-pond', 'Panic Pond (Silver Lake PFA)'),
    ('house-pond', 'House Pond (Silver Lake PFA)')
  ) as v(slug, name)
 where w.slug = v.slug
   and w.state_id = (select id from states where code = 'GA');

-- 3. WHAT THE SCHEMA CANNOT HOLD GOES IN NOTES -------------------------------
--
-- The gear rules first, because they are the ones that get somebody cited and
-- they are not expressible: "no more than two poles" is not
-- one_pole_handheld, and live minnows are allowed at most PFAs and forbidden
-- at one pond, which no single restriction flag says.
update waters w
   set notes = v.notes
  from (values
    ('big-lazer-creek',
     'Public Fishing Area: pole and line only, no more than two poles per angler, and no cast nets. Anglers 16 and older need a licence, or a Lands Pass, to enter.'),
    ('marben-pfa',
     'Public Fishing Area: pole and line only, no more than two poles per angler, and no cast nets. Twenty ponds -- check the information board for which lakes are open when you visit.'),
    ('dodge-county',
     'Public Fishing Area: pole and line only, no more than two poles per angler, and no cast nets.'),
    ('evans-county',
     'Public Fishing Area: pole and line only, no more than two poles per angler, and no cast nets. Three ponds, 122 acres.'),
    ('flat-creek',
     'Public Fishing Area: pole and line only, no more than two poles per angler, and no cast nets. The Event Pond is open only during scheduled or DNR-sponsored events.'),
    ('hugh-m-gillis',
     'Public Fishing Area: pole and line only, no more than two poles per angler, and no cast nets.'),
    ('mcduffie',
     'Public Fishing Area: pole and line only, no more than two poles per angler, and no cast nets. Seven ponds, 5 to 37 acres.'),
    ('ocmulgee',
     'Public Fishing Area: pole and line only, no more than two poles per angler, and no cast nets.'),
    ('paradise',
     'Public Fishing Area: pole and line only, no more than two poles per angler, and no cast nets. Sixty-eight lakes, 525 acres.'),
    ('rocky-mountain-recreation-and-public-fishing-area',
     'Public Fishing Area: pole and line only, no more than two poles per angler, and no cast nets. A Rocky Mountain PFA parking permit is required, one per vehicle. All activities are prohibited on the upper and lower reservoirs. No alcohol anywhere on the area, and no fishing at night. Heath Lake is open the 1st to the 10th of each month only.'),
    ('silver-lake',
     'Public Fishing Area: pole and line only, no more than two poles per angler, and no cast nets. Thirty ponds. Live minnows are allowed for bait except in Panic Pond.'),
    -- The two that carry a closure the rule schema cannot express.
    ('panic-pond',
     'Open to fishing Saturday through Monday only, and closed to all fishing during July and August. Live minnows are not allowed. One of the thirty ponds of Silver Lake PFA; the Public Fishing Area gear rules apply -- pole and line only, no more than two poles, no cast nets.'),
    ('house-pond',
     'Open only from sunrise on Thursday through sunset on Saturday. One of the thirty ponds of Silver Lake PFA; the Public Fishing Area gear rules apply -- pole and line only, no more than two poles, no cast nets.')
  ) as v(slug, notes)
 where w.slug = v.slug
   and w.state_id = (select id from states where code = 'GA')
   and w.notes is null;

-- The umbrella row says what it is, so the next reader of this table does not
-- take it for a place. Left published: see the header on why archiving it
-- would promote its rules to statewide force.
update waters
   set notes = 'Not a water. This row carries the Public Fishing Area default limits as the regulation states them. Each PFA now holds its own copy of these rules, because resolve.ts merges water rules over statewide rules and has no third tier for a default like this one.'
 where slug = 'public-fishing-area-lakes-operated-by-the-department-of-natural-resources'
   and state_id = (select id from states where code = 'GA');

-- 4. THE CLAIM ---------------------------------------------------------------
--
-- Every limit the Public Fishing Areas page states for these waters is now
-- held, as a rule where the schema can carry it and in notes where it
-- cannot. That is what rules_complete_at asserts.
update waters
   set rules_complete_at = now()
 where state_id = (select id from states where code = 'GA')
   and slug in (
     'big-lazer-creek', 'marben-pfa', 'dodge-county', 'evans-county', 'flat-creek',
     'hugh-m-gillis', 'mcduffie', 'ocmulgee', 'paradise',
     'rocky-mountain-recreation-and-public-fishing-area', 'silver-lake',
     'panic-pond', 'house-pond'
   )
   and rules_complete_at is null;

-- 5. PROVE IT ----------------------------------------------------------------
do $$
declare
  v_ga uuid;
  n_claimed int;
  n_bare int;
  n_lmb int;
  n_statewide_bass int;
  n_notes int;
begin
  select id into v_ga from states where code = 'GA';

  select count(*) into n_claimed from waters
   where state_id = v_ga and status = 'published' and rules_complete_at is not null;

  -- The point of the whole migration: no PFA may be left with zero rules of
  -- its own, because zero rules means the statewide answer renders.
  select count(*) into n_bare
    from waters w
   where w.state_id = v_ga and w.status = 'published'
     and w.slug in ('big-lazer-creek','marben-pfa','dodge-county','evans-county','flat-creek',
                    'hugh-m-gillis','mcduffie','ocmulgee','paradise',
                    'rocky-mountain-recreation-and-public-fishing-area','silver-lake',
                    'panic-pond','house-pond')
     and not exists (
       select 1 from fishing_rules r
         join fishing_rule_species f on f.rule_id = r.id
         join species sp on sp.id = f.species_id
        where r.water_id = w.id and r.status = 'published' and sp.key = 'largemouth-bass'
     );

  select count(*) into n_lmb
    from fishing_rules r
    join waters w on w.id = r.water_id
    join fishing_rule_species f on f.rule_id = r.id
    join species sp on sp.id = f.species_id
   where w.state_id = v_ga and r.status = 'published' and sp.key = 'largemouth-bass'
     and w.slug in ('big-lazer-creek','marben-pfa','dodge-county','evans-county','flat-creek',
                    'hugh-m-gillis','mcduffie','ocmulgee','paradise',
                    'rocky-mountain-recreation-and-public-fishing-area','silver-lake',
                    'panic-pond','house-pond');

  select count(*) into n_statewide_bass
    from fishing_rules r
    join fishing_rule_species f on f.rule_id = r.id
    join species sp on sp.id = f.species_id
   where r.state_id = v_ga and r.status = 'published' and r.water_id is null
     and sp.key = 'largemouth-bass' and r.daily_limit_kind = 'count';

  select count(*) into n_notes from waters
   where state_id = v_ga and notes is not null;

  raise notice 'GA waters claiming completeness: % (was 30, expect 43)', n_claimed;
  raise notice 'PFAs with no largemouth rule of their own: % (expected 0)', n_bare;
  raise notice 'PFA largemouth rules: % (expected 13)  statewide largemouth count-rules still: %', n_lmb, n_statewide_bass;
  raise notice 'GA waters with notes: %', n_notes;

  if n_bare > 0 then
    raise warning 'a PFA still falls through to the statewide bass limit';
  end if;
end $$;
