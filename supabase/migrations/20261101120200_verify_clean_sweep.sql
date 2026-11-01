-- 20261101120200_verify_clean_sweep.sql
-- Self-verifying no-op for approve_clean_reviews(): proves the sweep takes the
-- clean item, leaves the low-confidence one alone, really writes the date, and
-- passes the quiet flag through to the watchdog. Everything it touches is put
-- back in the same transaction.
--
-- The sweep can only be driven by an admin JWT, so this stands in David's
-- claims for the length of the block — the same path the app takes, not a
-- superuser shortcut around the gate.
do $$
declare
  v_admin     uuid;
  v_season    uuid;
  v_open      date;
  v_close     date;
  v_verified  timestamptz;
  v_clean     uuid;
  v_dirty     uuid;
  v_res       jsonb;
  v_cnt       integer;
  v_now       date;
begin
  select id into v_admin from public.profiles where is_admin order by created_at limit 1;
  select id, open_date, close_date, last_verified_at
    into v_season, v_open, v_close, v_verified
  from public.seasons
  where status = 'published' and open_date is not null and close_date is not null
  order by id
  limit 1;

  if v_admin is null or v_season is null then
    raise notice 'no admin or no published season; skipping sweep test';
    return;
  end if;

  if exists (select 1 from public.review_queue where status = 'pending') then
    raise notice 'queue is not empty; skipping sweep test to avoid touching real work';
    return;
  end if;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text,
    true
  );

  -- Clean: scored high, no validation errors. Moves the opener by a day.
  insert into public.review_queue (target_table, target_id, change_type, proposed_payload, confidence)
  values ('seasons', v_season, 'update',
          jsonb_build_object('open_date', (v_open + 1)::text, 'close_date', v_close::text),
          0.95)
  returning id into v_clean;

  -- Dirty: the same proposal, but the model wasn't sure. Must be left alone.
  insert into public.review_queue (target_table, target_id, change_type, proposed_payload, confidence)
  values ('seasons', v_season, 'update',
          jsonb_build_object('open_date', (v_open + 2)::text, 'close_date', v_close::text),
          0.40)
  returning id into v_dirty;

  v_res := public.approve_clean_reviews(true, 0.85, 50);

  if (v_res->>'approved')::int <> 1 or (v_res->>'failed')::int <> 0 then
    raise exception 'sweep applied the wrong set: %', v_res;
  end if;
  if (select status from public.review_queue where id = v_clean) <> 'approved' then
    raise exception 'clean item was not approved';
  end if;
  if (select status from public.review_queue where id = v_dirty) <> 'pending' then
    raise exception 'sweep touched a low-confidence item';
  end if;
  if (select open_date from public.seasons where id = v_season) <> v_open + 1 then
    raise exception 'sweep reported success without writing the date';
  end if;

  select count(*) into v_cnt
  from public.date_changes
  where target_table = 'seasons' and target_id = v_season
    and old_date = v_open and new_date = v_open + 1;
  if v_cnt <> 0 then
    raise exception 'quiet sweep still logged a change (% rows)', v_cnt;
  end if;

  -- Put everything back: the date, the verification stamp, the queue.
  perform set_config('openseason.quiet_apply', 'on', true);
  update public.seasons
  set open_date = v_open, last_verified_at = v_verified
  where id = v_season;
  perform set_config('openseason.quiet_apply', 'off', true);

  delete from public.review_queue where id in (v_clean, v_dirty);

  select current_date into v_now;
  raise notice 'clean sweep verified on season % (%)', v_season, v_now;
end $$;
