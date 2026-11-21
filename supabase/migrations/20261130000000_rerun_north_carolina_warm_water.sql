-- North Carolina's warm-water page: the one Southeast page still unread, and
-- the one test that has never run.
--
-- It has failed twice, differently each time:
--
--   run 1   Unterminated string in JSON at position 11214   (truncated at
--           max_tokens: 16000)
--   run 2   WORKER_RESOURCE_LIMIT                           (raising the cap
--           to 32000 made the answer bigger, and the worker died holding it)
--
-- The second failure was not the cap. groundFishingRule is called once per
-- proposed row, and its inner loop rebuilt `${heading} ${block}`, re-tokenised
-- it with words() and allocated a Set for EVERY block on EVERY row -- while
-- also re-deriving the subject's own tokens inside nameMatchScore each time.
-- None of that varies by row. Near the 5000-block cap with ~100 rows it is on
-- the order of a billion character operations and gigabytes of transient
-- strings for one page.
--
-- Fixed and deployed before this runs: the page is tokenised ONCE into a block
-- index cached on the blocks array, and the subject's tokens are hoisted out
-- of the loop. Measured on a synthetic 5000-block page with 100 rows:
-- ~9.4s before, ~0.5s after.
--
-- A regression test now holds it at 5s. The first version of that test used
-- short blocks and passed against the unoptimised code in 1.4s -- it caught
-- nothing, because the cost being guarded is per-character. Blocks have to be
-- realistic length or the test is theatre.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS PAGE IS FOR
--
-- It is the second of the two genuinely MIXED saltwater/freshwater pages, and
-- the only one still untested. Its "inland and joint waters" section lists
-- red drum (18in minimum), spotted seatrout and flounder beside largemouth,
-- smallmouth, crappie and walleye.
--
-- Alabama already passed this test: 70 proposals, not one marine species,
-- while the freshwater reservoirs filed under the page's own "saltwater"
-- heading (Lewis Smith, Martin, Thurlow, Yates) all survived at 0.90.
--
-- North Carolina asks the opposite question. Alabama's trap was a page calling
-- freshwater "saltwater"; NC's is genuine marine species sitting in an inland
-- regulations table. Passing one does not predict the other.
--
-- Expect: NO red drum, spotted seatrout or flounder. Named waters such as
-- Santeetlah, Chatuge, Hyco, Kerr, Gaston and Norman SHOULD appear.
--
-- Only this one source.

do $$
declare
  tok text; sid text;
begin
  select (regexp_match(command, 'Bearer ([^'']+)'))[1]
    into tok from cron.job where jobname = 'refresh-sources-daily' limit 1;
  if tok is null then raise notice 'no token on refresh-sources-daily'; return; end if;

  select src.id::text into sid
    from sources src
   where src.url = 'https://www.eregulations.com/northcarolina/fishing/warm-water-game-fish-regulations';

  if sid is null then raise notice 'NC warm-water source not found'; return; end if;

  perform net.http_post(
    url := 'https://soxglmgbhmpuxhngcsvx.supabase.co/functions/v1/extract-source',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || tok),
    body := jsonb_build_object('sourceId', sid, 'pursuit', 'fishing', 'force', true),
    timeout_milliseconds := 300000
  );
end $$;
