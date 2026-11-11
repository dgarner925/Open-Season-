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
-- Read this before pasting
-- ---------------------------------------------------------------------------
--
-- check_function_bodies is turned off for this script, and it has to be.
--
-- Postgres refuses to let a value added by ALTER TYPE ... ADD VALUE be used
-- in the same transaction that added it, and the SQL editor runs a pasted
-- script as one transaction. notifications_due below names 'leftover_sale'
-- and 'leftover_availability', which this script adds. With body checking on,
-- CREATE FUNCTION parses that body immediately, folds the enum constants, and
-- the whole paste fails with "unsafe use of new value of enum type".
--
-- With it off the body is stored as text and first parsed when the function
-- actually runs, which is a later transaction, by which time the labels are
-- committed. This is the same thing pg_dump does, for the same reason.
--
-- The cost is that a typo in a function body would not be caught here. That
-- is what scripts/check_migration.py is for: it parses every statement and
-- every plpgsql block in this file with libpg_query before it is ever pasted.

set check_function_bodies = off;

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
  -- The exact URL fetched. A state can have more than one page (Wyoming has
  -- two), and the content hash is only meaningful per URL -- keyed by state
  -- alone, two pages would overwrite each other's hash and every run would
  -- look like a change.
  url text,
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
create index if not exists source_fetch_log_url_recent
  on public.source_fetch_log (purpose, url, fetched_at desc);

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


-- ---------------------------------------------------------------------------
-- Telling people
-- ---------------------------------------------------------------------------

-- How far ahead to warn about a sale. Coarser than the others on purpose:
-- a leftover sale is a short-fuse event, so the week's notice is for planning
-- and the day-of is the one that actually saves the tag.
alter table public.alert_preferences
  add column if not exists leftover_offsets smallint[] not null default '{7,1,0}';

/**
 * The clock label for an instant in a US zone -- 'MDT', 'EST', 'PDT'.
 *
 * Why not pg_timezone_names.abbrev: that column reports the abbreviation in
 * effect TODAY. A July sale rendered in January would be labelled MST when
 * the agency means MDT, and an hour that is wrong by one hour on a sale that
 * sells out in minutes is worse than no hour at all.
 *
 * So the offset is measured at the sale's own instant and compared with the
 * zone's offset in January, which is standard time everywhere in the US. If
 * they differ, daylight time was in effect that day.
 *
 * Returns '' for anything not on the list, and the caller drops the label
 * rather than printing a raw IANA name at a hunter.
 */
create or replace function public.clock_label(p_at timestamptz, p_zone text)
returns text
language plpgsql
immutable
as $fn$
declare
  jan     timestamptz;
  off_now numeric;
  off_std numeric;
  is_dst  boolean;
begin
  if p_at is null or coalesce(p_zone, '') = '' then
    return '';
  end if;

  jan := make_timestamptz(extract(year from p_at at time zone p_zone)::int, 1, 15, 12, 0, 0, p_zone);

  off_now := extract(epoch from (p_at at time zone p_zone)) - extract(epoch from (p_at at time zone 'UTC'));
  off_std := extract(epoch from (jan  at time zone p_zone)) - extract(epoch from (jan  at time zone 'UTC'));
  is_dst  := off_now <> off_std;

  return case p_zone
    when 'America/New_York'             then case when is_dst then 'EDT'  else 'EST'  end
    when 'America/Detroit'              then case when is_dst then 'EDT'  else 'EST'  end
    when 'America/Indiana/Indianapolis' then case when is_dst then 'EDT'  else 'EST'  end
    when 'America/Chicago'              then case when is_dst then 'CDT'  else 'CST'  end
    when 'America/Denver'               then case when is_dst then 'MDT'  else 'MST'  end
    when 'America/Boise'                then case when is_dst then 'MDT'  else 'MST'  end
    when 'America/Los_Angeles'          then case when is_dst then 'PDT'  else 'PST'  end
    when 'America/Anchorage'            then case when is_dst then 'AKDT' else 'AKST' end
    -- Arizona and Hawaii never move their clocks, so there is only ever one
    -- abbreviation to print.
    when 'America/Phoenix'              then 'MST'
    when 'Pacific/Honolulu'             then 'HST'
    else ''
  end;
end;
$fn$;

grant execute on function public.clock_label(timestamptz, text) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- notifications_due: two more arms
-- ---------------------------------------------------------------------------
--
-- What follows is the function exactly as production is running it today --
-- pulled with pg_get_functiondef, md5 7948795988f56e9c6ce28553b5c4d042, and
-- verified byte-for-byte after the splice by removing the inserted block again
-- and comparing. Its CRLF line endings are deliberately preserved; the two new
-- arms are the only lines in this definition that differ from the live one.
--
-- The arms go in before the Weekend Brief because the brief's SELECT ends the
-- function, and because the brief is a digest of everything above it.

CREATE OR REPLACE FUNCTION public.notifications_due()
 RETURNS TABLE(user_id uuid, subject_type notification_subject_type, subject_id uuid, offset_days smallint, scheduled_for date, title text, body text, tokens text[], route_type text, route_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Season openers
  select
    f.user_id,
    'season_opener'::notification_subject_type,
    s.id,
    off::smallint,
    s.open_date,
    format('%s opens in %s day%s', sp.name, off, case when off = 1 then '' else 's' end),
    format('%s %s (%s) opens %s%s', st.code, sp.name, s.method, to_char(s.open_date, 'Mon DD'),
      -- Name the zone unless the season really is statewide. Washington's
      -- GMU lists reach 160 characters, so cap the clause: a truncated
      -- unit list still says "specific units, not the whole state", which
      -- is the whole point, and the season page carries the full list.
      case when z.type is distinct from 'statewide'::zone_type
           then ' at ' || case when length(z.name) > 48
                              then left(z.name, 45) || '...'
                              else z.name end
           else '' end),
    array_agg(distinct dt.token),
    'season_opener',
    s.id
  from public.seasons s
  join public.states st on st.id = s.state_id
  join public.species sp on sp.id = s.species_id
  left join public.zones z on z.id = s.zone_id
  join public.follows f on f.state_id = s.state_id and f.species_id = s.species_id
  join public.alert_preferences ap on ap.follow_id = f.id
  cross join lateral unnest(ap.opener_offsets) as off
  join public.device_push_tokens dt on dt.user_id = f.user_id
  join public.profiles pr on pr.id = f.user_id and pr.is_premium
  where s.status = 'published'
    and s.open_date = current_date + off
    and (ap.methods is null or s.method::text = any(ap.methods))
    and not exists (
      select 1 from public.sent_notifications sn
      where sn.user_id = f.user_id and sn.subject_type = 'season_opener'
        and sn.subject_id = s.id and sn.offset_days = off
    )
  group by f.user_id, s.id, off, s.open_date, sp.name, st.code, s.method, z.type, z.name

  union all

  -- Application deadlines
  select
    f.user_id,
    'application_deadline'::notification_subject_type,
    w.id,
    off::smallint,
    w.closes_at,
    format('%s tag deadline in %s day%s', sp.name, off, case when off = 1 then '' else 's' end),
    format('%s %s %s closes %s', st.code, sp.name, coalesce(w.name, 'draw'), to_char(w.closes_at, 'Mon DD')),
    array_agg(distinct dt.token),
    'application_deadline',
    w.id
  from public.application_windows w
  join public.states st on st.id = w.state_id
  join public.species sp on sp.id = w.species_id
  join public.follows f on f.state_id = w.state_id and f.species_id = w.species_id
  join public.alert_preferences ap on ap.follow_id = f.id
  cross join lateral unnest(ap.deadline_offsets) as off
  join public.device_push_tokens dt on dt.user_id = f.user_id
  join public.profiles pr on pr.id = f.user_id and pr.is_premium
  where w.status = 'published'
    and w.closes_at = current_date + off
    and not exists (
      select 1 from public.sent_notifications sn
      where sn.user_id = f.user_id and sn.subject_type = 'application_deadline'
        and sn.subject_id = w.id and sn.offset_days = off
    )
  group by f.user_id, w.id, off, w.closes_at, sp.name, st.code, w.name

  union all

  -- Draw results
  select
    f.user_id,
    'application_results'::notification_subject_type,
    w.id,
    off::smallint,
    w.results_expected_at,
    case when off = 0
      then format('%s draw results expected today', sp.name)
      else format('%s draw results in %s day%s', sp.name, off, case when off = 1 then '' else 's' end)
    end,
    format('%s %s %s results expected %s', st.code, sp.name, coalesce(w.name, 'draw'), to_char(w.results_expected_at, 'Mon DD')),
    array_agg(distinct dt.token),
    'application_results',
    w.id
  from public.application_windows w
  join public.states st on st.id = w.state_id
  join public.species sp on sp.id = w.species_id
  join public.follows f on f.state_id = w.state_id and f.species_id = w.species_id
  join public.alert_preferences ap on ap.follow_id = f.id
  cross join lateral unnest(ap.results_offsets) as off
  join public.device_push_tokens dt on dt.user_id = f.user_id
  join public.profiles pr on pr.id = f.user_id and pr.is_premium
  where w.status = 'published'
    and w.results_expected_at is not null
    and w.results_expected_at = current_date + off
    and not exists (
      select 1 from public.sent_notifications sn
      where sn.user_id = f.user_id and sn.subject_type = 'application_results'
        and sn.subject_id = w.id and sn.offset_days = off
    )
  group by f.user_id, w.id, off, w.results_expected_at, sp.name, st.code, w.name

  union all

  -- Season date changes (watchdog)
  select
    f.user_id,
    'date_change'::notification_subject_type,
    dc.id,
    0::smallint,
    dc.new_date,
    format('%s season dates changed', sp.name),
    format('%s %s (%s): %s %s → %s%s', st.code, sp.name, s.method,
           case dc.field when 'open_date' then 'opens' else 'closes' end,
           to_char(dc.old_date, 'Mon DD'), to_char(dc.new_date, 'Mon DD'),
           case when z.type is distinct from 'statewide'::zone_type
                then ' at ' || case when length(z.name) > 48
                                   then left(z.name, 45) || '...'
                                   else z.name end
                else '' end),
    array_agg(distinct dt.token),
    'season_opener',
    s.id
  from public.date_changes dc
  join public.seasons s on s.id = dc.target_id and dc.target_table = 'seasons'
  join public.states st on st.id = s.state_id
  join public.species sp on sp.id = s.species_id
  left join public.zones z on z.id = s.zone_id
  join public.follows f on f.state_id = s.state_id and f.species_id = s.species_id
  left join public.alert_preferences ap on ap.follow_id = f.id
  join public.device_push_tokens dt on dt.user_id = f.user_id
  join public.profiles pr on pr.id = f.user_id and pr.is_premium
  where s.status = 'published'
    and dc.created_at >= now() - interval '14 days'
    and dc.created_at >= f.created_at
    and greatest(dc.new_date, dc.old_date) >= current_date
    and (ap.methods is null or s.method::text = any(ap.methods))
    and not exists (
      select 1 from public.sent_notifications sn
      where sn.user_id = f.user_id and sn.subject_type = 'date_change'
        and sn.subject_id = dc.id and sn.offset_days = 0
    )
  group by f.user_id, dc.id, dc.new_date, dc.field, dc.old_date, sp.name, st.code, s.method, s.id, z.type, z.name

  union all

  -- Draw date changes (watchdog)
  select
    f.user_id,
    'date_change'::notification_subject_type,
    dc.id,
    0::smallint,
    dc.new_date,
    case dc.field
      when 'closes_at' then format('%s draw deadline changed', sp.name)
      else format('%s draw results date changed', sp.name)
    end,
    format('%s %s %s: %s → %s', st.code, sp.name, coalesce(w.name, 'draw'),
           to_char(dc.old_date, 'Mon DD'), to_char(dc.new_date, 'Mon DD')),
    array_agg(distinct dt.token),
    'application_deadline',
    w.id
  from public.date_changes dc
  join public.application_windows w on w.id = dc.target_id and dc.target_table = 'application_windows'
  join public.states st on st.id = w.state_id
  join public.species sp on sp.id = w.species_id
  join public.follows f on f.state_id = w.state_id and f.species_id = w.species_id
  join public.device_push_tokens dt on dt.user_id = f.user_id
  join public.profiles pr on pr.id = f.user_id and pr.is_premium
  where w.status = 'published'
    and dc.created_at >= now() - interval '14 days'
    and dc.created_at >= f.created_at
    and greatest(dc.new_date, dc.old_date) >= current_date
    and not exists (
      select 1 from public.sent_notifications sn
      where sn.user_id = f.user_id and sn.subject_type = 'date_change'
        and sn.subject_id = dc.id and sn.offset_days = 0
    )
  group by f.user_id, dc.id, dc.new_date, dc.field, dc.old_date, sp.name, st.code, w.name, w.id

  union all

  -- Federal permit hunt openers — following the permit is the opt-in.
  select
    pf.user_id,
    'permit_opener'::notification_subject_type,
    d.id,
    off::smallint,
    d.open_date,
    format('Permit hunt opens in %s day%s', off, case when off = 1 then '' else 's' end),
    format('%s%s opens %s · details on Recreation.gov', p.name,
           case when coalesce(d.label, '') = '' then '' else format(' (%s)', d.label) end,
           to_char(d.open_date, 'Mon DD')),
    array_agg(distinct dt.token),
    'permit_opener',
    p.id
  from public.federal_permit_hunt_dates d
  join public.federal_permit_hunts p on p.id = d.permit_id
  join public.permit_follows pf on pf.permit_id = p.id
  cross join lateral unnest(array[30, 7, 1]) as off
  join public.device_push_tokens dt on dt.user_id = pf.user_id
  join public.profiles pr on pr.id = pf.user_id and pr.is_premium
  where d.open_date = current_date + off
    and not exists (
      select 1 from public.sent_notifications sn
      where sn.user_id = pf.user_id and sn.subject_type = 'permit_opener'
        and sn.subject_id = d.id and sn.offset_days = off
    )
  group by pf.user_id, d.id, off, d.open_date, d.label, p.name, p.id

  union all

  -- Leftover and over-the-counter tag sales.
  --
  -- This is the one date in the app where the day alone is not enough. A
  -- Colorado leftover sale opens at a published hour and is gone in minutes,
  -- and a hunter in Georgia reading "10:00 AM" assumes Eastern and misses it
  -- by two hours -- so the body carries the hour AND its zone label, computed
  -- for the day of the sale rather than for today (see clock_label).
  --
  -- A sale with no published hour says the day alone. Inventing midnight here
  -- would be worse than vagueness: it would be a specific wrong answer.
  --
  -- The day-of push goes out on the 13:00 UTC run, which is 06:00 Mountain --
  -- four hours before a 10 a.m. Denver sale. For an 08:00 Eastern sale that
  -- same run is already level with the sale, which is exactly why the default
  -- offsets include the day before.
  select
    f.user_id,
    'leftover_sale'::notification_subject_type,
    ls.id,
    off::smallint,
    ls.sale_start_date,
    case when off = 0
      then format('%s tags on sale today', sp.name)
      else format('%s tags on sale in %s day%s', sp.name, off, case when off = 1 then '' else 's' end)
    end,
    format('%s %s · %s%s',
      st.code,
      ls.name,
      to_char(ls.sale_start_date, 'Mon DD')
        || case when ls.sale_start_time is null then ''
                else ' at ' || trim(to_char(ls.sale_start_time, 'HH12:MI AM'))
                     || coalesce(' ' || nullif(public.clock_label(ls.sale_start_at, ls.time_zone), ''), '')
           end,
      case when ls.residency = array['resident']::text[] then ' · residents only'
           when ls.residency = array['nonresident']::text[] then ' · nonresidents only'
           else '' end),
    array_agg(distinct dt.token),
    'leftover_sale',
    ls.id
  from public.leftover_tag_sales ls
  join public.states st on st.id = ls.state_id
  join public.species sp on sp.id = ls.species_id
  join public.follows f on f.state_id = ls.state_id and f.species_id = ls.species_id
  join public.alert_preferences ap on ap.follow_id = f.id
  cross join lateral unnest(ap.leftover_offsets) as off
  join public.device_push_tokens dt on dt.user_id = f.user_id
  join public.profiles pr on pr.id = f.user_id and pr.is_premium
  where ls.status = 'published'
    and ls.sale_start_date = current_date + off
    and not exists (
      select 1 from public.sent_notifications sn
      where sn.user_id = f.user_id and sn.subject_type = 'leftover_sale'
        and sn.subject_id = ls.id and sn.offset_days = off
    )
  group by f.user_id, ls.id, off, ls.sale_start_date, ls.name, ls.sale_start_time,
           ls.sale_start_at, ls.time_zone, ls.residency, sp.name, st.code

  union all

  -- Tags available again.
  --
  -- Colorado and Utah reissue licences through the season as hunters turn
  -- them back in, so a unit going from sold out to available is real news and
  -- a reason to open the app today.
  --
  -- The reverse is not. "The tags you were waiting for are gone" is a push
  -- that helps nobody and arrives after it could have mattered; the card in
  -- the app says it quietly instead. So this arm looks only at rows that
  -- are available NOW and were touched in the last day.
  --
  -- The dedupe key is the availability row, for all time, not the day. A
  -- unit that flickers available / sold out / available therefore notifies
  -- once and then stays quiet. That is the right trade: the second push
  -- would be about the same tags in the same unit, and an alert that cries
  -- wolf gets the whole category muted.
  select
    f.user_id,
    'leftover_availability'::notification_subject_type,
    av.id,
    0::smallint,
    current_date,
    format('%s tags available again', sp.name),
    format('%s %s%s · %s',
      st.code,
      ls.name,
      case when coalesce(av.unit_code, '') = '' then '' else format(' (%s)', av.unit_code) end,
      case when av.quantity_remaining is null
           then 'back on sale'
           else format('%s left', av.quantity_remaining) end),
    array_agg(distinct dt.token),
    'leftover_sale',
    ls.id
  from public.leftover_tag_availability av
  join public.leftover_tag_sales ls on ls.id = av.sale_id
  join public.states st on st.id = ls.state_id
  join public.species sp on sp.id = ls.species_id
  join public.follows f on f.state_id = ls.state_id and f.species_id = ls.species_id
  join public.device_push_tokens dt on dt.user_id = f.user_id
  join public.profiles pr on pr.id = f.user_id and pr.is_premium
  where ls.status = 'published'
    and av.status = 'available'
    and av.updated_at >= now() - interval '1 day'
    and av.updated_at >= f.created_at
    -- Only while the sale is still live. A unit that comes back in stock
    -- after the sale closed is a data artefact, not an opportunity.
    and (ls.sale_end_date is null or ls.sale_end_date >= current_date)
    and not exists (
      select 1 from public.sent_notifications sn
      where sn.user_id = f.user_id and sn.subject_type = 'leftover_availability'
        and sn.subject_id = av.id and sn.offset_days = 0
    )
  group by f.user_id, av.id, ls.id, ls.name, av.unit_code, av.quantity_remaining,
           sp.name, st.code

  union all

  -- The Weekend Brief — Fridays only; one composed row per Pro user with
  -- brief-worthy content. Lines (priority order, max 3): openers Fri-Sun,
  -- closers Fri-Sun (last chance), draw deadlines within 7 days. Silent when
  -- empty. Weekly dedupe key = md5(user_id, date) as uuid.
  select
    b.user_id,
    'weekend_brief'::notification_subject_type,
    md5(b.user_id::text || current_date::text)::uuid,
    0::smallint,
    current_date,
    'Your weekend, in season.',
    b.body,
    b.tokens,
    'weekend_brief',
    b.user_id
  from (
    select
      capped.user_id,
      string_agg(capped.line, ' · ' order by capped.priority, capped.d) as body,
      (select array_agg(distinct dt.token) from public.device_push_tokens dt where dt.user_id = capped.user_id) as tokens
    from (
      select lines.*, row_number() over (partition by lines.user_id order by lines.priority, lines.d) as overall_rn
      from (
      select distinct u.user_id, u.priority, u.d, u.line
      from (
      select * from (
        select
          f.user_id,
          1 as priority,
          s.open_date as d,
          format('%s %s %s in %s', sp.name,
                 case when sp.name in ('Geese', 'Ducks') then 'open' else 'opens' end,
                 case s.open_date - current_date when 0 then 'today' when 1 then 'Saturday' else 'Sunday' end,
                 st.name) as line,
          row_number() over (partition by f.user_id order by s.open_date, sp.name) as rn
        from public.seasons s
        join public.states st on st.id = s.state_id
        join public.species sp on sp.id = s.species_id
        join public.follows f on f.state_id = s.state_id and f.species_id = s.species_id
        left join public.alert_preferences ap on ap.follow_id = f.id
        where s.status = 'published'
          and s.open_date between current_date and current_date + 2
          and (ap.methods is null or s.method::text = any(ap.methods))
      ) o where o.rn <= 3
      union all
      select * from (
        select
          f.user_id,
          2 as priority,
          s.close_date as d,
          format('%s %s %s in %s — the last days', sp.name,
                 case when sp.name in ('Geese', 'Ducks') then 'close' else 'closes' end,
                 case s.close_date - current_date when 0 then 'today' when 1 then 'Saturday' else 'Sunday' end,
                 st.name) as line,
          row_number() over (partition by f.user_id order by s.close_date, sp.name) as rn
        from public.seasons s
        join public.states st on st.id = s.state_id
        join public.species sp on sp.id = s.species_id
        join public.follows f on f.state_id = s.state_id and f.species_id = s.species_id
        left join public.alert_preferences ap on ap.follow_id = f.id
        where s.status = 'published'
          and s.close_date between current_date and current_date + 2
          and s.open_date <= current_date
          and (ap.methods is null or s.method::text = any(ap.methods))
      ) c where c.rn <= 3
      union all
      select * from (
        select
          f.user_id,
          3 as priority,
          w.closes_at as d,
          format('The %s %s draw closes %s', st.name, lower(sp.name),
                 case w.closes_at - current_date
                   when 0 then 'today' when 1 then 'tomorrow'
                   when 7 then format('next %s', trim(to_char(w.closes_at, 'Day')))
                   else trim(to_char(w.closes_at, 'Day')) end) as line,
          row_number() over (partition by f.user_id order by w.closes_at, sp.name) as rn
        from public.application_windows w
        join public.states st on st.id = w.state_id
        join public.species sp on sp.id = w.species_id
        join public.follows f on f.state_id = w.state_id and f.species_id = w.species_id
        where w.status = 'published'
          and w.closes_at between current_date and current_date + 7
      ) dl where dl.rn <= 3
      union all
      -- Priority 4: discovery - weekend openers in the user's states for
      -- species they don't follow. Lowest priority, so it only fills room the
      -- user's own hunts left in the 3-line cap.
      select * from (
        select
          x.user_id,
          4 as priority,
          x.d,
          x.line,
          row_number() over (partition by x.user_id order by x.d, x.line) as rn
        from (
          select distinct
            ts.user_id,
            s.open_date as d,
            format('%s %s %s in %s', sp.name,
                   case when sp.name in ('Geese', 'Ducks') then 'open' else 'opens' end,
                   case s.open_date - current_date when 0 then 'today' when 1 then 'Saturday' else 'Sunday' end,
                   st.name) as line
          from (
            select f.user_id, f.state_id from public.follows f
            union
            select p.id, p.resident_state_id from public.profiles p where p.resident_state_id is not null
          ) ts
          join public.seasons s on s.state_id = ts.state_id
          join public.states st on st.id = s.state_id
          join public.species sp on sp.id = s.species_id
          where s.status = 'published'
            and s.open_date between current_date and current_date + 2
            and not exists (
              select 1 from public.follows f2
              where f2.user_id = ts.user_id and f2.state_id = s.state_id and f2.species_id = s.species_id
            )
        ) x
      ) disc where disc.rn <= 3
      ) u
      ) lines
    ) capped
    where capped.overall_rn <= 3
    group by capped.user_id
  ) b
  join public.profiles pr on pr.id = b.user_id and pr.is_premium and pr.weekend_brief
  where extract(isodow from current_date) = 5
    and b.tokens is not null
    and not exists (
      select 1 from public.sent_notifications sn
      where sn.user_id = b.user_id and sn.subject_type = 'weekend_brief'
        and sn.subject_id = md5(b.user_id::text || current_date::text)::uuid
        and sn.offset_days = 0
    );
$function$
;

-- Back on, so anything run after this in the same session is checked again.
reset check_function_bodies;
