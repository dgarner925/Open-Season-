import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import type { PointBalanceRow, PointType } from '@/lib/database.types';

export type PointBalanceWithRefs = PointBalanceRow & {
  state: { code: string; name: string } | null;
  species: { name: string } | null;
};

const SELECT = '*, state:states(code,name), species:species(name)';

export function usePointBalances() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['point_balances', user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<PointBalanceWithRefs[]> => {
      const { data, error } = await supabase
        .from('user_point_balances')
        .select(SELECT)
        .order('points', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PointBalanceWithRefs[];
    },
  });
}

export function usePointBalance(id: string | undefined) {
  return useQuery({
    queryKey: ['point_balance', id],
    enabled: Boolean(id),
    queryFn: async (): Promise<PointBalanceRow | null> => {
      const { data, error } = await supabase.from('user_point_balances').select('*').eq('id', id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export type PointInput = {
  id?: string;
  state_id: string;
  species_id: string;
  point_type: PointType;
  points: number;
  notes: string | null;
};

export function useSavePointBalance() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PointInput) => {
      if (!user) throw new Error('Not signed in.');
      // onConflict on the natural key lets "add" merge into an existing balance
      // for the same state+species+type instead of erroring on the unique index.
      const row = { ...input, user_id: user.id };
      const { error } = await supabase
        .from('user_point_balances')
        .upsert(row, { onConflict: input.id ? 'id' : 'user_id,state_id,species_id,point_type' });
      if (error) throw error;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['point_balance'] }).then(() => qc.invalidateQueries({ queryKey: ['point_balances'] })),
  });
}

/** Quick +/- on a row (buying a point, or fixing a typo). Clamps at 0. */
export function useAdjustPointBalance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, current, delta }: { id: string; current: number; delta: number }) => {
      const next = Math.max(0, current + delta);
      const { error } = await supabase.from('user_point_balances').update({ points: next }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['point_balances'] }),
  });
}

export function useDeletePointBalance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('user_point_balances').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['point_balances'] }),
  });
}
