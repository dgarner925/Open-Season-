-- Re-read the five Southeast pages whose answers were cut off mid-sentence.
--
-- Five of ten succeeded on the first Southeast run. The other five failed
-- identically:
--
--   Unterminated string in JSON at position 29575   AL creel/possession/size
--   Unterminated string in JSON at position 26532   MS freshwater size/creel
--   Unterminated string in JSON at position 26355   TN trout regulations
--   Unterminated string in JSON at position 22295   SC freshwater size/possession
--   Unterminated string in JSON at position 11214   NC warm-water game fish
--
-- Not a parser bug. The model's reply was TRUNCATED at max_tokens: 16000, and
-- JSON.parse then reported the symptom -- a string that never closes -- with
-- nothing about the cause. The five that failed are the five richest pages;
-- the five that succeeded emitted 8 to 51 rows and fitted.
--
-- This is the leftover-tags truncation bug returning in a new function. There
-- it silently became "this page announces no sale". Here it at least raised an
-- error, because propose()/extract() now surface failures rather than
-- swallowing them -- but the cap itself was never raised.
--
-- Fixed and deployed before this runs:
--   - max_tokens 16000 -> 32000
--   - extract() checks stop_reason BEFORE parsing, so a truncated answer says
--     it hit the output cap instead of blaming its own JSON.
--
-- ---------------------------------------------------------------------------
-- WHY THIS RE-RUN MATTERS MORE THAN THE ROW COUNT
--
-- Both genuinely MIXED saltwater/freshwater pages were in the failed five, so
-- the test they exist for has not actually run yet:
--
--   AL  files FRESHWATER reservoir striped bass (Lewis Smith, Martin, Thurlow,
--       Yates) under a heading the page calls "saltwater". Dropping those
--       reservoirs is wrong; keeping the coastal Baldwin/Mobile rules is also
--       wrong.
--   NC  lists red drum (18in min), spotted seatrout and flounder beside
--       largemouth and crappie. Those three must NOT appear; the freshwater
--       species on the same page must.
--
-- Until these two come back clean, FISHING_SYSTEM's saltwater instruction has
-- only ever been tested on pages that were wholly one thing or the other.
--
-- If a page still truncates at 32000 the error now says so plainly, and the
-- answer is to split the source rather than to raise the cap again: a reply
-- that large is a page that should be two sources.
--
-- Only these five. The five that succeeded are not re-read, so their
-- proposals are not duplicated.

do $$
declare
  tok text; sid text; ids text[];
begin
  select (regexp_match(command, 'Bearer ([^'']+)'))[1]
    into tok from cron.job where jobname = 'refresh-sources-daily' limit 1;
  if tok is null then raise notice 'no token on refresh-sources-daily'; return; end if;

  select array_agg(src.id::text) into ids
    from sources src
   where src.url in (
     'https://www.eregulations.com/alabama/fishing/fishing-daily-creel-possession-size-limits',
     'https://www.eregulations.com/mississippi/fishing/freshwater/freshwater-size-creel-limits',
     'https://www.eregulations.com/tennessee/fishing/trout-regulations',
     'https://www.eregulations.com/southcarolina/fishing/freshwater-fish-size-possession-limits',
     'https://www.eregulations.com/northcarolina/fishing/warm-water-game-fish-regulations');

  if ids is null then raise notice 'none of the five truncated sources found'; return; end if;

  raise notice 're-reading % truncated sources', array_length(ids, 1);

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
