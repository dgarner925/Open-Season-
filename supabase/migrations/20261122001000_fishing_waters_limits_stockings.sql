-- Open Season: On the Water, part 2 of 3 -- the three things fishing needs
-- that hunting does not.
--
-- Everything else about fishing fits the existing tables: a season is still
-- state x species x zone x year with an open and a close date, and the trout
-- lotteries some states run are application_windows. These three are the real
-- difference, and each exists because an angler's actual question cannot be
-- answered without it.

-- 1. WATERS -----------------------------------------------------------------
--
-- "Is it open?" is a weak question for fishing, because most fishing is open
-- all year. The real question is "what are the rules on THIS water", and the
-- rules attach to named waters: Lake Lanier, the Chattahoochee below Buford
-- Dam, Spring Creek. That is a different cardinality from hunting zones -- a
-- state has perhaps thirty zones and several hundred regulated waters -- so
-- waters are their own entity rather than more rows in `zones`.
create table if not exists waters (
  id uuid primary key default gen_random_uuid(),
  state_id uuid not null references states(id) on delete cascade,
  name text not null,
  -- Stable, human-readable, and the site's URL segment:
  -- /states/georgia/waters/lake-lanier
  slug text not null,
  kind text not null default 'other',
  county text,
  -- Where the regulation applies, when a state defines it by a landmark
  -- ("below the dam", "upstream of the Route 9 bridge") rather than by name.
  extent_note text,
  latitude double precision,
  longitude double precision,
  -- A tailwater or a named stretch is a child of the river it belongs to, so
  -- a rule on the parent can be shown on the child when the child has none.
  parent_water_id uuid references waters(id) on delete set null,
  notes text,
  source_id uuid references sources(id) on delete set null,
  last_verified_at timestamptz,
  status content_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint waters_kind_check check (kind in (
    'lake', 'reservoir', 'pond', 'river', 'stream', 'creek',
    'tailwater', 'impoundment', 'canal', 'bay', 'other')),
  constraint waters_latlon_check check (
    (latitude is null) = (longitude is null)
    and (latitude is null or (latitude between -90 and 90))
    and (longitude is null or (longitude between -180 and 180))),
  -- A water cannot be its own parent. Deeper cycles are not worth a trigger:
  -- the extractor proposes two levels at most (river, named stretch).
  constraint waters_not_own_parent check (parent_water_id is distinct from id)
);

create unique index if not exists waters_state_slug_key on waters (state_id, slug);
create index if not exists waters_state_name_idx on waters (state_id, name);
create index if not exists waters_parent_idx on waters (parent_water_id)
  where parent_water_id is not null;

-- A fishing season may be statewide, regional, or specific to one water.
-- Nullable, because the first two are the common case.
alter table seasons
  add column if not exists water_id uuid references waters(id) on delete restrict;
create index if not exists seasons_water_idx on seasons (water_id)
  where water_id is not null;

-- 2. FISHING LIMITS ---------------------------------------------------------
--
-- Hunting keeps its bag limit as free text, because "two deer, one antlered"
-- is read once and understood. Fishing's equivalent is not readable that way:
-- "keep five, none between 18 and 24 inches" is a rule a person has to apply
-- to a fish in their hands, and we cannot filter, alert on, or check a
-- sentence. So the numbers are numbers.
--
-- Creel and size live in one row because that is how the regulation is
-- written and how it is read -- splitting them would invite showing half a
-- rule, which for this product is worse than showing none.
create table if not exists fishing_limits (
  id uuid primary key default gen_random_uuid(),
  state_id uuid not null references states(id) on delete cascade,
  species_id uuid not null references species(id) on delete restrict,
  -- Which water or region this applies to. Both null means statewide.
  zone_id uuid references zones(id) on delete restrict,
  water_id uuid references waters(id) on delete cascade,
  season_year smallint,
  -- What shape of size rule this is. 'none' is a real and useful answer: it
  -- says we read the page and it set no size limit, which is different from
  -- not knowing.
  size_rule text not null default 'none',
  min_length_inches numeric(5,2),
  max_length_inches numeric(5,2),
  -- How many may be kept per day, and held in total.
  daily_limit smallint,
  possession_limit smallint,
  -- Anglers ask this as often as the size: how many may be over the mark.
  trophy_allowance smallint,
  notes text,
  source_id uuid references sources(id) on delete set null,
  last_verified_at timestamptz,
  status content_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fishing_limits_rule_check check (size_rule in (
    'none', 'minimum', 'maximum', 'slot_release', 'slot_keep', 'see_notes')),
  -- A rule must carry the numbers its own shape requires, or it is not a rule.
  -- This is the check that stops a half-read page becoming a half-rule.
  constraint fishing_limits_numbers_check check (
    case size_rule
      when 'minimum'      then min_length_inches is not null
      when 'maximum'      then max_length_inches is not null
      when 'slot_release' then min_length_inches is not null and max_length_inches is not null
      when 'slot_keep'    then min_length_inches is not null and max_length_inches is not null
      else true
    end),
  constraint fishing_limits_order_check check (
    min_length_inches is null or max_length_inches is null
    or max_length_inches >= min_length_inches),
  constraint fishing_limits_counts_check check (
    (daily_limit is null or daily_limit >= 0)
    and (possession_limit is null or possession_limit >= 0)
    and (trophy_allowance is null or trophy_allowance >= 0))
);

create index if not exists fishing_limits_lookup_idx
  on fishing_limits (state_id, species_id, status);
create index if not exists fishing_limits_water_idx
  on fishing_limits (water_id) where water_id is not null;

-- 3. STOCKINGS --------------------------------------------------------------
--
-- This is what turns a fishing app from a twice-a-year open into a daily one.
-- "They put 4,000 rainbows in Smith Creek on Thursday" is the single most
-- actionable thing a state publishes, it expires within about two weeks, and
-- most states publish it as its own feed rather than in the regulations.
--
-- No review queue for these: a stocking record is a dated event from a feed,
-- not a claim about a rule, so there is nothing for a grader to verify against
-- a page. They are append-only facts and are allowed to be wrong in the way a
-- feed is wrong -- by being corrected upstream.
create table if not exists stockings (
  id uuid primary key default gen_random_uuid(),
  state_id uuid not null references states(id) on delete cascade,
  water_id uuid not null references waters(id) on delete cascade,
  species_id uuid not null references species(id) on delete restrict,
  stocked_on date not null,
  quantity integer,
  average_length_inches numeric(5,2),
  notes text,
  source_id uuid references sources(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint stockings_quantity_check check (quantity is null or quantity >= 0)
);

create unique index if not exists stockings_event_key
  on stockings (water_id, species_id, stocked_on);
create index if not exists stockings_recent_idx
  on stockings (state_id, stocked_on desc);
create index if not exists stockings_water_recent_idx
  on stockings (water_id, stocked_on desc);

-- A stocking dated in the far future is a mis-parsed year, not a schedule.
-- States do publish genuine schedules a season ahead, so the horizon is
-- generous; it is not a CHECK because current_date is not immutable.
create or replace function stockings_date_sane() returns trigger
language plpgsql as $$
begin
  if new.stocked_on < date '2015-01-01'
     or new.stocked_on > current_date + interval '18 months' then
    raise exception 'stocked_on % is outside the plausible range', new.stocked_on;
  end if;
  return new;
end $$;

drop trigger if exists stockings_date_sane_trg on stockings;
create trigger stockings_date_sane_trg
  before insert or update on stockings
  for each row execute function stockings_date_sane();

-- RLS: identical to the pattern every content table here already uses --
-- anyone may read what is published, only an admin may write.
alter table waters         enable row level security;
alter table fishing_limits enable row level security;
alter table stockings      enable row level security;

drop policy if exists waters_public_read on waters;
create policy waters_public_read on waters
  for select to anon, authenticated using (status = 'published');
drop policy if exists waters_admin_all on waters;
create policy waters_admin_all on waters
  for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists fishing_limits_public_read on fishing_limits;
create policy fishing_limits_public_read on fishing_limits
  for select to anon, authenticated using (status = 'published');
drop policy if exists fishing_limits_admin_all on fishing_limits;
create policy fishing_limits_admin_all on fishing_limits
  for all to authenticated using (is_admin()) with check (is_admin());

-- Stockings carry no status: a feed record is either present or it is not.
drop policy if exists stockings_public_read on stockings;
create policy stockings_public_read on stockings
  for select to anon, authenticated using (true);
drop policy if exists stockings_admin_all on stockings;
create policy stockings_admin_all on stockings
  for all to authenticated using (is_admin()) with check (is_admin());
