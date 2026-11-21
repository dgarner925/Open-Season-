-- Open Season: On the Water, part 1 of 3 -- make the existing tables able to
-- say "this row is about fishing".
--
-- Fishing shares this schema with hunting deliberately. The expensive machine
-- here is not the tables: it is the extraction pipeline, the review queue, the
-- row-aware grader, the coverage watchdog and the publish gate -- all of which
-- are about reading an agency page and proving what it says. Fishing
-- regulations sit on the same agency sites, often in the same PDFs. Forking
-- any of that would mean maintaining two of everything that has ever broken.
--
-- What the schema needs instead is a discriminator, so the app, the site and
-- the coverage audits can ask for one pursuit at a time.

-- 1. The discriminator. `category` already groups species (big_game, upland,
--    waterfowl); it is the fine-grained group and stays that way. `pursuit` is
--    the coarse split, and it is the one every query will filter on.
alter table species
  add column if not exists pursuit text not null default 'hunting';

alter table species
  drop constraint if exists species_pursuit_check;
alter table species
  add constraint species_pursuit_check check (pursuit in ('hunting', 'fishing'));

-- Everything that exists today is hunting. Said explicitly rather than left to
-- the default, so the intent survives a future default change.
update species set pursuit = 'hunting' where pursuit is distinct from 'fishing';

create index if not exists species_pursuit_idx on species (pursuit, sort_order);

-- 1a. The launch gate, server side.
--
-- `species_public_read` was `using (true)`, and the client in users' hands
-- (1.4.8) reads species with no filter at all -- src/features/reference/
-- queries.ts selects every row and orders by sort_order. Seeding fish would
-- therefore put fifty-six fish into a shipped hunting app, on a build nobody
-- can patch retroactively.
--
-- So the gate lives here rather than in the client: until fishing launches,
-- anon and authenticated simply cannot see a fishing species, whatever any
-- build asks for. Relaxing this one policy is the launch switch, and it must
-- not be relaxed until a released client filters by pursuit itself.
--
-- Server-side code runs as the service role and bypasses RLS, so the
-- extractor and the site generator must filter in their own queries. They do.
drop policy if exists species_public_read on species;
create policy species_public_read on species
  for select to anon, authenticated
  using (pursuit = 'hunting');

-- 2. Gear and take rules. `season_method` carries archery/muzzleloader/
--    firearm/general; fishing's equivalents are the gear and release rules
--    that define a season just as sharply. Additive, so no existing row
--    changes meaning.
alter type season_method add value if not exists 'fly_only';
alter type season_method add value if not exists 'artificial_only';
alter type season_method add value if not exists 'bait_allowed';
alter type season_method add value if not exists 'catch_and_release';
alter type season_method add value if not exists 'spearfishing';
alter type season_method add value if not exists 'bowfishing';
alter type season_method add value if not exists 'ice_fishing';

-- 3. Zones. Hunting zones are a handful of large polygons per state (GMUs,
--    flyways). Fishing states also publish regions -- "mountain trout waters",
--    "the northern zone" -- which are the same kind of thing and belong here.
--    Named individual waters are NOT zones; they are a different cardinality
--    and get their own table in part 2.
alter type zone_type add value if not exists 'fishing_region';
alter type zone_type add value if not exists 'water_body';
