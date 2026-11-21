-- Give the two remaining nightly jobs an explicit pg_net timeout.
--
-- pg_net defaults to a 5 second timeout. Both of these functions take far
-- longer than that by design -- extract-source runs to a 150s wall clock, and
-- coverage-watch walks every state x species pair -- so pg_net stops waiting
-- and records a timeout in net._http_response on every single night they work.
--
-- Last night, 2026-11-21:
--     jobid 11  coverage-watch-nightly   timed out after 5002 ms
--     jobid  6  refresh-sources-daily    timed out after 5002 ms
--     jobid 16  refresh-draws-nightly    http 200, full result body, 77s
-- The only difference between 16 and the other two is that 16 was scheduled
-- with timeout_milliseconds set.
--
-- Two things this costs us, both of which the draw sweep already avoids:
--
-- 1. The runs are invisible. The request IS sent and the function DOES run to
--    completion -- pg_net merely stops listening -- so the work happens and
--    the result is thrown away. Last night's gaps run may have created fifty
--    proposals or none and there is no way to tell from the database. Every
--    diagnosis of that job to date has been guesswork.
-- 2. It inverts the pipeline heartbeat. The alarm looks for a timeout in
--    net._http_response and finds one every night the job WORKS, so it fires
--    on the good days and stays quiet on a night the function never ran at
--    all. An alarm that is exactly backwards is worse than no alarm.
--
-- 300000 ms matches the draw sweep. It is not a budget -- the function's own
-- wall clock governs how long it runs -- it is only how long pg_net is willing
-- to wait for the answer, so it wants to be comfortably longer than the work.
--
-- The command is rewritten in place rather than retyped, so the bearer token
-- is carried across inside the database and never passes through a migration
-- file, a terminal, or anybody's context. Guarded on the absence of
-- timeout_milliseconds, so a re-run is a no-op and this cannot stack.

do $$
declare
  r       record;
  newcmd  text;
  n       int := 0;
begin
  for r in
    select jobid, jobname, command
      from cron.job
     where jobname in ('refresh-sources-daily', 'coverage-watch-nightly')
       and command not like '%timeout_milliseconds%'
  loop
    -- regexp_replace without the 'g' flag touches the first match only, and
    -- there is exactly one `body :=` per command.
    newcmd := regexp_replace(r.command, 'body\s*:=',
                             'timeout_milliseconds := 300000, body :=');

    if newcmd = r.command then
      raise exception
        'job % (%) has no "body :=" to anchor on; not touching it',
        r.jobid, r.jobname;
    end if;

    perform cron.alter_job(job_id := r.jobid, command := newcmd);
    n := n + 1;
    raise notice 'jobid % (%) now waits 300s for its response', r.jobid, r.jobname;
  end loop;

  raise notice '% job(s) updated', n;
end $$;
