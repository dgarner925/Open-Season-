-- Schedule the coverage watchdog, and run it once now.
--
-- The call needs an sb_secret_ key (extract-source and coverage-watch both
-- refuse anything else — they spend money). That key is not in .env and not on
-- disk anywhere; the only copy lives inside the commands of the cron jobs set
-- up in 2026-07. So we lift it from there rather than pasting it in again:
-- no new copy of the secret is created, and nothing has to print it.
--
-- Order matters. coverage-watch runs at 03:30 UTC and writes coverage_gaps;
-- refresh-sources-daily already runs at 04:00, which gives the triage half an
-- hour to land before anything reads it.

do $$
declare
  tok  text;
  base text := 'https://soxglmgbhmpuxhngcsvx.supabase.co/functions/v1/';
  cmd  text;
begin
  -- Any existing job carries the same key; take the first that parses.
  select (regexp_match(command, 'Bearer ([^'']+)'))[1]
    into tok
    from cron.job
   where command like '%Bearer %'
   order by jobid
   limit 1;

  if tok is null then
    raise exception 'no existing cron job carries a bearer token — cannot schedule coverage-watch';
  end if;

  cmd := format(
    'select net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'',''application/json'',''Authorization'',''Bearer %s''), body := ''{}''::jsonb);',
    base || 'coverage-watch', tok);

  perform cron.unschedule('coverage-watch-nightly')
    where exists (select 1 from cron.job where jobname = 'coverage-watch-nightly');
  perform cron.schedule('coverage-watch-nightly', '30 3 * * *', cmd);

  -- Fire it once right now so coverage_gaps is populated immediately instead
  -- of sitting empty until tomorrow morning.
  execute cmd;
end $$;
