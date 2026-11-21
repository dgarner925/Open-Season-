-- One-shot: re-read the seven pages behind the retired window proposals.
--
-- 20261121070000 retired 71 application_window proposals that were created
-- before draw deadlines were scored. Retiring them is only half the job: the
-- content hash on those seven sources is unchanged, so the nightly sweep will
-- skip every one of them ("do not pay to read a page that has not changed")
-- and the 71 deadlines -- 61 of them Florida's -- would simply never come
-- back until an agency edited the page.
--
-- So the pages are re-read explicitly, with force:true, which exists for this
-- exact case: the same bytes now read differently because the parser changed.
--
-- All seven are HTML, which matters: a webpage reaches the worker as text, so
-- every date can be grounded against the page itself rather than against the
-- model's own quote. These should come back scored properly or not at all.
--
-- This is an action, not a schema change, and it sits in the migrations folder
-- because that is this project's only sanctioned write path to production. It
-- is idempotent in the way that matters -- re-running it re-reads the same
-- seven pages, and pendingExists() stops duplicate proposals -- but it is a
-- backfill and is not meant to run twice.
--
-- The bearer token is lifted from an existing job inside the database, exactly
-- as 20261102120100 and 20261120040000 do, so no copy of the secret is created
-- and nothing prints it.

do $$
declare
  tok  text;
  sid  text;
  ids  text[] := array[
    'e520f30f-a129-4797-a014-18419dc19064',  -- AR  agfc.com elk
    'dcad3e13-43fb-421e-8490-a4e59ebf5ead',  -- CO  cpw primary draw
    '48653574-0d5d-421f-a45d-1594dfea506c',  -- FL  myfwc limited entry  (61)
    '7b30d6e6-c78b-4dae-9f8e-80262f5dbb6c',  -- NC  ncwildlife permit hunts
    '44cb15c6-c5ce-45ac-b487-7e5af68adbf7',  -- SC  eregulations alligator/bear
    '9c913f5c-4ff4-4d92-8926-08636b3358ad',  -- TN  eregulations elk
    'f2ce9552-7c34-4eca-8ac7-5c1c688eb922'   -- VA  dwr elk
  ];
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

  foreach sid in array ids loop
    perform net.http_post(
      url     := 'https://soxglmgbhmpuxhngcsvx.supabase.co/functions/v1/extract-source',
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'Authorization', 'Bearer ' || tok),
      timeout_milliseconds := 300000,
      body    := jsonb_build_object('sourceId', sid, 'force', true)
    );
  end loop;

  raise notice 're-read queued for % sources', array_length(ids, 1);
end $$;
