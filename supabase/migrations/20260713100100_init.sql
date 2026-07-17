-- 0001_init.sql
-- Extensions, enums, and shared helper functions for OpenSeason.
--
-- Review notes:
--  * Enums are used for small, stable value sets. season_method and the others
--    can be extended later with `ALTER TYPE ... ADD VALUE 'x'` (see comments).
--  * public.is_admin() is SECURITY DEFINER so RLS policies can call it without
--    recursing into the profiles table's own policies.

create extension if not exists pgcrypto;      -- gen_random_uuid()

-- NOTE: pg_cron (scheduled jobs) and pg_net (net.http_post, used by the cron
-- jobs to call Edge Functions) are managed by Supabase at the platform level.
-- These `create extension` lines are a NO-OP on a hosted project — they neither
-- install the extensions nor error, so a migration alone leaves you with
-- "schema cron does not exist". They MUST be toggled on in the Dashboard:
--   Database -> Extensions -> enable `pg_net`, then `pg_cron`.
-- Verify with:
--   select name, installed_version from pg_available_extensions
--   where name in ('pg_cron','pg_net');
-- Kept here to document the dependency.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- Publishing lifecycle for all reference content. Nothing is public until
-- an admin flips it to 'published'.
create type content_status as enum ('draft', 'published', 'archived');

-- Zone granularity. V1 mostly seeds 'statewide' but the model is zone-first.
create type zone_type as enum ('statewide', 'county_group', 'gmu', 'flyway_zone');

-- Weapon / method for a season. Extend with ALTER TYPE ADD VALUE as needed
-- (e.g. 'crossbow', 'shotgun_only').
create type season_method as enum ('archery', 'muzzleloader', 'firearm', 'general');

-- What kind of official document a source points to.
create type source_doc_type as enum ('webpage', 'pdf', 'other');

-- Automated-extraction review workflow.
create type review_status as enum ('pending', 'approved', 'rejected');
create type review_change_type as enum ('create', 'update');

-- What a notification is about (used for idempotency keys).
create type notification_subject_type as enum ('season_opener', 'application_deadline');

-- ---------------------------------------------------------------------------
-- Helper: keep updated_at fresh
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- NOTE: public.is_admin() is defined in 0003_user.sql, right after the
-- profiles table it reads from (a SQL function body is validated against
-- existing objects at creation time, so profiles must exist first).
