-- 20260714130000_seed_co_duck.sql
-- Colorado 2025-26 duck seasons (the most recently published — CPW's 2026-27
-- waterfowl brochure isn't out until Aug 2026). Confirmed from the official 2025
-- CPW Small Game & Waterfowl brochure. All rows status=draft, sourced; season_year
-- 2025. Idempotent (guarded inserts).

-- Source
insert into public.sources (agency_name, url, doc_type, state_id)
select 'Colorado Parks & Wildlife',
       'https://cpw.state.co.us/Documents/RulesRegs/Brochure/SmallGameWaterfowl.pdf',
       'pdf',
       (select id from public.states where code = 'CO')
where not exists (
  select 1 from public.sources where url = 'https://cpw.state.co.us/Documents/RulesRegs/Brochure/SmallGameWaterfowl.pdf'
);

-- Flyway zones
insert into public.zones (state_id, type, name)
select st.id, 'flyway_zone', z.name
from public.states st
cross join (values
  ('Northeast Zone'), ('Southeast Zone'), ('Mountain/Foothills Zone'),
  ('Western Zone'), ('Eastern Zone'), ('September Teal Zone')
) as z(name)
where st.code = 'CO'
on conflict (state_id, name) do nothing;

-- Seasons
insert into public.seasons (state_id, species_id, zone_id, season_year, method, label, open_date, close_date, bag_limit_summary, notes, source_id, status)
select st.id, sp.id, z.id, 2025, 'general', nullif(d.label, ''),
       d.open_date::date, d.close_date::date, d.bag, d.notes, src.id, 'draft'
from (values
  ($s$Northeast Zone$s$,        $s$Split 1$s$,        $s$2025-10-18$s$, $s$2025-11-30$s$, $s$6 ducks/day aggregate (max 5 mallard incl. 2 hen; 3 pintail, 2 canvasback, 2 redhead, 3 wood duck, 1 scaup). Coot 15. Possession 3x.$s$, $s$Central Flyway. East of I-25 and north of I-70.$s$),
  ($s$Northeast Zone$s$,        $s$Split 2$s$,        $s$2025-12-11$s$, $s$2026-01-31$s$, $s$6 ducks/day aggregate (max 5 mallard incl. 2 hen; 3 pintail, 2 canvasback, 2 redhead, 3 wood duck, 1 scaup). Coot 15. Possession 3x.$s$, $s$Central Flyway. East of I-25 and north of I-70.$s$),
  ($s$Southeast Zone$s$,        $s$$s$,               $s$2025-10-28$s$, $s$2026-01-31$s$, $s$6 ducks/day aggregate (max 5 mallard incl. 2 hen; 3 pintail, 2 canvasback, 2 redhead, 3 wood duck, 1 scaup). Coot 15. Possession 3x.$s$, $s$Central Flyway. East of I-25, south of I-70, plus El Paso/Pueblo/Huerfano/Las Animas counties. Continuous.$s$),
  ($s$Mountain/Foothills Zone$s$, $s$Split 1$s$,      $s$2025-10-04$s$, $s$2025-11-30$s$, $s$6 ducks/day aggregate (max 5 mallard incl. 2 hen; 3 pintail, 2 canvasback, 2 redhead, 3 wood duck, 1 scaup). Coot 15. Possession 3x.$s$, $s$Central Flyway. West of I-25, east of the Continental Divide (except El Paso/Pueblo/Huerfano/Las Animas).$s$),
  ($s$Mountain/Foothills Zone$s$, $s$Split 2$s$,      $s$2025-12-25$s$, $s$2026-01-31$s$, $s$6 ducks/day aggregate (max 5 mallard incl. 2 hen; 3 pintail, 2 canvasback, 2 redhead, 3 wood duck, 1 scaup). Coot 15. Possession 3x.$s$, $s$Central Flyway. West of I-25, east of the Continental Divide (except El Paso/Pueblo/Huerfano/Las Animas).$s$),
  ($s$Western Zone$s$,          $s$Split 1$s$,        $s$2025-10-04$s$, $s$2025-10-21$s$, $s$7 ducks/day aggregate (max 2 hen mallard; 3 pintail, 2 canvasback, 2 redhead, 2 scaup). Coot 25. Possession 3x.$s$, $s$Pacific Flyway. West of the Continental Divide, not in the Eastern Zone. No scaup after Jan 12.$s$),
  ($s$Western Zone$s$,          $s$Split 2$s$,        $s$2025-11-06$s$, $s$2026-01-31$s$, $s$7 ducks/day aggregate (max 2 hen mallard; 3 pintail, 2 canvasback, 2 redhead, 2 scaup). Coot 25. Possession 3x.$s$, $s$Pacific Flyway. West of the Continental Divide, not in the Eastern Zone. No scaup after Jan 12.$s$),
  ($s$Eastern Zone$s$,          $s$$s$,               $s$2025-10-04$s$, $s$2026-01-16$s$, $s$7 ducks/day aggregate (max 2 hen mallard; 3 pintail, 2 canvasback, 2 redhead, 2 scaup). Coot 25. Possession 3x.$s$, $s$Pacific Flyway. Routt/Grand/Summit/Eagle/Pitkin + parts of Saguache/San Juan/Hinsdale/Mineral/Gunnison/Moffat west of the Divide. Continuous; no scaup after Dec 28.$s$),
  ($s$September Teal Zone$s$,   $s$September Teal$s$, $s$2025-09-13$s$, $s$2025-09-21$s$, $s$6 teal/day (blue-/green-/cinnamon). Teal only. Possession 18.$s$, $s$Early teal-only season. Lake & Chaffee counties and all areas east of I-25.$s$)
) as d(zone, label, open_date, close_date, bag, notes)
join public.states st on st.code = 'CO'
join public.species sp on sp.key = 'duck'
join public.zones z on z.state_id = st.id and z.name = d.zone
left join public.sources src on src.url = 'https://cpw.state.co.us/Documents/RulesRegs/Brochure/SmallGameWaterfowl.pdf'
where not exists (
  select 1 from public.seasons s2
  where s2.state_id = st.id and s2.species_id = sp.id and s2.zone_id = z.id
    and s2.season_year = 2025 and s2.method = 'general'
    and coalesce(s2.label, '') = coalesce(nullif(d.label, ''), '')
);
