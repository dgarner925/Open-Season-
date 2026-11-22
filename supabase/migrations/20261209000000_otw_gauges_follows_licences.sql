-- Open Season: On the Water, Phase 3 -- PROPOSAL, NOT APPLIED.
--
-- David: this file has not been run. Nothing in it has touched the remote
-- database. Read it, change what you want changed, and then it is one
-- `npx supabase db push --remote --yes`.
--
-- `supabase migration list --remote` was checked on 2026-11-21: every other
-- migration in this directory is already applied, so this is the only file a
-- push would run. That is worth re-checking before you run it, because push
-- applies everything pending and not just the file you had in mind.
--
-- It has NOT been dry-run. There is no local Postgres or Docker in this
-- environment, so the SQL was verified by reading every object it touches
-- back out of production -- waters, states, auth.users, is_admin(), and both
-- water slugs all resolve, and neither new table nor new column exists yet --
-- but no parser has seen it. Expect the possibility of a syntax fix.
--
-- ===========================================================================
-- WHY THIS IS A TENTH OF WHAT THE BRIEF ASKED FOR
--
-- The brief's Phase 3 lists seven tables to create. Five of them already
-- exist, because the fishing data shipped ahead of this phase. Measured
-- against production on 2026-11-21:
--
--   brief's table        reality
--   ------------------   -------------------------------------------------
--   fish_species         `species` where pursuit = 'fishing'. 72 rows.
--   waters               `waters`. 233 rows, all published, 7 states.
--   fishing_seasons      `fishing_rules`. 243 published rows --
--                        GA 94, MS 36, TN 34, FL 31, AL 29, SC 16, NC 3.
--   stocking_events      `stockings`. Exists with every column the brief
--                        wanted plus average_length_inches. ZERO rows: the
--                        table is ready and no feed has been loaded.
--   fishing_regs_docs    `sources` already carries agency_name, url,
--                        doc_type, state_id and purpose.
--   user_waters          MISSING. Created below.
--   user_licenses        MISSING. Created below.
--
-- So the real gap is two tables and two columns. Creating the other five
-- would have meant a second, emptier copy of tables already carrying real
-- hand-checked regulations.
--
-- One more correction worth your attention: `species_public_read` is
-- `using (true)`, not gated to pursuit = 'hunting'. The header comment in
-- src/features/otw/queries.ts says fishing species names are hidden behind a
-- launch gate. They are not, and have not been for some time -- the OTW
-- ledger is already showing real Georgia rules. That comment is stale, and
-- the fallback it guards is dead code. Fixed in the app separately; no SQL
-- needed.
-- ===========================================================================

-- 1. WHERE A WATER'S GAUGE LIVES --------------------------------------------
--
-- Phase 2 put the gauge list in src/features/otw/gauges.ts because there was
-- nowhere in the schema to put it. That file now holds two kinds of thing
-- that do not belong in a TypeScript constant:
--
--   the gauge mapping, which is a fact about a water, and
--   the wadeable threshold, which is editorial and will be edited.
--
-- Both move here. The mapping becomes a column on the row it describes, and
-- the slug guess that silently pointed at a non-existent water becomes
-- impossible, because the gauge now hangs off the water's own primary key
-- instead of off its name.
alter table waters
  add column if not exists usgs_site_no text,
  -- The flow at or below which this water is usually wadeable.
  --
  -- EDITORIAL. It is the input to the word "fishable" on the Today card, and
  -- it is not a safety claim. NULL is a legitimate and preferred value: the
  -- app treats a null threshold as "no verdict available" and reports the
  -- bare flow instead, which is what seven of the eight configured gauges do
  -- today. A plausible number is indistinguishable from a checked one once it
  -- is on screen, so leave it null until someone has actually judged it.
  add column if not exists wadeable_cfs_max numeric(8,1);

do $$ begin
  -- USGS site numbers are 8 to 15 digits. A site number with a space or a
  -- letter in it is a transcription error, and it would fail silently as an
  -- empty gauge rather than loudly as a bad request.
  alter table waters add constraint waters_usgs_site_no_check
    check (usgs_site_no is null or usgs_site_no ~ '^[0-9]{8,15}$');
exception when duplicate_object then null; end $$;

do $$ begin
  -- Zero is not a threshold, it is an unset field that reads as one: every
  -- flow would be above it and every water would be "blown out".
  alter table waters add constraint waters_wadeable_cfs_max_check
    check (wadeable_cfs_max is null or wadeable_cfs_max > 0);
exception when duplicate_object then null; end $$;

create index if not exists waters_usgs_site_idx on waters (usgs_site_no)
  where usgs_site_no is not null;

-- 2. THE WATERS SOMEBODY FOLLOWS --------------------------------------------
--
-- Hunting's `follows` is (user_id, state_id, species_id): you follow a
-- species in a state, because that is what has an opening date. Fishing's
-- equivalent object is the water -- it is what carries the rules, the
-- stockings and the gauge -- so this is its own table rather than a nullable
-- water_id bolted onto `follows`, which would leave every hunting row
-- carrying a column that can never apply to it.
--
-- This is what "Your species" on the OTW Home needs before it can stop being
-- three placeholder fly plates.
create table if not exists user_waters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  water_id uuid not null references waters(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists user_waters_key on user_waters (user_id, water_id);
create index if not exists user_waters_user_idx on user_waters (user_id);

-- 3. WHEN A LICENCE RUNS OUT ------------------------------------------------
--
-- The Today card's licence banner is currently a hardcoded "expires in 23
-- days". This is the model behind it.
--
-- Deliberately only an expiry date. Not a licence number, not a name, not a
-- document: none of it is needed to say "your licence expires in three
-- weeks", and a licence number is a government identifier that would turn
-- this row into something worth stealing. The banner needs a date and a
-- state. That is all this stores.
create table if not exists user_licenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  state_id uuid not null references states(id) on delete cascade,
  kind text not null default 'fishing',
  expires_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_licenses_kind_check check (kind in ('fishing', 'hunting', 'combination'))
);

-- One licence of each kind per state per person. A renewal updates the row
-- rather than stacking a second one, so the banner never has to choose
-- between two dates.
create unique index if not exists user_licenses_key
  on user_licenses (user_id, state_id, kind);

-- A licence expiring in 2041 is a typo, and one expiring in 1998 is a
-- different typo. Not a CHECK because current_date is not immutable --
-- the same reason stockings_date_sane() is a trigger.
create or replace function user_licenses_date_sane() returns trigger
language plpgsql as $$
begin
  if new.expires_on < current_date - interval '5 years'
     or new.expires_on > current_date + interval '5 years' then
    raise exception 'expires_on % is outside the plausible range', new.expires_on;
  end if;
  return new;
end $$;

drop trigger if exists user_licenses_date_sane_trg on user_licenses;
create trigger user_licenses_date_sane_trg
  before insert or update on user_licenses
  for each row execute function user_licenses_date_sane();

-- 4. RLS --------------------------------------------------------------------
--
-- Both are user tables, so both take the `follows_owner_all` pattern exactly:
-- one ALL policy for authenticated, owner-only, with the same predicate in
-- USING and WITH CHECK. The WITH CHECK is the half that matters -- USING
-- alone would let anyone insert a row carrying somebody else's user_id, and
-- it would not be visible to them afterwards, which is the kind of hole that
-- survives a casual test.
--
-- No anon policy at all. A guest has no rows here by definition.
alter table user_waters   enable row level security;
alter table user_licenses enable row level security;

drop policy if exists user_waters_owner_all on user_waters;
create policy user_waters_owner_all on user_waters
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists user_licenses_owner_all on user_licenses;
create policy user_licenses_owner_all on user_licenses
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 5. THE GAUGE MAPPING ------------------------------------------------------
--
-- Only the two mappings that are facts. Both slugs were read back from the
-- published rows today, not remembered.
--
-- NOT backfilled, and why:
--
--   chattahoochee-river-sope-creek-to-us-hwy-41 (the delayed-harvest reach)
--     Morgan Falls (02335815) sits immediately above it and Atlanta
--     (02336000) at its downstream end. Either is defensible, neither is
--     correct, and the choice changes what the card says about water a lot of
--     people actually fish. Yours to make.
--
--   toccoa-river-delayed-harvest
--     There is no USGS gauge on the Blue Ridge tailwater. 03558000 is ABOVE
--     the lake and 03559500 is the Ocoee in Tennessee. Either would be a
--     number from the wrong river under this water's name.
--
--   everything else
--     No gauge inside the regulated stretch, or no published water for the
--     gauge to serve -- there is no Chestatee row in the Georgia set at all.
--
-- `update ... where usgs_site_no is null` so re-running this never overwrites
-- a mapping you have since corrected by hand.
-- Two plain statements rather than one UPDATE ... FROM (VALUES ...) joined to
-- states. The clever version parses, but this file cannot be dry-run from
-- here -- there is no local Postgres in the loop -- and the last migration
-- that failed on push failed on a syntax detail, so the boring form wins.

-- The gauge is at the dam, which is this tailwater's head. 1000 cfs is the
-- threshold the Phase 1 brief itself used for this water, kept so the number
-- did not silently change meaning when the data became real.
update waters
   set usgs_site_no = '02334430',
       wadeable_cfs_max = 1000.0,
       updated_at = now()
 where slug = 'chattahoochee-river-buford-tailwater'
   and state_id = (select id from states where code = 'GA')
   and usgs_site_no is null;

-- Norcross sits inside this reach. The gauge is intermittent -- it returned
-- nothing on one of two probes today -- which the card handles by saying
-- "No reading" rather than by guessing. No threshold: nobody has judged one.
update waters
   set usgs_site_no = '02335000',
       updated_at = now()
 where slug = 'chattahoochee-river-buford-dam-to-peachtree-creek'
   and state_id = (select id from states where code = 'GA')
   and usgs_site_no is null;

-- What it did, so the push output says something checkable rather than
-- "Success." A count of 0 here means the slugs moved again.
do $$
declare mapped int;
begin
  select count(*) into mapped from waters where usgs_site_no is not null;
  raise notice 'waters carrying a USGS gauge: %', mapped;
end $$;
