import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import type { PartyMessage, PartyRosterEntry, PartyRow } from '@/lib/database.types';

export type PartyWithWindow = PartyRow & {
  window: {
    id: string;
    name: string | null;
    closes_at: string | null;
    results_expected_at: string | null;
    state: { code: string; name: string } | null;
    species: { key: string; name: string } | null;
  } | null;
  season: {
    id: string;
    label: string | null;
    method: string;
    open_date: string | null;
    close_date: string | null;
    state: { code: string; name: string } | null;
    species: { key: string; name: string } | null;
  } | null;
};

const PARTY_SELECT =
  '*, window:application_windows(id, name, closes_at, results_expected_at, state:states(code,name), species:species(key,name)), ' +
  'season:seasons(id, label, method, open_date, close_date, state:states(code,name), species:species(key,name))';

/** All parties I'm a member of (RLS scopes rows to my memberships). */
export function useMyParties() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['parties', user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<PartyWithWindow[]> => {
      const { data, error } = await supabase.from('parties').select(PARTY_SELECT).order('created_at');
      if (error) throw error;
      return (data ?? []) as unknown as PartyWithWindow[];
    },
  });
}

export function usePartyById(id: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['party', id],
    enabled: Boolean(user && id),
    queryFn: async (): Promise<PartyWithWindow | null> => {
      const { data, error } = await supabase.from('parties').select(PARTY_SELECT).eq('id', id!).maybeSingle();
      if (error) throw error;
      return data as unknown as PartyWithWindow | null;
    },
  });
}

export function usePartyRoster(partyId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['party_roster', partyId],
    enabled: Boolean(user && partyId),
    queryFn: async (): Promise<PartyRosterEntry[]> => {
      const { data, error } = await supabase.rpc('party_roster', { p_party_id: partyId! });
      if (error) throw error;
      return (data ?? []) as PartyRosterEntry[];
    },
  });
}

/** Create (or fetch) my party for a draw or a season; returns { party_id, invite_code }. */
export function useCreateParty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (target: { windowId?: string; seasonId?: string }) => {
      const { data, error } = await supabase.rpc('create_party', {
        p_window_id: target.windowId ?? null,
        p_season_id: target.seasonId ?? null,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error('No party returned');
      return row as { party_id: string; invite_code: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parties'] });
      qc.invalidateQueries({ queryKey: ['follows'] });
    },
  });
}

export function useJoinParty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc('join_party', { p_code: code.trim() });
      if (error) throw error;
      return data as string; // party id
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parties'] });
      qc.invalidateQueries({ queryKey: ['follows'] });
    },
  });
}

export function useSetApplied(partyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (applied: boolean) => {
      const { error } = await supabase.rpc('set_party_applied', { p_party_id: partyId, p_applied: applied });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['party_roster', partyId] }),
  });
}

export function useLeaveParty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (partyId: string) => {
      const { error } = await supabase.rpc('leave_party', { p_party_id: partyId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['parties'] }),
  });
}

// ---------------------------------------------------------------------------
// The thread
// ---------------------------------------------------------------------------

/**
 * Messages in a party. Polled rather than subscribed: a camp thread is four
 * people planning a weekend, not a chat room, and a 10s poll costs far less
 * than holding a realtime socket open on a phone in the woods.
 */
export function usePartyThread(partyId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['party_thread', partyId],
    enabled: Boolean(user && partyId),
    refetchInterval: 10_000,
    queryFn: async (): Promise<PartyMessage[]> => {
      const { data, error } = await supabase.rpc('party_thread', { p_party_id: partyId! });
      if (error) throw error;
      return (data ?? []) as PartyMessage[];
    },
  });
}

export function usePostPartyMessage(partyId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase.rpc('post_party_message', {
        p_party_id: partyId!,
        p_body: body,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['party_thread', partyId] }),
  });
}

export function useReportPartyMessage(partyId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { error } = await supabase.rpc('report_party_message', {
        p_message_id: id,
        p_reason: reason ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['party_thread', partyId] }),
  });
}

export function useDeletePartyMessage(partyId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('delete_party_message', { p_message_id: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['party_thread', partyId] }),
  });
}

/** Blocking is mutual in party_thread: neither of you sees the other again. */
export function useBlockUser(partyId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, blocked = true }: { userId: string; blocked?: boolean }) => {
      const { error } = await supabase.rpc('block_user', {
        p_user_id: userId,
        p_blocked: blocked,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['party_thread', partyId] });
      qc.invalidateQueries({ queryKey: ['party_roster', partyId] });
    },
  });
}

// ---------------------------------------------------------------------------
// Who is coming which days
// ---------------------------------------------------------------------------

export function useSetPartyDay(partyId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ day, going }: { day: string; going: boolean }) => {
      const { error } = await supabase.rpc('set_party_day', {
        p_party_id: partyId!,
        p_day: day,
        p_going: going,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['party_roster', partyId] }),
  });
}
