-- Read both halves of North Carolina's warm-water page.
--
-- The page is one 106-row table and killed the worker three times undivided.
-- It is now two sources sharing the URL and differing by slice markers; the
-- fragment makes the rows distinct for the unique index and is never sent to
-- the server.
--
-- WHAT EACH HALF HAS TO SHOW
--
--   part 1  Largemouth, smallmouth, Alabama/spotted, Bartram's, crappie,
--           sunfish and their per-water exceptions. Wholly freshwater, so a
--           clean read here is about VOLUME: did splitting stop the worker
--           dying.
--
--   part 2  The mixed-page test that has never run. Striped bass across
--           inland impoundments AND coastal rivers, then rock bass, white
--           bass, white perch, shad, walleye, muskellunge, sauger, kokanee,
--           bullheads, yellow perch, pickerel -- and flounder, red drum and
--           spotted seatrout, filed under "all inland fishing waters and
--           joint fishing waters".
--
--           PASS  = Lake Gaston, John H. Kerr, Roanoke Rapids proposed, and
--                   NO flounder, red drum or spotted seatrout anywhere.
--           FAIL  = any of those three marine species proposed, OR the
--                   freshwater striped bass waters dropped along with them.
--
-- Alabama already passed the opposite form of this test: a page calling
-- freshwater "saltwater", 70 proposals, not one marine species. North
-- Carolina asks the harder question -- genuine marine species sitting inside
-- an inland regulations table -- and passing one does not predict the other.
--
-- If a marker has gone missing the run now FAILS LOUDLY rather than reading
-- the whole page and proposing every row twice.
--
-- Only these two sources.

do $$
declare
  tok text; sid text; ids text[];
begin
  select (regexp_match(command, 'Bearer ([^'']+)'))[1]
    into tok from cron.job where jobname = 'refresh-sources-daily' limit 1;
  if tok is null then raise notice 'no token on refresh-sources-daily'; return; end if;

  select array_agg(src.id::text) into ids
    from sources src
   where src.url like 'https://www.eregulations.com/northcarolina/fishing/warm-water-game-fish-regulations#%';

  if ids is null then raise notice 'NC warm-water halves not found'; return; end if;

  raise notice 'reading % NC halves', array_length(ids, 1);

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
