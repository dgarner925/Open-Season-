-- Coverage burn-down batch G: OR/WA/UT/WY/CA/AZ/NM/OK/TX/FL/RI headline gaps
-- + ID fall bear. Filled 2026-08-18 from official sources (ODFW via
-- eRegulations, WDFW, Utah DWR guidebook, WGFD 2026 bear PDF, CCR/CDFW,
-- AZGFD regs PDF, NMDGF bear PDF, ODWC, TPWD 2026-27 dates page, FWC, RI SOS
-- rules). RI dove confirmed LEGAL. OK pronghorn gun: NOTPUBLISHED (follow-up).

insert into public.sources (agency_name, url, doc_type, state_id, notes, last_extracted_at)
select v.agency, v.url, (case when v.url like '%.pdf' then 'pdf' else 'webpage' end)::source_doc_type, s.id, 'Burn-down fill 2026-08-18 (batch G).', now()
from (values
  ('Oregon Department of Fish and Wildlife', 'https://www.eregulations.com/oregon/hunting/game-bird/migratory-game-bird-seasons', 'OR'),
  ('Washington Department of Fish & Wildlife', 'https://wdfw.wa.gov/newsroom/news-release/2026-washington-big-game-hunting-regulations-now-available-special-hunt-submissions-begin-april-20', 'WA'),
  ('Utah Division of Wildlife Resources', 'https://wildlife.utah.gov/guidebooks/biggameapp.pdf', 'UT'),
  ('Wyoming Game & Fish Department', 'https://wgfd.wyo.gov/Regulations/Trophy-Game/Black-Bear', 'WY'),
  ('California Department of Fish and Wildlife', 'https://wildlife.ca.gov/Hunting/Elk', 'CA'),
  ('Arizona Game & Fish Department', 'https://www.azgfd.com/hunting/regulations/', 'AZ'),
  ('New Mexico Department of Game & Fish', 'https://wildlife.dgf.nm.gov/hunting/information-by-animal/big-game/bear/', 'NM'),
  ('Oklahoma Department of Wildlife Conservation', 'https://www.wildlifedepartment.com/outdoorok/ooj/next-years-hunting-season-dates', 'OK'),
  ('Texas Parks & Wildlife Department', 'https://tpwd.texas.gov/regulations/outdoor-annual/hunting/2026-2027-hunting-season-dates', 'TX'),
  ('Florida Fish and Wildlife Conservation Commission', 'https://myfwc.com/hunting/regulations/birds/', 'FL'),
  ('Rhode Island Department of Environmental Management', 'https://rules.sos.ri.gov/regulations/part/250-60-00-9', 'RI'),
  ('Idaho Department of Fish and Game', 'https://idfg.idaho.gov/sites/default/files/seasons-rules-big-game-2026.pdf', 'ID')
) as v(agency, url, code)
join public.states s on s.code = v.code
where not exists (select 1 from public.sources x where x.url = v.url and x.notes = 'Burn-down fill 2026-08-18 (batch G).');

insert into public.zones (state_id, name)
select s.id, v.zone
from (values
  ('OR','Northwest Permit Zone'),('OR','Southwest Zone'),('OR','South Coast Zone'),('OR','High Desert & Blue Mountains'),('OR','Mid-Columbia Zone'),
  ('OR','Zone 1 (Western)'),('OR','Zone 2 (Eastern)'),('OR','Fall Zone 1'),('OR','Fall Zone 2'),('OR','Fall Zone 3'),('OR','Controlled Hunts'),
  ('WA','Permit Hunts'),
  ('UT','Once-in-a-Lifetime Units'),
  ('WY','Hunt Areas'),
  ('CA','Hunt Codes (draw)'),('CA','Zones 1-6'),('CA','Zones 2-6'),
  ('AZ','Open Units'),
  ('NM','Bear Zones'),
  ('OK','Panhandle'),
  ('TX','North Zone'),('TX','Central Zone'),('TX','South Zone'),('TX','West Zone'),('TX','East Zone')
) as v(code, zone)
join public.states s on s.code = v.code
where not exists (select 1 from public.zones z where z.state_id = s.id and z.name = v.zone);

with rows_to_add (state_code, species_key, zone_name, method, label, open_date, close_date, bag, notes) as (
  values
  -- OREGON
  ('OR','goose','Northwest Permit Zone','general','Canada Goose', date '2026-10-24', date '2027-02-14',
   '2 per day.', 'Segments Oct 24 – Nov 1, Nov 21 – Jan 8, Jan 30 – Feb 14. NW goose permit required.'),
  ('OR','goose','Southwest Zone','general','Canada Goose', date '2026-10-17', date '2027-01-31',
   '4 per day.', 'Segments Oct 17 – Nov 1 and Nov 10 – Jan 31.'),
  ('OR','goose','South Coast Zone','general','Canada Goose', date '2026-10-03', date '2027-03-10',
   '6 per day.', 'Segments Oct 3 – Dec 6, Dec 19 – Jan 7, Feb 20 – Mar 10.'),
  ('OR','goose','High Desert & Blue Mountains','general','Canada Goose', date '2026-10-10', date '2027-01-31',
   '4 per day.', 'Segments Oct 10 – Nov 29 and Dec 15 – Jan 31.'),
  ('OR','goose','Mid-Columbia Zone','general','Canada Goose', date '2026-10-17', date '2027-01-31',
   '4 per day.', 'Segments Oct 17 – Nov 1 and Nov 10 – Jan 31.'),
  ('OR','dove','Zone 1 (Western)','general',null, date '2026-09-01', date '2026-12-14',
   '15 per day.', 'Segments Sep 1 – 30 and Nov 15 – Dec 14.'),
  ('OR','dove','Zone 2 (Eastern)','general',null, date '2026-09-01', date '2026-10-30', '15 per day.', null),
  ('OR','turkey','Fall Zone 1','general','Fall Turkey', date '2026-09-01', date '2027-01-31',
   '2 either sex.', 'Max 2 fall tags statewide.'),
  ('OR','turkey','Fall Zone 2','general','Fall Turkey', date '2026-10-10', date '2027-01-31',
   '1.', 'Private lands only Dec 1 – Jan 31.'),
  ('OR','turkey','Fall Zone 3','general','Fall Turkey', date '2026-09-01', date '2027-01-31',
   '1.', 'Private lands only Dec 1 – Jan 31.'),
  ('OR','turkey','Statewide','general','Spring Turkey', date '2027-04-15', date '2027-05-31',
   '3 per spring, 1 per day.', 'Youth weekend Apr 10 – 11.'),
  ('OR','pronghorn','Controlled Hunts','firearm','Controlled Buck (draw)', date '2026-08-15', date '2026-08-23',
   '1.', 'Draw only (apply by May 15); secondary hunts Aug 22 – 30 vary by unit.'),
  ('OR','pronghorn','Controlled Hunts','archery','Archery (draw)', date '2026-08-29', date '2026-09-06',
   '1.', 'Other hunts Aug 6 – 14, Sep 5 – 13; varies by unit.'),
  ('OR','pronghorn','Controlled Hunts','muzzleloader','Muzzleloader (draw)', date '2026-08-29', date '2026-09-06',
   '1.', 'Some units Sep 5 – 13.'),
  -- WASHINGTON / UTAH / WYOMING moose+bear
  ('WA','moose','Permit Hunts','firearm','Special Permit (draw)', date '2026-10-01', date '2026-11-30',
   '1.', 'Draw only; hunts run Oct 1 – 31, Nov 1 – 30, or the full span by unit. Antlered bull is once-in-a-lifetime.'),
  ('UT','moose','Once-in-a-Lifetime Units','firearm','Bull Moose (draw)', date '2026-09-12', date '2026-10-31',
   '1.', 'All 13 public-draw bull hunts share these dates; CWMU hunts differ.'),
  ('WY','bear','Hunt Areas','firearm','Fall Black Bear', date '2026-09-01', date '2026-10-31',
   '1.', 'Dominant window; some areas open Aug 1/15 or close Nov 15. Closes early at female mortality limit — call the WGFD hotline.'),
  ('WY','bear','Hunt Areas','archery','Fall Archery', date '2026-08-15', date '2026-08-31',
   '1.', 'Pre-season archery in most areas; varies by area.'),
  ('WY','moose','Hunt Areas','firearm','Regular (draw)', date '2026-10-01', date '2026-11-20',
   '1.', 'Draw only; most areas open Oct 1, closes vary Oct 31 – Nov 20.'),
  ('WY','moose','Hunt Areas','archery','Archery (draw)', date '2026-09-01', date '2026-09-30', '1.', null),
  -- CALIFORNIA
  ('CA','elk','Hunt Codes (draw)','firearm','Elk (draw only)', date '2026-09-01', date '2026-10-31',
   '1.', 'No OTC elk in California; dominant Sep – Oct window. Tule hunts range Jul – Dec by hunt code.'),
  ('CA','pronghorn','Zones 1-6','firearm','General (draw)', date '2026-08-22', date '2026-08-30',
   '1 per license year.', 'Zones 3-4 second period Sep 5 – 13.'),
  ('CA','pronghorn','Zones 2-6','archery','Archery (draw)', date '2026-08-08', date '2026-08-16', '1.', null),
  -- ARIZONA / NEW MEXICO bear
  ('AZ','bear','Open Units','firearm','Fall General (OTC)', date '2026-10-02', date '2026-12-31',
   '1.', 'Nonpermit tag; some units differ. Female harvest limits close units — check the hotline daily.'),
  ('AZ','bear','Open Units','archery','Fall Archery-Only (OTC)', date '2026-08-21', date '2026-10-01',
   '1.', 'Some units Aug 14 – 20 or Aug 21 – Sep 10.'),
  ('NM','bear','Bear Zones','firearm','Early Any-Legal (zones 3-6, 9, 11-13)', date '2026-08-16', date '2026-08-31',
   '1.', 'OTC license; dogs allowed; zone quotas close at 90% of limit.'),
  ('NM','bear','Bear Zones','archery','Bow-Only (all zones)', date '2026-09-01', date '2026-09-24',
   '1.', 'No dogs; zone quotas apply.'),
  ('NM','bear','Bear Zones','firearm','Any-Legal Main', date '2026-09-25', date '2026-11-15',
   '1.', 'Dominant close Nov 15; zones 4/11/13 to Nov 30, zones 10/12 to Dec 15, zones 8/14 Oct 15 – Nov 15.'),
  -- OKLAHOMA pronghorn (archery; gun NOTPUBLISHED)
  ('OK','pronghorn','Panhandle','archery','Archery', date '2026-10-01', date '2026-10-14',
   '2, max 1 buck.', 'Cimarron County & Texas County west of SH 136; written landowner permission required. Gun controlled-hunt dates publish separately.'),
  -- TEXAS
  ('TX','dove','North Zone','general',null, date '2026-09-01', date '2027-01-07',
   '15 per day.', 'Segments Sep 1 – Nov 8 and Dec 18 – Jan 7.'),
  ('TX','dove','Central Zone','general',null, date '2026-09-01', date '2027-01-14',
   '15 per day.', 'Segments Sep 1 – Oct 25 and Dec 11 – Jan 14.'),
  ('TX','dove','South Zone','general',null, date '2026-09-01', date '2027-01-21',
   '15 per day.', 'Segments Sep 1 – Oct 25 and Dec 18 – Jan 21. Sep 1 South Zone opener is new for 2026-27.'),
  ('TX','goose','West Zone','general','Dark & Light Geese', date '2026-11-07', date '2027-02-07',
   'Dark 5 per day.', 'Light-goose limits per the Outdoor Annual.'),
  ('TX','goose','East Zone','general','Dark & Light Geese', date '2026-11-07', date '2027-02-19',
   'Dark 5 per day (dark close Jan 31).', 'Light geese run to Feb 19.'),
  ('TX','turkey','Statewide','archery','Fall Archery-Only', date '2026-10-03', date '2026-11-06',
   '4; county limits vary.', null),
  ('TX','turkey','North Zone','firearm','Fall Turkey', date '2026-11-07', date '2027-01-03', '4.', null),
  ('TX','turkey','South Zone','firearm','Fall Turkey', date '2026-11-07', date '2027-01-17', '4.', null),
  ('TX','turkey','North Zone','general','Spring Rio Grande', date '2027-04-03', date '2027-05-16',
   '4, gobblers/bearded hens.', null),
  ('TX','turkey','South Zone','general','Spring Rio Grande', date '2027-03-20', date '2027-05-02',
   '4.', 'One-turkey counties Apr 1 – 30.'),
  ('TX','turkey','East Zone','general','Spring Eastern', date '2027-04-22', date '2027-05-14',
   '1.', 'Mandatory harvest reporting.'),
  -- FLORIDA / RHODE ISLAND / IDAHO
  ('FL','goose','Statewide','general','Canada Goose', date '2026-09-05', date '2027-01-30',
   '5 per day.', 'Early Sep 5 – 27; regular Nov 21 – 29 and Dec 1 – Jan 30. Waterfowl permit + federal duck stamp for regular season.'),
  ('FL','goose','Statewide','general','Light Geese', date '2026-11-21', date '2027-01-31',
   '15 per day.', 'Segments Nov 21 – 29 and Dec 12 – Jan 31.'),
  ('FL','dove','Statewide','general','Dove (three phases)', date '2026-09-26', date '2027-01-31',
   '15 per day.', 'Phases Sep 26 – Oct 18, Nov 14 – Dec 6, Dec 19 – Jan 31.'),
  ('RI','dove','Statewide','general',null, date '2026-09-01', date '2026-12-15',
   '15 per day.', 'Segment 1 Sep 1 – 30; segment 2 mid-Oct through mid-Dec. Confirm close in the DEM 2026-27 abstract.'),
  ('ID','bear','Statewide','firearm','Fall General', date '2026-08-30', date '2026-12-31',
   '1 per tag.', 'Closes Oct 9 / Nov 30 / Dec 31 / Jan 31 by unit — check IDFG regs.')
)
insert into public.seasons
  (state_id, species_id, zone_id, season_year, method, label, open_date, close_date,
   bag_limit_summary, notes, source_id, last_verified_at, status)
select st.id, sp.id, z.id, 2026, r.method::season_method, r.label, r.open_date, r.close_date,
       r.bag, r.notes,
       (select id from public.sources so where so.state_id = st.id
          and so.notes = 'Burn-down fill 2026-08-18 (batch G).' limit 1),
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
