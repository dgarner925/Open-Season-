/**
 * The daily brief — one or two sentences about the hunter's own day, phrased
 * server-side from facts assembled in SQL. Asked once per day and cached; the
 * card simply shows nothing when there's no news, and never blocks Home.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

export type DailyBrief = {
  brief: string | null;
  phrased?: boolean;
  disclaimer?: string;
  locked?: boolean;
  cached?: boolean;
};

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function useDailyBrief(enabled = true) {
  const { user } = useAuth();
  const day = todayISO();
  return useQuery({
    queryKey: ['daily-brief', user?.id ?? 'anon', day],
    enabled: Boolean(user) && enabled,
    // One call per person per day; the server caches it too.
    staleTime: 12 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
    queryFn: async (): Promise<DailyBrief> => {
      const { data, error } = await supabase.functions.invoke('daily-brief', { body: {} });
      if (error) throw error;
      return (data ?? { brief: null }) as DailyBrief;
    },
  });
}
