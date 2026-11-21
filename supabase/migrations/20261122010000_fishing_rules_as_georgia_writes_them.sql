-- Reshape the fishing rule table to match how a state actually writes rules.
--
-- Written after reading Georgia's freshwater pages end to end, before loading
-- any data. Four things in the real regulations that the first cut could not
-- express -- and in two cases would have expressed WRONGLY, which is worse
-- than not at all. The tables are empty, so this is free now and would have
-- been a data migration later.
--
-- 1. LIMITS ARE AGGREGATE ACROSS SPECIES.
--    "Total daily limit of 10 black bass, only 5 of which may be Altamaha,
--    Bartrams, Chattahoochee, Coosa, Shoal, Smallmouth, Suwannee,
--    Tallapoosa." With one species_id per row, that becomes ten rows each
--    saying "10" -- which an app reads out as ten of EACH. A limit therefore
--    belongs to a SET of species, with a basis saying whether the number is
--    shared between them or applies to each.
--
-- 2. GEAR RULES ARE A SET.
--    A delayed-harvest stream is catch-and-release AND artificial-only AND
--    single-barbless-hook, all at once. `season_method` is one value, which
--    works for hunting because archery and firearm really are exclusive.
--
-- 3. A RULE WINDOW IS NOT A SEASON.
--    Georgia's trout waters are open year round; delayed harvest runs Nov 1 to
--    May 14 INSIDE that. Modelled as a season, the app would announce that the
--    Chattahoochee is shut from May 15 to October 31. That is the span-row
--    failure -- an agency line transcribed as an open/close pair -- running in
--    the opposite direction, and it is the exact error this product cannot
--    afford. So a rule carries its own window and `seasons` keeps only
--    genuinely open-and-shut seasons.
--
-- 4. "NO LIMIT" IS AN ANSWER.
--    Channel and flathead catfish have no daily limit in Georgia. A null said
--    "we never read it". Sturgeon, meanwhile, may not be taken at all. Those
--    are three different facts and they need three different values.
--
-- The table is renamed because `fishing_limits` now understates it: it carries
-- gear and effective dates, not only limits, and a name that undersells a row
-- invites someone showing part of it.

alter table if exists fishing_limits rename to fishing_rules;

-- Keep the index names honest about what they index.
alter index if exists fishing_limits_lookup_idx rename to fishing_rules_lookup_idx;
alter index if exists fishing_limits_water_idx  rename to fishing_rules_water_idx;

alter table fishing_rules rename constraint fishing_limits_rule_check
  to fishing_rules_size_rule_check;
alter table fishing_rules rename constraint fishing_limits_numbers_check
  to fishing_rules_numbers_check;
alter table fishing_rules rename constraint fishing_limits_order_check
  to fishing_rules_order_check;
alter table fishing_rules rename constraint fishing_limits_counts_check
  to fishing_rules_counts_check;

drop policy if exists fishing_limits_public_read on fishing_rules;
drop policy if exists fishing_limits_admin_all on fishing_rules;
drop policy if exists fishing_rules_public_read on fishing_rules;
create policy fishing_rules_public_read on fishing_rules
  for select to anon, authenticated using (status = 'published');
drop policy if exists fishing_rules_admin_all on fishing_rules;
create policy fishing_rules_admin_all on fishing_rules
  for all to authenticated using (is_admin()) with check (is_admin());

-- 1. A rule applies to a SET of species ------------------------------------
--
-- species_id stays, as the common single-species case and to keep every
-- existing index and query working. When a rule covers several species the
-- set lives in fishing_rule_species and species_id is null.
alter table fishing_rules alter column species_id drop not null;

-- Shared between the species, or applied to each of them.
--   aggregate   -> "30 crappie, black and/or white" (30 in total)
--   per_species -> "5 of each species"
alter table fishing_rules
  add column if not exists limit_basis text not null default 'aggregate';
alter table fishing_rules drop constraint if exists fishing_rules_basis_check;
alter table fishing_rules
  add constraint fishing_rules_basis_check
  check (limit_basis in ('aggregate', 'per_species'));

create table if not exists fishing_rule_species (
  rule_id uuid not null references fishing_rules(id) on delete cascade,
  species_id uuid not null references species(id) on delete restrict,
  primary key (rule_id, species_id)
);

create index if not exists fishing_rule_species_species_idx
  on fishing_rule_species (species_id);

alter table fishing_rule_species enable row level security;
drop policy if exists fishing_rule_species_public_read on fishing_rule_species;
create policy fishing_rule_species_public_read on fishing_rule_species
  for select to anon, authenticated using (
    exists (select 1 from fishing_rules r
             where r.id = rule_id and r.status = 'published'));
drop policy if exists fishing_rule_species_admin_all on fishing_rule_species;
create policy fishing_rule_species_admin_all on fishing_rule_species
  for all to authenticated using (is_admin()) with check (is_admin());

-- A rule has to be about something: either one species, or a set.
create or replace function fishing_rules_has_species() returns trigger
language plpgsql as $$
declare
  n int;
begin
  if new.species_id is not null then return new; end if;
  select count(*) into n from fishing_rule_species where rule_id = new.id;
  if n = 0 then
    raise exception
      'fishing rule % names no species: set species_id or add fishing_rule_species rows',
      new.id;
  end if;
  return new;
end $$;

-- Deferred to the end of the transaction, because the join rows are inserted
-- after the rule they point at.
drop trigger if exists fishing_rules_has_species_trg on fishing_rules;
create constraint trigger fishing_rules_has_species_trg
  after insert or update on fishing_rules
  deferrable initially deferred
  for each row execute function fishing_rules_has_species();

-- 2. Gear and take rules, as a set -----------------------------------------
alter table fishing_rules
  add column if not exists gear_rules text[] not null default '{}';

alter table fishing_rules drop constraint if exists fishing_rules_gear_check;
alter table fishing_rules
  add constraint fishing_rules_gear_check check (
    gear_rules <@ array[
      'artificial_only',       -- no bait of any kind
      'flies_only',
      'single_hook',
      'barbless',
      'no_live_bait',
      'catch_and_release',     -- everything goes back
      'one_pole_handheld',
      'reservation_required',  -- Dukes Creek
      'daylight_only',
      'no_night_fishing',
      'trout_licence_required'
    ]::text[]);

-- 3. A rule's own window ----------------------------------------------------
--
-- Null means all year, which for fishing is the common case. These are the
-- dates the RULE is in force, and say nothing about the water being open.
alter table fishing_rules
  add column if not exists effective_from date;
alter table fishing_rules
  add column if not exists effective_to date;

alter table fishing_rules drop constraint if exists fishing_rules_window_check;
alter table fishing_rules
  add constraint fishing_rules_window_check check (
    -- A window that wraps the new year is normal here (Nov 1 to May 14), so
    -- the two dates are NOT required to be in order; both or neither, only.
    (effective_from is null) = (effective_to is null));

-- 4. Three different facts about a daily limit ------------------------------
alter table fishing_rules
  add column if not exists daily_limit_kind text not null default 'unknown';

alter table fishing_rules drop constraint if exists fishing_rules_daily_kind_check;
alter table fishing_rules
  add constraint fishing_rules_daily_kind_check check (
    daily_limit_kind in ('count', 'no_limit', 'prohibited', 'unknown'));

-- 'count' must carry its count; the others must not pretend to have one.
alter table fishing_rules drop constraint if exists fishing_rules_daily_agrees_check;
alter table fishing_rules
  add constraint fishing_rules_daily_agrees_check check (
    case daily_limit_kind
      when 'count'      then daily_limit is not null
      when 'no_limit'   then daily_limit is null
      when 'prohibited' then coalesce(daily_limit, 0) = 0
      else true
    end);

-- A trophy allowance is meaningless without the length it is measured
-- against: "15, only two of which can be 22 inches or longer."
alter table fishing_rules
  add column if not exists trophy_min_length_inches numeric(5,2);

alter table fishing_rules drop constraint if exists fishing_rules_trophy_check;
alter table fishing_rules
  add constraint fishing_rules_trophy_check check (
    (trophy_allowance is null) or (trophy_min_length_inches is not null));

-- Georgia names species the national list did not have. Most are black bass
-- and sunfish endemic to the south-east, and all of them carry a limit.
insert into species (key, name, category, pursuit, sort_order) values
  ('altamaha-bass',      'Altamaha bass',      'bass',    'fishing', 1109),
  ('bartrams-bass',      'Bartrams bass',      'bass',    'fishing', 1110),
  ('chattahoochee-bass', 'Chattahoochee bass', 'bass',    'fishing', 1111),
  ('coosa-bass',         'Coosa bass',         'bass',    'fishing', 1112),
  ('suwannee-bass',      'Suwannee bass',      'bass',    'fishing', 1113),
  ('tallapoosa-bass',    'Tallapoosa bass',    'bass',    'fishing', 1114),
  ('flier',              'Flier',              'panfish', 'fishing', 1207),
  ('redbreast-sunfish',  'Redbreast sunfish',  'panfish', 'fishing', 1208),
  ('spotted-sunfish',    'Spotted sunfish',    'panfish', 'fishing', 1209),
  ('shadow-bass',        'Shadow bass',        'panfish', 'fishing', 1210),
  ('grass-pickerel',     'Grass pickerel',     'walleye_pike', 'fishing', 1307),
  ('redfin-pickerel',    'Redfin pickerel',    'walleye_pike', 'fishing', 1308),
  ('shortnose-sturgeon', 'Shortnose sturgeon', 'other_fish',   'fishing', 1514),
  ('atlantic-sturgeon',  'Atlantic sturgeon',  'other_fish',   'fishing', 1515)
on conflict (key) do update set
  name       = excluded.name,
  category   = excluded.category,
  pursuit    = excluded.pursuit,
  sort_order = excluded.sort_order;
