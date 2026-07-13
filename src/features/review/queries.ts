import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ReviewQueueRow } from '@/lib/database.types';

/** Pending proposals from the extraction pipeline, newest first. Admin-only (RLS). */
export function usePendingReviews() {
  return useQuery({
    queryKey: ['review_queue', 'pending'],
    queryFn: async (): Promise<ReviewQueueRow[]> => {
      const { data, error } = await supabase
        .from('review_queue')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useApproveReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reviewId: string) => {
      const { error } = await supabase.rpc('apply_review_item', { p_review_id: reviewId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['review_queue'] });
      qc.invalidateQueries({ queryKey: ['seasons'] });
    },
  });
}

export function useRejectReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reviewId: string) => {
      // Admins can write review_queue directly (RLS). No table change is applied.
      const { error } = await supabase
        .from('review_queue')
        .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
        .eq('id', reviewId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['review_queue'] }),
  });
}
