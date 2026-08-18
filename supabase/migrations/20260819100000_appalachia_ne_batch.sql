-- Coverage burn-down batch K: ME/NH/VT tier 2-3 + OH/MI/WI/PA/KY/TN/WV/NC
-- headline gaps (goose/dove/turkey/bear). Filled 2026-08-18/19 from official
-- sources (MDIFW 2026-27 PDF, NH digest rules, VT 2026 season sheet, ODNR
-- chart, MI NRC memo + regs pages, WI season sheet, PGC releases, KDFW
-- poster, TWRA summary, WVDNR 2026-27 summary PDF, NCWRC proclamations).
-- Matrix prune #4: MI dove (banned by 2006 referendum), WV elk (no open
-- season 2026-27), NH bobcat (closed since 1989).
-- NOTPUBLISHED follow-ups: ME fisher/marten (Sept lawbook), WV goose/duck
-- (booklet late Aug), OH/MI/WI spring turkey 2027, KY spring turkey formula
-- dates to confirm.

delete from public.state_species ss
using public.states st, public.species sp
where ss.state_id = st.id and ss.species_id = sp.id
  and ((st.code = 'MI' and sp.key = 'dove')
    or (st.code = 'WV' and sp.key = 'elk')
    or (st.code = 'NH' and sp.key = 'bobcat'));

insert into public.sources (agency_name, url, doc_type, state_id, notes, last_extracted_at)
select v.agency, v.url, (case when v.url like '%.pdf' then 'pdf' else 'webpage' end)::source_doc_type, s.id, 'Burn-down fill 2026-08-19 (batch K).', now()
from (values
  ('Maine Department of Inland Fisheries and Wildlife', 'https://www.maine.gov/ifw/docs/26-MDIFW-6-Hunting-Season-2026-27.pdf', 'ME'),
  ('New Hampshire Fish and Game Department', 'https://www.eregulations.com/newhampshire/hunting/furbearer-hunting-trapping-seasons', 'NH'),
  ('Vermont Fish & Wildlife Department', 'https://www.vtfishandwildlife.com/sites/fishandwildlife/files/documents/Seasons/2026-hunt-trap-dates.pdf.pdf', 'VT'),
  ('Ohio Department of Natural Resources', 'https://dam.assets.ohio.gov/image/upload/ohiodnr.gov/documents/wildlife/news/2026-27_Hunting_Seasons.pdf', 'OH'),
  ('Michigan Department of Natural Resources', 'https://www.michigan.gov/dnr/managing-resources/laws/regulations/fall-turkey', 'MI'),
  ('Wisconsin Department of Natural Resources', 'https://gowildagent.wi.gov/Documents/Season%20Sheet.pdf', 'WI'),
  ('Pennsylvania Game Commission', 'https://www.pa.gov/agencies/pgc/newsroom/2026-27-migratory-game-bird-season-set', 'PA'),
  ('Kentucky Department of Fish and Wildlife Resources', 'https://fw.ky.gov/Hunt/Documents/Hunting_Poster.pdf', 'KY'),
  ('Tennessee Wildlife Resources Agency', 'https://www.tn.gov/twra/hunting/tennessee-hunting-seasons-summary.html', 'TN'),
  ('West Virginia Division of Natural Resources', 'https://wvdnr.gov/wp-content/uploads/2026/07/Pub_Regs_HuntTrap_202627_DNR_WILD_20260724.pdf', 'WV'),
  ('North Carolina Wildlife Resources Commission', 'https://www.ncwildlife.gov/media/5176/download?attachment=', 'NC')
) as v(agency, url, code)
join public.states s on s.code = v.code
where not exists (select 1 from public.sources x where x.url = v.url and x.notes = 'Burn-down fill 2026-08-19 (batch K).');

insert into public.zones (state_id, name)
select s.id, v.zone
from (values
  ('ME','WMDs 1-6'),('ME','WMDs 7-29'),
  ('OH','Goose Zone A'),('OH','Goose Zones B & C'),('OH','Open Counties (70)'),
  ('MI','North Goose Zone'),('MI','Middle Goose Zone'),('MI','South Goose Zone'),('MI','TMUs I & M'),
  ('WI','Northern Goose Zone'),('WI','Southern Goose Zone'),('WI','Mississippi River Zone'),
  ('PA','RP Zone'),('PA','AP Zone'),('PA','Fall Turkey WMUs'),
  ('KY','Western Zone'),('KY','Eastern Zone'),
  ('TN','All Bear Zones'),('TN','BHZ 1-4'),('TN','BHZ 1-3'),('TN','BHZ 1'),('TN','BHZ 2'),('TN','BHZ 3'),('TN','BHZ 4'),
  ('WV','Fall Turkey Counties'),
  ('NC','Resident Population Zone'),('NC','Northeast Hunt Zone')
) as v(code, zone)
join public.states s on s.code = v.code
where not exists (select 1 from public.zones z where z.state_id = s.id and z.name = v.zone);

with rows_to_add (state_code, species_key, zone_name, label, open_date, close_date, bag, notes) as (
  values
  -- MAINE
  ('ME','snipe','Statewide',null, date '2026-09-01', date '2027-01-02', '8 per day.', 'No Sunday hunting in Maine.'),
  ('ME','coyote','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Night season Dec 16 – Aug 31 with permit.'),
  ('ME','crow','WMDs 1-6','Split Season', date '2026-08-01', date '2027-04-15',
   'No limit.', 'Segments Aug 1 – Sep 19 and Jan 30 – Apr 15.'),
  ('ME','crow','WMDs 7-29','Split Season', date '2026-08-01', date '2027-03-31',
   'No limit.', 'Segments Aug 1 – Sep 19 and Jan 15 – Mar 31.'),
  ('ME','fox','Statewide',null, date '2026-10-19', date '2027-02-27', 'No limit.', null),
  ('ME','raccoon','Statewide',null, date '2026-10-01', date '2026-12-31', 'No limit.', null),
  ('ME','bobcat','Statewide',null, date '2026-12-01', date '2027-02-20', 'No limit.', null),
  -- NEW HAMPSHIRE
  ('NH','fisher','Statewide','Trapping + Limited Hunting', date '2026-12-01', date '2026-12-31',
   '2 per season combined.', 'Trapping Dec 1 – 31; hunting Dec 1 – Jan 31. Registration within 24 hours.'),
  ('NH','snipe','Statewide',null, date '2026-09-15', date '2026-11-14', '8 per day.', 'HIP required.'),
  ('NH','coyote','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Night hunting only Jan 1 – Mar 31.'),
  ('NH','crow','Statewide','Split Season', date '2026-08-15', date '2027-03-31',
   'No limit.', 'Segments Aug 15 – Nov 30 and Mar 16 – 31.'),
  ('NH','fox','Statewide',null, date '2026-09-01', date '2027-03-31', 'No limit.', 'Registration required.'),
  ('NH','raccoon','Statewide',null, date '2026-09-01', date '2027-03-31', 'No limit.', null),
  -- VERMONT
  ('VT','fisher','Statewide','Trapping Only', date '2026-12-01', date '2026-12-31',
   null, 'Fisher hunting has no open season in Vermont.'),
  ('VT','rabbit','Statewide','Hare & Rabbit Season', date '2026-09-26', date '2027-03-14',
   null, 'Combined season with snowshoe hare; WMUs D & E open through Mar 31.'),
  ('VT','coyote','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Hunting with dogs restricted to Dec 15 – Mar 15 by permit; competitions illegal.'),
  ('VT','crow','Statewide','Fall Segment (Fri – Mon only)', date '2026-08-21', date '2026-12-18',
   null, 'Winter/spring segment ~mid-Jan to mid-Apr (2027 sheet pending).'),
  ('VT','fox','Statewide',null, date '2026-10-24', date '2027-02-14',
   null, 'Trapping Oct 24 – Dec 31.'),
  ('VT','raccoon','Statewide',null, date '2026-10-10', date '2026-12-31',
   null, 'Trapping Oct 24 – Dec 31.'),
  ('VT','bobcat','Statewide','Hunting Season', date '2027-01-10', date '2027-02-07',
   null, 'Trapping Dec 1 – 16.'),
  -- OHIO birds/turkey
  ('OH','dove','Statewide','Two Segments', date '2026-09-01', date '2027-01-01',
   '15 per day.', 'Segments Sep 1 – Nov 8 and Dec 12 – Jan 1.'),
  ('OH','goose','Statewide','Early Canada Goose', date '2026-09-05', date '2026-09-13', '5 per day.', null),
  ('OH','goose','Goose Zone A','Regular Season', date '2026-10-17', date '2027-02-01',
   '5 dark per day.', 'Segments Oct 17 – Nov 1 and Nov 14 – Feb 1. Light geese 10/day.'),
  ('OH','goose','Goose Zones B & C','Regular Season', date '2026-10-17', date '2027-02-15',
   '5 dark per day.', 'Segments Oct 17 – 25 and Nov 21 – Feb 15.'),
  ('OH','turkey','Open Counties (70)','Fall Turkey', date '2026-10-01', date '2026-10-25',
   '1 per season, either sex.', 'Spring 2027 dates announced at the winter council meeting.'),
  -- MICHIGAN goose/turkey
  ('MI','goose','North Goose Zone',null, date '2026-09-01', date '2026-12-16',
   '5 dark per day.', 'Light geese 20/day.'),
  ('MI','goose','Middle Goose Zone','Two Segments', date '2026-09-01', date '2026-12-18',
   '5 dark per day.', 'Segments Sep 1 – 30 and Oct 3 – Dec 18.'),
  ('MI','goose','South Goose Zone','Four Segments', date '2026-09-01', date '2027-02-15',
   '5 dark per day.', 'Segments Sep 1 – 30, Oct 17 – Dec 13, Dec 26 – Jan 3, Feb 6 – 15.'),
  ('MI','turkey','TMUs I & M','Fall Turkey', date '2026-09-15', date '2026-11-14',
   '1 per season, either sex.', 'TMU I unlimited licenses; TMU M quota. Spring 2027 drawing runs Jan – Feb.'),
  -- WISCONSIN goose/dove/turkey
  ('WI','goose','Statewide','Early Canada Goose', date '2026-09-01', date '2026-09-15', '5 per day.', null),
  ('WI','goose','Northern Goose Zone','Regular Season', date '2026-09-16', date '2026-12-16',
   '3 per day.', 'Permit required.'),
  ('WI','goose','Southern Goose Zone','Regular + Holiday Hunt', date '2026-09-16', date '2027-01-02',
   '3 per day.', 'Segments Sep 16 – Oct 11 and Oct 17 – Dec 6; holiday hunt Dec 19 – Jan 2 (5/day).'),
  ('WI','goose','Mississippi River Zone','Two Segments', date '2026-10-03', date '2027-01-05',
   '3 per day.', 'Segments Oct 3 – 11 and Oct 17 – Jan 5.'),
  ('WI','dove','Statewide',null, date '2026-09-01', date '2026-11-29', '15 per day.', null),
  ('WI','turkey','Statewide','Fall Turkey', date '2026-09-12', date '2027-01-03',
   '1 per harvest authorization.', 'Zone-specific authorizations. Spring 2027 application deadline Dec 10.'),
  -- PENNSYLVANIA dove/goose/turkey
  ('PA','dove','Statewide','Two Segments', date '2026-09-01', date '2027-01-02',
   '15 per day.', 'Segments Sep 1 – Nov 27 and Dec 18 – Jan 2. No Sunday migratory bird hunting 2026-27.'),
  ('PA','goose','Statewide','Early Canada Goose (both zones)', date '2026-09-01', date '2026-09-25', '8 per day.', null),
  ('PA','goose','RP Zone','Regular Season', date '2026-10-24', date '2027-02-20',
   '5 per day.', 'Segments Oct 24 – Nov 27, Dec 15 – Jan 18, Jan 29 – Feb 20.'),
  ('PA','goose','AP Zone','Regular Season', date '2026-11-21', date '2027-01-18',
   '3 per day.', 'Expanded to 45 days/3 per day for 2026-27. Segments Nov 21 – 27 and Dec 4 – Jan 18.'),
  ('PA','turkey','Fall Turkey WMUs','Fall Turkey (season length varies by WMU)', date '2026-10-31', date '2026-11-20',
   '1 per season, either sex.', 'Closes Nov 3 – 20 by WMU group; some groups reopen Nov 25 – 27. WMUs 5C/5D closed.'),
  ('PA','turkey','Statewide','Spring Gobbler 2027', date '2027-05-01', date '2027-05-31',
   '1 gobbler per season.', 'Bag reduced to 1; Sundays included from 2027. Youth day Apr 24 – 25. Half-day hours May 1 – 16.'),
  -- KENTUCKY goose/turkey
  ('KY','goose','Statewide','September Canada Goose (zoned)', date '2026-09-01', date '2026-09-30',
   '5 per day.', 'Western Zone Sep 1 – 15; Eastern Zone Sep 16 – 30.'),
  ('KY','goose','Statewide','Regular Season', date '2026-11-26', date '2027-02-15',
   'Canada 3 per day.', 'Light Goose Conservation Order Feb 16 – Mar 31. Confirm bags in the 2026-27 waterfowl guide.'),
  ('KY','turkey','Statewide','Fall Archery', date '2026-09-05', date '2027-01-18',
   '2 per fall combined.', 'Crossbow Oct 1 – 18 and Nov 14 – Dec 31; shotgun Oct 24 – 30 and Dec 5 – 11.'),
  ('KY','turkey','Statewide','Spring Season 2027', date '2027-04-17', date '2027-05-09',
   '2 bearded per season.', 'Dates per the statutory formula — confirm when KDFW posts. Youth weekend Apr 3 – 4.'),
  -- TENNESSEE goose/turkey/bear
  ('TN','goose','Statewide','September Canada Goose', date '2026-09-01', date '2026-09-20', '5 per day.', null),
  ('TN','goose','Statewide','Regular Season (segments)', date '2026-10-10', date '2027-02-14',
   'Canada 3 per day.', 'Segments Oct 10 – 22, Nov 28 – 29, Dec 5 – Feb 14. Light geese 20/day; conservation season Feb 15 – Mar 31.'),
  ('TN','turkey','Statewide','Fall Archery (two segments)', date '2026-09-26', date '2026-11-06',
   '1 male per fall.', 'Segments Sep 26 – Oct 30 and Nov 2 – 6. No bearded hens.'),
  ('TN','turkey','Statewide','Fall Shotgun/Archery', date '2026-10-17', date '2026-10-30',
   '1 male per fall.', 'Closed in 11 listed counties.'),
  ('TN','turkey','Statewide','Spring Season 2027', date '2027-04-03', date '2027-05-16',
   '2 per season, max 1 jake.', 'Opens a week earlier than prior years. Young Sportsman Mar 27 – 28.'),
  ('TN','bear','All Bear Zones','Archery (no dogs)', date '2026-09-26', date '2026-10-23',
   '1 per year, either sex.', null),
  ('TN','bear','BHZ 1-4','Young Sportsman', date '2026-10-31', date '2026-11-01',
   '1 per year.', 'BHZ5 same dates, private land only.'),
  ('TN','bear','BHZ 1-3','Gun (no dogs)', date '2026-11-21', date '2026-11-24',
   '1 per year.', 'Additional private-land no-dog hunt Dec 12 – 13.'),
  ('TN','bear','BHZ 1','Hound Seasons', date '2026-10-03', date '2026-12-16',
   '1 per year.', 'Segments: Oct 3 – 5, Oct 10 – 11, Nov 9 – 16, Nov 30 – Dec 16.'),
  ('TN','bear','BHZ 2','Hound Seasons', date '2026-10-03', date '2026-12-15',
   '1 per year.', 'Segments: Oct 3 – 18, Nov 2 – 6, Nov 30 – Dec 15.'),
  ('TN','bear','BHZ 3','Hound Seasons', date '2026-10-03', date '2027-01-03',
   '1 per year.', 'Segments: Oct 3 – 4, Oct 10 – 16, Nov 2 – 6, Nov 30 – Dec 13, Dec 31 – Jan 3.'),
  ('TN','bear','BHZ 4','Hound Season (private land)', date '2026-12-12', date '2026-12-13',
   '1 per year.', 'BHZ5 and Transitional Zone closed to hound hunting.'),
  -- WEST VIRGINIA dove/turkey
  ('WV','dove','Statewide','Three Segments', date '2026-09-01', date '2027-01-10',
   '15 per day.', 'Segments Sep 1 – Oct 11 (opening day noon – sunset), Nov 2 – 15, Dec 7 – Jan 10. Waterfowl booklet publishes late August.'),
  ('WV','turkey','Fall Turkey Counties','Fall Turkey (county groups)', date '2026-10-10', date '2026-11-15',
   '1 per season, either sex.', '25 counties Oct 10 – 18; 20 counties + Oct 26 – Nov 1; 14 counties + Oct 26 – Nov 15. Dogs legal in fall.'),
  ('WV','turkey','Statewide','Spring Gobbler 2027', date '2027-04-19', date '2027-05-23',
   '2 bearded per season, 1 per day.', 'Youth weekend Apr 17 – 18. Shooting until 1 p.m.'),
  -- NORTH CAROLINA dove/goose/turkey
  ('NC','dove','Statewide','Three Segments', date '2026-09-05', date '2027-01-30',
   '15 per day.', 'Segments Sep 5 – Oct 10, Nov 7 – 28, Dec 16 – Jan 30.'),
  ('NC','goose','Statewide','September Canada Goose', date '2026-09-01', date '2026-09-30',
   '15 per day.', 'West of US 17: extended hours, unplugged guns, electronic calls allowed.'),
  ('NC','goose','Resident Population Zone','Regular Season', date '2026-10-15', date '2027-02-06',
   '5 per day.', 'Segments Oct 15 – 24, Nov 7 – Dec 5, Dec 17 – Feb 6.'),
  ('NC','goose','Northeast Hunt Zone','Regular Season', date '2026-12-28', date '2027-01-30',
   '2 per day.', 'Light geese Nov 7 – Mar 10 (25/day).'),
  ('NC','turkey','Statewide','Spring Season 2027', date '2027-04-17', date '2027-05-15',
   '2 per season.', 'Male or bearded only. Youth weekend Apr 10 – 11. North Carolina has no fall turkey season.')
)
insert into public.seasons
  (state_id, species_id, zone_id, season_year, method, label, open_date, close_date,
   bag_limit_summary, notes, source_id, last_verified_at, status)
select st.id, sp.id, z.id, 2026, 'general'::season_method, r.label, r.open_date, r.close_date,
       r.bag, r.notes,
       (select id from public.sources so where so.state_id = st.id
          and so.notes = 'Burn-down fill 2026-08-19 (batch K).' limit 1),
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
