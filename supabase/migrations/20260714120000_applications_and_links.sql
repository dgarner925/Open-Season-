-- 20260714120000_applications_and_links.sql
-- (1) State license/tag purchase portal links.
-- (2) A per-user application tracker: what you applied for, when, the link, your
--     portal username, status, fees, notes. NO passwords are stored here by
--     design — those belong in the phone's password manager.

-- ---------------------------------------------------------------------------
-- 1. License / purchase portal link per state
-- ---------------------------------------------------------------------------
alter table public.states add column if not exists license_url text;

update public.states set license_url = 'https://georgiawildlife.com/licenses-permits-passes' where code = 'GA' and license_url is null;
update public.states set license_url = 'https://www.outdooralabama.com/licenses' where code = 'AL' and license_url is null;
update public.states set license_url = 'https://www.cpwshop.com/' where code = 'CO' and license_url is null;
update public.states set license_url = 'https://ols.fwp.mt.gov/' where code = 'MT' and license_url is null;
update public.states set license_url = 'https://wgfd.wyo.gov/licenses-applications' where code = 'WY' and license_url is null;

-- ---------------------------------------------------------------------------
-- 2. Application tracker
-- ---------------------------------------------------------------------------
create type application_status as enum ('planned', 'applied', 'successful', 'unsuccessful', 'purchased');

create table public.user_applications (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  state_id         uuid references public.states(id) on delete set null,
  species_id       uuid references public.species(id) on delete set null,
  window_id        uuid references public.application_windows(id) on delete set null,
  title            text not null,              -- e.g. "Colorado Elk — Primary Draw"
  application_url  text,                        -- the portal you used
  portal_username  text,                        -- username only; never a password
  status           application_status not null default 'applied',
  applied_on       date,
  results_on       date,
  fee_summary      text,
  points           smallint,                    -- preference/bonus points, if tracked
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger user_applications_set_updated_at
  before update on public.user_applications
  for each row execute function public.set_updated_at();
create index user_applications_user_idx on public.user_applications(user_id);

alter table public.user_applications enable row level security;
create policy user_applications_owner_all on public.user_applications
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
