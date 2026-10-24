/**
 * Ask the Book — natural-language questions answered from our own records.
 *
 * The model never sees the app; it runs server-side in the ask-book Edge
 * Function, which holds the API key and enforces grounding. This file only
 * carries the question there and the answer back.
 */
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type AskCitation = {
  label: string;
  state_code: string;
  season_year?: number;
  record_id?: string;
};

export type AskAnswer = {
  answer: string;
  citations: AskCitation[];
  season_ids: string[];
  not_covered: boolean;
  disclaimer: string;
  official_url?: string | null;
  cached?: boolean;
};

/** The server said this hunter has spent their free questions. */
export type AskPaywall = { paywall: true; trial_used: number; trial_total: number };
/** Pro, but past the daily ceiling. */
export type AskRateLimited = { rate_limited: true; retry_after_hours: number };

export type AskResult = AskAnswer | AskPaywall | AskRateLimited;

export function isPaywall(r: AskResult | undefined): r is AskPaywall {
  return Boolean(r && (r as AskPaywall).paywall);
}
export function isRateLimited(r: AskResult | undefined): r is AskRateLimited {
  return Boolean(r && (r as AskRateLimited).rate_limited);
}
export function isAnswer(r: AskResult | undefined): r is AskAnswer {
  return Boolean(r && typeof (r as AskAnswer).answer === 'string');
}

export function useAskBook() {
  return useMutation({
    mutationFn: async ({ question, stateCode }: { question: string; stateCode: string | null }): Promise<AskResult> => {
      const { data, error } = await supabase.functions.invoke('ask-book', {
        body: { question, state_code: stateCode },
      });
      if (error) throw error;
      return data as AskResult;
    },
  });
}
