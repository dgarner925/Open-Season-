import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import type { ApplicationStatus, UserApplicationRow } from '@/lib/database.types';

export type ApplicationWithRefs = UserApplicationRow & {
  state: { code: string; name: string } | null;
  species: { name: string } | null;
};

const SELECT = '*, state:states(code,name), species:species(name)';

export function useApplications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['applications', user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<ApplicationWithRefs[]> => {
      const { data, error } = await supabase
        .from('user_applications')
        .select(SELECT)
        .order('applied_on', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ApplicationWithRefs[];
    },
  });
}

export function useApplication(id: string | undefined) {
  return useQuery({
    queryKey: ['application', id],
    enabled: Boolean(id),
    queryFn: async (): Promise<UserApplicationRow | null> => {
      const { data, error } = await supabase.from('user_applications').select('*').eq('id', id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export type ApplicationInput = {
  id?: string;
  title: string;
  state_id: string | null;
  species_id: string | null;
  window_id: string | null;
  application_url: string | null;
  portal_username: string | null;
  status: ApplicationStatus;
  applied_on: string | null;
  results_on: string | null;
  fee_summary: string | null;
  points: number | null;
  notes: string | null;
};

export function useSaveApplication() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ApplicationInput) => {
      if (!user) throw new Error('Not signed in.');
      const row = { ...input, user_id: user.id };
      const { error } = await supabase.from('user_applications').upsert(row, { onConflict: 'id' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['application'] }).then(() => qc.invalidateQueries({ queryKey: ['applications'] })),
  });
}

export function useDeleteApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('user_applications').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['applications'] }),
  });
}
