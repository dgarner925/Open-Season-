-- Coverage burn-down batch J: NY tier 2-3 (full, from the official 2026-27
-- guide) + NJ crow (2026-27 agency publication) + prune NJ bobcat (state
-- endangered). All other NJ small game/furbearers remain NOTPUBLISHED until
-- the digest drops (~late Aug) — existing follow-up.

delete from public.state_species ss
using public.states st, public.species sp
where ss.state_id = st.id and ss.species_id = sp.id
  and st.code = 'NJ' and sp.key = 'bobcat';

insert into public.sources (agency_name, url, doc_type, state_id, notes, last_extracted_at)
select v.agency, v.url, 'pdf'::source_doc_type, s.id, 'Burn-down fill 2026-08-18 (batch J).', now()
from (values
  ('New York State Department of Environmental Conservation',
   'https://dec.ny.gov/sites/default/files/2024-07/htgfurbearer.pdf', 'NY'),
  ('New Jersey Division of Fish and Wildlife',
   'https://dep.nj.gov/wp-content/uploads/njfw/proposed-migratory-bird-seasons-2026-2027.pdf', 'NJ')
) as v(agency, url, code)
join public.states s on s.code = v.code
where not exists (select 1 from public.sources x where x.url = v.url and x.notes = 'Burn-down fill 2026-08-18 (batch J).');

insert into public.zones (state_id, name)
select s.id, v.zone
from (values
  ('NY','Adirondack Marten Zone'),('NY','Northern & Eastern NY'),('NY','Central NY'),('NY','Western NY'),
  ('NY','Except Long Island & NYC'),('NY','Long Island & NYC'),('NY','Bobcat Harvest Area'),('NY','Bobcat Expansion Area')
) as v(code, zone)
join public.states s on s.code = v.code
where not exists (select 1 from public.zones z where z.state_id = s.id and z.name = v.zone);

with rows_to_add (state_code, species_key, zone_name, label, open_date, close_date, bag, notes) as (
  values
  ('NY','fisher','Adirondack Marten Zone','Trapping', date '2026-12-01', date '2026-12-31',
   'No limit.', 'Trapping only — fisher hunting is not legal in NY.'),
  ('NY','fisher','Northern & Eastern NY','Trapping', date '2026-11-15', date '2026-12-31',
   'No limit.', 'New 2026-27 zone structure — check the DEC map for exact WMUs.'),
  ('NY','fisher','Central NY','Trapping', date '2026-11-26', date '2026-12-10', 'No limit.', null),
  ('NY','fisher','Western NY','Trapping', date '2026-12-05', date '2026-12-10',
   'No limit.', 'Short season in newly opened western WMUs; LI/NYC closed.'),
  ('NY','marten','Adirondack Marten Zone','Trapping (permit)', date '2026-12-01', date '2026-12-31',
   '6 per season.', 'Free DEC marten permit; pelt seal required. Closed elsewhere.'),
  ('NY','snowshoe-hare','Northern Zone',null, date '2026-10-01', date '2027-03-21', '6 per day.', null),
  ('NY','snowshoe-hare','Southern Zone',null, date '2026-12-14', date '2027-02-28',
   '2 per day.', 'Closed in several far-western WMUs and LI/NYC. Limited Jan-only season in parts of western NY.'),
  ('NY','coyote','Except Long Island & NYC',null, date '2026-10-01', date '2027-03-28',
   'No limit.', 'Day or night; electronic calls OK. Trapping Oct 25 – Feb 15.'),
  ('NY','crow','Statewide','Fri – Mon only', date '2026-09-01', date '2027-03-31', 'No limit.', null),
  ('NY','fox','Except Long Island & NYC',null, date '2026-10-25', date '2027-02-15',
   'No limit.', 'Red and gray fox; day or night after opening sunrise.'),
  ('NY','fox','Long Island & NYC',null, date '2026-11-01', date '2027-02-25', 'No limit.', null),
  ('NY','raccoon','Except Long Island & NYC',null, date '2026-10-25', date '2027-02-15', 'No limit.', null),
  ('NY','raccoon','Long Island & NYC',null, date '2026-11-01', date '2027-02-25', 'No limit.', null),
  ('NY','bobcat','Bobcat Harvest Area',null, date '2026-10-25', date '2027-02-15',
   'No limit.', 'Northern Zone + eastern/southeastern harvest area. Possession tag + pelt seal required. Trapping same dates.'),
  ('NY','bobcat','Bobcat Expansion Area',null, date '2026-10-25', date '2026-11-20',
   'No limit.', 'Shorter season; most of western NY and LI/NYC closed.'),
  ('NJ','crow','Statewide','Segment 1 (Mon/Thu/Fri/Sat)', date '2026-08-10', date '2026-11-28',
   'No limit.', 'From the agency 2026-27 migratory publication; confirm in the final digest.'),
  ('NJ','crow','Statewide','Segment 2 (Mon/Thu/Fri/Sat)', date '2026-12-14', date '2027-03-20', 'No limit.', null)
)
insert into public.seasons
  (state_id, species_id, zone_id, season_year, method, label, open_date, close_date,
   bag_limit_summary, notes, source_id, last_verified_at, status)
select st.id, sp.id, z.id, 2026, 'general'::season_method, r.label, r.open_date, r.close_date,
       r.bag, r.notes,
       (select id from public.sources so where so.state_id = st.id
          and so.notes = 'Burn-down fill 2026-08-18 (batch J).' limit 1),
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
