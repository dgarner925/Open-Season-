-- 20261024120000_ai_features.sql
-- Groundwork for the AI features: a token ledger so spend is visible, and an
-- answer cache so the same question asked twice costs nothing the second time.
--
-- Neither table is written by the app. Both are written by Edge Functions
-- running as service_role, which bypasses RLS — so the only policy here is the
-- one that lets a hunter see their own usage.

-- ---------------------------------------------------------------------------
-- 1. Token ledger — one row per model call, per feature.
-- ---------------------------------------------------------------------------
create table if not exists public.ai_usage (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references auth.users(id) on delete cascade,
  feature            text not null,              -- 'ask_book' | 'daily_brief' | 'extract' | ...
  model              text not null,
  input_tokens       integer not null default 0,
  output_tokens      integer not null default 0,
  cache_read_tokens  integer not null default 0,
  served_from_cache  boolean not null default false,
  ok                 boolean not null default true,
  note               text,                       -- rejection reason, error class
  created_at         timestamptz not null default now()
);
-- Rate limiting reads this hot path: "how many calls has this user made today".
create index if not exists ai_usage_user_time_idx on public.ai_usage (user_id, created_at desc);
create index if not exists ai_usage_feature_time_idx on public.ai_usage (feature, created_at desc);

alter table public.ai_usage enable row level security;
drop policy if exists ai_usage_read_own on public.ai_usage;
create policy ai_usage_read_own on public.ai_usage
  for select to authenticated using (user_id = auth.uid());
grant select on public.ai_usage to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Answer cache — normalized question + state + date.
--    Dates matter: "what's open now" means something different tomorrow.
-- ---------------------------------------------------------------------------
create table if not exists public.ai_answer_cache (
  id           uuid primary key default gen_random_uuid(),
  cache_key    text not null unique,
  question     text not null,
  state_code   text,
  asked_on     date not null,
  payload      jsonb not null,                   -- the whole ask-book response
  hit_count    integer not null default 0,
  created_at   timestamptz not null default now(),
  last_hit_at  timestamptz
);
create index if not exists ai_answer_cache_asked_on_idx on public.ai_answer_cache (asked_on);

alter table public.ai_answer_cache enable row level security;
-- No policies: service_role only. The app never reads this directly.

-- ---------------------------------------------------------------------------
-- 3. Housekeeping: yesterday's answers are wrong today. Called by the Edge
--    Function opportunistically; safe to run from cron later.
-- ---------------------------------------------------------------------------
create or replace function public.prune_ai_answer_cache()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.ai_answer_cache where asked_on < current_date - 1;
$$;
revoke all on function public.prune_ai_answer_cache() from public;
grant execute on function public.prune_ai_answer_cache() to service_role;
