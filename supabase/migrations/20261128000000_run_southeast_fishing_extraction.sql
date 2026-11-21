-- Read the ten Southeast freshwater pages: AL, SC, NC, TN, FL, MS.
--
-- Georgia's grading run passed on mechanics before this: 163 rows read, 163
-- proposed, 0 lost, 0 write failures. The grounding knocked 25 of 91 rules to
-- <=0.3 with specific reasons and caught an invented date (2027-03-27). Dates
-- and restrictions on the two delayed-harvest waters matched the hand-read
-- gold set exactly.
--
-- Georgia's PENDING proposals are still unreviewed when this runs. That is a
-- deliberate choice, not an oversight: it multiplies the queue before anyone
-- has confirmed what the extractor gets right on the one state where right and
-- wrong can be told apart. Recorded here so the size of the queue is not a
-- surprise later.
--
-- ---------------------------------------------------------------------------
-- WHAT TO WATCH IN THESE RESULTS
--
-- Two of the ten pages are genuinely MIXED saltwater and freshwater, and they
-- are the real test of FISHING_SYSTEM's saltwater instruction, because every
-- page it has faced so far was wholly one or the other:
--
--   AL  fishing-daily-creel-possession-size-limits
--       Files striped bass rules for FRESHWATER reservoirs (Lewis Smith,
--       Martin, Thurlow, Yates) under a heading the page calls "saltwater".
--       The heading is not a reliable split. Dropping those reservoirs would
--       be wrong; keeping the coastal Baldwin/Mobile river rules would also
--       be wrong.
--
--   NC  warm-water-game-fish-regulations
--       Its "inland and joint waters" section lists red drum (18in minimum),
--       spotted seatrout and flounder beside largemouth and crappie. Those
--       three should NOT appear; the freshwater species on the same page
--       should.
--
-- A clean run on those two is the evidence that the instruction works on a
-- mixed page. A run that takes everything, or nothing, from either is not.
--
-- Also expect low-confidence noise from SC's freshwater-game-fishing-
-- regulations: it carries methods, seasons and prohibitions but NO limits
-- table. Rules proposed from it with daily_limit_kind other than 'unknown'
-- deserve suspicion.
--
-- Nothing here publishes. Every row lands in review_queue as 'pending'.
--
-- Check the responses, not cron's "succeeded":
--
--   select left(content, 500) from net._http_response
--    where created > now() - interval '10 minutes' order by id desc;
--
-- waters: 0 with insert_errors means a failed write, not an empty page.
-- waters: 0 with doc_chars in the low hundreds means a blocked fetch.

do $$
declare
  tok text; sid text; ids text[];
begin
  select (regexp_match(command, 'Bearer ([^'']+)'))[1]
    into tok from cron.job where jobname = 'refresh-sources-daily' limit 1;
  if tok is null then raise notice 'no token on refresh-sources-daily'; return; end if;

  select array_agg(src.id::text) into ids
    from sources src
    join states s on s.id = src.state_id
   where src.purpose = 'fishing_rules'
     and s.code in ('AL', 'SC', 'NC', 'TN', 'FL', 'MS');

  if ids is null then raise notice 'no Southeast fishing_rules sources'; return; end if;

  raise notice 'dispatching % Southeast fishing sources', array_length(ids, 1);

  foreach sid in array ids loop
    perform net.http_post(
      url := 'https://soxglmgbhmpuxhngcsvx.supabase.co/functions/v1/extract-source',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || tok),
      body := jsonb_build_object('sourceId', sid, 'pursuit', 'fishing', 'force', true),
      timeout_milliseconds := 300000
    );
  end loop;
end $$;
