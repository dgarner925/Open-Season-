import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryClient } from '@/lib/queryClient';
import { useAuth } from '@/providers/AuthProvider';
import type { StateRow, ZoneRow } from '@/lib/database.types';

export type LocationWithRefs = {
  id: string;
  state_id: string;
  zone_id: string | null;
  state: Pick<StateRow, 'id' | 'code' | 'name'> | null;
  zone: Pick<ZoneRow, 'id' | 'name' | 'type'> | null;
};

/** The hunter's saved locations (state + optional unit). */
export function useLocations() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['locations', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<LocationWithRefs[]> => {
      const { data, error } = await supabase
        .from('user_locations')
        .select('id, state_id, zone_id, state:states(id,code,name), zone:zones(id,name,type)')
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as unknown as LocationWithRefs[];
    },
  });
}

/** Real GMU units for a state (empty where we haven't sourced units yet). */
export function useUnitsForState(stateId: string | null | undefined) {
  return useQuery({
    queryKey: ['zones', 'gmu', stateId],
    enabled: Boolean(stateId),
    queryFn: async (): Promise<ZoneRow[]> => {
      const { data, error } = await supabase.from('zones').select('*').eq('state_id', stateId!).eq('type', 'gmu').order('name');
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Add a location (idempotent) and make it the active one. */
export function useAddLocation() {
  const { user, refreshProfile } = useAuth();
  return useMutation({
    mutationFn: async ({ stateId, zoneId }: { stateId: string; zoneId: string | null }) => {
      if (!user) throw new Error('not signed in');
      let q = supabase.from('user_locations').select('id').eq('user_id', user.id).eq('state_id', stateId);
      q = zoneId ? q.eq('zone_id', zoneId) : q.is('zone_id', null);
      const { data: existing } = await q.maybeSingle();
      let id = existing?.id as string | undefined;
      if (!id) {
        const { data, error } = await supabase
          .from('user_locations')
          .insert({ user_id: user.id, state_id: stateId, zone_id: zoneId })
          .select('id')
          .single();
        if (error) throw error;
        id = data.id;
      }
      const { error: pErr } = await supabase.from('profiles').update({ active_location_id: id }).eq('id', user.id);
      if (pErr) throw pErr;
      return id;
    },
    onSuccess: async () => {
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ['locations'] });
    },
  });
}

/** Switch the active location (or clear it with null). */
export function useSetActiveLocation() {
  const { user, refreshProfile } = useAuth();
  return useMutation({
    mutationFn: async (id: string | null) => {
      if (!user) throw new Error('not signed in');
      const { error } = await supabase.from('profiles').update({ active_location_id: id }).eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshProfile();
    },
  });
}

export function useRemoveLocation() {
  const { refreshProfile } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('user_locations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ['locations'] });
    },
  });
}
