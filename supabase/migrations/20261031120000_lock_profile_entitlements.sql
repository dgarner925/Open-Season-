-- 20261031120000_lock_profile_entitlements.sql
-- Close the free-Pro hole: a signed-in client could grant itself Pro.
--
-- profiles_update_own's WITH CHECK constrains only `id` and `is_admin`, so any
-- authenticated user could PATCH their own row with {"is_premium": true} using
-- the public key — unlocking push alerts, the daily brief, and unlimited
-- "Ask the book" — and setting grandfathered = true stopped the RevenueCat
-- webhook from ever revoking it. profiles_insert_own had the same gap.
--
-- This was logged as an accepted v1 risk when is_premium gated only push
-- alerts. It no longer is: is_premium now gates features that spend money per
-- call against our Anthropic account.
--
-- Why a trigger rather than a column REVOKE: Supabase grants table-level UPDATE
-- to `authenticated`, so a column REVOKE does nothing unless the table grant is
-- removed and every other column re-granted one by one — which breaks the next
-- time a column is added. One trigger survives schema changes.

create or replace function public.guard_profile_entitlements()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- Server-side callers (service_role, postgres, dashboard) pass straight through.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- A client may self-heal its own profile row, but never as Pro.
    new.is_premium    := false;
    new.grandfathered := false;
    return new;
  end if;

  if new.is_premium is distinct from old.is_premium
     or new.grandfathered is distinct from old.grandfathered then
    raise exception 'is_premium and grandfathered can only be changed by the server'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_entitlements on public.profiles;
create trigger profiles_guard_entitlements
  before insert or update on public.profiles
  for each row execute function public.guard_profile_entitlements();

revoke all on function public.guard_profile_entitlements() from public;
