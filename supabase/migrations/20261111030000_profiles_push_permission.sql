-- Record what the OS said about notifications
--
-- On 2026-11-11 this question took a day to answer and the answer was a guess:
-- 97 users, 91 with follows, 41 reachable by any notification. 39 premium
-- users, 17 reachable. Four premium users follow Colorado turkey and not one
-- could be told when the tags go on sale.
--
-- The app had been asking all of them -- from `(tabs)/_layout`, in the first
-- seconds of a first session, before showing anyone a date. On iOS that prompt
-- comes once. And `src/lib/push.ts` caught its own failures into console.warn
-- and dropped them, so nothing anywhere recorded whether a user had declined,
-- had never been asked, or had hit an error. Hence the guessing.
--
-- Two columns, written by the client through `profiles_update_own`. Neither is
-- an entitlement, so `guard_profile_entitlements` leaves them alone; writes are
-- rare enough that bumping `updated_at` costs nothing.

alter table public.profiles
  add column if not exists push_permission text,
  add column if not exists push_permission_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_push_permission_known;

alter table public.profiles
  add constraint profiles_push_permission_known
  check (push_permission is null
         or push_permission in ('granted', 'denied', 'undetermined'));

comment on column public.profiles.push_permission is
  'Last known OS notification permission: granted, denied (and unaskable), or undetermined. Null means the app has not reported since this column shipped — not that the user declined.';

-- Who can be reached, and who decided they could not be.
create index if not exists profiles_push_permission_idx
  on public.profiles (push_permission)
  where push_permission is not null;
