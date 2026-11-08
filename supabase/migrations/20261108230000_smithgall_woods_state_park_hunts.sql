-- 20261108230000_smithgall_woods_state_park_hunts.sql
-- Smithgall Woods State Park deer hunts, 2026-27.
--
-- WHY BY HAND
--   The app carries 9 Georgia deer seasons and not one is a state-park hunt:
--   zero park zones, zero permit hunts, nothing matching "smithgall". That is
--   a missing CATEGORY, not a gap in Georgia. Park hunts are a separate system
--   from the statewide and WMA dates the extractor reads, with their own
--   properties, sign-in rules and hunter caps. The coverage watchdog cannot
--   see the hole, because it counts state x species pairs and GA deer is fully
--   covered. This adds one property because David is hunting it; it does not
--   attempt the category.
--
-- TRANSCRIBED, NOT INFERRED
--   Archery     Buck Only: Sept. 12-13
--   Firearms    HC Buck Only: Oct. 9-11
--   Primitive   Buck Only: Nov. 11-14
--   Firearms    Buck Only: Nov. 25-28
--
--   "HC" is left unexpanded: the source prints it without a key, and guessing
--   would be a claim about who may hunt. "Primitive" maps to muzzleloader,
--   matching the existing statewide "Primitive Weapons" row.
--
-- DELIBERATELY NOT ADDED
--   * Bear. The source groups these under "Deer & Bear", but every hunt line
--     says "Buck Only", which is deer. Inventing a season from a section
--     heading is the exact failure that put span rows in this table before.
--   * Turkey (Q20: Apr 10-11, 24-25, May 8-9) and small game (Dec 3-5,
--     Jan 7-9, 28-31). Real, but season_year 2027 / reservation-only, and
--     outside "add this hunt".
--
-- THE PROPERTY NAME LIVES IN THE LABEL, NOT JUST THE ZONE
--   SeasonCard does not render zone at all (grep: no "zone" in the file). A
--   row labelled only "Primitive Weapons, Buck Only" would sit in every GA
--   deer follower's list looking statewide. So the label carries the property.
--
-- Source: https://www.eregulations.com/georgia/hunting/state-park-hunting-opportunities
-- The page never prints a season year; these dates fall Sat-Sun / Fri-Sun /
-- Wed-Sat only in 2026.

begin;

-- 1. Provenance. No existing Georgia source covers state-park hunts.
insert into sources (state_id, agency_name, url, doc_type, notes)
select
  (select id from states where code = 'GA'),
  'Georgia DNR / Georgia State Parks',
  'https://www.eregulations.com/georgia/hunting/state-park-hunting-opportunities',
  'webpage',
  'State park hunt schedules. Separate from the WMA and statewide regulations pages; not read by the extraction pipeline.'
where not exists (
  select 1 from sources
  where url = 'https://www.eregulations.com/georgia/hunting/state-park-hunting-opportunities'
);

-- 2. The property, as a zone. county_group matches the existing
--    "Baker, Decatur, ... Counties" and WMA rows -- named properties already
--    live that way, and zone_type has no park/property member. Nothing in the
--    app switches on zone.type, so this is a data convention, not behaviour.
insert into zones (state_id, type, name, notes)
select
  (select id from states where code = 'GA'),
  'county_group',
  'Smithgall Woods State Park (Dukes Creek)',
  'State park hunt property near Helen, GA. Sign-in required for all bear, deer and turkey hunts. Visitor center (706) 878-3087.'
where not exists (
  select 1 from zones
  where state_id = (select id from states where code = 'GA')
    and name = 'Smithgall Woods State Park (Dukes Creek)'
);

-- 3. The four deer hunts.
insert into seasons (
  state_id, species_id, zone_id, season_year, method, label,
  open_date, close_date, bag_limit_summary, notes, source_id,
  last_verified_at, status
)
select
  (select id from states where code = 'GA'),
  (select id from species where name = 'Deer'),
  (select id from zones
    where state_id = (select id from states where code = 'GA')
      and name = 'Smithgall Woods State Park (Dukes Creek)'),
  2026,
  h.method::season_method,
  h.label,
  h.open_date,
  h.close_date,
  'Buck only.',
  h.notes,
  (select id from sources
    where url = 'https://www.eregulations.com/georgia/hunting/state-park-hunting-opportunities'),
  now(),
  'published'
from (values
  ('archery',      'Smithgall Woods Archery, Buck Only',           date '2026-09-12', date '2026-09-13',
   'State park hunt, not statewide. Sign-in required. Source line: "Buck Only: Sept. 12-13".'),
  ('firearm',      'Smithgall Woods Firearms (HC), Buck Only',     date '2026-10-09', date '2026-10-11',
   'State park hunt, not statewide. Sign-in required. Source line: "HC Buck Only: Oct. 9-11"; "HC" is printed without a key on the source page.'),
  ('muzzleloader', 'Smithgall Woods Primitive Weapons, Buck Only', date '2026-11-11', date '2026-11-14',
   'State park hunt, not statewide. Sign-in required. Source line: "Buck Only: Nov. 11-14".'),
  ('firearm',      'Smithgall Woods Firearms, Buck Only',          date '2026-11-25', date '2026-11-28',
   'State park hunt, not statewide. Sign-in required. Source line: "Buck Only: Nov. 25-28".')
) as h(method, label, open_date, close_date, notes)
where not exists (
  select 1 from seasons s
  where s.zone_id = (select id from zones
                      where state_id = (select id from states where code = 'GA')
                        and name = 'Smithgall Woods State Park (Dukes Creek)')
    and s.open_date = h.open_date
    and s.method = h.method::season_method
);

-- 4. Suppress the opener pushes for the two future dates.
--
--    The season-opener body in notifications_due() is
--      format('%s %s (%s) opens %s', st.code, sp.name, s.method, ...)
--    state, species, method, date. It never names the zone. So a push for the
--    Nov 11 row reads "GA Deer (muzzleloader) opens Nov 11" to everyone
--    following GA + Deer, while statewide GA firearms deer has been open since
--    Oct 17 and runs to Jan 10. That is a false statewide opener.
--
--    14 premium GA+Deer followers hold a push token. No preference set
--    contains an offset of 3 or 17, so nothing fires today -- but the offsets
--    in use are {1,7,30,90,180,365}, and offset 1 matches on Nov 10, offset 7
--    on Nov 18, offset 1 again on Nov 24. Three wrong pushes without this.
--
--    Done through the system's own mechanism rather than a code change:
--    sent_notifications is the dedup guard, and status='suppressed' with
--    sent_at and hidden_at set is the existing convention (all 373 rows from
--    the 2026-10-31 backlog correction look exactly like this). Written for
--    every follower of the pair, not only the premium ones holding a token
--    today, so going premium before Nov 24 cannot reopen the hole.
insert into sent_notifications (
  user_id, subject_type, subject_id, offset_days, scheduled_for,
  sent_at, status, detail, hidden_at
)
select
  f.user_id,
  'season_opener'::notification_subject_type,
  s.id,
  off::smallint,
  s.open_date,
  now(),
  'suppressed',
  'smithgall woods 2026-11-08: one state-park property, and the opener push names only state, species and method, so it would read as a statewide GA deer opener while statewide firearms is already open',
  now()
from seasons s
join zones z on z.id = s.zone_id
join follows f on f.state_id = s.state_id and f.species_id = s.species_id
join alert_preferences ap on ap.follow_id = f.id
cross join lateral unnest(ap.opener_offsets) as off
where z.name = 'Smithgall Woods State Park (Dukes Creek)'
  and s.open_date > current_date
  and not exists (
    select 1 from sent_notifications sn
    where sn.user_id = f.user_id
      and sn.subject_type = 'season_opener'
      and sn.subject_id = s.id
      and sn.offset_days = off::smallint
  );

commit;

-- Verify (expect 4 seasons, and suppression rows only for Nov 11 and Nov 25):
--   select s.label, s.method, s.open_date, s.close_date, s.status,
--          (select count(*) from sent_notifications sn
--            where sn.subject_id = s.id and sn.status = 'suppressed') as suppressed
--   from seasons s join zones z on z.id = s.zone_id
--   where z.name = 'Smithgall Woods State Park (Dukes Creek)'
--   order by s.open_date;
