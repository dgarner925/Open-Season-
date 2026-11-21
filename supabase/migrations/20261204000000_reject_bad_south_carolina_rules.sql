-- Reject the eleven South Carolina rules that are wrong on their face.
--
-- David reviewed the 50 pending SC rules on 2026-11-21 and rejected the two
-- categories below. The remaining 39 stay PENDING: they are the ones where
-- South Carolina states a limit once at the top of a table and lists waters
-- carrying only their exceptions, so the grounding cannot find the number
-- beside the water even when the reading is right. Those need a person with
-- the page open, not a bulk decision.
--
-- ELEVEN, NOT TWELVE. Six rules carry a water-list name and six carry the
-- invented date; one row has BOTH defects, so the union is 11. The first
-- report of this said 12 by adding the categories without checking the
-- overlap.
--
-- ---------------------------------------------------------------------------
-- 1. A water_name that is a LIST of waters (6 rules, 3 distinct lists)
--
-- One reads: "Ashepoo River; Ashley River; Back River in Jasper County and the
-- Back River in Berkeley County; Black River; ... and Waccamaw River" -- 22
-- rivers in a single water_name. It would render as one impossible place and
-- could never be matched to a real one. The schema wants a water per regulated
-- unit; a list is not a unit.
--
-- Detected by counting semicolons rather than by id, so re-running this cannot
-- reject something else by accident, and a re-extraction producing the same
-- shape is caught again.
--
-- 2. The same invented date, six times (6 rules, 1 overlapping the above)
--
-- The grounding could not find 2026-09-30 on the page, and the model applied
-- it to six different striped bass waters: Lake Murray, both Saluda reaches,
-- the Santee system, Lake Jocassee and the river list. A date repeated
-- identically across six rows is a systematic inference, not a slip -- and a
-- wrong closing date tells someone a season is shut while it is open, which is
-- the single worst thing this app can say.
--
-- ---------------------------------------------------------------------------
-- NOT rejected, deliberately:
--
--   the one pending SC water, "Santee River system", flagged only for an
--   extent_note that is not quoted verbatim. That is a paraphrase to fix, not
--   a fabrication, and the water is real.
--
-- Idempotent: touches only rows still 'pending' that match the shapes above.
-- Re-running it changes nothing.

update public.review_queue rq
   set status       = 'rejected',
       reviewed_by  = '418e5326-0812-46be-8928-b74ab0da0aa1',
       reviewed_at  = now(),
       review_notes = case
         when (length(rq.proposed_payload->>'water_name')
               - length(replace(rq.proposed_payload->>'water_name', ';', ''))) >= 2
              and array_to_string(rq.validation_errors, ' ') like '%not found on the page%'
           then 'Rejected: water_name is a list of many waters, AND carries the date 2026-09-30 which is not on the page.'
         when (length(rq.proposed_payload->>'water_name')
               - length(replace(rq.proposed_payload->>'water_name', ';', ''))) >= 2
           then 'Rejected: water_name is a list of many waters, not one regulated unit.'
         else 'Rejected: carries a date the grounding could not find on the page (2026-09-30, proposed on six striped bass waters).'
       end
  from public.sources src
  join public.states s on s.id = src.state_id
 where src.id = rq.source_id
   and s.code = 'SC'
   and rq.status = 'pending'
   and rq.target_table = 'fishing_rules'
   and (
     (length(rq.proposed_payload->>'water_name')
      - length(replace(rq.proposed_payload->>'water_name', ';', ''))) >= 2
     or array_to_string(rq.validation_errors, ' ') like '%not found on the page%'
   );
