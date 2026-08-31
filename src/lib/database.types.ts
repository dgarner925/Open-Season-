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
  joined_at: string;
  applied_at: string | null;
  is_owner: boolean;
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

export type SpeciesRow = {
  id: string;
  key: string;
  name: string;
  category: string | null;
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
  status: ReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
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
      application_windows: Table<ApplicationWindowRow, Omit<ApplicationWindowRow, Gen> & { id?: string }>;
      regulation_summaries: Table<RegulationSummaryRow, Omit<RegulationSummaryRow, Gen> & { id?: string }>;
      profiles: Table<
        ProfileRow,
        { id: string; display_name?: string | null; is_admin?: boolean; onboarded_at?: string | null; active_location_id?: string | null; resident_state_id?: string | null; is_premium?: boolean; grandfathered?: boolean; weekend_brief?: boolean }
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
      parties: Table<PartyRow, Omit<PartyRow, 'id' | 'created_at'> & { id?: string }>;
      party_members: Table<PartyMemberRow, Omit<PartyMemberRow, 'joined_at'> & { joined_at?: string }>;
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      apply_review_item: { Args: { p_review_id: string }; Returns: undefined };
      create_party: {
        Args: { p_window_id?: string | null; p_season_id?: string | null };
        Returns: { party_id: string; invite_code: string }[];
      };
      join_party: { Args: { p_code: string }; Returns: string };
      set_party_applied: { Args: { p_party_id: string; p_applied: boolean }; Returns: undefined };
      leave_party: { Args: { p_party_id: string }; Returns: undefined };
      party_roster: { Args: { p_party_id: string }; Returns: PartyRosterEntry[] };
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
