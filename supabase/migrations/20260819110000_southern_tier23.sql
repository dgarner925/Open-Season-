-- Coverage burn-down batch L: GA/KY/LA/MS/NC/SC/TN/VA/WV tier 2-3.
-- Filled 2026-08-19 from official sources (KDFWR 2026-27 poster, LDWF,
-- eRegulations MS/SC/NC/LA digests, TWRA, VA DWR, WVDNR 2026-27 PDF, GA DNR).
-- Matrix prune #5: KY wild-hog (hunting BANNED 2024), TN wild-hog (no public
-- season), SC nutria (no season), SC pheasant (no wild season).
-- LA fox pair KEPT: hunting prohibited but a trapping season exists.

delete from public.state_species ss
using public.states st, public.species sp
where ss.state_id = st.id and ss.species_id = sp.id
  and ((st.code in ('KY','TN') and sp.key = 'wild-hog')
    or (st.code = 'SC' and sp.key in ('nutria','pheasant')));

insert into public.sources (agency_name, url, doc_type, state_id, notes, last_extracted_at)
select v.agency, v.url, (case when v.url like '%.pdf' then 'pdf' else 'webpage' end)::source_doc_type, s.id, 'Burn-down fill 2026-08-19 (batch L).', now()
from (values
  ('Georgia DNR Wildlife Resources Division', 'https://georgiawildlife.com/laws-native-wildlife', 'GA'),
  ('Kentucky Department of Fish and Wildlife Resources', 'https://fw.ky.gov/Hunt/Documents/Hunting_Poster.pdf', 'KY'),
  ('Louisiana Department of Wildlife and Fisheries', 'https://www.wlf.louisiana.gov/page/furbearers', 'LA'),
  ('Mississippi Department of Wildlife, Fisheries, and Parks', 'https://www.eregulations.com/mississippi/hunting/hunting-regulations-requirements', 'MS'),
  ('North Carolina Wildlife Resources Commission', 'https://ncwildlife.gov/regulations/2026-2027-season-dates-glance/download?attachment=', 'NC'),
  ('South Carolina Department of Natural Resources', 'https://www.eregulations.com/southcarolina/hunting/small-game-seasons', 'SC'),
  ('Tennessee Wildlife Resources Agency', 'https://www.tn.gov/twra/hunting/tennessee-hunting-seasons-summary.html', 'TN'),
  ('Virginia Department of Wildlife Resources', 'https://dwr.virginia.gov/hunting/regulations/furbearerhunting/', 'VA'),
  ('West Virginia Division of Natural Resources', 'https://wvdnr.gov/wp-content/uploads/2026/06/Pub_Regs_HuntTrap_202627_DNR_WILD_20260629.pdf', 'WV')
) as v(agency, url, code)
join public.states s on s.code = v.code
where not exists (select 1 from public.sources x where x.url = v.url and x.notes = 'Burn-down fill 2026-08-19 (batch L).');

insert into public.zones (state_id, name)
select s.id, v.zone
from (values
  ('KY','Grouse Zone'),('KY','Eastern Small Game Zone'),('KY','Western Small Game Zone'),
  ('VA','West of I-95'),
  ('WV','Boar Counties')
) as v(code, zone)
join public.states s on s.code = v.code
where not exists (select 1 from public.zones z where z.state_id = s.id and z.name = v.zone);

with rows_to_add (state_code, species_key, zone_name, label, open_date, close_date, bag, notes) as (
  values
  -- GEORGIA
  ('GA','coyote','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Unprotected species; day or night on private land.'),
  ('GA','nutria','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Unprotected species.'),
  -- KENTUCKY
  ('KY','woodcock','Statewide','Split Season', date '2026-10-24', date '2026-12-09',
   '3 per day.', 'Segments Oct 24 – Nov 13 and Nov 16 – Dec 9. HIP required.'),
  ('KY','ruffed-grouse','Grouse Zone','Split Season', date '2026-11-01', date '2027-02-28',
   null, 'Grouse Zone only. Segments Nov 1 – 13 and Nov 16 – Feb 28.'),
  ('KY','bobwhite','Eastern Small Game Zone','Quail (split)', date '2026-11-01', date '2027-01-31',
   null, 'Segments Nov 1 – 13 and Nov 16 – Jan 31.'),
  ('KY','bobwhite','Western Small Game Zone','Quail', date '2026-11-16', date '2027-02-10', null, null),
  ('KY','rabbit','Eastern Small Game Zone','Split Season', date '2026-11-01', date '2027-01-31',
   null, 'Segments Nov 1 – 13 and Nov 16 – Jan 31.'),
  ('KY','rabbit','Western Small Game Zone',null, date '2026-11-16', date '2027-02-10', null, null),
  ('KY','squirrel','Statewide','Split Season', date '2026-08-15', date '2027-02-28',
   null, 'Segments Aug 15 – Nov 13 and Nov 16 – Feb 28.'),
  ('KY','snipe','Statewide','Split Season', date '2026-09-16', date '2027-01-31',
   '8 per day.', 'Segments Sep 16 – Oct 25 and Nov 26 – Jan 31.'),
  ('KY','coyote','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Night restrictions during spring turkey season.'),
  ('KY','crow','Statewide','Split Season', date '2026-09-01', date '2027-02-28',
   'No limit.', 'Segments Sep 1 – Nov 7 and Jan 4 – Feb 28.'),
  ('KY','fox','Statewide',null, date '2026-11-16', date '2027-02-28',
   'No limit.', 'Red and gray; daylight only. Trapping same dates.'),
  ('KY','raccoon','Statewide',null, date '2026-10-01', date '2027-02-28',
   null, 'Day or night with exceptions. Trapping Nov 16 – Feb 28.'),
  ('KY','bobcat','Statewide',null, date '2026-11-21', date '2027-02-28',
   null, 'Daylight only; season limit per KDFWR guide.'),
  -- LOUISIANA
  ('LA','wild-hog','Statewide','Year-round (outlaw quadruped)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Daylight year-round for licensed hunters; night year-round on private land with conditions.'),
  ('LA','nutria','Statewide','Recreational Season', date '2026-09-01', date '2027-02-28',
   'No limit.', 'Some WMAs to Mar 31. Coastwide Nutria Control Program (incentive payments) runs Nov – Mar.'),
  ('LA','coyote','Statewide','Year-round (outlaw quadruped)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Dog restrictions during turkey and deer still-hunt segments.'),
  ('LA','crow','Statewide',null, date '2026-09-01', date '2027-01-01', 'No limit.', null),
  ('LA','fox','Statewide','Trapping Only', date '2026-11-20', date '2027-03-31',
   'No limit.', 'Fox HUNTING is prohibited in Louisiana (protected quadruped; chase-only allowed). Licensed trappers only.'),
  ('LA','raccoon','Statewide','Year-round', date '2026-07-01', date '2027-06-30',
   '2 per day or night.', 'Night hunting legal on private land (.22 rimfire or smaller).'),
  ('LA','bobcat','Statewide','Experimental Year-round Season', date '2026-07-01', date '2027-06-30',
   '1 per calendar year.', 'Legal shooting hours; different rules on WMAs/federal lands.'),
  -- MISSISSIPPI
  ('MS','wild-hog','Statewide','Year-round (nuisance)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Night hunting allowed except during spring turkey season.'),
  ('MS','nutria','Statewide','Year-round (nuisance)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Also trappable Nov 1 – Mar 15.'),
  ('MS','coyote','Statewide','Year-round (nuisance)', date '2026-07-01', date '2027-06-30', 'No limit.', null),
  ('MS','crow','Statewide',null, date '2026-11-07', date '2027-02-28', 'No limit.', null),
  ('MS','fox','Statewide','Year-round (nuisance)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Also trappable Nov 1 – Mar 15.'),
  ('MS','raccoon','Statewide','Food/Sport/Pelt Season', date '2026-11-01', date '2027-03-15',
   'No limit.', 'Early segments: Jul – Sep (1/party/night) and October (5/day).'),
  ('MS','bobcat','Statewide','Food/Sport/Pelt Season', date '2026-11-01', date '2027-03-15',
   'No limit.', 'October segment also open. CITES tag to export.'),
  -- NORTH CAROLINA
  ('NC','woodcock','Statewide',null, date '2026-12-10', date '2027-01-30',
   '3 per day.', 'No Sunday migratory-bird hunting in NC.'),
  ('NC','ruffed-grouse','Statewide',null, date '2026-10-12', date '2027-02-28', null, null),
  ('NC','bobwhite','Statewide','Quail', date '2026-11-21', date '2027-02-28', null, null),
  ('NC','wild-hog','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Private land; night with lights legal; trapping year-round with free permit.'),
  ('NC','nutria','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30', 'No limit.', null),
  ('NC','rabbit','Statewide',null, date '2026-10-12', date '2027-02-28', null, null),
  ('NC','squirrel','Statewide','Gray & Red', date '2026-10-12', date '2027-02-28',
   null, 'Gray spring season May 17 – 31. Fox squirrel closes Jan 31.'),
  ('NC','snipe','Statewide',null, date '2026-10-27', date '2027-02-27', '8 per day.', null),
  ('NC','coyote','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Night with lights except five listed coastal counties (permit + reporting there).'),
  ('NC','crow','Statewide','Wed/Fri/Sat + holidays only', date '2026-08-01', date '2027-02-27',
   'No limit.', 'Summer 2027 segment Jun 2 – Jul 31.'),
  ('NC','fox','Statewide','County-specific Seasons', date '2026-10-01', date '2027-02-28',
   'Varies by county.', 'NC fox seasons are set county-by-county — see ncwildlife.gov/foxseasons.'),
  ('NC','raccoon','Statewide',null, date '2026-10-12', date '2027-02-28', null, 'Trapping Oct 1 – Feb 28.'),
  ('NC','bobcat','Statewide',null, date '2026-10-12', date '2027-02-28', null, 'Trapping Oct 1 – Feb 28.'),
  -- SOUTH CAROLINA
  ('SC','woodcock','Statewide',null, date '2026-12-18', date '2027-01-31', '3 per day.', null),
  ('SC','snipe','Statewide',null, date '2026-11-14', date '2027-02-28', '8 per day.', null),
  ('SC','wild-hog','Statewide','Year-round on private land', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Night hunting only on property registered annually at dnr.sc.gov/nighthunt.'),
  ('SC','coyote','Statewide','Year-round on private land', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Night requires property registration. Trapping Dec 1 – Mar 1.'),
  ('SC','crow','Statewide',null, date '2026-11-01', date '2027-03-01', 'No limit.', null),
  ('SC','fox','Statewide','Thanksgiving – Mar 1', date '2026-11-26', date '2027-03-01',
   'No limit.', 'Statutory season on private land; trapping in the same window.'),
  ('SC','raccoon','Statewide','Guns & Dogs', date '2026-09-15', date '2027-03-15',
   '3 per party per day.', 'Dogs-only chase the rest of the year.'),
  ('SC','bobcat','Statewide','Thanksgiving – Mar 1', date '2026-11-26', date '2027-03-01', null, null),
  -- TENNESSEE
  ('TN','woodcock','Statewide','Split Season', date '2026-11-14', date '2027-01-31',
   '3 per day.', 'Segments Nov 14 – Dec 6 and Jan 10 – 31. Migratory Bird Permit required.'),
  ('TN','ruffed-grouse','Statewide',null, date '2026-10-10', date '2027-02-28', '3 per day.', null),
  ('TN','rabbit','Statewide',null, date '2026-11-07', date '2027-02-28', '5 per day.', null),
  ('TN','snipe','Statewide',null, date '2026-11-14', date '2027-02-28', '8 per day.', null),
  ('TN','coyote','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Designated night season in summer.'),
  ('TN','crow','Statewide',null, date '2026-09-11', date '2026-12-20',
   'No limit.', 'Additional early-September and summer weekend segments.'),
  ('TN','fox','Statewide',null, date '2026-11-20', date '2027-02-28', 'No limit.', 'Trapping same dates.'),
  ('TN','raccoon','Statewide',null, date '2026-09-18', date '2027-03-15',
   '4 per day.', 'Opens at sunset Sep 18. Year-round on private lands; trapping year-round.'),
  ('TN','bobcat','Statewide',null, date '2026-11-20', date '2027-02-28',
   '1 per day.', 'Private-lands early segment Sep 26 – Nov 19; night hunting permitted.'),
  -- VIRGINIA
  ('VA','woodcock','Statewide','Split Season', date '2026-11-11', date '2027-01-18',
   '3 per day.', 'Segments Nov 11 – Dec 1 and Dec 26 – Jan 18. HIP required.'),
  ('VA','snipe','Statewide','Split Season', date '2026-09-28', date '2027-01-31',
   '8 per day.', 'Segments Sep 28 – Nov 29 and Dec 19 – Jan 31.'),
  ('VA','ruffed-grouse','West of I-95',null, date '2026-10-24', date '2027-02-13',
   '3 per day.', 'Closed east of I-95.'),
  ('VA','wild-hog','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Night and over bait legal; license required.'),
  ('VA','nutria','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Eradication in progress — DWR encourages sighting reports.'),
  ('VA','pheasant','Statewide',null, date '2026-11-07', date '2027-01-31', null, null),
  ('VA','coyote','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Restrictions on National Forest and DWR lands.'),
  ('VA','crow','Statewide','Mon/Wed/Fri/Sat only', date '2026-08-15', date '2027-03-19', 'No limit.', null),
  ('VA','fox','Statewide','Red Fox Firearms', date '2026-11-01', date '2027-02-28',
   null, 'Gray fox: Jan 1 – Feb 28 only. County exceptions exist; continuous chase-only seasons.'),
  ('VA','raccoon','Statewide',null, date '2026-10-15', date '2027-03-10',
   '2 per hunter/party (noon-to-noon).', null),
  ('VA','bobcat','Statewide','Firearms Season', date '2026-11-01', date '2027-02-28',
   '2 per party (noon-to-noon).', 'Archery segment Oct 3 – 31.'),
  -- WEST VIRGINIA
  ('WV','woodcock','Statewide','Split Season', date '2026-10-17', date '2026-12-08',
   '3 per day.', 'Segments Oct 17 – Nov 21 and Nov 30 – Dec 8. Verify in the migratory brochure when posted.'),
  ('WV','snipe','Statewide',null, date '2026-09-01', date '2026-12-16', '8 per day.', null),
  ('WV','ruffed-grouse','Statewide',null, date '2026-10-17', date '2027-02-28', '4 per day.', null),
  ('WV','bobwhite','Statewide','Quail', date '2026-11-07', date '2027-01-02',
   '3 per day.', 'Closed on Tomblin WMA only.'),
  ('WV','wild-hog','Boar Counties','Wild Boar Firearms (splits)', date '2026-10-24', date '2026-10-31',
   '1 per year.', 'Boone, Logan, Raleigh & Wyoming counties only. Second split Feb 5 – 7. E-registration required.'),
  ('WV','wild-hog','Boar Counties','Wild Boar Archery/Crossbow', date '2026-09-26', date '2026-12-31',
   '1 per year.', 'Plus Feb 5 – 7 split.'),
  ('WV','rabbit','Statewide',null, date '2026-11-07', date '2027-02-28', '5 per day.', null),
  ('WV','squirrel','Statewide',null, date '2026-09-12', date '2027-02-28',
   '6 per day.', 'Youth weekend Sep 5 – 6.'),
  ('WV','coyote','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Night with artificial light/night vision permitted.'),
  ('WV','crow','Statewide','Split Season', date '2026-10-01', date '2027-03-06',
   'No limit.', 'Segments Oct 1 – Nov 21 and Jan 1 – Mar 6. Nuisance crows any time.'),
  ('WV','fox','Statewide','Hunting & Trapping', date '2026-11-07', date '2027-02-28',
   'No limit.', 'Night hunting with light Jan 1 – Feb 28 only.'),
  ('WV','raccoon','Statewide',null, date '2026-10-17', date '2027-02-28',
   '4 per 24 hours.', 'Trapping Nov 7 – Feb 28.'),
  ('WV','bobcat','Statewide','Hunting & Trapping', date '2026-11-07', date '2027-02-28',
   '3 per season.', 'E-registration of pelts required.')
)
insert into public.seasons
  (state_id, species_id, zone_id, season_year, method, label, open_date, close_date,
   bag_limit_summary, notes, source_id, last_verified_at, status)
select st.id, sp.id, z.id, 2026, 'general'::season_method, r.label, r.open_date, r.close_date,
       r.bag, r.notes,
       (select id from public.sources so where so.state_id = st.id
          and so.notes = 'Burn-down fill 2026-08-19 (batch L).' limit 1),
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
