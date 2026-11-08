import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ReviewQueueRow } from '@/lib/database.types';

/**
 * The confidence floor for a "clean" item. The screen counts with it and the
 * RPC applies with it — the same number travels to the server, so the count on
 * the button is the number of rows the sweep will touch.
 */
export const CLEAN_MIN_CONFIDENCE = 0.85;

/**
 * Clean = the pipeline scored it, the score is high, and our own validation
 * found nothing wrong. Mirrors the predicate in approve_clean_reviews()
 * (20261101120000). A missing score is never clean: an item we couldn't score
 * is exactly the one that needs a human eye.
 */
export function isCleanReview(r: ReviewQueueRow): boolean {
  return (
    typeof r.confidence === 'number' &&
    r.confidence >= CLEAN_MIN_CONFIDENCE &&
    (r.validation_errors?.length ?? 0) === 0
  );
}

/** Pending proposals from the extraction pipeline, newest first. Admin-only (RLS). */
export function usePendingReviews() {
  return useQuery({
    queryKey: ['review_queue', 'pending'],
    queryFn: async (): Promise<ReviewQueueRow[]> => {
      const { data, error } = await supabase
        .from('review_queue')
        .select('*')
        .eq('status', 'pending')
        // Least-certain first: the rows that need a human eye, not the easy ones.
        .order('confidence', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useApproveReview() {
  const qc = useQueryClient();
  return useMutation({
    // quiet: apply the dates without alerting followers. Default is loud —
    // a one-off approval is the "an agency moved a date" case, which is
    // exactly what the watchdog push is for.
    mutationFn: async ({ reviewId, quiet = false }: { reviewId: string; quiet?: boolean }) => {
      const { error } = await supabase.rpc('apply_review_item', {
        p_review_id: reviewId,
        p_quiet: quiet,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['review_queue'] });
      qc.invalidateQueries({ queryKey: ['seasons'] });
    },
  });
}

export type CleanSweepResult = {
  approved: number;
  failed: number;
  quiet: boolean;
  min_confidence: number;
  failures: { id: string; error: string }[];
};

/**
 * Apply every clean item in one pass.
 *
 * `quiet` is required, with no default. It used to default to true, and since
 * this is how a large queue actually gets worked, every sweep went out silent
 * and the date-change watchdog never fired once between shipping on 2026-11-01
 * and 2026-11-08 — three published openers moved in that window with nobody
 * told. A default either way is a decision made far from the screen that knows
 * the consequences, so the caller has to say.
 *
 * See notifyCount() in ./notify for how the screen works out what a sweep
 * would actually announce before asking.
 */
export function useApproveCleanReviews() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ quiet }: { quiet: boolean }): Promise<CleanSweepResult> => {
      const { data, error } = await supabase.rpc('approve_clean_reviews', {
        p_quiet: quiet,
        p_min_confidence: CLEAN_MIN_CONFIDENCE,
      });
      if (error) throw error;
      return data as CleanSweepResult;
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
