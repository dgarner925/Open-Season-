-- Coverage burn-down batch N: stragglers already verified in earlier crew
-- datasets but not yet encoded as their own rows, + prune #7.
--   ID chukar (from the IDFG upland brochure delivery)
--   NV chukar (CR 26-13: same dates as gray partridge)
--   CO chukar + CO mountain sharp-tailed grouse (from the CPW small game
--     brochure delivery — dates were in the dusky/sage-grouse row notes)
--   TX bobwhite (TPWD: single statewide quail season, all species combined)
--   MN marten (MN DNR: trapping-only, shares the fisher season/limit)
-- Prune #7: ME cottontail rabbit (no open season), RI ruffed grouse (closed
-- in the 2026-27 guide).

delete from public.state_species ss
using public.states st, public.species sp
where ss.state_id = st.id and ss.species_id = sp.id
  and ((st.code = 'ME' and sp.key = 'rabbit')
    or (st.code = 'RI' and sp.key = 'ruffed-grouse'));

with rows_to_add (state_code, species_key, zone_name, label, open_date, close_date, bag, notes, src_like) as (
  values
  ('ID','chukar','Statewide', null, date '2026-09-15', date '2027-01-31',
   '8 per day.', 'Entire state open. Separate limit from gray partridge.', '%idfg.idaho.gov%uplandgame%'),
  ('NV','chukar','Statewide', 'Chukar & Hungarian Partridge', date '2026-10-17', date '2027-02-07',
   '6 per day aggregate with gray partridge.', 'Youth season Sep 26 – Oct 4.', '%CR26-13%'),
  ('CO','chukar','Statewide', null, date '2026-09-01', date '2026-11-30',
   '4 per day.', null, '%colorado-small-game%'),
  ('CO','sharptail-grouse','Statewide', 'Mountain Sharp-tailed Grouse (select GMUs)', date '2026-09-01', date '2026-09-20',
   '2 per day.', '$5 permit required; select GMUs only. Plains sharp-tailed remains closed.', '%colorado-small-game%'),
  ('TX','bobwhite','Statewide', 'Quail (all species combined)', date '2026-11-01', date '2027-02-28',
   '15 per day combined.', 'Single statewide quail season; Upland Game Bird Endorsement required.', '%tpwd.texas.gov%'),
  ('MN','marten','North Furbearer Zone', 'Trapping Only (with fisher)', date '2026-12-12', date '2026-12-20',
   'Shared fisher/marten season limit.', 'Hunting marten prohibited by statute; registration required.', '%dnr.state.mn.us%')
)
insert into public.seasons
  (state_id, species_id, zone_id, season_year, method, label, open_date, close_date,
   bag_limit_summary, notes, source_id, last_verified_at, status)
select st.id, sp.id, z.id, 2026, 'general'::season_method, r.label, r.open_date, r.close_date,
       r.bag, r.notes,
       (select id from public.sources so where so.state_id = st.id and so.url like r.src_like limit 1),
       now(), 'published'
from rows_to_add r
join public.states st on st.code = r.state_code
join public.species sp on sp.key = r.species_key
join public.zones z on z.state_id = st.id and z.name = r.zone_name
where not exists (
  select 1 from public.seasons s
  where s.state_id = st.id and s.species_id = sp.id and s.zone_id = z.id
    and s.method = 'general'::season_method and s.season_year = 2026
    and coalesce(s.label, '') = coalesce(r.label, '')
);
