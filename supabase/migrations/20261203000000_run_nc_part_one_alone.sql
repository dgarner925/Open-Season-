-- Read North Carolina part 1 on its own.
--
-- THE CAUSE IS NOW NAMED. Part 1 came back:
--
--   {"code":"IDLE_TIMEOUT","message":"Request idle timeout limit (150s) reached"}
--
-- That is what WORKER_RESOURCE_LIMIT was all along, under a clearer name. The
-- 150-second edge limit is the binding constraint, and it fits every
-- observation: Mississippi through at 138s, NC part 2 at 109s, and the
-- undivided 106-row page never had a chance. It also explains why there was
-- no ai_usage row -- the worker was killed mid-call, before res.json().
--
-- So the split was the right fix and this is no longer a workaround in search
-- of an explanation.
--
-- WHY PART 1 STILL TIMED OUT, AND WHY THIS RUN IS DIFFERENT
--
-- Part 1 is the SMALLER half -- ~44 rows against part 2's ~62 -- so size is
-- not what beat it. Both halves were dispatched in the same statement and ran
-- concurrently; part 2 used 109s of the 150s on its own. Two model calls
-- competing is the only difference between the half that finished and the half
-- that did not.
--
-- This runs part 1 alone. If it completes, concurrency was the cause and the
-- lesson is that two heavy sources must not be dispatched together. If it
-- times out again at ~44 rows, the 150s ceiling is tighter than the work and
-- the answer is a smaller slice, not another retry.
--
-- Either way the result is informative, which is more than the last three
-- attempts on this page could say.
--
-- Part 1 is wholly freshwater (largemouth, smallmouth, Alabama/spotted,
-- Bartram's, crappie, sunfish and their per-water exceptions), so there is no
-- saltwater judgement to make here. Part 2 already passed that test: 63
-- proposals, zero red drum, zero seatrout, zero flounder, with Gaston, Kerr
-- and Roanoke Rapids all present.

do $$
declare
  tok text; sid text;
begin
  select (regexp_match(command, 'Bearer ([^'']+)'))[1]
    into tok from cron.job where jobname = 'refresh-sources-daily' limit 1;
  if tok is null then raise notice 'no token on refresh-sources-daily'; return; end if;

  select src.id::text into sid
    from sources src
   where src.url like '%warm-water-game-fish-regulations#part-1-freshwater-species';

  if sid is null then raise notice 'NC part 1 not found'; return; end if;

  perform net.http_post(
    url := 'https://soxglmgbhmpuxhngcsvx.supabase.co/functions/v1/extract-source',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || tok),
    body := jsonb_build_object('sourceId', sid, 'pursuit', 'fishing', 'force', true),
    timeout_milliseconds := 300000
  );
end $$;
