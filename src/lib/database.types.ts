/**
 * Hand-written to mirror supabase/migrations. Once the schema is pushed to a
 * real project, regenerate this from the live DB for perfect fidelity:
 *
 *   npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
 *
 * Keep the shape compatible with @supabase/supabase-js generics:
 * Database['public']['Tables'][T]['Row' | 'Insert' | 'Update'].
 *
 * NOTE: these are `type` aliases, not `interface`s, on purpose — supabase-js's
 * GenericTable requires Row/Insert/Update to satisfy Record<string, unknown>,
 * and interfaces (unlike object type aliases) are not assignable to that. Using
 * `interface` here makes the whole schema fail the GenericSchema constraint and
 * insert/update silently resolve to `never`.
 */

export type ContentStatus = 'draft' | 'published' | 'archived';
export type ZoneType = 'statewide' | 'county_group' | 'gmu' | 'flyway_zone';
export type SeasonMethod = 'archery' | 'muzzleloader' | 'firearm' | 'general';
export type SourceDocType = 'webpage' | 'pdf' | 'other';
export type ReviewStatus = 'pending' | 'approved' | 'rejected';
export type ReviewChangeType = 'create' | 'update';
export type NotificationSubjectType = 'season_opener' | 'application_deadline' | 'application_results' | 'date_change';

export type PartyRow = {
  id: string;
  window_id: string | null;
  season_id: string | null;
  owner_id: string;
  invite_code: string;
  created_at: string;
};

export type PartyMemberRow = {
  party_id: string;
  user_id: string;
  joined_at: string;
  applied_at: string | null;
};

export type PartyRosterEntry = {
  user_id: string;
  display_name: string;
  /** Null until they set one; the roster falls back to a lettered medallion. */
  avatar_url: string | null;
  joined_at: string;
  applied_at: string | null;
  is_owner: boolean;
  /** Days of a season party this member has said they are coming. */
  days: string[];
};

export type PartyMessage = {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  body: string;
  created_at: string;
  mine: boolean;
};

export type DateChangeRow = {
  id: string;
  target_table: string;
  target_id: string;
  field: string;
  old_date: string;
  new_date: string;
  created_at: string;
};

export type RegulationChangeRow = {
  id: string;
  state_id: string;
  species_id: string | null;
  target_table: string;
  change_type: 'added' | 'removed' | 'modified';
  old_id: string | null;
  new_id: string | null;
  old_year: number | null;
  new_year: number | null;
  field_diffs: { field: string; old: string | null; new: string | null }[];
  note: string | null;
  note_phrased: boolean;
  note_model: string | null;
  published: boolean;
  dedupe_key: string;
  created_at: string;
  updated_at: string;
};

type Timestamps = { created_at: string; updated_at: string };

export type SourceRow = Timestamps & {
  id: string;
  agency_name: string;
  url: string;
  doc_type: SourceDocType;
  notes: string | null;
};

export type StateRow = Timestamps & {
  id: string;
  code: string;
  name: string;
  agency_name: string | null;
  is_active: boolean;
  license_url: string | null;
};

export type ApplicationStatus = 'planned' | 'applied' | 'successful' | 'unsuccessful' | 'purchased';

export type UserApplicationRow = Timestamps & {
  id: string;
  user_id: string;
  state_id: string | null;
  species_id: string | null;
  window_id: string | null;
  title: string;
  application_url: string | null;
  portal_username: string | null;
  status: ApplicationStatus;
  applied_on: string | null;
  results_on: string | null;
  fee_summary: string | null;
  points: number | null;
  notes: string | null;
};

export type PointType = 'preference' | 'bonus';

export type PointBalanceRow = Timestamps & {
  id: string;
  user_id: string;
  state_id: string;
  species_id: string;
  point_type: PointType;
  points: number;
  notes: string | null;
};

/** Hunting or fishing. The coarse split; `category` is the fine-grained group
 *  within it (big_game, upland, trout_salmon, bass...). Every species query
 *  should filter on this: relying on the RLS policy to mean the right thing
 *  breaks the day fishing launches and the policy is relaxed. */
export type Pursuit = 'hunting' | 'fishing';

export type SpeciesRow = {
  id: string;
  key: string;
  name: string;
  category: string | null;
  pursuit: Pursuit;
  sort_order: number;
  created_at: string;
};

export type ZoneRow = Timestamps & {
  id: string;
  state_id: string;
  type: ZoneType;
  name: string;
  code: string | null;
  notes: string | null;
};

export type SeasonRow = Timestamps & {
  id: string;
  state_id: string;
  species_id: string;
  zone_id: string;
  season_year: number;
  method: SeasonMethod;
  label: string | null;
  open_date: string | null;
  close_date: string | null;
  bag_limit_summary: string | null;
  notes: string | null;
  source_id: string | null;
  last_verified_at: string | null;
  status: ContentStatus;
};

export type ApplicationWindowRow = Timestamps & {
  id: string;
  state_id: string;
  species_id: string;
  zone_id: string | null;
  season_year: number;
  name: string | null;
  opens_at: string | null;
  closes_at: string | null;
  results_expected_at: string | null;
  fee_summary: string | null;
  application_url: string | null;
  notes: string | null;
  source_id: string | null;
  last_verified_at: string | null;
  status: ContentStatus;
};

export type RegulationSummaryRow = Timestamps & {
  id: string;
  state_id: string;
  species_id: string;
  body: string;
  source_id: string | null;
  last_verified_at: string | null;
  status: ContentStatus;
};

export type ProfileRow = Timestamps & {
  id: string;
  display_name: string | null;
  is_admin: boolean;
  onboarded_at: string | null;
  active_location_id: string | null;
  resident_state_id: string | null;
  is_premium: boolean;
  grandfathered: boolean;
  /** Friday-morning Weekend Brief push (Pro). Default true. */
  weekend_brief?: boolean;
  /** Public URL in the avatars bucket; null until they set one. */
  avatar_url?: string | null;
  /**
   * Last known OS notification permission. Null means the app has not
   * reported since the column shipped -- NOT that the user declined. Written
   * by src/lib/push.ts, which previously discarded this and left us guessing
   * why 50 of 91 users with follows could not be reached.
   */
  push_permission?: 'granted' | 'denied' | 'undetermined' | null;
  push_permission_at?: string | null;
};

export type DateReportRow = {
  id: string;
  user_id: string;
  target_table: string;
  target_id: string | null;
  label: string | null;
  detail: string | null;
  created_at: string;
};

export type UserLocationRow = {
  id: string;
  user_id: string;
  state_id: string;
  zone_id: string | null;
  created_at: string;
};

export type StateSpeciesRow = { state_id: string; species_id: string };

export type FollowRow = {
  id: string;
  user_id: string;
  state_id: string;
  species_id: string;
  created_at: string;
};

export type AlertPreferenceRow = Timestamps & {
  follow_id: string;
  opener_offsets: number[];
  deadline_offsets: number[];
  results_offsets: number[];
  /** null = all methods (legacy default), [] = none, ['archery'] = only those. */
  methods?: string[] | null;
  /** Coarser than the rest on purpose: a leftover sale is a short-fuse event. */
  leftover_offsets?: number[];
};

export type LeftoverSaleType = 'leftover' | 'otc' | 'reissue';
export type LeftoverAvailabilityStatus = 'available' | 'sold_out' | 'unknown';

/**
 * A leftover, over-the-counter or reissued tag sale.
 *
 * sale_start_date is NOT NULL and sale_start_time IS nullable, and that
 * asymmetry is the whole point: "Tuesday" and "9:00 AM Tuesday" are different
 * facts, and the second is the rarer one on an agency page. sale_start_at is
 * maintained by a trigger from the date, the time and the zone -- never
 * written by hand.
 */
export type LeftoverTagSaleRow = Timestamps & {
  id: string;
  state_id: string;
  species_id: string;
  zone_id: string | null;
  season_year: number;
  sale_type: LeftoverSaleType;
  name: string;
  sale_start_date: string;
  sale_start_time: string | null;
  sale_end_date: string | null;
  sale_end_time: string | null;
  time_zone: string | null;
  sale_start_at: string | null;
  sale_end_at: string | null;
  residency: string[] | null;
  purchase_url: string | null;
  source_url: string | null;
  notes: string | null;
  status: string;
  last_verified_at: string | null;
};

export type LeftoverTagAvailabilityRow = Timestamps & {
  id: string;
  sale_id: string;
  unit_code: string | null;
  weapon_type: string | null;
  /** Null is not zero: most agencies list units with tags left and no counts. */
  quantity_remaining: number | null;
  status: LeftoverAvailabilityStatus;
  last_checked_at: string;
};

export type FederalPermitHuntRow = {
  id: string;
  entity_id: string;
  name: string;
  agency: string | null;
  state_code: string | null;
  city: string | null;
  description: string | null;
  lat: number | null;
  lng: number | null;
  reservable: boolean;
  url: string;
  image_url: string | null;
  last_seen_at: string | null;
  created_at: string;
};

export type PermitFollowRow = {
  id: string;
  user_id: string;
  permit_id: string;
  created_at: string;
};

export type DevicePushTokenRow = Timestamps & {
  id: string;
  user_id: string;
  token: string;
  platform: string | null;
};

export type SentNotificationRow = {
  id: string;
  user_id: string;
  subject_type: NotificationSubjectType;
  subject_id: string;
  offset_days: number;
  scheduled_for: string;
  sent_at: string;
  status: string;
  detail: string | null;
  hidden_at: string | null;
};

export type ReviewQueueRow = Timestamps & {
  id: string;
  target_table: string;
  target_id: string | null;
  change_type: ReviewChangeType;
  proposed_payload: Record<string, unknown>;
  current_snapshot: Record<string, unknown> | null;
  diff: Record<string, unknown> | null;
  source_id: string | null;
  extraction_run_id: string | null;
  confidence: number | null;
  evidence: { page?: number | null; quote?: string | null } | null;
  validation_errors: string[] | null;
  status: ReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
};

// ---------------------------------------------------------------------------
// On the Water (fishing). The tables are live in production; see the
// migrations from 20261122. Hand-written here, like everything else in this
// file, rather than generated.

export type WaterKind =
  | 'lake' | 'reservoir' | 'pond' | 'river' | 'stream' | 'creek'
  | 'tailwater' | 'impoundment' | 'canal' | 'bay' | 'other';

export type WaterRow = Timestamps & {
  id: string;
  state_id: string;
  name: string;
  slug: string;
  kind: WaterKind;
  /**
   * The state's own words for where a regulated stretch runs -- "450 feet
   * upstream of the Sandy Bottom Canoe Access". These landmarks ARE the
   * regulation, so they are stored verbatim and must be shown verbatim.
   */
  extent_note: string | null;
  county: string | null;
  parent_water_id: string | null;
  source_id: string | null;
  last_verified_at: string | null;
  status: ContentStatus;
  /**
   * The USGS gauge that reads this water, 8 to 15 digits. A fact about the
   * water, constrained in the database, and null for most of them: there is
   * no gauge inside most regulated stretches.
   */
  usgs_site_no: string | null;
  /**
   * The flow at or below which this water is usually wadeable, in cfs.
   *
   * EDITORIAL, not a safety claim, and null is the preferred value until
   * somebody has actually judged it -- the app reads null as "no verdict" and
   * reports the bare flow instead of saying "fishable". Seven of the eight
   * configured gauges are null today.
   */
  wadeable_cfs_max: number | null;
};

/** What the daily number means when several species share one row. */
export type LimitBasis = 'aggregate' | 'per_species';

/**
 * Four different answers, because 0 is a real limit. "unknown" means this
 * document did not say; "prohibited" means you may not keep one.
 */
export type DailyLimitKind = 'count' | 'no_limit' | 'prohibited' | 'unknown';

export type SizeRule = 'none' | 'minimum' | 'maximum' | 'slot_release' | 'slot_keep' | 'see_notes';

export type FishingRestriction =
  | 'artificial_only' | 'flies_only' | 'single_hook' | 'barbless'
  | 'no_live_bait' | 'one_pole_handheld' | 'catch_and_release'
  | 'reservation_required' | 'daylight_only' | 'no_night_fishing'
  | 'youth_senior_disabled_only' | 'trout_licence_required';

export type FishingRuleRow = Timestamps & {
  id: string;
  state_id: string;
  /** Always null: the species set lives in fishing_rule_species, even for one. */
  species_id: string | null;
  zone_id: string | null;
  /** Null means the rule is statewide. */
  water_id: string | null;
  season_year: number;
  size_rule: SizeRule;
  min_length_inches: number | null;
  max_length_inches: number | null;
  daily_limit_kind: DailyLimitKind;
  daily_limit: number | null;
  possession_limit: number | null;
  trophy_allowance: number | null;
  trophy_min_length_inches: number | null;
  limit_basis: LimitBasis;
  restrictions: FishingRestriction[];
  /**
   * The window the RULE is in force -- NOT a season. Null means all year,
   * which is the common case: most freshwater fishing is open year round,
   * and a rule window must never be rendered as a closure.
   */
  effective_from: string | null;
  effective_to: string | null;
  notes: string | null;
  source_id: string | null;
  last_verified_at: string | null;
  status: ContentStatus;
};

export type FishingRuleSpeciesRow = {
  rule_id: string;
  species_id: string;
};

export type StockingRow = Timestamps & {
  id: string;
  water_id: string;
  species_id: string;
  stocked_on: string;
  quantity: number | null;
  source_id: string | null;
  status: ContentStatus;
};

/**
 * A water somebody follows.
 *
 * Fishing's equivalent of `follows`, which is (user_id, state_id, species_id)
 * because a hunting season belongs to a species. A fishing rule belongs to a
 * water, so this is its own table rather than a nullable water_id on
 * `follows` that every hunting row would carry and never use.
 */
export type UserWaterRow = {
  id: string;
  user_id: string;
  water_id: string;
  created_at: string;
};

export type LicenseKind = 'fishing' | 'hunting' | 'combination';

/**
 * When somebody's licence runs out, and nothing else.
 *
 * Deliberately only a date, a state and a kind. No licence number, no name,
 * no document: none of it is needed to say "your licence expires in three
 * weeks", and a licence number is a government identifier that would make
 * this row worth stealing.
 */
export type UserLicenseRow = Timestamps & {
  id: string;
  user_id: string;
  state_id: string;
  kind: LicenseKind;
  expires_on: string;
};

/**
 * Insert = row minus DB-managed defaults; Update = all optional.
 * Relationships is required by supabase-js's GenericTable shape — without it
 * the client's insert/update types collapse to `never`.
 */
type Table<Row, Insert> = { Row: Row; Insert: Insert; Update: Partial<Insert>; Relationships: [] };
type Gen = 'id' | 'created_at' | 'updated_at';

export type Database = {
  public: {
    Tables: {
      sources: Table<SourceRow, Omit<SourceRow, Gen> & { id?: string }>;
      states: Table<StateRow, Omit<StateRow, Gen> & { id?: string }>;
      species: Table<SpeciesRow, Omit<SpeciesRow, 'id' | 'created_at'> & { id?: string }>;
      zones: Table<ZoneRow, Omit<ZoneRow, Gen> & { id?: string }>;
      seasons: Table<SeasonRow, Omit<SeasonRow, Gen> & { id?: string }>;
      // usgs_site_no and wadeable_cfs_max are optional on insert: both default
      // to null in the database, and a water is published long before anyone
      // knows which gauge reads it.
      waters: Table<
        WaterRow,
        Omit<WaterRow, Gen | 'usgs_site_no' | 'wadeable_cfs_max'> & {
          id?: string;
          usgs_site_no?: string | null;
          wadeable_cfs_max?: number | null;
        }
      >;
      fishing_rules: Table<FishingRuleRow, Omit<FishingRuleRow, Gen> & { id?: string }>;
      fishing_rule_species: Table<FishingRuleSpeciesRow, FishingRuleSpeciesRow>;
      stockings: Table<StockingRow, Omit<StockingRow, Gen> & { id?: string }>;
      user_waters: Table<UserWaterRow, Omit<UserWaterRow, 'id' | 'created_at'> & { id?: string }>;
      user_licenses: Table<UserLicenseRow, Omit<UserLicenseRow, Gen> & { id?: string; kind?: LicenseKind }>;
      application_windows: Table<ApplicationWindowRow, Omit<ApplicationWindowRow, Gen> & { id?: string }>;
      regulation_summaries: Table<RegulationSummaryRow, Omit<RegulationSummaryRow, Gen> & { id?: string }>;
      profiles: Table<
        ProfileRow,
        { id: string; display_name?: string | null; is_admin?: boolean; onboarded_at?: string | null; active_location_id?: string | null; resident_state_id?: string | null; is_premium?: boolean; grandfathered?: boolean; weekend_brief?: boolean; avatar_url?: string | null; push_permission?: 'granted' | 'denied' | 'undetermined' | null; push_permission_at?: string | null }
      >;
      user_locations: Table<UserLocationRow, Omit<UserLocationRow, 'id' | 'created_at'> & { id?: string }>;
      state_species: Table<StateSpeciesRow, StateSpeciesRow>;
      follows: Table<FollowRow, Omit<FollowRow, 'id' | 'created_at'> & { id?: string }>;
      federal_permit_hunts: Table<FederalPermitHuntRow, Omit<FederalPermitHuntRow, 'id' | 'created_at'> & { id?: string }>;
      permit_follows: Table<PermitFollowRow, Omit<PermitFollowRow, 'id' | 'created_at'> & { id?: string }>;
      alert_preferences: Table<AlertPreferenceRow, Omit<AlertPreferenceRow, 'created_at' | 'updated_at'>>;
      device_push_tokens: Table<DevicePushTokenRow, Omit<DevicePushTokenRow, Gen> & { id?: string }>;
      sent_notifications: Table<SentNotificationRow, Omit<SentNotificationRow, 'id' | 'sent_at' | 'hidden_at'> & { id?: string; hidden_at?: string | null }>;
      review_queue: Table<ReviewQueueRow, Omit<ReviewQueueRow, Gen> & { id?: string }>;
      user_applications: Table<UserApplicationRow, Omit<UserApplicationRow, Gen> & { id?: string }>;
      user_point_balances: Table<PointBalanceRow, Omit<PointBalanceRow, Gen> & { id?: string }>;
      date_reports: Table<DateReportRow, Omit<DateReportRow, 'id' | 'created_at'> & { id?: string }>;
      date_changes: Table<DateChangeRow, Omit<DateChangeRow, 'id' | 'created_at'> & { id?: string }>;
      regulation_changes: Table<RegulationChangeRow, Omit<RegulationChangeRow, Gen> & { id?: string }>;
      parties: Table<PartyRow, Omit<PartyRow, 'id' | 'created_at'> & { id?: string }>;
      leftover_tag_sales: Table<LeftoverTagSaleRow, Omit<LeftoverTagSaleRow, Gen> & { id?: string }>;
      leftover_tag_availability: Table<LeftoverTagAvailabilityRow, Omit<LeftoverTagAvailabilityRow, Gen> & { id?: string }>;
      party_members: Table<PartyMemberRow, Omit<PartyMemberRow, 'joined_at'> & { joined_at?: string }>;
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      apply_review_item: { Args: { p_review_id: string; p_quiet?: boolean }; Returns: undefined };
      approve_clean_reviews: {
        Args: { p_quiet?: boolean; p_min_confidence?: number; p_limit?: number };
        Returns: {
          approved: number;
          failed: number;
          quiet: boolean;
          min_confidence: number;
          failures: { id: string; error: string }[];
        };
      };
      create_party: {
        Args: { p_window_id?: string | null; p_season_id?: string | null };
        Returns: { party_id: string; invite_code: string }[];
      };
      join_party: { Args: { p_code: string }; Returns: string };
      set_party_applied: { Args: { p_party_id: string; p_applied: boolean }; Returns: undefined };
      leave_party: { Args: { p_party_id: string }; Returns: undefined };
      party_roster: { Args: { p_party_id: string }; Returns: PartyRosterEntry[] };
      party_thread: { Args: { p_party_id: string; p_limit?: number }; Returns: PartyMessage[] };
      post_party_message: { Args: { p_party_id: string; p_body: string }; Returns: string };
      report_party_message: { Args: { p_message_id: string; p_reason?: string | null }; Returns: void };
      delete_party_message: { Args: { p_message_id: string }; Returns: void };
      block_user: { Args: { p_user_id: string; p_blocked?: boolean }; Returns: void };
      set_party_day: { Args: { p_party_id: string; p_day: string; p_going: boolean }; Returns: void };
      set_avatar_url: { Args: { p_url: string | null }; Returns: void };
      is_party_member: { Args: { p_party_id: string }; Returns: boolean };
    };
    Enums: {
      content_status: ContentStatus;
      zone_type: ZoneType;
      season_method: SeasonMethod;
      source_doc_type: SourceDocType;
      review_status: ReviewStatus;
      review_change_type: ReviewChangeType;
      notification_subject_type: NotificationSubjectType;
    };
    CompositeTypes: Record<string, never>;
  };
};
