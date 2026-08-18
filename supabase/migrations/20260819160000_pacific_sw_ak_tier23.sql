-- Coverage burn-down batch Q: Pacific/Southwest/Alaska tier 2-3
-- (WA/OR/CA/AZ/NM/AK), from official regs (WAC 220-416/417, ODFW/eregs,
-- CDFW + 14 CCR, AZGFD 2026-27 regs PDF, NMAC + NM migratory supplement,
-- ADFG 2026-27 PDFs). Also fixes the batch-P KS prairie-chicken zone bug.
-- Matrix prune #9: CA mountain-lion (Prop 117 ban), CA bobcat (AB 1254 ban),
-- AK bobcat (species not present), WA squirrel (western gray endangered; no
-- game season), OR sharptail-grouse (no season), OR crow + NM crow (no sport
-- season; depredation-order only).
-- Flags: AZ snipe dates medium-confidence (waterfowl PDF 404'd — recheck);
-- OR furbearer dates from the 2024-26 booklet (2026-28 expected same).

delete from public.state_species ss
using public.states st, public.species sp
where ss.state_id = st.id and ss.species_id = sp.id
  and ((st.code = 'CA' and sp.key in ('mountain-lion','bobcat'))
    or (st.code = 'AK' and sp.key = 'bobcat')
    or (st.code = 'WA' and sp.key = 'squirrel')
    or (st.code = 'OR' and sp.key in ('sharptail-grouse','crow'))
    or (st.code = 'NM' and sp.key = 'crow'));

insert into public.sources (agency_name, url, doc_type, state_id, notes, last_extracted_at)
select v.agency, v.url, (case when v.url like '%.pdf' then 'pdf' else 'webpage' end)::source_doc_type, s.id, 'Burn-down fill 2026-08-19 (batch Q).', now()
from (values
  ('Washington Department of Fish & Wildlife', 'https://www.law.cornell.edu/regulations/washington/WAC-220-416-010', 'WA'),
  ('Oregon Department of Fish & Wildlife', 'https://www.eregulations.com/oregon/hunting/game-bird/game-bird-seasons', 'OR'),
  ('California Department of Fish & Wildlife', 'https://wildlife.ca.gov/Hunting/Upland-Game-Birds', 'CA'),
  ('Arizona Game & Fish Department', 'https://azgfd-portal-wordpress-pantheon.s3.us-west-2.amazonaws.com/wp-content/uploads/2026/05/04081122/2026-27-Arizona-Hunting-Regulations.pdf', 'AZ'),
  ('New Mexico Department of Game & Fish', 'https://wildlife.dgf.nm.gov/download/2026-2027-new-mexico-migratory-game-bird-hunting-rules-and-info/?wpdmdl=55779', 'NM'),
  ('Alaska Department of Fish & Game', 'https://www.adfg.alaska.gov/static/regulations/wildliferegulations/pdfs/smgame.pdf', 'AK')
) as v(agency, url, code)
join public.states s on s.code = v.code
where not exists (select 1 from public.sources x where x.url = v.url and x.notes = 'Burn-down fill 2026-08-19 (batch Q).');

insert into public.zones (state_id, name)
select s.id, v.zone
from (values
  ('WA','Draw Units'), ('WA','Eastern Washington'), ('WA','Western Washington'),
  ('OR','Draw Units'), ('OR','East of I-5'), ('OR','Western Oregon'),
  ('OR','Zone 1 (Western Oregon)'), ('OR','Zone 2 (Eastern Oregon)'),
  ('CA','Desert Zones'), ('CA','North Zone'), ('CA','South Zone'),
  ('AZ','Draw Units'), ('AZ','Units 28-32'), ('AZ','Northern Units'),
  ('NM','Draw Units'), ('NM','Regular Season Area'),
  ('NM','Central Flyway Zones'), ('NM','Pacific Flyway Zones'),
  ('AK','Draw Hunts'), ('AK','Units 1-9 & 15'),
  ('KS','East Unit (Greater Prairie-Chicken)')
) as v(code, zone)
join public.states s on s.code = v.code
where not exists (select 1 from public.zones z where z.state_id = s.id and z.name = v.zone);

with rows_to_add (state_code, species_key, zone_name, label, open_date, close_date, bag, notes) as (
  values
  -- WASHINGTON
  ('WA','bighorn-sheep','Draw Units','Special Permit (draw)', date '2026-09-15', date '2026-11-15',
   '1 ram.', 'Draw only; dates vary by unit; once-in-a-lifetime.'),
  ('WA','mountain-goat','Draw Units','Special Permit (draw)', date '2026-09-01', date '2026-11-30',
   '1 goat.', 'Draw only; dates vary by unit; once-in-a-lifetime.'),
  ('WA','mountain-lion','Statewide','General Cougar Season', date '2026-09-01', date '2027-03-31',
   '1 per license year.', 'Areas close early when the harvest guideline is met — check WDFW before hunting.'),
  ('WA','gray-partridge','Eastern Washington',null, date '2026-10-03', date '2027-01-18', '6 per day.', null),
  ('WA','chukar','Eastern Washington',null, date '2026-10-03', date '2027-01-31', '6 per day.', null),
  ('WA','snowshoe-hare','Statewide',null, date '2026-09-01', date '2027-03-15',
   '5 per day with cottontail.', null),
  ('WA','marten','Statewide','Trapping Only', date '2026-11-01', date '2027-03-31',
   'No limit.', 'Closed in Clallam, Jefferson, Mason and Grays Harbor counties; live-restraint traps only.'),
  ('WA','spruce-grouse','Statewide','Forest Grouse (aggregate)', date '2026-09-15', date '2027-01-15',
   '4 per day total, max 3 spruce.', 'Aggregate with dusky, sooty and ruffed grouse.'),
  ('WA','band-tailed-pigeon','Western Washington','Permit Season', date '2026-09-15', date '2026-09-23',
   '2 per day.', 'Free special permit and harvest record card required.'),
  ('WA','nutria','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Unclassified invasive wildlife; hunting or trapping license required.'),
  ('WA','snipe','Statewide','Split Season', date '2026-10-17', date '2027-01-31',
   '8 per day.', 'Segments Oct 17 – 25 and Oct 28 – Jan 31.'),
  ('WA','coyote','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30', 'No limit.', null),
  ('WA','crow','Statewide',null, date '2026-09-01', date '2026-12-31', 'No limit.', null),
  ('WA','fox','Statewide',null, date '2026-09-01', date '2027-03-15',
   'No limit.', 'Trapping Nov 1 – Mar 31.'),
  ('WA','raccoon','Statewide',null, date '2026-09-01', date '2027-03-15',
   'No limit.', 'No hound hunting during modern-firearm deer/elk seasons; trapping Nov 1 – Mar 31.'),
  ('WA','bobcat','Statewide',null, date '2026-09-01', date '2027-03-15',
   'No limit.', 'Trapping Nov 1 – Mar 31.'),
  -- OREGON
  ('OR','bighorn-sheep','Draw Units','Controlled Hunt (draw)', date '2026-08-15', date '2026-10-31',
   '1 ram.', 'Draw only; dates vary by unit; once-in-a-lifetime.'),
  ('OR','mountain-goat','Draw Units','Controlled Hunt (draw)', date '2026-08-01', date '2026-10-31',
   '1 goat.', 'Draw only; dates vary by unit; once-in-a-lifetime.'),
  ('OR','mountain-lion','Statewide','Year-round (zone quotas)', date '2026-07-01', date '2027-06-30',
   '1 per tag.', 'Calendar-year season; zones close when quota is met.'),
  ('OR','ruffed-grouse','Statewide',null, date '2026-09-01', date '2027-01-31',
   '3 per day.', 'Blue (dusky) grouse same dates, separate limit.'),
  ('OR','snowshoe-hare','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Hunting license required.'),
  ('OR','gray-partridge','Statewide',null, date '2026-10-10', date '2027-01-31',
   '8 per day with chukar.', null),
  ('OR','chukar','Statewide',null, date '2026-10-10', date '2027-01-31',
   '8 per day with gray partridge.', 'Lower Klamath Hills special limit 2 per day.'),
  ('OR','marten','East of I-5','Trapping Only', date '2026-11-01', date '2027-01-31',
   'No limit.', 'From the 2024-26 booklet — confirm in the 2026-28 furbearer regs.'),
  ('OR','band-tailed-pigeon','Statewide','Permit Season', date '2026-09-15', date '2026-09-23',
   '2 per day.', 'Free band-tailed pigeon permit required.'),
  ('OR','western-quail','Western Oregon','California & Mountain Quail', date '2026-09-01', date '2027-01-31',
   '10 per day combined.', 'Eastern Oregon opens Oct 10 with a 2-mountain-quail sub-limit.'),
  ('OR','pheasant','Statewide',null, date '2026-10-10', date '2026-12-31', '2 roosters per day.', null),
  ('OR','rabbit','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Cottontail and jackrabbit.'),
  ('OR','squirrel','Statewide','Western Gray Squirrel', date '2026-09-01', date '2026-11-15',
   '5 per day.', 'North-central units 34/35/39/41/42: Sep 15 – Oct 31, 3 per day.'),
  ('OR','nutria','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Unprotected mammal.'),
  ('OR','snipe','Zone 2 (Eastern Oregon)',null, date '2026-10-10', date '2027-01-24', '8 per day.', null),
  ('OR','snipe','Zone 1 (Western Oregon)',null, date '2026-11-07', date '2027-02-21', '8 per day.', null),
  ('OR','coyote','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Unprotected mammal.'),
  ('OR','fox','Statewide','Furbearer Season', date '2026-10-15', date '2027-02-28',
   'No limit.', 'Red fox closed within 15 miles of the PCT (Sierra Nevada red fox); furbearer license required.'),
  ('OR','raccoon','Statewide','Furbearer Season', date '2026-11-15', date '2027-03-15',
   'No limit.', 'Hunting and trapping; furbearer license required.'),
  ('OR','bobcat','Statewide','Furbearer Season', date '2026-12-01', date '2027-02-28',
   'West: no limit; East: 5 per season.', 'Bobcat record card required.'),
  -- CALIFORNIA
  ('CA','bighorn-sheep','Desert Zones','Tag Hunt (draw)', date '2026-12-05', date '2027-02-01',
   '1 ram.', 'Draw only; dates vary by zone (some zones hunt Aug – Sep); once-in-a-lifetime.'),
  ('CA','chukar','Statewide',null, date '2026-10-17', date '2027-01-31',
   '6 per day.', 'Nonlead ammunition required.'),
  ('CA','band-tailed-pigeon','North Zone',null, date '2026-09-19', date '2026-09-27', '2 per day.', null),
  ('CA','band-tailed-pigeon','South Zone',null, date '2026-12-19', date '2026-12-27', '2 per day.', null),
  ('CA','pheasant','Statewide',null, date '2026-11-14', date '2026-12-27',
   '2 males per day (3 after day 2).', null),
  ('CA','snowshoe-hare','Statewide','Rabbit & Varying Hare Season', date '2026-07-01', date '2027-01-31',
   '5 per day aggregate.', 'Aggregate with brush and cottontail rabbits.'),
  ('CA','snipe','Statewide',null, date '2026-10-17', date '2027-01-31',
   '8 per day.', 'HIP validation required.'),
  ('CA','coyote','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Nongame mammal.'),
  ('CA','crow','Statewide',null, date '2026-12-05', date '2027-04-07',
   '24 per day.', 'Shotgun, archery or falconry only; nonlead shot; closure area in northwest CA.'),
  ('CA','fox','Statewide','Gray Fox Season', date '2026-11-24', date '2027-02-28',
   'No limit.', 'Gray fox only — red fox protected; recreational trapping banned statewide.'),
  ('CA','raccoon','Statewide',null, date '2026-11-16', date '2027-03-31',
   'No limit.', 'Longer season in parts of the southern desert region.'),
  -- ARIZONA
  ('AZ','bighorn-sheep','Draw Units','Permit Hunt (draw)', date '2026-12-01', date '2026-12-31',
   '1 ram.', 'Draw only; some hunts open as early as Oct 1; once-in-a-lifetime.'),
  ('AZ','mountain-lion','Statewide','General Season (OTC tag)', date '2026-08-21', date '2027-05-31',
   '1 per calendar year.', 'Zone harvest thresholds — check unit status before hunting; mandatory 48-hour reporting.'),
  ('AZ','sandhill-crane','Units 28-32','Draw-only 3-day Hunts', date '2026-11-13', date '2027-01-25',
   '3 per hunt.', 'Series of 3-day hunts Nov 13 – Dec 20 and Jan 9 – 25.'),
  ('AZ','chukar','Statewide',null, date '2026-09-01', date '2027-02-07', '5 per day.', null),
  ('AZ','band-tailed-pigeon','Statewide',null, date '2026-09-25', date '2026-10-08',
   '2 per day.', 'Migratory bird stamp required.'),
  ('AZ','bison','Draw Units','Permit Hunt (draw)', date '2026-07-31', date '2026-12-31',
   '1 bison.', 'Draw only; Raymond and House Rock herd hunts run Nov – Dec.'),
  ('AZ','ringtail','Statewide','Furbearer Season', date '2026-08-01', date '2027-03-31', 'No limit.', null),
  ('AZ','snipe','Statewide',null, date '2026-10-23', date '2027-01-31',
   '8 per day.', 'Migratory bird stamp required. Dates pending confirmation in the 2026-27 waterfowl booklet.'),
  ('AZ','coyote','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30', 'No limit.', null),
  ('AZ','crow','Northern Units',null, date '2026-09-01', date '2026-12-31',
   null, 'Open only in listed northern units — see Commission Order.'),
  ('AZ','fox','Statewide','Furbearer Season', date '2026-08-01', date '2027-03-31',
   'No limit.', 'All fox species.'),
  ('AZ','raccoon','Statewide',null, date '2026-08-01', date '2027-03-31',
   'No limit.', 'Day-long hours; pursuit-only with dogs outside the season.'),
  ('AZ','bobcat','Statewide','Furbearer Season', date '2026-08-01', date '2027-03-31',
   'No limit.', 'Export tag required to ship pelts out of state.'),
  -- NEW MEXICO
  ('NM','bighorn-sheep','Draw Units','Permit Hunt (draw)', date '2026-08-06', date '2027-01-31',
   '1 ram.', 'Draw only; Rocky Mountain hunts Aug – Nov, desert bighorn hunts Jan; once-in-a-lifetime.'),
  ('NM','mountain-lion','Statewide','License-Year Season', date '2026-04-01', date '2027-03-31',
   '2 per license year.', 'Zone harvest limits — zones close when met.'),
  ('NM','javelina','Statewide',null, date '2027-01-01', date '2027-03-31',
   '1 per license year.', 'Over-the-counter statewide except listed draw units.'),
  ('NM','band-tailed-pigeon','Regular Season Area','Permit Season', date '2026-09-01', date '2026-09-14',
   '2 per day.', 'Free permit required; southwest area runs Oct 1 – 14.'),
  ('NM','ringtail','Statewide','Furbearer Season', date '2026-11-01', date '2027-03-15',
   'No limit.', 'Furbearer license required.'),
  ('NM','rabbit','Statewide',null, date '2026-10-01', date '2027-02-28',
   '15 per day with jackrabbit.', null),
  ('NM','snipe','Central Flyway Zones',null, date '2026-10-10', date '2027-01-24', '8 per day.', null),
  ('NM','snipe','Pacific Flyway Zones',null, date '2026-10-17', date '2027-01-31',
   '8 per day.', 'West of the Continental Divide.'),
  ('NM','coyote','Statewide','Year-round (no closed season)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Unprotected furbearer.'),
  ('NM','fox','Statewide','Furbearer Season', date '2026-11-01', date '2027-03-15',
   'No limit.', 'Gray, red, kit and swift fox; furbearer license required.'),
  ('NM','raccoon','Statewide','Year-round (split seasons)', date '2026-07-01', date '2027-06-30',
   'No limit.', 'Method restrictions May 16 – Aug 31.'),
  ('NM','bobcat','Statewide','Furbearer Season', date '2026-11-01', date '2027-03-15',
   'No limit.', 'Pelt tagging required.'),
  -- ALASKA
  ('AK','sandhill-crane','Statewide','Southeast & Northern Zones', date '2026-09-01', date '2026-10-21',
   '2 per day (3 in Northern zone).', 'Gulf Coast zone Oct 1 – Nov 20; Kodiak and Pribilof/Aleutian Oct 8 – Nov 27; nontoxic shot required.'),
  ('AK','sharptail-grouse','Statewide','Grouse Aggregate (Interior units)', date '2026-08-10', date '2027-03-31',
   '15 per day aggregate.', 'Sub-limits in Unit 20D.'),
  ('AK','spruce-grouse','Statewide','Grouse Aggregate', date '2026-08-10', date '2027-03-31',
   '15 per day aggregate (5 in Southeast).', 'Southeast units 1-6 run Aug 1 – May 15; units 8 and 10 closed.'),
  ('AK','ruffed-grouse','Statewide','Grouse Aggregate', date '2026-08-10', date '2027-03-31',
   '15 per day aggregate.', 'Ruffed sub-limits of 1-2 per day in some Southcentral units.'),
  ('AK','snowshoe-hare','Statewide','Year-round (most units)', date '2026-07-01', date '2027-06-30',
   'No limit in most units.', 'Units 1-5 and 14C: Sep 1 – Apr 30, 5 per day; hide or meat must be salvaged.'),
  ('AK','marten','Statewide','Trapping Only', date '2026-11-01', date '2027-02-28',
   'No limit.', 'Dates vary by region (Southeast Dec 1 – Feb 15); sealing required.'),
  ('AK','wolf','Statewide','General Season (most units)', date '2026-08-10', date '2027-04-30',
   '5 per year (varies 1-10 by unit).', 'Hunting season — trapping seasons differ; check unit regs.'),
  ('AK','bison','Draw Hunts','Permit Hunt (draw)', date '2026-10-01', date '2027-03-31',
   '1 bison.', 'Draw only; Delta herd hunts use staggered assigned start dates.'),
  ('AK','muskox','Draw Hunts','Permit Hunt (draw)', date '2026-08-01', date '2027-03-31',
   '1 muskox.', 'Draw only; Nunivak fall hunt Aug 1 – Sep 30, winter hunts Jan – Mar.'),
  ('AK','wolverine','Statewide','General Season (most units)', date '2026-09-01', date '2027-03-31',
   '1 per year.', 'Hunting season — trapping seasons differ.'),
  ('AK','snipe','Statewide','Gulf Coast & Northern Zones', date '2026-09-01', date '2026-12-16',
   '8 per day.', 'Southeast units 1-4 split Sep 1 – Nov 30 and Dec 16 – 31; nontoxic shot required.'),
  ('AK','coyote','Statewide','Year-round (most units)', date '2026-07-01', date '2027-06-30',
   'No limit in most units.', 'Units 1-5, 18 and 22: Sep 1 – Apr 30, 2 per year.'),
  ('AK','crow','Units 1-9 & 15','Limited Season (split)', date '2026-09-01', date '2026-11-17',
   '5 per day.', 'Second segment Mar 1 – Apr 15; birds may be taken only for food or clothing use.'),
  -- KANSAS (batch P zone-bug fix)
  ('KS','prairie-chicken','East Unit (Greater Prairie-Chicken)',null, date '2026-09-15', date '2027-01-31',
   '2 per day.', 'Greater prairie-chicken only; Southwest Unit closed (lesser).')
)
insert into public.seasons
  (state_id, species_id, zone_id, season_year, method, label, open_date, close_date,
   bag_limit_summary, notes, source_id, last_verified_at, status)
select st.id, sp.id, z.id, 2026, 'general'::season_method, r.label, r.open_date, r.close_date,
       r.bag, r.notes,
       (select id from public.sources so where so.state_id = st.id
          and so.notes like 'Burn-down fill 2026-08-19 (batch %' limit 1),
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
