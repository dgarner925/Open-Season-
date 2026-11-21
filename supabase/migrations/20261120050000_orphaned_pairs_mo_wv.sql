-- Three state x species pairs that were never created, hiding 8 approved seasons.
--
-- A season is only reachable through a state_species row: the pair is what the
-- app lists and what a follow attaches to. Missing the pair hides every season
-- behind it, and the coverage count cannot see it -- the gap report asks which
-- pairs lack seasons, not which seasons lack a pair.
--
-- Missouri nutria (2 seasons), West Virginia ring-necked pheasant (4) and West
-- Virginia snowshoe hare (2). All extracted, reviewed and approved; all
-- invisible until 2026-11-20. Keyed by code and name rather than by pasted
-- uuids so it reads as what it means, and guarded so a re-run is a no-op.

insert into public.state_species (state_id, species_id)
select st.id, sp.id
from (values ('MO','Nutria'),('WV','Ring-necked pheasant'),('WV','Snowshoe hare')) v(c,n)
join public.states  st on st.code = v.c
join public.species sp on sp.name = v.n
where not exists (
  select 1 from public.state_species ss
   where ss.state_id = st.id and ss.species_id = sp.id
);
