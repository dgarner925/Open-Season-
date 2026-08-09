import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import type { PartyRosterEntry, PartyRow } from '@/lib/database.types';

export type PartyWithWindow = PartyRow & {
  window: {
    id: string;
    name: string | null;
    closes_at: string | null;
    results_expected_at: string | null;
    state: { code: string; name: string } | null;
    species: { key: string; name: string } | null;
  } | null;
};

const PARTY_SELECT =
  '*, window:application_windows(id, name, closes_at, results_expected_at, state:states(code,name), species:species(key,name))';

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

/** Create (or fetch) my party for a draw; returns { party_id, invite_code }. */
export function useCreateParty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (windowId: string) => {
      const { data, error } = await supabase.rpc('create_party', { p_window_id: windowId });
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
