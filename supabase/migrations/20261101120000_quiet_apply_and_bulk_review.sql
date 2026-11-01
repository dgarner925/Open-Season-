-- 20261101120000_quiet_apply_and_bulk_review.sql
-- Two things the admin review screen needed before anyone could realistically
-- work a 300-item queue by hand.
--
-- 1. QUIET APPLY
--    The watchdog turns any date revision on a PUBLISHED row into a push for
--    every follower — "the app noticed the change so you don't have to." That
--    is right when an agency actually moves an opener. It is wrong when we are
--    correcting our own extraction: clearing one extraction backlog on
--    2026-10-31 would have sent 373 "dates changed" alerts for dates that never
--    moved in the real world.
--
--    A quiet apply writes the correction without logging it as a change, so no
--    alert is generated and the in-app Updates history keeps meaning "an agency
--    changed something" rather than "we fixed our own typo."
--
--    Mechanism: apply_review_item() sets a transaction-local GUC that the two
--    logging triggers check. date_changes is read only by those notification
--    branches and by the app's Updates list, so skipping the log IS the whole
--    suppression — notifications_due() is deliberately left untouched.
--
--    The audit trail does not depend on date_changes: review_queue keeps the
--    proposal, the before snapshot, the source quote, who approved it and when.
--
-- 2. BULK APPROVE OF CLEAN ITEMS
--    One tap per card is data entry, not review, and rubber-stamping 300 cards
--    defeats the gate. approve_clean_reviews() applies only the items the
--    pipeline is confident about AND that passed our own validation checks,
--    leaving every low-confidence or flagged row for a human eye. An item that
--    fails to apply stays pending with the reason in review_notes instead of
--    aborting the batch.

-- ---------------------------------------------------------------------------
-- 1. The quiet flag, read by the watchdog triggers
-- ---------------------------------------------------------------------------
-- Transaction-local, set by apply_review_item() and never by a client: the
-- function is security definer, so a caller cannot set it themselves and then
-- sneak a silent change past the watchdog by writing the table directly (RLS
-- already forbids that).
create or replace function public.quiet_apply_active()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(current_setting('openseason.quiet_apply', true), 'off') = 'on';
$$;

create or replace function public.log_season_date_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- A correction to our own data is not news. See quiet_apply_active().
  if public.quiet_apply_active() then
    return new;
  end if;

  if old.status = 'published' and new.status = 'published' then
    if old.open_date is not null and new.open_date is not null
       and old.open_date is distinct from new.open_date then
      insert into public.date_changes (target_table, target_id, field, old_date, new_date)
      values ('seasons', new.id, 'open_date', old.open_date, new.open_date)
      on conflict do nothing;
    end if;
    if old.close_date is not null and new.close_date is not null
       and old.close_date is distinct from new.close_date then
      insert into public.date_changes (target_table, target_id, field, old_date, new_date)
      values ('seasons', new.id, 'close_date', old.close_date, new.close_date)
      on conflict do nothing;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.log_window_date_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.quiet_apply_active() then
    return new;
  end if;

  if old.status = 'published' and new.status = 'published' then
    if old.closes_at is not null and new.closes_at is not null
       and old.closes_at is distinct from new.closes_at then
      insert into public.date_changes (target_table, target_id, field, old_date, new_date)
      values ('application_windows', new.id, 'closes_at', old.closes_at, new.closes_at)
      on conflict do nothing;
    end if;
    if old.results_expected_at is not null and new.results_expected_at is not null
       and old.results_expected_at is distinct from new.results_expected_at then
      insert into public.date_changes (target_table, target_id, field, old_date, new_date)
      values ('application_windows', new.id, 'results_expected_at', old.results_expected_at, new.results_expected_at)
      on conflict do nothing;
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. apply_review_item(review_id, quiet)
--    Body is unchanged from 20260714150000 apart from the quiet bracket.
--    The 1-argument version is dropped rather than kept alongside: two
--    overloads where one has a default makes a 1-argument call ambiguous.
-- ---------------------------------------------------------------------------
drop function if exists public.apply_review_item(uuid);

create or replace function public.apply_review_item(
  p_review_id uuid,
  p_quiet boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.review_queue;
  p jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select * into r from public.review_queue where id = p_review_id and status = 'pending';
  if not found then
    raise exception 'review item not found or not pending';
  end if;

  -- Transaction-local: it covers the writes below and is cleared before we
  -- return, so a later statement in the same transaction alerts normally.
  if coalesce(p_quiet, false) then
    perform set_config('openseason.quiet_apply', 'on', true);
  end if;

  p := r.proposed_payload;

  -- seasons -----------------------------------------------------------------
  if r.target_table = 'seasons' then
    if r.change_type = 'create' then
      insert into public.seasons (
        state_id, species_id, zone_id, season_year, method, label,
        open_date, close_date, bag_limit_summary, notes, source_id, last_verified_at, status
      ) values (
        (p->>'state_id')::uuid,
        (p->>'species_id')::uuid,
        (p->>'zone_id')::uuid,
        (p->>'season_year')::smallint,
        (p->>'method')::season_method,
        nullif(p->>'label', ''),
        nullif(p->>'open_date', '')::date,
        nullif(p->>'close_date', '')::date,
        nullif(p->>'bag_limit_summary', ''),
        nullif(p->>'notes', ''),
        (p->>'source_id')::uuid,
        now(),
        coalesce(nullif(p->>'status', ''), 'published')::content_status
      );
    else
      update public.seasons set
        open_date         = nullif(p->>'open_date', '')::date,
        close_date        = nullif(p->>'close_date', '')::date,
        bag_limit_summary = coalesce(nullif(p->>'bag_limit_summary', ''), bag_limit_summary),
        notes             = coalesce(nullif(p->>'notes', ''), notes),
        label             = coalesce(nullif(p->>'label', ''), label),
        last_verified_at  = now(),
        status            = coalesce(nullif(p->>'status', ''), status::text)::content_status
      where id = r.target_id;
    end if;

  -- application_windows -----------------------------------------------------
  elsif r.target_table = 'application_windows' then
    if r.change_type = 'create' then
      insert into public.application_windows (
        state_id, species_id, zone_id, season_year, name,
        opens_at, closes_at, results_expected_at, fee_summary, application_url,
        source_id, last_verified_at, status
      ) values (
        (p->>'state_id')::uuid,
        (p->>'species_id')::uuid,
        nullif(p->>'zone_id', '')::uuid,
        (p->>'season_year')::smallint,
        nullif(p->>'name', ''),
        nullif(p->>'opens_at', '')::date,
        nullif(p->>'closes_at', '')::date,
        nullif(p->>'results_expected_at', '')::date,
        nullif(p->>'fee_summary', ''),
        nullif(p->>'application_url', ''),
        (p->>'source_id')::uuid,
        now(),
        coalesce(nullif(p->>'status', ''), 'published')::content_status
      );
    else
      update public.application_windows set
        opens_at            = nullif(p->>'opens_at', '')::date,
        closes_at           = nullif(p->>'closes_at', '')::date,
        results_expected_at = nullif(p->>'results_expected_at', '')::date,
        name                = coalesce(nullif(p->>'name', ''), name),
        fee_summary         = coalesce(nullif(p->>'fee_summary', ''), fee_summary),
        application_url     = coalesce(nullif(p->>'application_url', ''), application_url),
        last_verified_at    = now(),
        status              = coalesce(nullif(p->>'status', ''), status::text)::content_status
      where id = r.target_id;
    end if;

  -- regulation_summaries ----------------------------------------------------
  elsif r.target_table = 'regulation_summaries' then
    if r.change_type = 'create' then
      insert into public.regulation_summaries (
        state_id, species_id, body, source_id, last_verified_at, status
      ) values (
        (p->>'state_id')::uuid,
        (p->>'species_id')::uuid,
        p->>'body',
        (p->>'source_id')::uuid,
        now(),
        coalesce(nullif(p->>'status', ''), 'published')::content_status
      );
    else
      update public.regulation_summaries set
        body             = coalesce(nullif(p->>'body', ''), body),
        last_verified_at = now(),
        status           = coalesce(nullif(p->>'status', ''), status::text)::content_status
      where id = r.target_id;
    end if;

  else
    perform set_config('openseason.quiet_apply', 'off', true);
    raise exception 'unsupported target_table: %', r.target_table;
  end if;

  update public.review_queue
  set status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_notes = case when coalesce(p_quiet, false)
                          then 'applied quietly (no follower alert)'
                          else review_notes end
  where id = r.id;

  perform set_config('openseason.quiet_apply', 'off', true);
end;
$$;

revoke all on function public.apply_review_item(uuid, boolean) from public;
grant execute on function public.apply_review_item(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. approve_clean_reviews(quiet, min_confidence, limit)
--    "Clean" means: the model gave a confidence AND it is at or above the
--    threshold AND our own validation found nothing wrong. A null confidence is
--    never clean — an item we can't score is exactly the one needing a human.
-- ---------------------------------------------------------------------------
create or replace function public.approve_clean_reviews(
  p_quiet boolean default true,
  p_min_confidence numeric default 0.85,
  p_limit integer default 1000
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec       record;
  n_ok      integer := 0;
  n_fail    integer := 0;
  failures  jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if p_min_confidence is null or p_min_confidence < 0 or p_min_confidence > 1 then
    raise exception 'p_min_confidence must be between 0 and 1';
  end if;

  for rec in
    select id
    from public.review_queue
    where status = 'pending'
      and confidence is not null
      and confidence >= p_min_confidence
      and coalesce(cardinality(validation_errors), 0) = 0
    order by created_at
    limit greatest(coalesce(p_limit, 1000), 0)
  loop
    -- Per-item subtransaction: one unapplicable payload (a species that no
    -- longer exists, a zone that was renamed) must not roll back the batch.
    begin
      perform public.apply_review_item(rec.id, p_quiet);
      n_ok := n_ok + 1;
    exception when others then
      n_fail := n_fail + 1;
      failures := failures || jsonb_build_object('id', rec.id, 'error', sqlerrm);
    end;
  end loop;

  -- Leave the failures pending, with the reason visible on the card.
  if n_fail > 0 then
    update public.review_queue q
    set review_notes = f->>'error'
    from jsonb_array_elements(failures) as f
    where q.id = (f->>'id')::uuid
      and q.status = 'pending';
  end if;

  return jsonb_build_object(
    'approved', n_ok,
    'failed', n_fail,
    'quiet', coalesce(p_quiet, true),
    'min_confidence', p_min_confidence,
    'failures', failures
  );
end;
$$;

revoke all on function public.approve_clean_reviews(boolean, numeric, integer) from public;
grant execute on function public.approve_clean_reviews(boolean, numeric, integer) to authenticated;

-- The clean sweep scans pending by confidence; the existing index is
-- (status, created_at), which doesn't help that filter.
create index if not exists review_queue_pending_confidence_idx
  on public.review_queue (status, confidence desc);
