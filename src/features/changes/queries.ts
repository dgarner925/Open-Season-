/**
 * "What changed this year" — year-over-year regulation differences for the
 * states a hunter follows. The diff is computed server-side and stored; this
 * only reads it.
 */
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useFollows } from '@/features/follows/queries';

export type RegulationChange = {
  id: string;
  change_type: 'added' | 'removed' | 'modified';
  note: string | null;
  new_id: string | null;
  old_id: string | null;
  new_year: number | null;
  old_year: number | null;
  state: { code: string; name: string } | null;
  species: { name: string } | null;
};

const SELECT =
  'id,change_type,note,new_id,old_id,new_year,old_year,state:states(code,name),species:species(name)';

/** Changes in every state the hunter follows, newest license year first. */
export function useRegulationChanges() {
  const { data: follows = [] } = useFollows();
  const stateIds = useMemo(() => [...new Set(follows.map((f) => f.state_id))].sort(), [follows]);

  return useQuery({
    queryKey: ['regulation_changes', stateIds],
    enabled: stateIds.length > 0,
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<RegulationChange[]> => {
      const { data, error } = await supabase
        .from('regulation_changes')
        .select(SELECT)
        .in('state_id', stateIds)
        .eq('published', true)
        .order('new_year', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as unknown as RegulationChange[];
    },
  });
}

/**
 * Did this particular season change this year? Drives the badge on the season
 * page — one row, cheap, cached.
 */
export function useSeasonChange(seasonId: string | undefined) {
  return useQuery({
    queryKey: ['regulation_changes', 'season', seasonId],
    enabled: Boolean(seasonId),
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<RegulationChange | null> => {
      const { data, error } = await supabase
        .from('regulation_changes')
        .select(SELECT)
        .eq('new_id', seasonId!)
        .eq('published', true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as RegulationChange) ?? null;
    },
  });
}
