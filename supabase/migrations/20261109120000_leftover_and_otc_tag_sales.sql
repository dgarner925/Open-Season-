-- Leftover and over-the-counter tag sales.
--
-- After draw results, most western states put the licences nobody drew back on
-- sale on a fixed date, first come first served. Hunters miss them because the
-- date is buried on an agency page nobody refreshes. This is the data model
-- for knowing when those sales open and what is left in them.
--
-- Three decisions worth defending:
--
-- 1. TIME IS NULLABLE AND DATE IS NOT.
--    A sale that opens "9:00 AM MT Tuesday" and a sale that opens "Tuesday"
--    are different facts, and the second one is far more common on agency
--    pages. Storing a single timestamptz would force a time we do not know,
--    and the app would then render "Tuesday 12:00 AM" or, worse, "Monday
--    7:00 PM" to somebody in another zone. So: date NOT NULL, time NULL, and
--    the UI says "Tuesday" until an agency publishes an hour.
--
-- 2. THE ZONE LIVES ON THE SALE, NOT THE STATE.
--    Nine states straddle a time-zone line. states.time_zone below is the
--    agency's own clock -- a sale opens when the agency's office says it does,
--    not when the hunter's phone does -- and a sale row may override it.
--
-- 3. NOTHING HERE AUTO-PUBLISHES.
--    status defaults to 'draft' and the public read policy only serves
--    'published'. Ingestion proposes into review_queue exactly like seasons
--    and application windows do; apply_review_item is extended at the bottom
--    of this file to know about these two tables. A wrong season date costs a
--    wasted morning. A wrong first-come sale time costs the tag.

-- ---------------------------------------------------------------------------
-- The agency's clock
-- ---------------------------------------------------------------------------

alter table public.states add column if not exists time_zone text;

-- IANA zone of the agency headquarters, which is the clock a sale runs on.
-- For the nine straddling states this is deliberately the capital, not the
-- geographic majority: Pierre and Bismarck are Central though the west of both
-- Dakotas is Mountain; Boise is Mountain though north Idaho is Pacific.
update public.states set time_zone = v.tz from (values
  ('AL','America/Chicago'),       ('AK','America/Anchorage'),
  ('AZ','America/Phoenix'),       ('AR','America/Chicago'),
  ('CA','America/Los_Angeles'),   ('CO','America/Denver'),
  ('CT','America/New_York'),      ('DE','America/New_York'),
  ('DC','America/New_York'),      ('FL','America/New_York'),
  ('GA','America/New_York'),      ('HI','Pacific/Honolulu'),
  ('ID','America/Boise'),         ('IL','America/Chicago'),
  ('IN','America/Indiana/Indianapolis'), ('IA','America/Chicago'),
  ('KS','America/Chicago'),       ('KY','America/New_York'),
  ('LA','America/Chicago'),       ('ME','America/New_York'),
  ('MD','America/New_York'),      ('MA','America/New_York'),
  ('MI','America/Detroit'),       ('MN','America/Chicago'),
  ('MS','America/Chicago'),       ('MO','America/Chicago'),
  ('MT','America/Denver'),        ('NE','America/Chicago'),
  ('NV','America/Los_Angeles'),   ('NH','America/New_York'),
  ('NJ','America/New_York'),      ('NM','America/Denver'),
  ('NY','America/New_York'),      ('NC','America/New_York'),
  ('ND','America/Chicago'),       ('OH','America/New_York'),
  ('OK','America/Chicago'),       ('OR','America/Los_Angeles'),
  ('PA','America/New_York'),      ('RI','America/New_York'),
  ('SC','America/New_York'),      ('SD','America/Chicago'),
  ('TN','America/Chicago'),       ('TX','America/Chicago'),
  ('UT','America/Denver'),        ('VT','America/New_York'),
  ('VA','America/New_York'),      ('WA','America/Los_Angeles'),
  ('WV','America/New_York'),      ('WI','America/Chicago'),
  ('WY','America/Denver')
) as v(code, tz)
where public.states.code = v.code;

-- Every zone named above must be one Postgres can actually resolve, or the
-- trigger below would fail at write time instead of here.
do $$
declare bad text;
begin
  select string_agg(code || '=' || time_zone, ', ') into bad
  from public.states s
  where s.time_zone is not null
    and not exists (select 1 from pg_timezone_names n where n.name = s.time_zone);
  if bad is not null then
    raise exception 'unknown IANA time zone(s): %', bad;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- What a source is FOR
-- ---------------------------------------------------------------------------
--
-- refresh-sources-daily walks `sources` ordered by last_extracted_at and hands
-- each one to the season/application/regulation extractor. Registering a
-- leftover-tag page as a source without this column would therefore feed an
-- agency's licence-sale page to the season extractor, which would dutifully
-- propose nonsense into review_queue every night.
--
-- Existing rows all default to 'seasons', which is what they are.

alter table public.sources add column if not exists purpose text not null default 'seasons';

alter table public.sources drop constraint if exists sources_purpose_known;
alter table public.sources
  add constraint sources_purpose_known
  check (purpose in ('seasons', 'leftover_tags'));

create index if not exists sources_purpose_stalest
  on public.sources (purpose, last_extracted_at nulls first);

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.leftover_sale_type as enum ('leftover', 'otc', 'reissue');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.leftover_availability_status as enum ('available', 'sold_out', 'unknown');
exception when duplicate_object then null; end $$;

-- Two new reasons to send somebody a push. These join season_opener,
-- application_deadline, application_results, date_change, permit_opener and
-- weekend_brief, and they key into the same sent_notifications ledger, so the
-- existing UNIQUE (user_id, subject_type, subject_id, offset_days) is what
-- stops a double send.
alter type public.notification_subject_type add value if not exists 'leftover_sale';
alter type public.notification_subject_type add value if not exists 'leftover_availability';

-- ---------------------------------------------------------------------------
-- Sales
-- ---------------------------------------------------------------------------

create table if not exists public.leftover_tag_sales (
  id uuid primary key default gen_random_uuid(),
  state_id uuid not null references public.states(id) on delete cascade,
  species_id uuid not null references public.species(id) on delete cascade,
  -- Null means the sale is not tied to one unit. A unit-scoped sale points at
  -- the same zones rows the seasons do, so the UI can name it the same way.
  zone_id uuid references public.zones(id) on delete set null,

  season_year smallint not null,
  sale_type public.leftover_sale_type not null,
  -- The agency's own words for it: "Leftover limited licence sale",
  -- "Over-the-counter elk", "Reissued antlerless". Shown as the title.
  name text not null,

  sale_start_date date not null,
  sale_start_time time,                      -- null: the agency published no hour
  sale_end_date date,
  sale_end_time time,
  -- Defaults from states.time_zone; set explicitly only when a sale runs on a
  -- different clock from the agency's office.
  time_zone text,

  -- Who may buy. Subset of {resident, nonresident}; both means open to all.
  residency text[] not null default '{resident,nonresident}',

  purchase_url text,
  source_id uuid references public.sources(id) on delete set null,
  source_url text,
  last_verified_at timestamptz,

  status public.content_status not null default 'draft',
  notes text,

  -- Maintained by the trigger below, never written by hand: the sale's start
  -- and end as absolute instants, so "what opens in the next 72 hours" is one
  -- indexed comparison instead of fifty time-zone conversions.
  sale_start_at timestamptz not null,
  sale_end_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint leftover_sales_residency_known check (
    residency <@ array['resident','nonresident']::text[] and array_length(residency, 1) >= 1
  ),
  constraint leftover_sales_end_after_start check (
    sale_end_date is null or sale_end_date >= sale_start_date
  ),
  -- An end time without an end date is a half-written row.
  constraint leftover_sales_end_time_needs_date check (
    sale_end_time is null or sale_end_date is not null
  ),
  constraint leftover_sales_season_year check (season_year between 2020 and 2100)
);

-- One sale per state/species/zone/type/year/start. Expression-based because
-- zone_id is nullable and a plain UNIQUE would let a statewide sale be
-- inserted twice.
create unique index if not exists leftover_sales_identity
  on public.leftover_tag_sales (
    state_id, species_id, coalesce(zone_id, '00000000-0000-0000-0000-000000000000'::uuid),
    sale_type, season_year, sale_start_date
  );

create index if not exists leftover_sales_state_species
  on public.leftover_tag_sales (state_id, species_id);
create index if not exists leftover_sales_start
  on public.leftover_tag_sales (sale_start_at);
-- The only query the alert job runs: published sales starting soon.
create index if not exists leftover_sales_upcoming
  on public.leftover_tag_sales (sale_start_at)
  where status = 'published';

-- ---------------------------------------------------------------------------
-- What is left in them
-- ---------------------------------------------------------------------------

create table if not exists public.leftover_tag_availability (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.leftover_tag_sales(id) on delete cascade,
  unit_code text,
  weapon_type text,
  -- Null is not zero. Most agencies publish a list of units with tags left and
  -- no counts at all; inventing 0 would tell a hunter the unit is gone.
  quantity_remaining int,
  status public.leftover_availability_status not null default 'unknown',
  last_checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leftover_availability_quantity_sane check (
    quantity_remaining is null or quantity_remaining >= 0
  ),
  -- A count of zero and a status of available contradict each other.
  constraint leftover_availability_zero_is_sold_out check (
    quantity_remaining is null or quantity_remaining > 0 or status <> 'available'
  )
);

create unique index if not exists leftover_availability_identity
  on public.leftover_tag_availability (sale_id, coalesce(unit_code, ''), coalesce(weapon_type, ''));
create index if not exists leftover_availability_sale_status
  on public.leftover_tag_availability (sale_id, status);
create index if not exists leftover_availability_status
  on public.leftover_tag_availability (status)
  where status = 'available';

-- ---------------------------------------------------------------------------
-- Every fetch, logged
-- ---------------------------------------------------------------------------

create table if not exists public.source_fetch_log (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.sources(id) on delete set null,
  state_id uuid references public.states(id) on delete set null,
  -- Which job did the fetching: 'leftover_tags', 'seasons', 'regulations'.
  purpose text not null default 'leftover_tags',
  fetched_at timestamptz not null default now(),
  -- ok: fetched and changed. unchanged: hash matched, nothing written.
  -- blocked: robots.txt said no. error: anything else.
  status text not null,
  http_status int,
  -- sha256 of the fetched body. The whole point: an agency page that has not
  -- changed costs one request and no extraction.
  content_hash text,
  bytes int,
  duration_ms int,
  error text,
  constraint source_fetch_log_status_known check (
    status in ('ok', 'unchanged', 'blocked', 'error', 'skipped')
  )
);

create index if not exists source_fetch_log_recent
  on public.source_fetch_log (state_id, purpose, fetched_at desc);
create index if not exists source_fetch_log_source_recent
  on public.source_fetch_log (source_id, fetched_at desc);

-- ---------------------------------------------------------------------------
-- Keeping the absolute instants honest
-- ---------------------------------------------------------------------------

create or replace function public.leftover_sale_resolve_instants()
returns trigger
language plpgsql
as $$
declare
  tz text;
begin
  tz := coalesce(new.time_zone, (select s.time_zone from public.states s where s.id = new.state_id));
  if tz is null then
    raise exception 'no time zone for state % and none given on the sale', new.state_id;
  end if;
  new.time_zone := tz;

  -- No published hour means midnight local, and the client is expected to
  -- render the date alone. sale_start_at exists for ordering and for "within
  -- 72 hours", not for display.
  new.sale_start_at := ((new.sale_start_date::timestamp + coalesce(new.sale_start_time, time '00:00')) at time zone tz);

  if new.sale_end_date is null then
    new.sale_end_at := null;
  else
    -- An end date with no time means the sale runs through that whole day.
    new.sale_end_at := ((new.sale_end_date::timestamp + coalesce(new.sale_end_time, time '23:59')) at time zone tz);
  end if;

  return new;
end $$;

drop trigger if exists leftover_sales_resolve_instants on public.leftover_tag_sales;
create trigger leftover_sales_resolve_instants
  before insert or update of sale_start_date, sale_start_time, sale_end_date, sale_end_time, time_zone, state_id
  on public.leftover_tag_sales
  for each row execute function public.leftover_sale_resolve_instants();

drop trigger if exists leftover_sales_touch on public.leftover_tag_sales;
create trigger leftover_sales_touch
  before update on public.leftover_tag_sales
  for each row execute function public.set_updated_at();

drop trigger if exists leftover_availability_touch on public.leftover_tag_availability;
create trigger leftover_availability_touch
  before update on public.leftover_tag_availability
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.leftover_tag_sales enable row level security;
alter table public.leftover_tag_availability enable row level security;
alter table public.source_fetch_log enable row level security;

drop policy if exists "published sales are readable" on public.leftover_tag_sales;
create policy "published sales are readable"
  on public.leftover_tag_sales for select
  using (status = 'published' or public.is_admin());

drop policy if exists "availability of published sales is readable" on public.leftover_tag_availability;
create policy "availability of published sales is readable"
  on public.leftover_tag_availability for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.leftover_tag_sales s
      where s.id = leftover_tag_availability.sale_id and s.status = 'published'
    )
  );

-- No insert/update/delete policy on either table, by design: the service role
-- bypasses RLS, so ingestion works and no signed-in client can write a sale.

drop policy if exists "admins read the fetch log" on public.source_fetch_log;
create policy "admins read the fetch log"
  on public.source_fetch_log for select
  using (public.is_admin());

grant select on public.leftover_tag_sales to authenticated, anon;
grant select on public.leftover_tag_availability to authenticated, anon;
grant select on public.source_fetch_log to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: where is each state's ingestion standing?
-- ---------------------------------------------------------------------------

create or replace view public.admin_source_health
with (security_invoker = true)
as
select
  st.code as state_code,
  st.name as state_name,
  l.purpose,
  l.fetched_at as last_fetch_at,
  l.status as last_status,
  l.http_status,
  l.error,
  l.content_hash,
  (select count(*) from public.leftover_tag_sales s
    where s.state_id = st.id and s.status = 'published') as published_sales,
  (select count(*) from public.leftover_tag_sales s
    where s.state_id = st.id and s.status = 'draft') as draft_sales,
  (select max(s.last_verified_at) from public.leftover_tag_sales s
    where s.state_id = st.id) as last_verified_at,
  (select count(*) from public.source_fetch_log f
    where f.state_id = st.id and f.status = 'error'
      and f.fetched_at > now() - interval '7 days') as errors_7d
from public.states st
left join lateral (
  select * from public.source_fetch_log f
  where f.state_id = st.id
  order by f.fetched_at desc
  limit 1
) l on true
where st.is_active
order by
  -- Worst first: never fetched, then erroring, then stalest.
  (l.fetched_at is null) desc,
  (l.status = 'error') desc,
  l.fetched_at asc nulls first;

grant select on public.admin_source_health to authenticated;

-- ---------------------------------------------------------------------------
-- Teaching the review queue about leftover sales
-- ---------------------------------------------------------------------------
--
-- apply_review_item is the single place a proposed row becomes a published
-- one. Extending it, rather than letting the ingest function upsert sales
-- directly, keeps one approval surface and one audit trail for everything the
-- pipeline touches.
--
-- NOTE on the split: SALES go through this queue, AVAILABILITY does not.
-- A sale date is a fact a hunter plans around and it changes once a year, so
-- it is worth a human look. Availability is volatile inventory -- a unit can
-- sell out between two refreshes -- and routing thousands of unit rows
-- through a human would not make them safer, only stale. Availability is
-- written straight by the service role and carries last_checked_at, and every
-- screen that shows it shows that timestamp.
--
-- Every existing branch below (seasons, application_windows,
-- regulation_summaries) is identical to the deployed function; only the
-- leftover_tag_sales branch and this comment are new.

create or replace function public.apply_review_item(p_review_id uuid, p_quiet boolean default false)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r public.review_queue;
  p jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select * into r from public.review_queue where id = p_review_id and status = 'pending';
  if not found then
    raise exception 'review item not found or not pending';
  end if;

  -- Transaction-local: it covers the writes below and is cleared before we
  -- return, so a later statement in the same transaction alerts normally.
  if coalesce(p_quiet, false) then
    perform set_config('openseason.quiet_apply', 'on', true);
  end if;

  p := r.proposed_payload;

  -- seasons -----------------------------------------------------------------
  if r.target_table = 'seasons' then
    if r.change_type = 'create' then
      insert into public.seasons (
        state_id, species_id, zone_id, season_year, method, label,
        open_date, close_date, bag_limit_summary, notes, source_id, last_verified_at, status
      ) values (
        (p->>'state_id')::uuid,
        (p->>'species_id')::uuid,
        (p->>'zone_id')::uuid,
        (p->>'season_year')::smallint,
        (p->>'method')::season_method,
        nullif(p->>'label', ''),
        nullif(p->>'open_date', '')::date,
        nullif(p->>'close_date', '')::date,
        nullif(p->>'bag_limit_summary', ''),
        nullif(p->>'notes', ''),
        (p->>'source_id')::uuid,
        now(),
        coalesce(nullif(p->>'status', ''), 'published')::content_status
      );
    else
      update public.seasons set
        open_date         = nullif(p->>'open_date', '')::date,
        close_date        = nullif(p->>'close_date', '')::date,
        bag_limit_summary = coalesce(nullif(p->>'bag_limit_summary', ''), bag_limit_summary),
        notes             = coalesce(nullif(p->>'notes', ''), notes),
        label             = coalesce(nullif(p->>'label', ''), label),
        last_verified_at  = now(),
        status            = coalesce(nullif(p->>'status', ''), status::text)::content_status
      where id = r.target_id;
    end if;

  -- application_windows -----------------------------------------------------
  elsif r.target_table = 'application_windows' then
    if r.change_type = 'create' then
      insert into public.application_windows (
        state_id, species_id, zone_id, season_year, name,
        opens_at, closes_at, results_expected_at, fee_summary, application_url,
        source_id, last_verified_at, status
      ) values (
        (p->>'state_id')::uuid,
        (p->>'species_id')::uuid,
        nullif(p->>'zone_id', '')::uuid,
        (p->>'season_year')::smallint,
        nullif(p->>'name', ''),
        nullif(p->>'opens_at', '')::date,
        nullif(p->>'closes_at', '')::date,
        nullif(p->>'results_expected_at', '')::date,
        nullif(p->>'fee_summary', ''),
        nullif(p->>'application_url', ''),
        (p->>'source_id')::uuid,
        now(),
        coalesce(nullif(p->>'status', ''), 'published')::content_status
      );
    else
      update public.application_windows set
        opens_at            = nullif(p->>'opens_at', '')::date,
        closes_at           = nullif(p->>'closes_at', '')::date,
        results_expected_at = nullif(p->>'results_expected_at', '')::date,
        name                = coalesce(nullif(p->>'name', ''), name),
        fee_summary         = coalesce(nullif(p->>'fee_summary', ''), fee_summary),
        application_url     = coalesce(nullif(p->>'application_url', ''), application_url),
        last_verified_at    = now(),
        status              = coalesce(nullif(p->>'status', ''), status::text)::content_status
      where id = r.target_id;
    end if;

  -- regulation_summaries ----------------------------------------------------
  elsif r.target_table = 'regulation_summaries' then
    if r.change_type = 'create' then
      insert into public.regulation_summaries (
        state_id, species_id, body, source_id, last_verified_at, status
      ) values (
        (p->>'state_id')::uuid,
        (p->>'species_id')::uuid,
        p->>'body',
        (p->>'source_id')::uuid,
        now(),
        coalesce(nullif(p->>'status', ''), 'published')::content_status
      );
    else
      update public.regulation_summaries set
        body             = coalesce(nullif(p->>'body', ''), body),
        last_verified_at = now(),
        status           = coalesce(nullif(p->>'status', ''), status::text)::content_status
      where id = r.target_id;
    end if;

  -- leftover_tag_sales ------------------------------------------------------
  elsif r.target_table = 'leftover_tag_sales' then
    if r.change_type = 'create' then
      insert into public.leftover_tag_sales (
        state_id, species_id, zone_id, season_year, sale_type, name,
        sale_start_date, sale_start_time, sale_end_date, sale_end_time, time_zone,
        residency, purchase_url, source_id, source_url, notes,
        last_verified_at, status
      ) values (
        (p->>'state_id')::uuid,
        (p->>'species_id')::uuid,
        nullif(p->>'zone_id', '')::uuid,
        (p->>'season_year')::smallint,
        (p->>'sale_type')::leftover_sale_type,
        p->>'name',
        nullif(p->>'sale_start_date', '')::date,
        nullif(p->>'sale_start_time', '')::time,
        nullif(p->>'sale_end_date', '')::date,
        nullif(p->>'sale_end_time', '')::time,
        nullif(p->>'time_zone', ''),
        coalesce(
          (select array_agg(x) from jsonb_array_elements_text(p->'residency') as t(x)),
          '{resident,nonresident}'::text[]
        ),
        nullif(p->>'purchase_url', ''),
        (p->>'source_id')::uuid,
        nullif(p->>'source_url', ''),
        nullif(p->>'notes', ''),
        now(),
        coalesce(nullif(p->>'status', ''), 'published')::content_status
      );
    else
      update public.leftover_tag_sales set
        zone_id          = coalesce(nullif(p->>'zone_id', '')::uuid, zone_id),
        name             = coalesce(nullif(p->>'name', ''), name),
        sale_start_date  = coalesce(nullif(p->>'sale_start_date', '')::date, sale_start_date),
        -- `?` not `->>`: a later fetch that simply stops publishing an hour
        -- must not erase the hour we already verified. Only a payload that
        -- carries the key explicitly, with an empty value, clears it.
        sale_start_time  = case when p ? 'sale_start_time'
                                then nullif(p->>'sale_start_time', '')::time
                                else sale_start_time end,
        sale_end_date    = case when p ? 'sale_end_date'
                                then nullif(p->>'sale_end_date', '')::date
                                else sale_end_date end,
        sale_end_time    = case when p ? 'sale_end_time'
                                then nullif(p->>'sale_end_time', '')::time
                                else sale_end_time end,
        time_zone        = coalesce(nullif(p->>'time_zone', ''), time_zone),
        residency        = coalesce(
                             (select array_agg(x) from jsonb_array_elements_text(p->'residency') as t(x)),
                             residency),
        purchase_url     = coalesce(nullif(p->>'purchase_url', ''), purchase_url),
        source_url       = coalesce(nullif(p->>'source_url', ''), source_url),
        notes            = coalesce(nullif(p->>'notes', ''), notes),
        last_verified_at = now(),
        status           = coalesce(nullif(p->>'status', ''), status::text)::content_status
      where id = r.target_id;
    end if;

  else
    perform set_config('openseason.quiet_apply', 'off', true);
    raise exception 'unsupported target_table: %', r.target_table;
  end if;

  update public.review_queue
  set status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_notes = case when coalesce(p_quiet, false)
                          then 'applied quietly (no follower alert)'
                          else review_notes end
  where id = r.id;

  perform set_config('openseason.quiet_apply', 'off', true);
end;
$function$;
