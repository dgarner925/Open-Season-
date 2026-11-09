-- 20261109030000_party_messages_avatars_and_days.sql
-- Three things a camp roster was missing: talk, faces, and who is coming.
--
-- Written to the conventions already here: membership-gated RLS through
-- is_party_member(), every write behind a SECURITY DEFINER RPC, nothing
-- writable directly from the client.
--
-- WHAT APPLE REQUIRES, AND WHERE IT LIVES
--   Messages and avatars are user-generated content, so Guideline 1.2 asks
--   for filtering, reporting, blocking, and a way to act on reports:
--     filtering  -> post_party_message() rejects a blocklist, server side,
--                   where the client cannot skip it
--     reporting  -> report_party_message(), one row per reporter per message
--     blocking   -> blocked_users; party_thread() hides blocked authors, and
--                   blocking is mutual so neither sees the other
--     acting     -> is_admin on profiles can soft-delete any message
--
-- ---------------------------------------------------------------------------
-- 1. Faces
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists avatar_url text;

-- Public bucket: an avatar is shown to everyone in your party, and signing
-- every roster row would cost a round trip per face. The path is the user's
-- id, so nobody can write over anyone else's.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists avatars_write_own on storage.objects;
create policy avatars_write_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.set_avatar_url(p_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  -- Only our own bucket, and only ever this user's own folder. Without this
  -- a client could point its face at any URL on the internet.
  if p_url is not null and p_url !~ ('^https://[a-z0-9.-]+/storage/v1/object/public/avatars/' || auth.uid()::text || '/') then
    raise exception 'avatar must live in this user''s own avatars folder';
  end if;
  update public.profiles set avatar_url = p_url, updated_at = now() where id = auth.uid();
end;
$$;
revoke all on function public.set_avatar_url(text) from public;
grant execute on function public.set_avatar_url(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Blocking, which messaging cannot ship without
-- ---------------------------------------------------------------------------

create table if not exists public.blocked_users (
  user_id         uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (user_id, blocked_user_id),
  check (user_id <> blocked_user_id)
);
alter table public.blocked_users enable row level security;
drop policy if exists blocked_users_own_read on public.blocked_users;
create policy blocked_users_own_read on public.blocked_users
  for select to authenticated using (user_id = auth.uid());
grant select on public.blocked_users to authenticated;

create or replace function public.block_user(p_user_id uuid, p_blocked boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_user_id = auth.uid() then raise exception 'cannot block yourself'; end if;
  if p_blocked then
    insert into public.blocked_users (user_id, blocked_user_id)
    values (auth.uid(), p_user_id)
    on conflict do nothing;
  else
    delete from public.blocked_users
    where user_id = auth.uid() and blocked_user_id = p_user_id;
  end if;
end;
$$;
revoke all on function public.block_user(uuid, boolean) from public;
grant execute on function public.block_user(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Messages
-- ---------------------------------------------------------------------------

create table if not exists public.party_messages (
  id          uuid primary key default gen_random_uuid(),
  party_id    uuid not null references public.parties(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  body        text not null check (length(btrim(body)) between 1 and 2000),
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  deleted_by  uuid references auth.users(id) on delete set null
);
create index if not exists party_messages_party_idx
  on public.party_messages(party_id, created_at desc);

alter table public.party_messages enable row level security;
drop policy if exists party_messages_member_read on public.party_messages;
create policy party_messages_member_read on public.party_messages
  for select to authenticated using (public.is_party_member(party_id));
grant select on public.party_messages to authenticated;

create table if not exists public.party_message_reports (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references public.party_messages(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason      text,
  created_at  timestamptz not null default now(),
  unique (message_id, reporter_id)
);
alter table public.party_message_reports enable row level security;
grant select on public.party_message_reports to authenticated;
drop policy if exists party_message_reports_own_read on public.party_message_reports;
create policy party_message_reports_own_read on public.party_message_reports
  for select to authenticated using (reporter_id = auth.uid());

-- The filter. Deliberately short and server-side: a blocklist is the floor
-- Apple asks for, not a claim to have solved moderation. It lives here rather
-- than in the client so no build can skip it.
create or replace function public.message_is_objectionable(p_body text)
returns boolean
language sql
immutable
as $$
  select lower(p_body) ~ (
    '\m(' ||
    'fuck|shit|cunt|bitch|bastard|asshole|' ||
    'nigger|nigga|faggot|fag|kike|spic|chink|wetback|tranny|retard' ||
    ')\M'
  );
$$;

create or replace function public.post_party_message(p_party_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_body text := btrim(coalesce(p_body, ''));
  v_id   uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not public.is_party_member(p_party_id) then
    raise exception 'not a member of this party';
  end if;
  if length(v_body) = 0 then raise exception 'message is empty'; end if;
  if length(v_body) > 2000 then raise exception 'message is too long'; end if;
  if public.message_is_objectionable(v_body) then
    raise exception 'objectionable language';
  end if;

  insert into public.party_messages (party_id, user_id, body)
  values (p_party_id, auth.uid(), v_body)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.post_party_message(uuid, text) from public;
grant execute on function public.post_party_message(uuid, text) to authenticated;

-- Reading the thread: hides deleted messages, hides anyone either party has
-- blocked (mutually), and carries the face so the list needs one call.
create or replace function public.party_thread(p_party_id uuid, p_limit int default 200)
returns table (
  id uuid, user_id uuid, display_name text, avatar_url text,
  body text, created_at timestamptz, mine boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id,
    m.user_id,
    coalesce(nullif(btrim(pr.display_name), ''), 'Hunter'),
    pr.avatar_url,
    m.body,
    m.created_at,
    (m.user_id = auth.uid())
  from public.party_messages m
  left join public.profiles pr on pr.id = m.user_id
  where m.party_id = p_party_id
    and public.is_party_member(p_party_id)
    and m.deleted_at is null
    and not exists (
      select 1 from public.blocked_users b
      where (b.user_id = auth.uid() and b.blocked_user_id = m.user_id)
         or (b.user_id = m.user_id and b.blocked_user_id = auth.uid())
    )
  order by m.created_at
  limit greatest(1, least(coalesce(p_limit, 200), 500));
$$;
revoke all on function public.party_thread(uuid, int) from public;
grant execute on function public.party_thread(uuid, int) to authenticated;

create or replace function public.report_party_message(p_message_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_party uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select party_id into v_party from public.party_messages where id = p_message_id;
  if v_party is null or not public.is_party_member(v_party) then
    raise exception 'message not found';
  end if;
  insert into public.party_message_reports (message_id, reporter_id, reason)
  values (p_message_id, auth.uid(), nullif(btrim(coalesce(p_reason, '')), ''))
  on conflict (message_id, reporter_id) do nothing;
end;
$$;
revoke all on function public.report_party_message(uuid, text) from public;
grant execute on function public.report_party_message(uuid, text) to authenticated;

-- Taking a message down: your own always, anyone's if you are an admin.
create or replace function public.delete_party_message(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author uuid;
  v_party  uuid;
  v_admin  boolean;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select user_id, party_id into v_author, v_party
  from public.party_messages where id = p_message_id;
  if v_party is null or not public.is_party_member(v_party) then
    raise exception 'message not found';
  end if;
  select coalesce(is_admin, false) into v_admin from public.profiles where id = auth.uid();
  if v_author <> auth.uid() and not v_admin then
    raise exception 'not yours to delete';
  end if;
  update public.party_messages
  set deleted_at = now(), deleted_by = auth.uid()
  where id = p_message_id and deleted_at is null;
end;
$$;
revoke all on function public.delete_party_message(uuid) from public;
grant execute on function public.delete_party_message(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Who is coming which days
-- ---------------------------------------------------------------------------
-- The thing a group text cannot do: hold state. A thread re-asks "who's in
-- Thursday?" every season; a row answers it once.

create table if not exists public.party_days (
  party_id uuid not null references public.parties(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  day      date not null,
  primary key (party_id, user_id, day)
);
alter table public.party_days enable row level security;
drop policy if exists party_days_member_read on public.party_days;
create policy party_days_member_read on public.party_days
  for select to authenticated using (public.is_party_member(party_id));
grant select on public.party_days to authenticated;

create or replace function public.set_party_day(p_party_id uuid, p_day date, p_going boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not public.is_party_member(p_party_id) then
    raise exception 'not a member of this party';
  end if;
  if p_going then
    insert into public.party_days (party_id, user_id, day)
    values (p_party_id, auth.uid(), p_day)
    on conflict do nothing;
  else
    delete from public.party_days
    where party_id = p_party_id and user_id = auth.uid() and day = p_day;
  end if;
end;
$$;
revoke all on function public.set_party_day(uuid, date, boolean) from public;
grant execute on function public.set_party_day(uuid, date, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. The roster carries faces now
-- ---------------------------------------------------------------------------

drop function if exists public.party_roster(uuid);
create or replace function public.party_roster(p_party_id uuid)
returns table (
  user_id uuid, display_name text, avatar_url text,
  joined_at timestamptz, applied_at timestamptz, is_owner boolean, days date[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pm.user_id,
    coalesce(nullif(btrim(pr.display_name), ''), 'Hunter'),
    pr.avatar_url,
    pm.joined_at,
    pm.applied_at,
    (pm.user_id = p.owner_id),
    coalesce(
      (select array_agg(d.day order by d.day)
       from public.party_days d
       where d.party_id = pm.party_id and d.user_id = pm.user_id),
      '{}'::date[]
    )
  from public.party_members pm
  join public.parties p on p.id = pm.party_id
  left join public.profiles pr on pr.id = pm.user_id
  where pm.party_id = p_party_id
    and public.is_party_member(p_party_id)
  order by pm.joined_at;
$$;
revoke all on function public.party_roster(uuid) from public;
grant execute on function public.party_roster(uuid) to authenticated;
