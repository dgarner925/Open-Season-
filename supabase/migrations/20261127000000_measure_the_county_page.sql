-- Read the county trout-stream page once more, now that the response says how
-- much page the edge was actually served.
--
-- WHAT THIS IS SETTLING
--
-- trout-streams-destinations-by-county returns in under four seconds with
-- returned_keys: [] -- twice, identically. Two explanations fit that response
-- exactly, and they want opposite fixes:
--
--   A. The edge is served a shell. eRegulations fingerprints requests, and a
--      datacentre IP may get markup a desktop browser does not. Then the model
--      is reading an empty page and the fix is the fetch.
--
--   B. The model read the page and correctly declined. FISHING_SYSTEM says,
--      almost describing this page by name:
--
--        "Do not invent waters from a list of place names that carries no
--         rule. A page listing every trout stream in a county is a list, not a
--         set of rules: emit the waters only if the document states a rule for
--         them."
--
--      Then nothing is broken and the fix is a prompt decision, not a fetch.
--
-- Fetched from a desktop browser on 2026-11-21 the page is 83,599 bytes of
-- HTML and 14,647 characters after the extractor's own strip -- so B is likely
-- from here. But "likely from here" is not what the edge sees, and the whole
-- point of the previous three bugs was that a plausible explanation stood in
-- for a measurement.
--
-- doc_chars now carries the answer:
--
--   select left(content, 600) from net._http_response order by id desc limit 1;
--
--   doc_chars in the low hundreds  -> A, the edge is served a shell
--   doc_chars near 14,647          -> B, the refusal is the model's judgement
--
-- Only this one source. No other page is re-read.

do $$
declare
  tok text; sid text;
begin
  select (regexp_match(command, 'Bearer ([^'']+)'))[1]
    into tok from cron.job where jobname = 'refresh-sources-daily' limit 1;
  if tok is null then raise notice 'no token on refresh-sources-daily'; return; end if;

  select src.id::text into sid
    from sources src
   where src.url = 'https://www.eregulations.com/georgia/fishing/trout-streams-destinations-by-county';

  if sid is null then raise notice 'county page source not found'; return; end if;

  perform net.http_post(
    url := 'https://soxglmgbhmpuxhngcsvx.supabase.co/functions/v1/extract-source',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || tok),
    body := jsonb_build_object('sourceId', sid, 'pursuit', 'fishing', 'force', true),
    timeout_milliseconds := 300000
  );
end $$;
