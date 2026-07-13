-- 0003_user.sql
-- Per-user data: profiles, follows, alert preferences, push tokens, and the
-- idempotency log for sent notifications. RLS in 0005 locks these to the owner.

-- ---------------------------------------------------------------------------
-- profiles — 1:1 with auth.users. is_admin gates reference-data writes and the
-- in-app admin review tab.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  is_admin      boolean not null default false,
  onboarded_at  timestamptz,                  -- set when the user finishes picking states/species
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Now that profiles exists, define is_admin() (declared/needed by RLS in 0005).
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- follows — a user follows a (state, species) combination.
-- ---------------------------------------------------------------------------
create table public.follows (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  state_id    uuid not null references public.states(id) on delete cascade,
  species_id  uuid not null references public.species(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user_id, state_id, species_id)
);
create index follows_user_idx on public.follows(user_id);

-- ---------------------------------------------------------------------------
-- alert_preferences — 1:1 with a follow. Offsets are days-before arrays so we
-- can add cadences (e.g. 14) later without a schema change. Deadlines default
-- ON at all three cadences.
-- ---------------------------------------------------------------------------
create table public.alert_preferences (
  follow_id         uuid primary key references public.follows(id) on delete cascade,
  opener_offsets    smallint[] not null default '{30,7,1}',
  deadline_offsets  smallint[] not null default '{30,7,1}',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- Restrict to a known set of cadences so bad data can't reach the cron job.
  constraint opener_offsets_allowed   check (opener_offsets   <@ array[1,3,7,14,30]::smallint[]),
  constraint deadline_offsets_allowed check (deadline_offsets <@ array[1,3,7,14,30]::smallint[])
);
create trigger alert_preferences_set_updated_at
  before update on public.alert_preferences
  for each row execute function public.set_updated_at();

-- Create a default alert_preferences row whenever a follow is created.
create or replace function public.handle_new_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.alert_preferences (follow_id)
  values (new.id)
  on conflict (follow_id) do nothing;
  return new;
end;
$$;
create trigger on_follow_created
  after insert on public.follows
  for each row execute function public.handle_new_follow();

-- ---------------------------------------------------------------------------
-- device_push_tokens — Expo push tokens, one per device. A user may have many.
-- ---------------------------------------------------------------------------
create table public.device_push_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  token       text not null unique,           -- ExponentPushToken[...]
  platform    text,                           -- 'ios' | 'android'
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger device_push_tokens_set_updated_at
  before update on public.device_push_tokens
  for each row execute function public.set_updated_at();
create index device_push_tokens_user_idx on public.device_push_tokens(user_id);

-- ---------------------------------------------------------------------------
-- sent_notifications — idempotency log. The UNIQUE constraint is what
-- guarantees a user is never pinged twice for the same event+cadence.
-- Written by the Edge Function via service role (bypasses RLS).
-- ---------------------------------------------------------------------------
create table public.sent_notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  subject_type  notification_subject_type not null,
  subject_id    uuid not null,                -- season.id or application_window.id
  offset_days   smallint not null,            -- which cadence fired (30/7/1/...)
  scheduled_for date not null,                -- the event date this refers to
  sent_at       timestamptz not null default now(),
  status        text not null default 'sent', -- 'sent' | 'error'
  detail        text,                         -- expo receipt id or error message
  unique (user_id, subject_type, subject_id, offset_days)
);
create index sent_notifications_user_idx on public.sent_notifications(user_id);
