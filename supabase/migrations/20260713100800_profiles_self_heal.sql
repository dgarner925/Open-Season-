-- 20260713100800_profiles_self_heal.sql
-- Make profile creation resilient.
--
-- The on_auth_user_created trigger creates a profile for normal sign-ups, but
-- users created through some paths (e.g. the dashboard "Add user" tool) can end
-- up without a profile row. When that happens, the onboarding UPDATE matches
-- zero rows and silently "succeeds", leaving the user stuck. Two safeguards:
--   1. Allow an authenticated user to INSERT their own profile (so the client
--      can self-heal a missing row).
--   2. Backfill profile rows for any existing auth users that lack one.

-- 1) Insert-own policy (RLS). id must equal the caller; they can't forge others.
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

-- 2) Backfill any missing profiles for existing users. Runs as the migration
--    role, so it bypasses RLS. Safe/idempotent.
insert into public.profiles (id)
select u.id
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);
