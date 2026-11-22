/**
 * The angler's own licence expiry, read from `user_licenses`.
 *
 * Replaces the hardcoded "expires in 23 days" that every user saw, whoever
 * they were and whatever licence they held. That was not a placeholder in the
 * usual sense -- a grey box reads as unfinished, but a specific number of days
 * about YOUR licence reads as a fact the app checked.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT DOES WHEN IT DOES NOT KNOW
 *
 * Nothing. `user_licenses` is empty for everyone today, so the banner is
 * absent for everyone today, and that is the correct behaviour rather than a
 * gap waiting to be filled: nobody has told us when their licence expires.
 * OtwLicenseBanner already returns null for a null `daysLeft`, so honesty here
 * needed no new component -- only a hook that is willing to return null.
 *
 * A guest has no rows by RLS (the table is owner-only for `authenticated`,
 * with no anon policy), so the query is simply disabled rather than issued and
 * discarded.
 *
 * The renewal link comes from `states.license_url` for the angler's own state.
 * The placeholder hardcoded Georgia's, which was wrong for 49 states and
 * invisibly so -- a Montana angler tapping "Renew" landed at georgiawildlife.com.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { licenceDaysLeft, type LicenceLike } from './licence';
import type { StateRow } from '@/lib/database.types';

const ONE_HOUR = 60 * 60 * 1000;

export type OtwLicence = {
  /** Whole calendar days left; negative when lapsed; null when unknown. */
  daysLeft: number | null;
  /** The angler's own state's licence page, not a hardcoded one. */
  renewUrl: string | null;
};

/**
 * @param state the angler's resident or browsed state, or null if unknown.
 */
export function useOtwLicence(state: StateRow | null | undefined): OtwLicence {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const stateId = state?.id ?? null;

  const { data } = useQuery({
    enabled: !!userId && !!stateId,
    queryKey: ['otw', 'licence', userId, stateId],
    queryFn: async (): Promise<LicenceLike[]> => {
      const { data, error } = await supabase
        .from('user_licenses')
        .select('kind, expires_on')
        .eq('user_id', userId!)
        .eq('state_id', stateId!);
      // RLS already restricts this to the caller's own rows; the user_id
      // filter is here so a future shared view cannot widen it by accident.
      if (error) throw error;
      return data ?? [];
    },
    staleTime: ONE_HOUR,
  });

  // Deliberately NOT memoised on [data, license_url].
  //
  // The obvious useMemo over those two is wrong in a way that hides: the
  // count depends on a third input, today's date, which is not in the
  // dependency list and cannot usefully be put there. Memoised, a session
  // left open overnight would keep rendering yesterday's number -- "expires
  // tomorrow" on the morning it expires.
  //
  // Recomputing is two integer subtractions against an array that is empty
  // or has one element, so there is nothing to save. The banner consumes
  // scalars, so the fresh object identity costs no re-render either.
  return {
    daysLeft: licenceDaysLeft(data ?? null, new Date()),
    renewUrl: state?.license_url ?? null,
  };
}
