-- 20261108234500_smithgall_woods_black_bear.sql
-- Black bear on the Smithgall Woods hunts. Corrects the migration before it.
--
-- WHAT I GOT WRONG
--   20261108230000 added only deer, and said in its own comment that adding
--   bear would be "inventing a season from a section heading". That was the
--   wrong call. The heading is not decoration:
--
--     Deer & Bear
--       Archery    Buck Only: Sept. 12-13
--       Firearms   HC Buck Only: Oct. 9-11
--       Primitive  Buck Only: Nov. 11-14
--       Firearms   Buck Only: Nov. 25-28
--
--   "Buck Only" restricts the DEER harvest. It does not exclude bear -- it is
--   a limit on antlers, and bears do not have any. The agency grouped these
--   hunts under "Deer & Bear" because that is what you may take on them.
--
--   Two further confirmations, both independent of the heading:
--     * The page's own legend requires sign-in for "all bear, deer and turkey
--       hunts" at this property. That line is meaningless unless bear hunts
--       happen here.
--     * David is going on the Nov 11-14 hunt and says it includes black bear.
--
--   So this is not heading inference any more. It is three sources agreeing.
--
-- WHAT THE SOURCE STILL DOES NOT SAY
--   It gives no separate bear dates and no bear bag limit for this property,
--   so bag_limit_summary is left null rather than borrowing the statewide
--   figure. The notes record that gap instead of papering over it.
--
--   The Oct 9-11 firearms hunt is the one date worth a hunter's own check:
--   statewide Northern Zone bear firearms does not open until Oct 17, while
--   bear archery ran Sep 12 - Oct 9 and primitive Oct 10-16. Whether the park
--   hunt stands on its own authority there is not something this page settles.
--   It is in the past, so nothing is pushed about it either way.
--
-- Smithgall Woods is near Helen, in White County: Northern Zone. Northern Zone
-- bear firearms is open 2026-10-17 to 2027-01-10, which covers both remaining
-- hunts -- and is exactly why step 2 exists.
--
-- Source: https://www.eregulations.com/georgia/hunting/state-park-hunting-opportunities

begin;

-- 1. The same four hunts, for black bear. Same zone, same source, same dates,
--    same methods. No "Buck Only" in the labels: that belongs to the deer row.
insert into seasons (
  state_id, species_id, zone_id, season_year, method, label,
  open_date, close_date, bag_limit_summary, notes, source_id,
  last_verified_at, status
)
select
  (select id from states where code = 'GA'),
  (select id from species where name = 'Black bear'),
  (select id from zones
    where state_id = (select id from states where code = 'GA')
      and name = 'Smithgall Woods State Park (Dukes Creek)'),
  2026,
  h.method::season_method,
  h.label,
  h.open_date,
  h.close_date,
  null,
  h.notes,
  (select id from sources
    where url = 'https://www.eregulations.com/georgia/hunting/state-park-hunting-opportunities'),
  now(),
  'published'
from (values
  ('archery',      'Smithgall Woods Archery',          date '2026-09-12', date '2026-09-13',
   'State park hunt, not statewide. Sign-in required. Listed under the "Deer & Bear" heading as "Buck Only: Sept. 12-13"; the buck-only limit is on the deer harvest. The page gives no separate bear bag limit for this property.'),
  ('firearm',      'Smithgall Woods Firearms (HC)',    date '2026-10-09', date '2026-10-11',
   'State park hunt, not statewide. Sign-in required. Listed under "Deer & Bear" as "HC Buck Only: Oct. 9-11"; "HC" is printed without a key. Note that statewide Northern Zone bear firearms does not open until Oct 17 -- check with the park before relying on these three days for bear.'),
  ('muzzleloader', 'Smithgall Woods Primitive Weapons', date '2026-11-11', date '2026-11-14',
   'State park hunt, not statewide. Sign-in required. Listed under the "Deer & Bear" heading as "Buck Only: Nov. 11-14"; the buck-only limit is on the deer harvest. Inside Northern Zone bear firearms season. The page gives no separate bear bag limit for this property.'),
  ('firearm',      'Smithgall Woods Firearms',         date '2026-11-25', date '2026-11-28',
   'State park hunt, not statewide. Sign-in required. Listed under the "Deer & Bear" heading as "Buck Only: Nov. 25-28"; the buck-only limit is on the deer harvest. Inside Northern Zone bear firearms season. The page gives no separate bear bag limit for this property.')
) as h(method, label, open_date, close_date, notes)
where not exists (
  select 1 from seasons s
  where s.zone_id = (select id from zones
                      where state_id = (select id from states where code = 'GA')
                        and name = 'Smithgall Woods State Park (Dukes Creek)')
    and s.species_id = (select id from species where name = 'Black bear')
    and s.open_date = h.open_date
    and s.method = h.method::season_method
);

-- 2. Suppress the opener pushes, for the same reason as the deer rows.
--
--    The season-opener body is state + species + method + date and never names
--    the zone, so the Nov 11 row would read "GA Black bear (muzzleloader)
--    opens Nov 11" to everyone following GA + Black bear -- while Northern
--    Zone bear firearms has been open since Oct 17 and runs to Jan 10. False
--    statewide opener, same as the deer case.
--
--    31 users follow the pair with alert preferences; 9 are premium with a
--    token today. Written for all 31, so an upgrade before Nov 24 cannot
--    reopen the hole. Offsets in use are {1,7,30,90,180,365}: offset 1 fires
--    Nov 10, offset 7 on Nov 18, offset 1 again Nov 24.
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
  'smithgall woods bear 2026-11-08: one state-park property, and the opener push names only state, species and method, so it would read as a statewide GA black bear opener while Northern Zone bear firearms is already open',
  now()
from seasons s
join zones z on z.id = s.zone_id
join follows f on f.state_id = s.state_id and f.species_id = s.species_id
join alert_preferences ap on ap.follow_id = f.id
cross join lateral unnest(ap.opener_offsets) as off
where z.name = 'Smithgall Woods State Park (Dukes Creek)'
  and s.species_id = (select id from species where name = 'Black bear')
  and s.open_date > current_date
  and not exists (
    select 1 from sent_notifications sn
    where sn.user_id = f.user_id
      and sn.subject_type = 'season_opener'
      and sn.subject_id = s.id
      and sn.offset_days = off::smallint
  );

commit;

-- Verify (expect 8 Smithgall seasons: 4 deer, 4 black bear, and suppression
-- rows only on the two that open after today):
--   select sp.name, s.label, s.method, s.open_date, s.close_date,
--          (select count(*) from sent_notifications sn
--            where sn.subject_id = s.id and sn.status = 'suppressed') as suppressed
--   from seasons s
--   join species sp on sp.id = s.species_id
--   join zones z on z.id = s.zone_id
--   where z.name = 'Smithgall Woods State Park (Dukes Creek)'
--   order by sp.name, s.open_date;
