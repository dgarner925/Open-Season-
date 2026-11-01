-- 20261101120100_verify_quiet_apply.sql
-- Self-verifying no-op: proves the quiet flag suppresses the watchdog AND that
-- the watchdog still logs a real change, then leaves the data exactly as found.
-- There is no way to unit-test a trigger from the TS suite, and "it didn't send
-- 300 pushes" is not something to find out in production.
--
-- Every write below is undone in the same transaction, and the whole migration
-- rolls back if any assertion fails. On an empty database it does nothing.
do $$
declare
  v_id   uuid;
  v_old  date;
  v_cnt  integer;
begin
  select id, open_date into v_id, v_old
  from public.seasons
  where status = 'published' and open_date is not null
  order by id
  limit 1;

  if v_id is null then
    raise notice 'no published season to test against; skipping';
    return;
  end if;

  -- 1. Quiet: the date moves, nothing is logged, so nothing can be pushed.
  perform set_config('openseason.quiet_apply', 'on', true);
  update public.seasons set open_date = v_old + 1 where id = v_id;
  select count(*) into v_cnt
  from public.date_changes
  where target_table = 'seasons' and target_id = v_id and old_date = v_old and new_date = v_old + 1;
  if v_cnt <> 0 then
    raise exception 'quiet apply leaked a date_changes row (% found)', v_cnt;
  end if;
  update public.seasons set open_date = v_old where id = v_id;

  -- 2. Loud: the watchdog still does its job for a genuine agency change.
  perform set_config('openseason.quiet_apply', 'off', true);
  update public.seasons set open_date = v_old + 1 where id = v_id;
  select count(*) into v_cnt
  from public.date_changes
  where target_table = 'seasons' and target_id = v_id and old_date = v_old and new_date = v_old + 1;
  if v_cnt <> 1 then
    raise exception 'watchdog stopped logging real changes (% rows)', v_cnt;
  end if;

  -- Put the season and the log back the way we found them.
  perform set_config('openseason.quiet_apply', 'on', true);
  update public.seasons set open_date = v_old where id = v_id;
  delete from public.date_changes
  where target_table = 'seasons' and target_id = v_id and old_date = v_old and new_date = v_old + 1;
  perform set_config('openseason.quiet_apply', 'off', true);

  raise notice 'quiet apply verified on season %', v_id;
end $$;
