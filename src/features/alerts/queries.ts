import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

export type AlertPref = {
  follow_id: string;
  opener_offsets: number[];
  deadline_offsets: number[];
  results_offsets: number[];
  follow: {
    state: { code: string; name: string } | null;
    species: { key: string; name: string } | null;
  } | null;
};

const DEFAULT_OFFSETS = [365, 30, 7, 1];
const DEFAULT_RESULTS = [1, 0];

/**
 * One alert card per followed (state, species). We drive this off `follows`
 * (the source of truth for what the user selected) and left-join the prefs row,
 * defaulting the cadences if it's missing — so the screen always mirrors the
 * user's picks even if a prefs row somehow never got created.
 */
export function useAlertPreferences() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['alert_preferences', user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<AlertPref[]> => {
      const { data, error } = await supabase
        .from('follows')
        .select('id, state:states(code,name), species:species(key,name), alert_preferences(opener_offsets, deadline_offsets, results_offsets)')
        .eq('user_id', user!.id);
      if (error) throw error;
      return (data ?? []).map((f: any) => {
        const ap = Array.isArray(f.alert_preferences) ? f.alert_preferences[0] : f.alert_preferences;
        return {
          follow_id: f.id,
          opener_offsets: ap?.opener_offsets ?? DEFAULT_OFFSETS,
          deadline_offsets: ap?.deadline_offsets ?? DEFAULT_OFFSETS,
          results_offsets: ap?.results_offsets ?? DEFAULT_RESULTS,
          follow: { state: f.state, species: f.species },
        } as AlertPref;
      });
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
      kind: 'opener' | 'deadline' | 'results';
      offset: number;
      current: number[];
    }) => {
      const next = current.includes(offset)
        ? current.filter((o) => o !== offset)
        : [...current, offset].sort((a, b) => b - a);
      const patch =
        kind === 'opener'
          ? { opener_offsets: next }
          : kind === 'deadline'
            ? { deadline_offsets: next }
            : { results_offsets: next };
      // The prefs row is normally created by a trigger; if it's missing, this
      // self-heals it with the defaults (ignoreDuplicates means an existing row
      // is never clobbered). Then update only the toggled cadence.
      await supabase
        .from('alert_preferences')
        .upsert(
          { follow_id: followId, opener_offsets: DEFAULT_OFFSETS, deadline_offsets: DEFAULT_OFFSETS, results_offsets: DEFAULT_RESULTS },
          { onConflict: 'follow_id', ignoreDuplicates: true },
        );
      const { error } = await supabase.from('alert_preferences').update(patch).eq('follow_id', followId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alert_preferences'] }),
  });
}
