-- Alligator fill: FL, AL, SC, MS, LA, TX, AR — 2026 seasons (only GA had a
-- gator row; David caught FL/AL "No dates yet" while both are open/imminent).
-- Filled 2026-08-18 from official sources (FWC, Outdoor Alabama, MDWFP, SCDNR,
-- LDWF, TPWD, AGFC). All are limited-permit/draw hunts — notes say so.

insert into public.sources (agency_name, url, doc_type, state_id, notes, last_extracted_at)
select v.agency, v.url, 'webpage'::source_doc_type, s.id, v.notes, now()
from (values
  ('Florida Fish and Wildlife Conservation Commission',
   'https://myfwc.com/license/limited-entry/statewide-alligator-hunt/', 'FL',
   'Alligator rows filled 2026-08-18.'),
  ('Alabama Department of Conservation and Natural Resources',
   'https://www.outdooralabama.com/seasons-and-bag-limits/alligator-season', 'AL',
   'Alligator rows filled 2026-08-18.'),
  ('South Carolina Department of Natural Resources',
   'https://www.dnr.sc.gov/wildlife/alligator/', 'SC',
   'Alligator rows filled 2026-08-18.'),
  ('Mississippi Department of Wildlife, Fisheries, and Parks',
   'https://www.mdwfp.com/wildlife-hunting/wildlife-species-program/alligator-program/public-waters-permits', 'MS',
   'Alligator rows filled 2026-08-18.'),
  ('Louisiana Department of Wildlife and Fisheries',
   'https://www.wlf.louisiana.gov/news/lwfc-approves-noi-to-conduct-recreational-alligator-hunting-season-in-2026', 'LA',
   'Alligator rows filled 2026-08-18.'),
  ('Texas Parks & Wildlife Department',
   'https://tpwd.texas.gov/regulations/outdoor-annual/regs/animals/alligator', 'TX',
   'Alligator rows filled 2026-08-18.'),
  ('Arkansas Game & Fish Commission',
   'https://www.agfc.com/hunting/more-game/alligator/season-dates/', 'AR',
   'Alligator rows filled 2026-08-18.')
) as v(agency, url, code, notes)
join public.states s on s.code = v.code
where not exists (select 1 from public.sources x where x.url = v.url);

insert into public.zones (state_id, name)
select s.id, v.zone
from (values
  ('LA','East Zone'),('LA','West Zone'),
  ('TX','Core Counties'),('TX','Non-core Counties')
) as v(code, zone)
join public.states s on s.code = v.code
where not exists (select 1 from public.zones z where z.state_id = s.id and z.name = v.zone);

with rows_to_add (state_code, zone_name, src_url, label, open_date, close_date, bag, notes) as (
  values
  ('FL', 'Statewide', 'https://myfwc.com/license/limited-entry/statewide-alligator-hunt/',
   'Statewide Alligator Harvest', date '2026-08-15', date '2026-11-01',
   '2 per harvest permit.', 'Quota permit required (limited-entry drawing, applications in May). First four weeks are assigned quota weeks; all permit holders may hunt from mid-September.'),
  ('AL', 'Statewide', 'https://www.outdooralabama.com/seasons-and-bag-limits/alligator-season',
   'Regulated Alligator Hunts', date '2026-08-13', date '2026-09-10',
   '1 per tag.', 'Registration-only hunts (register in June), sunset-to-sunrise on designated nights beginning Aug 13, Aug 20, and Sep 10 by zone: Southwest (100 tags), Coastal (50), West Central (50), Southeast (40), Lake Eufaula (20).'),
  ('SC', 'Statewide', 'https://www.dnr.sc.gov/wildlife/alligator/',
   'Public Alligator Season', date '2026-09-12', date '2026-10-10',
   '1 per permit.', 'Opens at noon Sep 12, closes at noon Oct 10. Quota draw — apply with SCDNR in June.'),
  ('MS', 'Statewide', 'https://www.mdwfp.com/wildlife-hunting/wildlife-species-program/alligator-program/public-waters-permits',
   'Public Waters Season', date '2026-08-28', date '2026-09-07',
   'Per permit.', 'Noon Aug 28 to noon Sep 7. Permits by draw (apply June 1 – 12), zone-specific.'),
  ('MS', 'Statewide', 'https://www.mdwfp.com/wildlife-hunting/wildlife-species-program/alligator-program/public-waters-permits',
   'Private Lands Season', date '2026-08-28', date '2026-09-21',
   'Per permit.', 'Noon Aug 28 to 6 a.m. Sep 21. Private-lands permit required.'),
  ('LA', 'East Zone', 'https://www.wlf.louisiana.gov/news/lwfc-approves-noi-to-conduct-recreational-alligator-hunting-season-in-2026',
   'Wild Harvest — East Zone', date '2026-08-26', date '2026-12-31',
   'Per CITES tags.', 'Opens the last Wednesday of August. Tags issued to licensed hunters for specific properties; lottery hunts on public lands. A recreational season (Oct 1 – 31) was also approved for 2026.'),
  ('LA', 'West Zone', 'https://www.wlf.louisiana.gov/news/lwfc-approves-noi-to-conduct-recreational-alligator-hunting-season-in-2026',
   'Wild Harvest — West Zone', date '2026-09-02', date '2026-12-31',
   'Per CITES tags.', 'Opens the first Wednesday of September.'),
  ('TX', 'Core Counties', 'https://tpwd.texas.gov/regulations/outdoor-annual/regs/animals/alligator',
   'Core Counties Season', date '2026-09-10', date '2026-09-30',
   '1 per tag (CITES tag from landowner).', '22 core counties.'),
  ('TX', 'Non-core Counties', 'https://tpwd.texas.gov/regulations/outdoor-annual/regs/animals/alligator',
   'Non-core Counties Season', date '2027-04-01', date '2027-06-30',
   '1 per person per year.', 'All other Texas counties; hide tag reported to TPWD after harvest.'),
  ('AR', 'Statewide', 'https://www.agfc.com/hunting/more-game/alligator/season-dates/',
   'Draw Hunt — Weekend 1', date '2026-09-18', date '2026-09-21',
   '1 per permit.', 'Permit by draw. Night hunting only.'),
  ('AR', 'Statewide', 'https://www.agfc.com/hunting/more-game/alligator/season-dates/',
   'Draw Hunt — Weekend 2', date '2026-09-25', date '2026-09-28',
   '1 per permit.', 'Season ends 30 minutes before sunrise Sep 28, or when the quota is reached.')
)
insert into public.seasons
  (state_id, species_id, zone_id, season_year, method, label, open_date, close_date,
   bag_limit_summary, notes, source_id, last_verified_at, status)
select st.id, sp.id, z.id, 2026, 'general'::season_method, r.label, r.open_date, r.close_date,
       r.bag, r.notes, src.id, now(), 'published'
from rows_to_add r
join public.states st on st.code = r.state_code
join public.species sp on sp.key = 'alligator'
join public.zones z on z.state_id = st.id and z.name = r.zone_name
join public.sources src on src.url = r.src_url
where not exists (
  select 1 from public.seasons s
  where s.state_id = st.id and s.species_id = sp.id and s.zone_id = z.id
    and s.method = 'general'::season_method and s.season_year = 2026
    and coalesce(s.label, '') = coalesce(r.label, '')
);
