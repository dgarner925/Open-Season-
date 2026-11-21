-- Re-read all five Georgia freshwater pages, now that the extractor stops
-- throwing the model's answer away.
--
-- ---------------------------------------------------------------------------
-- WHY THESE PAGES HAVE NEVER BEEN READ
--
-- extract() ended with a hardcoded return of three keys (seasons,
-- application_windows, regulation_summaries). The fishing schema requires
-- `waters` and `fishing_rules`; the model returned them; the function dropped
-- them. processFishingSource then read `out.waters ?? []` as empty EVERY time
-- and fell into the branch that reports the page as saltwater.
--
-- So the note "nothing freshwater on this page" was never about the page. It
-- was the shape of the bug. Georgia's 29 waters and 33 rules were transcribed
-- by hand, which is the only reason the extractor's silence was never
-- contradicted by a state that worked.
--
-- Fixed in the commit that precedes this migration and deployed before it
-- runs. This re-reads all five with force := true, because the bytes have not
-- changed -- only what the code does with them.
--
-- ---------------------------------------------------------------------------
-- WHAT TO EXPECT, AND HOW TO TELL SUCCESS FROM SILENCE
--
-- Results land in review_queue as PROPOSALS, not as published rows. Nothing
-- reaches the app until a human approves them. Georgia already holds 33
-- hand-checked published rules, so this run is also a free grading of the
-- extractor against a gold set: proposals that contradict the hand-read rows
-- are the extractor being wrong, not the hand-read rows.
--
-- Do NOT read cron's "succeeded" to mean the work happened. Check the
-- responses:
--
--   select status_code, left(content, 400)
--     from net._http_response order by id desc limit 5;
--
-- A body carrying "nothing freshwater on this page" together with a
-- returned_keys array that is non-empty would mean the page really is marine.
-- The same note with returned_keys absent means the response never arrived.

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
