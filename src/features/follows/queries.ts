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

/**
 * Per-season reminder arming, scoped by hunt method so it survives yearly date
 * refreshes. alert_preferences.methods: null = all methods (legacy default),
 * [] = none, ['archery'] = just those. The follow row (and its prefs row, via
 * DB trigger) is created on first arm if the user wasn't following yet.
 */
export function useMethodReminder(stateId: string | undefined, speciesId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: follows = [] } = useFollows();
  const follow = follows.find((f) => f.state_id === stateId && f.species_id === speciesId);

  const prefs = useQuery({
    queryKey: ['alert_preferences', 'methods', follow?.id],
    enabled: Boolean(follow),
    queryFn: async (): Promise<string[] | null> => {
      const { data, error } = await supabase
        .from('alert_preferences')
        .select('methods')
        .eq('follow_id', follow!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as { methods: string[] | null } | null)?.methods ?? null;
    },
  });

  const methods = prefs.data ?? null;
  const isArmed = (method: string) =>
    Boolean(follow) && (methods === null || (methods ?? []).includes(method));

  const toggle = useMutation({
    mutationFn: async ({ method, allMethods }: { method: string; allMethods: string[] }) => {
      if (!user || !stateId || !speciesId) throw new Error('Not signed in.');
      let followId = follow?.id;
      if (!followId) {
        // First arm on an unfollowed hunt: follow it, then scope to just this method.
        const { data, error } = await supabase
          .from('follows')
          .insert({ user_id: user.id, state_id: stateId, species_id: speciesId })
          .select('id')
          .single();
        if (error) throw error;
        followId = (data as { id: string }).id;
        const { error: e2 } = await supabase
          .from('alert_preferences')
          .update({ methods: [method] })
          .eq('follow_id', followId);
        if (e2) throw e2;
        return;
      }
      const armed = methods === null || (methods ?? []).includes(method);
      let next: string[] | null;
      if (armed) {
        next = (methods === null ? allMethods : methods).filter((m) => m !== method);
      } else {
        next = [...(methods ?? []), method];
        // Arming the last remaining method = back to "all" (null keeps future
        // methods covered too, matching legacy behavior).
        if (allMethods.every((m) => next!.includes(m))) next = null;
      }
      const { error } = await supabase.from('alert_preferences').update({ methods: next }).eq('follow_id', followId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alert_preferences'] });
      qc.invalidateQueries({ queryKey: ['follows'] });
    },
  });

  return { follow, methods, isArmed, toggle, loading: prefs.isLoading };
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
