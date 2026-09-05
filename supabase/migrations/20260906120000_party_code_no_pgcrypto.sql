-- 20260906120000_party_code_no_pgcrypto.sql
-- Bug (David, build 70, Sep 5 logs): create_party failed with 42883
-- "function gen_random_bytes(integer) does not exist" — pgcrypto lives in the
-- extensions schema on Supabase, invisible from this function's pinned
-- search_path = public. Rather than qualify the extension, drop the
-- dependency: mint the 8-hex invite code from the built-in gen_random_uuid().
create or replace function public.create_party(p_window_id uuid default null, p_season_id uuid default null)
returns table (party_id uuid, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if num_nonnulls(p_window_id, p_season_id) <> 1 then
    raise exception 'exactly one of p_window_id or p_season_id is required';
  end if;

  select id, parties.invite_code into v_id, v_code
  from public.parties
  where owner_id = auth.uid()
    and (window_id = p_window_id or season_id = p_season_id);

  if v_id is null then
    -- 8 hex chars from a v4 uuid — no pgcrypto needed.
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    insert into public.parties (window_id, season_id, owner_id, invite_code)
    values (p_window_id, p_season_id, auth.uid(), v_code)
    returning id into v_id;
  end if;

  insert into public.party_members (party_id, user_id)
  values (v_id, auth.uid())
  on conflict do nothing;

  perform public._party_autofollow_target(p_window_id, p_season_id);
  return query select v_id, v_code;
end;
$$;
