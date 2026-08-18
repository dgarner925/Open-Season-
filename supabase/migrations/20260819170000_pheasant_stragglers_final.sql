-- Coverage burn-down batch R (final fillable batch): pheasant in 12 states
-- + misc stragglers (IA bobwhite, ID moose, UT goat/hare/ringtail, CO marten,
-- WV fisher, VT snipe, AK goat, OR sage-grouse).
-- Matrix prune #10: TX crow — no defined season; take is federal
-- depredation-order nuisance control only (TPWD).
-- Save: CO marten is legal (hunting or cage/box traps; new 2/day limit
-- effective Sep 1, 2026 per CPW Commission).
-- Flags: MI pheasant formula-derived (michigan.gov 403s — verify in the 2026
-- Small Game Summary); IL from IDNR Rules-of-Thumb (digest not posted).

delete from public.state_species ss
using public.states st, public.species sp
where ss.state_id = st.id and ss.species_id = sp.id
  and st.code = 'TX' and sp.key = 'crow';

insert into public.sources (agency_name, url, doc_type, state_id, notes, last_extracted_at)
select v.agency, v.url, (case when v.url like '%.pdf%' or v.url like '%download%' then 'pdf' else 'webpage' end)::source_doc_type, s.id, 'Burn-down fill 2026-08-19 (batch R).', now()
from (values
  ('California Department of Fish & Wildlife', 'https://wildlife.ca.gov/Hunting/Upland-Game-Birds#pheasant', 'CA'),
  ('Iowa Department of Natural Resources', 'https://www.iowadnr.gov/media/1701/download?inline=', 'IA'),
  ('Illinois Department of Natural Resources', 'https://dnr.illinois.gov/content/dam/soi/en/web/dnr/conservation/wildlife/documents/season-dates-rules-of-thumb.pdf#pheasant', 'IL'),
  ('Michigan Department of Natural Resources', 'https://www.michigan.gov/dnr/things-to-do/hunting/small-game', 'MI'),
  ('Minnesota Department of Natural Resources', 'https://www.dnr.state.mn.us/hunting/pheasant/index.html', 'MN'),
  ('Missouri Department of Conservation', 'https://mdc.mo.gov/hunting-trapping/species/pheasant/pheasant-regulations', 'MO'),
  ('Ohio Department of Natural Resources', 'https://dam.assets.ohio.gov/image/upload/ohiodnr.gov/documents/wildlife/laws-regs-licenses/Ohio%20Hunting%20and%20Trapping%20Regulations%20ENGLISH.pdf', 'OH'),
  ('Oklahoma Department of Wildlife Conservation', 'https://www.wildlifedepartment.com/hunting/regs/pheasant-regulations', 'OK'),
  ('Pennsylvania Game Commission', 'https://www.pa.gov/agencies/pgc/newsroom/final-2026-27-hunting-seasons-approved', 'PA'),
  ('South Dakota Game, Fish & Parks', 'https://gfp.sd.gov/pheasant/', 'SD'),
  ('Texas Parks & Wildlife Department', 'https://tpwd.texas.gov/regulations/outdoor-annual/regs/animals/pheasant', 'TX'),
  ('Wisconsin Department of Natural Resources', 'https://dnr.wisconsin.gov/topic/hunt/dates.html', 'WI'),
  ('Idaho Department of Fish & Game', 'https://idfg.idaho.gov/rules/moose-sheep-goat', 'ID'),
  ('Utah Division of Wildlife Resources', 'https://wildlife.utah.gov/guidebooks/biggameapp.pdf', 'UT'),
  ('Colorado Parks & Wildlife', 'https://cpw.state.co.us/activities/hunting/small-game', 'CO'),
  ('West Virginia Division of Natural Resources', 'https://wvdnr.gov/wp-content/uploads/2026/06/Pub_Regs_HuntTrap_202627_DNR_WILD_20260629.pdf', 'WV'),
  ('Vermont Fish & Wildlife Department', 'https://www.vtfishandwildlife.com/sites/fishandwildlife/files/documents/Hunt/waterfowl/migratory-bird-syllabus-2026-WEB-v2.pdf', 'VT'),
  ('Alaska Department of Fish & Game', 'https://www.adfg.alaska.gov/index.cfm?adfg=hunting.main#goat', 'AK'),
  ('Oregon Department of Fish & Wildlife', 'https://www.eregulations.com/oregon/hunting/game-bird/game-bird-seasons#sage-grouse', 'OR')
) as v(agency, url, code)
join public.states s on s.code = v.code
where not exists (select 1 from public.sources x where x.url = v.url and x.notes = 'Burn-down fill 2026-08-19 (batch R).');

insert into public.zones (state_id, name)
select s.id, v.zone
from (values
  ('MI','Zone 1 (Upper Peninsula)'),
  ('MI','Zones 2 & 3'),
  ('MI','Zone 3 Late Season Areas'),
  ('MO','North Pheasant Zone'),
  ('OK','Northwest Counties'),
  ('TX','Panhandle Counties'),
  ('ID','Draw Units'),
  ('UT','Draw Units')
) as v(code, zone)
join public.states s on s.code = v.code
where not exists (select 1 from public.zones z where z.state_id = s.id and z.name = v.zone);

with rows_to_add (state_code, species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  -- PHEASANT
  ('CA','pheasant','Statewide','archery','Archery Season (split)', date '2026-10-10', date '2027-01-24',
   '2 per day first 2 days, then 3.', 'Segments Oct 10 – Nov 1 and Dec 28 – Jan 24; max 1 hen per day.'),
  ('IA','pheasant','Statewide','general',null, date '2026-10-31', date '2027-01-10',
   '3 roosters per day.', 'Youth weekend Oct 24 – 25; shooting hours 8 a.m. – 4:30 p.m.'),
  ('IL','pheasant','North Zone','general',null, date '2026-11-07', date '2027-01-08',
   '2 roosters per day.', 'Hens illegal except on controlled areas.'),
  ('IL','pheasant','South Zone','general',null, date '2026-11-07', date '2027-01-15',
   '2 roosters per day.', 'Hens illegal except on controlled areas.'),
  ('MI','pheasant','Zone 1 (Upper Peninsula)','general','Designated Areas', date '2026-10-10', date '2026-10-31',
   '2 males per day.', 'Fixed annual dates — verify in the 2026 Small Game Summary.'),
  ('MI','pheasant','Zones 2 & 3','general',null, date '2026-10-20', date '2026-11-14',
   '2 males per day.', 'Males only; pheasant license required for Lower Peninsula public land.'),
  ('MI','pheasant','Zone 3 Late Season Areas','general','Late Season', date '2026-12-01', date '2027-01-01',
   '2 males per day.', 'Selected areas of the southern Lower Peninsula only.'),
  ('MN','pheasant','Statewide','general',null, date '2026-10-10', date '2027-01-03',
   '2 roosters per day (3 from Dec 1).', 'Roosters only; 9 a.m. to sunset.'),
  ('MO','pheasant','North Pheasant Zone','general',null, date '2026-11-01', date '2027-01-15',
   '2 males per day.', 'Open only in the northern pheasant zone; youth weekend Oct 24 – 25.'),
  ('OH','pheasant','Statewide','general',null, date '2026-11-06', date '2027-01-10',
   '2 males per day.', 'Youth weekends Oct 24 – 25 and Oct 31 – Nov 1; birds released at public areas.'),
  ('OK','pheasant','Northwest Counties','general',null, date '2026-12-01', date '2027-01-31',
   '2 cocks per day.', 'Open in listed northwest counties only.'),
  ('PA','pheasant','Statewide','general','Split Season', date '2026-10-24', date '2027-02-28',
   '2 per day.', 'Segments Oct 24 – Dec 24 and Dec 26 – Feb 28; hens legal in all WMUs; junior/mentored season Oct 10 – 18; closed in Wild Pheasant Recovery Areas.'),
  ('SD','pheasant','Statewide','general','Traditional Season', date '2026-10-17', date '2027-01-31',
   '3 roosters per day.', 'Youth season Sep 26 – Oct 4; resident-only Oct 10 – 12; shooting 10 a.m. CT to sunset.'),
  ('TX','pheasant','Panhandle Counties','general',null, date '2026-12-05', date '2027-01-03',
   '3 cocks per day.', 'Upland Game Bird Endorsement required.'),
  ('WI','pheasant','Statewide','general',null, date '2026-10-17', date '2027-01-03',
   '1 rooster per day Oct 17 – 18, then 2.', 'Opens 9 a.m.; rooster-only except designated hen/rooster areas.'),
  -- MISC STRAGGLERS
  ('IA','bobwhite','Statewide','general',null, date '2026-10-31', date '2027-01-31',
   '8 per day.', 'Shooting hours 8 a.m. – 4:30 p.m.'),
  ('ID','moose','Draw Units','general','Controlled Hunts (draw)', date '2026-08-30', date '2026-12-01',
   '1 per tag.', 'Draw only; dates vary by unit; lifetime limit of one antlered and one antlerless.'),
  ('UT','mountain-goat','Draw Units','general','Once-in-a-Lifetime (draw)', date '2026-09-05', date '2026-11-25',
   '1 goat.', 'Draw only; dates vary by unit.'),
  ('UT','snowshoe-hare','Statewide','general',null, date '2026-09-01', date '2027-03-15',
   '5 per day.', null),
  ('UT','ringtail','Statewide','general','Furbearer Season', date '2026-09-15', date '2027-03-01',
   'No limit.', 'Furbearer license required.'),
  ('CO','marten','Statewide','general','Furbearer Season', date '2026-11-01', date '2027-02-28',
   '2 per day (new limit).', 'Hunting or live cage/box traps only — no leghold, body-grip or snares; furbearer license required.'),
  ('WV','fisher','Statewide','general','Trapping Only', date '2026-11-07', date '2027-01-31',
   '1 per season.', null),
  ('VT','snipe','Statewide','general',null, date '2026-09-26', date '2026-11-09',
   '8 per day.', 'Same dates as woodcock; HIP required; duck stamp not required.'),
  ('AK','mountain-goat','Draw Hunts','general','Registration & Draw Hunts', date '2026-08-01', date '2026-12-31',
   '1 goat.', 'Dates vary by hunt and unit; taking nannies with kids prohibited.'),
  ('OR','sage-grouse','Draw Units','general','Controlled September Hunt', date '2026-09-12', date '2026-09-20',
   '2 per season.', 'Permit only — apply Jul 1 – Aug 14; 30-125 permits per unit.')
)
insert into public.seasons
  (state_id, species_id, zone_id, season_year, method, label, open_date, close_date,
   bag_limit_summary, notes, source_id, last_verified_at, status)
select st.id, sp.id, z.id, 2026, r.method::season_method, r.label, r.open_date, r.close_date,
       r.bag, r.notes,
       (select id from public.sources so where so.state_id = st.id
          and so.notes = 'Burn-down fill 2026-08-19 (batch R).' limit 1),
       now(), 'published'
from rows_to_add r
join public.states st on st.code = r.state_code
join public.species sp on sp.key = r.species_key
join public.zones z on z.state_id = st.id and z.name = r.zone_name
where not exists (
  select 1 from public.seasons s
  where s.state_id = st.id and s.species_id = sp.id and s.zone_id = z.id
    and s.method = r.method::season_method and s.season_year = 2026
    and coalesce(s.label, '') = coalesce(r.label, '')
);
