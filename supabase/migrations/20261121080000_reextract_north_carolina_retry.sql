-- Retry the one source of the seven that did not come back.
--
-- 20261121073000 fired seven re-reads. Six returned 200. North Carolina
-- returned 404 "no source with a state_id to process", which is not true: the
-- row exists, has a state, and is flagged carries_draws. The lookup in the
-- sourceId branch is
--
--     const { data } = await admin.from('sources').select('*').eq('id', sourceId).single();
--     if (data) sources = [data];
--
-- and it discards the error. Seven concurrent invocations hit that query at
-- once; one came back empty and the caller was told the source does not exist
-- rather than that the query failed. That is the swallowed-failure shape this
-- project keeps finding: a default that reads as data.
--
-- Retrying matters rather than waiting for the nightly sweep, because the
-- sweep skips a page whose content hash is unchanged. North Carolina's two
-- retired deadlines would not have come back until the agency edited the page.
--
-- Alone this time, so there is nothing to race with.

do $$
declare
  tok text;
begin
  select (regexp_match(command, 'Bearer ([^'']+)'))[1]
    into tok
    from cron.job
   where command like '%Bearer %'
   order by jobid
   limit 1;

  if tok is null then
    raise exception 'no existing cron job carries a bearer token';
  end if;

  perform net.http_post(
    url     := 'https://soxglmgbhmpuxhngcsvx.supabase.co/functions/v1/extract-source',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || tok),
    timeout_milliseconds := 300000,
    body    := jsonb_build_object(
                 'sourceId', '7b30d6e6-c78b-4dae-9f8e-80262f5dbb6c',
                 'force', true)
  );
end $$;
