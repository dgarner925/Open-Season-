-- Dedupe CO big-game rows: the original coarse Statewide rows coexist with
-- the batch-B CO refresh rows (zone "West of I-25 & GMU 140", BGSS labels)
-- at identical method+dates, so the app shows doubled seasons (seen on the
-- elk page: Archery and each rifle season listed twice). Delete any CO
-- Statewide row that has a zone-specific twin with the same species, method
-- and dates. Statewide rows without a twin (e.g. muzzleloader) survive.

delete from public.seasons s
using public.states st, public.zones z
where s.state_id = st.id and st.code = 'CO'
  and s.zone_id = z.id and z.name = 'Statewide'
  and s.season_year = 2026
  and exists (
    select 1
    from public.seasons s2
    join public.zones z2 on z2.id = s2.zone_id
    where s2.id <> s.id
      and s2.state_id = s.state_id
      and s2.species_id = s.species_id
      and s2.method = s.method
      and s2.season_year = 2026
      and s2.open_date = s.open_date
      and s2.close_date = s.close_date
      and z2.name <> 'Statewide'
  );
