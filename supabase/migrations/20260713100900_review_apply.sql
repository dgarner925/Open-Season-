-- 20260713100900_review_apply.sql
-- Phase 2 apply path: an admin approves a review_queue item, and this RPC applies
-- the proposed change to the live table and stamps last_verified_at. Nothing here
-- runs automatically — it's only ever called from the admin review screen.

-- The extraction pipeline needs to know which state a source belongs to.
alter table public.sources add column if not exists state_id uuid references public.states(id) on delete set null;

-- Point the seeded Georgia sources at Georgia so the PoC can resolve them.
update public.sources s
set state_id = (select id from public.states where code = 'GA')
where s.state_id is null and s.url like '%georgiawildlife.com%';

-- ---------------------------------------------------------------------------
-- apply_review_item(review_id): admin-only. Applies a pending seasons proposal
-- (create or update), stamps last_verified_at, and marks the item approved.
-- ---------------------------------------------------------------------------
create or replace function public.apply_review_item(p_review_id uuid)
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
  if r.target_table <> 'seasons' then
    raise exception 'apply_review_item v1 only supports the seasons table';
  end if;

  p := r.proposed_payload;

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
  else -- update
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

  update public.review_queue
  set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  where id = r.id;
end;
$$;

revoke all on function public.apply_review_item(uuid) from public;
grant execute on function public.apply_review_item(uuid) to authenticated;
