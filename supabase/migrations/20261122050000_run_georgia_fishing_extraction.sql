-- Read Georgia's two freshwater pages with the fishing extractor.
--
-- The output is graded against the hand-transcribed Georgia rules, which is
-- the only way to measure an extractor. Nothing here applies anything: the
-- proposals land in review_queue and are scored.
do $$
declare
  tok text;
  sid text;
  ids text[];
begin
  select (regexp_match(command, 'Bearer ([^'']+)'))[1]
    into tok from cron.job where jobname = 'refresh-sources-daily' limit 1;
  if tok is null then raise notice 'no token; nothing requested'; return; end if;

  select array_agg(id::text) into ids from sources
   where purpose = 'fishing_rules'
     and url in (
       'https://www.eregulations.com/georgia/fishing/game-species-daily-limits',
       'https://www.eregulations.com/georgia/fishing/trout-fishing');

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
