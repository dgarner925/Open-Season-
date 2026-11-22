-- A published fishing rule must name at least one species, and the database
-- now says so rather than hoping.
--
-- ===========================================================================
-- HOW THIS WAS FOUND
--
-- Verifying 20261217000000 turned up two Georgia rules with a 22-inch minimum
-- that still said nothing about a daily limit, where the migration expected
-- none. They were not striped bass rules at all -- they are Waters Creek
-- trout rules that happen to share the number 22, and the species guard in
-- that migration correctly refused them. The data was right; the verification
-- query was loose.
--
-- But reading them turned up something else. Measured on production
-- 2026-11-22, of 258 published fishing rules, exactly two have NO row in
-- fishing_rule_species:
--
--   0624bdb9  Waters Creek, 22-inch minimum, species_id -> rainbow-trout
--   ee047e64  Waters Creek, 18-inch minimum, species_id -> brook-trout
--
-- They are not species-less. They carry their species in
-- fishing_rules.species_id, the column the schema had before the join table,
-- and they are the only two rules left in the database that use it.
--
-- ===========================================================================
-- WHY THAT IS INVISIBLE RATHER THAN MERELY UNTIDY
--
-- Nothing reads species_id any more. useFishingRules in
-- src/features/otw/queries.ts resolves species by querying
-- fishing_rule_species and nothing else, and resolveSpeciesAtWater matches on
-- the names that query returns. A rule with no row there matches no species,
-- so it renders on no screen, under no heading, with no error anywhere.
--
-- This is the same argument that kept the Georgia-South Carolina 40-fish
-- aggregate out of fishing_rules in 20261214000000 and put it in notes
-- instead: a rule that renders nowhere is worse than one in prose, because
-- nobody can see that it is missing. Here are two that were already in that
-- state, and nobody had seen them.
--
-- NOTHING IS ACTUALLY MISSING FROM THE APP. Waters Creek has four published
-- rules, which are two pairs saying the same thing:
--
--   22-inch minimum   species_id rainbow-trout, no links     invisible
--   22-inch minimum   links: brown-trout, rainbow-trout      renders
--   18-inch minimum   species_id brook-trout, no links       invisible
--   18-inch minimum   links: brook-trout                     renders
--
-- Both of Georgia's Waters Creek limits reach the reader through the linked
-- copy. The two legacy rows are redundant, not load-bearing -- and the linked
-- 22-inch rule is the better of the pair anyway, because the regulation
-- covers brown AND rainbow trout and the legacy row names only rainbow.
--
-- ===========================================================================
-- THE LIVE WRITE PATHS ARE ALREADY CORRECT, WHICH IS WHY THIS IS A GUARD
-- AND NOT A REPAIR
--
-- apply_review_item, as 20261208000000 last defined it, hardcodes species_id
-- to null -- "the set lives in fishing_rule_species, even for a single
-- species, so one code path reads every rule" -- and refuses the write
-- outright when the species keys are empty or do not all resolve. So no
-- review approval can produce this shape.
--
-- What is NOT guarded is a direct insert: a migration, or a statement typed
-- into the dashboard. That is how both of these rows got here, and it is the
-- same hand that writes every data migration in this repo, including the five
-- that landed an hour ago. A convention that lives in a comment protects the
-- code path that has the comment. A constraint protects the next one.

-- 1. THE TWO REDUNDANT ROWS -------------------------------------------------
--
-- Guarded so it can only ever delete a row whose content survives: same
-- water, same size rule, same number, and a linked rule that actually names
-- the species this row names. Without that last clause the predicate would
-- happily delete a legacy row whose species appears nowhere else, which is
-- the one outcome worse than leaving it.
do $$
declare
  n_del int;
begin
  delete from fishing_rules victim
   where victim.status = 'published'
     and victim.species_id is not null
     and not exists (select 1 from fishing_rule_species f where f.rule_id = victim.id)
     and exists (
       select 1 from fishing_rules keep
        where keep.id <> victim.id
          and keep.status = 'published'
          and keep.state_id = victim.state_id
          and keep.water_id is not distinct from victim.water_id
          and keep.size_rule = victim.size_rule
          and keep.min_length_inches is not distinct from victim.min_length_inches
          and keep.max_length_inches is not distinct from victim.max_length_inches
          and keep.daily_limit_kind = victim.daily_limit_kind
          and keep.daily_limit is not distinct from victim.daily_limit
          and exists (
            select 1 from fishing_rule_species f
             where f.rule_id = keep.id
               and f.species_id = victim.species_id
          )
     );

  get diagnostics n_del = row_count;
  raise notice 'invisible legacy rules deleted: % (expected 2)', n_del;
  if n_del <> 2 then
    raise warning 'expected 2, deleted % -- a legacy row may hold a species no linked rule covers; leave it and look', n_del;
  end if;
end $$;

-- 2. THE DEAD COLUMN CANNOT TAKE NEW DATA ----------------------------------
--
-- species_id is not dropped. Dropping it would rewrite the column list of
-- apply_review_item, which is generated rather than retyped precisely so that
-- its hunting branches stay byte-identical to what has been running, and
-- there is no reason to risk that for tidiness. Forbidding values in it gets
-- the whole benefit: the only way to give a rule a species is the way the app
-- reads it.
--
-- The existing writers already pass null explicitly, so this constraint
-- changes nothing they do. It only stops the writer who does not know yet.
alter table fishing_rules drop constraint if exists fishing_rules_species_id_retired;
alter table fishing_rules add constraint fishing_rules_species_id_retired
  check (species_id is null);

comment on column fishing_rules.species_id is
  'RETIRED and constrained to null. A rule''s species live in '
  'fishing_rule_species, even when there is only one, because that is the '
  'only place the app reads them from -- a rule with a species_id and no link '
  'row renders on no screen at all. Kept rather than dropped so that '
  'apply_review_item''s column list does not have to be rewritten.';

-- 3. A PUBLISHED RULE MUST NAME A SPECIES -----------------------------------
--
-- A CONSTRAINT TRIGGER, DEFERRED, because a plain trigger cannot express
-- this. Every writer in the repo inserts the rule first and its species rows
-- second -- it needs the rule's id for the link -- so an immediate check
-- would fire while the rule is legitimately still bare and fail every honest
-- write. Deferring to commit asks the only question worth asking: when this
-- transaction is finished, does every published rule it touched name a
-- species?
--
-- Two triggers, because there are two ways to arrive at the bad state: insert
-- or publish a rule and never link it, or delete a rule's last link and leave
-- the rule published.
create or replace function public.fishing_rule_species_required()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_rule uuid;
begin
  -- Branch with statements rather than a CASE: referencing `new` inside an
  -- expression evaluated on a DELETE trigger raises "record new is not
  -- assigned yet", even in the branch that is not taken.
  if tg_table_name = 'fishing_rules' then
    v_rule := new.id;
  else
    v_rule := old.rule_id;
  end if;

  -- The rule may be gone by commit -- deleted in this same transaction, the
  -- links cascading with it. Nothing to enforce about a row that no longer
  -- exists, and only a published rule is claimed to be readable.
  if not exists (
    select 1 from fishing_rules r where r.id = v_rule and r.status = 'published'
  ) then
    return null;
  end if;

  if not exists (
    select 1 from fishing_rule_species f where f.rule_id = v_rule
  ) then
    raise exception
      'published fishing rule % names no species, so it would render on no '
      'screen. Insert its fishing_rule_species rows in this transaction, or '
      'leave the rule unpublished.', v_rule;
  end if;

  return null;
end $$;

-- security definer: the function only reads two tables and raises. Running it
-- as the owner keeps RLS from hiding a row from the check and turning a
-- genuine violation into a silent pass -- or, worse, hiding the rule itself
-- and failing an honest write.
--
-- Not revoked from public, though that is the usual hygiene for a SECURITY
-- DEFINER function. Postgres checks EXECUTE on a trigger function when the
-- trigger is CREATED and not when it fires, so a revoke here is very likely
-- harmless -- and if that is wrong it breaks every write to fishing_rules.
-- The function reads two tables of published regulations and either raises or
-- returns null, so there is nothing to escalate; the risk and the benefit are
-- not in proportion.

drop trigger if exists fishing_rules_species_required on public.fishing_rules;
create constraint trigger fishing_rules_species_required
  after insert or update of status on public.fishing_rules
  deferrable initially deferred
  for each row execute function public.fishing_rule_species_required();

drop trigger if exists fishing_rule_species_last_link on public.fishing_rule_species;
create constraint trigger fishing_rule_species_last_link
  after delete on public.fishing_rule_species
  deferrable initially deferred
  for each row execute function public.fishing_rule_species_required();

-- 4. PROVE IT --------------------------------------------------------------
do $$
declare
  n_bare int;
  n_legacy int;
  n_total int;
begin
  select count(*) into n_total from fishing_rules where status = 'published';
  select count(*) into n_legacy from fishing_rules where species_id is not null;
  select count(*) into n_bare
    from fishing_rules r
   where r.status = 'published'
     and not exists (select 1 from fishing_rule_species f where f.rule_id = r.id);

  raise notice 'published rules: %  naming no species: % (expected 0)  using species_id: % (expected 0)',
    n_total, n_bare, n_legacy;

  if n_bare > 0 or n_legacy > 0 then
    raise warning 'the invariant this migration just declared does not hold';
  end if;
end $$;
