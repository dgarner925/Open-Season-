-- 20260808150000_party_code_fix.sql
-- create_party failed in production: gen_random_bytes lives in the extensions
-- schema, which the function's `set search_path = public` hides. Generate the
-- invite code with pure built-ins instead (md5 over random + clock).

create or replace function public.create_party(p_window_id uuid)
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

  select id, parties.invite_code into v_id, v_code
  from public.parties
  where window_id = p_window_id and owner_id = auth.uid();

  if v_id is null then
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    insert into public.parties (window_id, owner_id, invite_code)
    values (p_window_id, auth.uid(), v_code)
    returning id into v_id;
  end if;

  insert into public.party_members (party_id, user_id)
  values (v_id, auth.uid())
  on conflict do nothing;

  perform public._party_autofollow(p_window_id);
  return query select v_id, v_code;
end;
$$;
revoke all on function public.create_party(uuid) from public;
grant execute on function public.create_party(uuid) to authenticated;
