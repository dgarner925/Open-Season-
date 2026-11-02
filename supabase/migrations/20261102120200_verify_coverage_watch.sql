-- Verify the watchdog actually ran. Writes nothing.
--
-- A pg_cron job reporting "succeeded" only means the SQL ran, not that the
-- HTTP call landed — that is exactly how the legacy-key sunset killed the push
-- crons silently. The truth is in net._http_response.
--
-- This asserts coverage_gaps has rows, and if it does not, fails with the
-- actual HTTP status and body so the reason is in the error rather than
-- somewhere else. Re-running it after a good run is a no-op.

do $$
declare
  n_gaps     int;
  n_stale    int;
  n_action   int;
  last_resp  text;
begin
  select count(*) into n_gaps from public.coverage_gaps;

  if n_gaps = 0 then
    select format('status=%s body=%s', status_code, left(coalesce(content, '(null)'), 900))
      into last_resp
      from net._http_response
     order by id desc
     limit 1;
    raise exception 'coverage_gaps is empty — watchdog did not land. Last HTTP response: %',
      coalesce(last_resp, '(no rows in net._http_response)');
  end if;

  select count(*) filter (where kind = 'stale_in_season'),
         count(*) filter (where kind in ('stale_in_season', 'not_huntable'))
    into n_stale, n_action
    from public.coverage_gaps;

  raise notice 'coverage_gaps: % rows, % stale_in_season, % actionable', n_gaps, n_stale, n_action;
end $$;
