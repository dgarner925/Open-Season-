import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { FollowRow } from '@/lib/database.types';
import { useAuth } from '@/providers/AuthProvider';

export function useFollows() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['follows', user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<FollowRow[]> => {
      const { data, error } = await supabase.from('follows').select('*').eq('user_id', user!.id);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Add or remove a (state, species) follow. Returns the resulting followed state. */
export function useToggleFollow() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      stateId,
      speciesId,
      existingId,
    }: {
      stateId: string;
      speciesId: string;
      existingId?: string;
    }) => {
      if (!user) throw new Error('Not signed in.');
      if (existingId) {
        const { error } = await supabase.from('follows').delete().eq('id', existingId);
        if (error) throw error;
        return { followed: false };
      }
      const { error } = await supabase
        .from('follows')
        .insert({ user_id: user.id, state_id: stateId, species_id: speciesId });
      if (error) throw error;
      return { followed: true };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['follows'] });
      qc.invalidateQueries({ queryKey: ['seasons'] });
      qc.invalidateQueries({ queryKey: ['windows'] });
      qc.invalidateQueries({ queryKey: ['regs'] });
    },
  });
}

/** Mark onboarding complete once the user has picked at least one follow. */
export function useCompleteOnboarding() {
  const { user, refreshProfile } = useAuth();
  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not signed in.');
      // Upsert (not update) so this works even if the profile row is missing.
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, onboarded_at: new Date().toISOString() }, { onConflict: 'id' });
      if (error) throw error;
    },
    onSuccess: () => refreshProfile(),
  });
}
