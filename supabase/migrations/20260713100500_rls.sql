-- 0005_rls.sql
-- Row Level Security for every table.
--
-- Model:
--   * Reference data (seasons/windows/regs): world-readable ONLY where
--     status = 'published'. Admins can read + write everything.
--   * Lookup data (states/species/zones/sources): world-readable (active states
--     only). Admins write.
--   * User data (profiles/follows/prefs/tokens): owner-only.
--   * sent_notifications: owner may read; only the service role writes.
--   * review_queue: admin-only.
--
-- Permissive policies OR together, so an admin's broad policy unions with the
-- public one — admins simply see/do more.

-- ===========================================================================
-- Reference lookups
-- ===========================================================================
alter table public.sources enable row level security;
create policy sources_public_read on public.sources
  for select to anon, authenticated using (true);
create policy sources_admin_all on public.sources
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.states enable row level security;
create policy states_public_read on public.states
  for select to anon, authenticated using (is_active = true);
create policy states_admin_all on public.states
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.species enable row level security;
create policy species_public_read on public.species
  for select to anon, authenticated using (true);
create policy species_admin_all on public.species
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.zones enable row level security;
create policy zones_public_read on public.zones
  for select to anon, authenticated using (true);
create policy zones_admin_all on public.zones
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ===========================================================================
-- Reference content (published-only public read)
-- ===========================================================================
alter table public.seasons enable row level security;
create policy seasons_public_read on public.seasons
  for select to anon, authenticated using (status = 'published');
create policy seasons_admin_all on public.seasons
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.application_windows enable row level security;
create policy app_windows_public_read on public.application_windows
  for select to anon, authenticated using (status = 'published');
create policy app_windows_admin_all on public.application_windows
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.regulation_summaries enable row level security;
create policy reg_summaries_public_read on public.regulation_summaries
  for select to anon, authenticated using (status = 'published');
create policy reg_summaries_admin_all on public.regulation_summaries
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ===========================================================================
-- User data (owner-only)
-- ===========================================================================
alter table public.profiles enable row level security;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid())
  -- Prevent a user from granting themselves admin. is_admin can only change
  -- to its current value from a client; elevation is done in the SQL console.
  with check (id = auth.uid() and is_admin = (select p.is_admin from public.profiles p where p.id = auth.uid()));
create policy profiles_admin_read_all on public.profiles
  for select to authenticated using (public.is_admin());

alter table public.follows enable row level security;
create policy follows_owner_all on public.follows
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.alert_preferences enable row level security;
-- Ownership is derived through the parent follow.
create policy alert_prefs_owner_all on public.alert_preferences
  for all to authenticated
  using (exists (select 1 from public.follows f where f.id = follow_id and f.user_id = auth.uid()))
  with check (exists (select 1 from public.follows f where f.id = follow_id and f.user_id = auth.uid()));

alter table public.device_push_tokens enable row level security;
create policy push_tokens_owner_all on public.device_push_tokens
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.sent_notifications enable row level security;
-- Read your own history; inserts come from the Edge Function (service role,
-- which bypasses RLS). No client insert/update policy on purpose.
create policy sent_notifications_read_own on public.sent_notifications
  for select to authenticated using (user_id = auth.uid());

-- ===========================================================================
-- Review queue (admin-only)
-- ===========================================================================
alter table public.review_queue enable row level security;
create policy review_queue_admin_all on public.review_queue
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
