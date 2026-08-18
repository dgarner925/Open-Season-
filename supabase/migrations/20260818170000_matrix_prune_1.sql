-- Matrix prune #1: remove followable (state, species) pairs where the species
-- is NOT legal game in that state — verified against official regulations
-- during the 2026-08-18 coverage burn-down. Removing the pair hides it from
-- the species pickers; any existing follows simply never produce dates.
--
--   FL fox — foxes may not be killed in Florida (chase-with-dogs only).
--   MT crow — Montana sets no crow hunting season (federal depredation only).

delete from public.state_species ss
using public.states st, public.species sp
where ss.state_id = st.id and ss.species_id = sp.id
  and ((st.code = 'FL' and sp.key = 'fox')
    or (st.code = 'MT' and sp.key = 'crow'));
