-- The ten orphaned (state, species) pairs, verified one at a time.
--
-- An orphan is a season row whose pair is missing from state_species, so the
-- app holds the dates and refuses to show them. audit_coverage.py grew the
-- check tonight (20261102203000) after Florida; this clears what it found.
--
-- Eight were plain mapping gaps - the season is real, the dates we hold are
-- right, and only the pair was missing. Each checked 2026-11-02 against the
-- agency or its official publisher:
--
--   OH chukar       Nov 6 - Jan 10, 4/day     OAC 1501:31-15-17 (eff. 2026-07-06)
--   CT bobwhite     Oct 17-31, 2/day 10/szn   CT DEEP 2026 guide
--   DE bobwhite     Nov 23 - Feb 28           eRegulations DE; wild quail closed
--                                             statewide, pen-raised only - which
--                                             our note already said
--   ME pheasant     Sep 26 - Dec 31, 2/day    MDIFW season dates page
--   NH pheasant     Oct 1 - Dec 31, 2/day     NH F&G; separate pheasant licence
--   SC ruffed-grouse Nov 26 - Mar 1, 3/day    eRegulations SC (upd. 2026-08-07),
--                                             Game Zone 1 only
--   CA snowshoe-hare Jul 1 - Jan 31, 5/day    CCR T14 s.308, aggregate w/ rabbits
--   VA tundra-swan  Nov 15 - Jan 31           VA DWR; 475 permits by drawing
--
-- Two were not mapping gaps at all, and are handled separately below.

insert into public.state_species (state_id, species_id)
select st.id, sp.id
from (values
  ('OH', 'chukar'), ('CT', 'bobwhite'), ('DE', 'bobwhite'), ('ME', 'pheasant'),
  ('NH', 'pheasant'), ('SC', 'ruffed-grouse'), ('CA', 'snowshoe-hare'),
  ('VA', 'tundra-swan')
) as v(code, species_key)
join public.states st on st.code = v.code
join public.species sp on sp.key = v.species_key
on conflict do nothing;

-- Maine's permit rule, picked up while verifying the dates. Worth carrying:
-- it is the difference between a legal hunt and a citation in two counties.
update public.seasons s
   set notes = 'Stocked birds. A pheasant permit is required for hunters 16 and older in Cumberland and York counties. Possession limit 4.',
       last_verified_at = now()
from public.states st, public.species sp
where s.state_id = st.id and s.species_id = sp.id
  and st.code = 'ME' and sp.key = 'pheasant' and s.season_year = 2026
  and s.notes is null;

-- ---------------------------------------------------------------------------
-- Colorado and New Mexico were filed under the wrong bird.
--
-- Both rows are labelled "Dusky Grouse" / "Dusky (Blue) Grouse" and the
-- Colorado row's own note says it outright: "Colorado's forest grouse is dusky
-- grouse." Neither state has a ruffed grouse season - New Mexico has no huntable
-- ruffed grouse at all - so the extractor put a real season under a species that
-- does not apply, and the pair was missing because the matrix was right to
-- exclude them. Mapping them as ruffed grouse would have published a lie; the
-- app simply had nowhere correct to put a dusky grouse.
--
-- So dusky grouse becomes what it is: its own species. Verified 2026-11-02 -
-- CO Sep 1 - Nov 22 west of I-25, 3/day (CPW Ch. W-3, approved July 2026);
-- NM Sep 1 - Dec 31 statewide, 3/day and 6 in possession (NMAC 19.31.16).
--
-- Only CO and NM are mapped, because those are the only two we hold dates for.
-- Dusky grouse is hunted across the Mountain West; the rest should arrive the
-- way any season does, with a source behind it.

-- Keep the grouse together in the species list rather than bolting the new one
-- on the end. Everything from spruce grouse down shifts by one.
update public.species set sort_order = sort_order + 1 where sort_order >= 28;

insert into public.species (key, name, category, sort_order)
select 'dusky-grouse', 'Dusky grouse', 'upland', 28
where not exists (select 1 from public.species where key = 'dusky-grouse');

insert into public.state_species (state_id, species_id)
select st.id, sp.id from public.states st, public.species sp
where sp.key = 'dusky-grouse' and st.code in ('CO', 'NM')
on conflict do nothing;

-- Re-file the two rows. The label goes with them: once the species itself is
-- called "Dusky grouse", a label repeating it is noise.
update public.seasons s
   set species_id = (select id from public.species where key = 'dusky-grouse'),
       label = null,
       notes = 'Colorado''s forest grouse. Possession limit 6. Extended falconry season Sep 1 - Mar 31.',
       last_verified_at = now()
from public.states st, public.species sp
where s.state_id = st.id and s.species_id = sp.id
  and st.code = 'CO' and sp.key = 'ruffed-grouse' and s.season_year = 2026;

-- New Mexico's bag limit was wrong as well as its species. The row claimed
-- "3 per day North zone; 1 per day South"; NMAC 19.31.16 sets dusky grouse
-- statewide at three daily, six in possession, with no north/south split. That
-- split belongs to other New Mexico birds, not this one.
update public.seasons s
   set species_id = (select id from public.species where key = 'dusky-grouse'),
       label = null,
       bag_limit_summary = '3 per day, 6 in possession.',
       notes = 'Statewide - no north/south split for dusky grouse.',
       last_verified_at = now()
from public.states st, public.species sp
where s.state_id = st.id and s.species_id = sp.id
  and st.code = 'NM' and sp.key = 'ruffed-grouse' and s.season_year = 2026;

-- Guards: every orphan closed, and nothing left filed as ruffed grouse in a
-- state that does not have it.
do $$
declare
  n_orphan_seasons int;
  n_orphan_windows int;
  n_dusky int;
  n_bad_grouse int;
begin
  select count(*) into n_orphan_seasons
  from public.seasons s
  where not exists (
    select 1 from public.state_species ss
    where ss.state_id = s.state_id and ss.species_id = s.species_id);

  select count(*) into n_orphan_windows
  from public.application_windows w
  where not exists (
    select 1 from public.state_species ss
    where ss.state_id = w.state_id and ss.species_id = w.species_id);

  select count(*) into n_dusky
  from public.seasons s
  join public.species sp on sp.id = s.species_id
  where sp.key = 'dusky-grouse';

  select count(*) into n_bad_grouse
  from public.seasons s
  join public.states st on st.id = s.state_id
  join public.species sp on sp.id = s.species_id
  where sp.key = 'ruffed-grouse' and st.code in ('CO', 'NM');

  if n_orphan_seasons <> 0 or n_orphan_windows <> 0 or n_dusky <> 2 or n_bad_grouse <> 0 then
    raise exception
      'Orphaned pairs: expected 0 orphan seasons / 0 orphan windows / 2 dusky rows / 0 CO-NM ruffed grouse, got % / % / % / %',
      n_orphan_seasons, n_orphan_windows, n_dusky, n_bad_grouse;
  end if;
end $$;
