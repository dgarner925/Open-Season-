-- Read Georgia's five freshwater pages again, now that a fishing proposal can
-- actually be stored.
--
-- Third run, third layer of the same bug removed:
--
--   1. extract() dropped the model's `waters` / `fishing_rules` keys
--      -> every page reported "nothing freshwater on this page"
--   2. the empty branch asserted saltwater as the cause
--      -> the note hid the bug behind a plausible explanation
--   3. review_queue's target_table CHECK rejected both fishing tables
--      -> pages reported read: 27-55 with waters: 0, rules: 0
--
-- All three are fixed and deployed. This run is the first time a Georgia
-- fishing proposal can reach review_queue.
--
-- THIS IS THE GRADING RUN. Georgia already holds 33 hand-checked published
-- rules and 29 published waters, transcribed from the agency pages by a person
-- before the extractor existed, precisely so there would be something true to
-- measure against. Proposals that contradict those rows are the extractor
-- being wrong -- the hand-read rows win. Nothing here publishes; every row
-- lands as 'pending' for review.
--
-- Check the responses, not cron's "succeeded":
--
--   select status_code, left(content, 600)
--     from net._http_response order by id desc limit 5;
--
-- Expect waters/rules > 0. If a page still reports waters: 0, rules: 0, the
-- response now carries insert_errors when the cause was a failed write, so a
-- storage failure cannot be mistaken for an empty page.
--
-- One page to watch: trout-streams-destinations-by-county returned
-- returned_keys: [] in 4.3 seconds on the previous run, far too fast for a
-- model call. That is a different failure from the other four -- most likely
-- the fetch, not the extraction -- and it is still unexplained.

do $$
declare
  tok text; sid text; ids text[];
begin
  select (regexp_match(command, 'Bearer ([^'']+)'))[1]
    into tok from cron.job where jobname = 'refresh-sources-daily' limit 1;
  if tok is null then raise notice 'no token on refresh-sources-daily'; return; end if;

  select array_agg(src.id::text) into ids
    from sources src
    join states s on s.id = src.state_id
   where src.purpose = 'fishing_rules'
     and s.code = 'GA';

  if ids is null then raise notice 'no Georgia fishing_rules sources'; return; end if;

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
