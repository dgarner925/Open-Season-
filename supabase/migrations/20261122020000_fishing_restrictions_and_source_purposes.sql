-- Two names that turned out to be wrong, fixed before any data relies on them.

-- 1. `gear_rules` was not only about gear.
--
-- It already held `reservation_required` and `daylight_only`, and Georgia adds
-- a restriction that is about the angler rather than the tackle: the stretch
-- of Moccasin Creek between the Lake Burton Hatchery intake and the lake is
-- open only to anglers under 12, licensed seniors 65 or older, and any age
-- holding a Georgia Disability License.
--
-- A column called gear_rules invites someone to render it as "Gear", and a
-- person reading "Gear: youth and seniors only" learns nothing. These are
-- restrictions on taking fish, whatever their kind.
alter table fishing_rules rename column gear_rules to restrictions;
alter table fishing_rules rename constraint fishing_rules_gear_check
  to fishing_rules_restrictions_check;

alter table fishing_rules drop constraint if exists fishing_rules_restrictions_check;
alter table fishing_rules
  add constraint fishing_rules_restrictions_check check (
    restrictions <@ array[
      -- tackle
      'artificial_only',
      'flies_only',
      'single_hook',
      'barbless',
      'no_live_bait',
      'one_pole_handheld',
      -- what happens to the fish
      'catch_and_release',
      -- access and timing
      'reservation_required',
      'daylight_only',
      'no_night_fishing',
      -- who may fish here at all
      'youth_senior_disabled_only',
      -- what you must hold
      'trout_licence_required'
    ]::text[]);

-- 2. A source can now be about fishing.
--
-- `purpose` allowed only 'seasons' and 'leftover_tags'. Fishing rules are not
-- seasons -- that distinction is the whole point of the previous migration --
-- and stocking feeds are a third kind of document again.
alter table sources drop constraint if exists sources_purpose_known;
alter table sources
  add constraint sources_purpose_known check (purpose = any (array[
    'seasons',        -- hunting seasons and draw windows
    'leftover_tags',
    'fishing_rules',  -- limits, sizes, restrictions, named waters
    'stockings'       -- dated stocking records, usually a separate feed
  ]));
