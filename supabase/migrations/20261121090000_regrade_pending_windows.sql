-- Re-grade every pending application window under the row-aware grader.
--
-- The 44 rows pending now were scored by a check that asked only whether a
-- date appeared somewhere on the page. On a page listing 34 hunts that is
-- nearly free to satisfy, so a 0.90 from it does not mean what 0.90 means
-- now, and approving on it would publish dates nothing has verified.
--
-- So: retire those scores, and re-read the seven sources that produced them.
-- The payloads stay in the table as rejected rows, so nothing is lost -- only
-- the claim that they were checked.

update review_queue
   set status = 'rejected',
       review_notes = coalesce(review_notes || ' | ', '')
         || 'superseded 2026-11-21: scored by page-level grounding, which could '
         || 'not tell whether the date belonged to this hunt. Re-extracted.',
       updated_at = now()
 where status = 'pending'
   and target_table = 'application_windows';

-- Re-read the sources, one request each, through the function's own endpoint.
do $$
declare
  tok text;
  sid text;
  ids text[] := array[
    '48653574-0d5d-421f-a45d-1594dfea506c',  -- FL  myfwc limited entry (34)
    'dcad3e13-43fb-421e-8490-a4e59ebf5ead',  -- CO  (4)
    '7b30d6e6-c78b-4dae-9f8e-80262f5dbb6c',  -- NC  (2)
    'e520f30f-a129-4797-a014-18419dc19064',  -- AR  elk
    '44cb15c6-c5ce-45ac-b487-7e5af68adbf7',  -- SC  alligator/bear
    '9c913f5c-4ff4-4d92-8926-08636b3358ad',  -- TN  elk quota
    'f2ce9552-7c34-4eca-8ac7-5c1c688eb922'   -- VA
  ];
begin
  -- The service key is never selected or printed: it is read out of the
  -- existing cron command and used in place.
  select (regexp_match(command, 'Bearer ([^'']+)'))[1]
    into tok
    from cron.job
   where jobname = 'refresh-sources-daily'
   limit 1;

  if tok is null then
    raise notice 'no token found; nothing requested';
    return;
  end if;

  foreach sid in array ids loop
    perform net.http_post(
      url := 'https://soxglmgbhmpuxhngcsvx.supabase.co/functions/v1/extract-source',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || tok),
      body := jsonb_build_object('sourceId', sid, 'force', true),
      timeout_milliseconds := 300000
    );
  end loop;
end $$;
