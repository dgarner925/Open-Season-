-- 20260719180000_strip_todo_notes.sql
-- Early extractions occasionally leaked the model's own editorial notes into
-- published content, e.g. a fee_summary ending "...TODO: results date not published
-- on official page." Strip any "TODO:" sentence (up to the next period) from the
-- user-facing text fields; if that empties the field, null it. The extract-source
-- prompt now forbids these notes going forward, so this is a one-time backfill.

update public.application_windows
  set fee_summary = nullif(btrim(regexp_replace(fee_summary, '\s*TODO:[^.]*\.?', '', 'gi')), '')
  where fee_summary ~* 'TODO:';

update public.seasons
  set notes = nullif(btrim(regexp_replace(notes, '\s*TODO:[^.]*\.?', '', 'gi')), '')
  where notes ~* 'TODO:';

update public.seasons
  set bag_limit_summary = nullif(btrim(regexp_replace(bag_limit_summary, '\s*TODO:[^.]*\.?', '', 'gi')), '')
  where bag_limit_summary ~* 'TODO:';

update public.regulation_summaries
  set body = nullif(btrim(regexp_replace(body, '\s*TODO:[^.]*\.?', '', 'gi')), '')
  where body ~* 'TODO:';
