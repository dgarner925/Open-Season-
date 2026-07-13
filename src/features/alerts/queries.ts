import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

export type AlertPref = {
  follow_id: string;
  opener_offsets: number[];
  deadline_offsets: number[];
  follow: {
    state: { code: string; name: string } | null;
    species: { key: string; name: string } | null;
  } | null;
};

/** The user's per-follow alert preferences (RLS scopes to the owner). */
export function useAlertPreferences() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['alert_preferences', user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<AlertPref[]> => {
      const { data, error } = await supabase
        .from('alert_preferences')
        .select('follow_id, opener_offsets, deadline_offsets, follow:follows(state:states(code,name), species:species(key,name))');
      if (error) throw error;
      return (data ?? []) as unknown as AlertPref[];
    },
  });
}

/** Add/remove one day-offset from a follow's opener or deadline list. */
export function useToggleOffset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      followId,
      kind,
      offset,
      current,
    }: {
      followId: string;
      kind: 'opener' | 'deadline';
      offset: number;
      current: number[];
    }) => {
      const next = current.includes(offset)
        ? current.filter((o) => o !== offset)
        : [...current, offset].sort((a, b) => b - a);
      const patch = kind === 'opener' ? { opener_offsets: next } : { deadline_offsets: next };
      const { error } = await supabase.from('alert_preferences').update(patch).eq('follow_id', followId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alert_preferences'] }),
  });
}
