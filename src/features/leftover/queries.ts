/**
 * Reading leftover and over-the-counter tag sales.
 *
 * Same shape as the seasons and windows feeds: what you follow if you follow
 * anything, the browsed state if you do not. Reading is free -- the paywall is
 * on being TOLD, not on knowing, and a sale nobody can see is a sale nobody
 * turns up to.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useFollows } from '@/features/follows/queries';
import { useBrowseStateCode } from '@/lib/browseState';
import { followPairs, keepFollowed } from '@/features/reference/queries';
import { upcomingSales, type SaleShape } from './format';

export type LeftoverSale = SaleShape & {
  id: string;
  state_id: string;
  species_id: string;
  zone_id: string | null;
  season_year: number;
  name: string;
  sale_end_time: string | null;
  purchase_url: string | null;
  source_url: string | null;
  notes: string | null;
  last_verified_at: string | null;
  state?: { id: string; code: string; name: string; license_url: string | null } | null;
  species?: { id: string; key: string; name: string } | null;
  zone?: { id: string; name: string; type: string } | null;
};

export type SaleAvailability = {
  id: string;
  sale_id: string;
  unit_code: string | null;
  weapon_type: string | null;
  quantity_remaining: number | null;
  status: 'available' | 'sold_out' | 'unknown';
  last_checked_at: string;
};

const SALE_SELECT =
  '*, state:states(id,code,name,license_url), species:species(id,key,name), zone:zones(id,name,type)';

/** The sales for everything you follow, soonest first, finished ones dropped. */
export function useFollowedSales() {
  const { data: follows = [] } = useFollows();
  return useQuery({
    queryKey: ['leftover_sales', 'followed', follows.map((f) => f.id).sort()],
    enabled: follows.length > 0,
    queryFn: async (): Promise<LeftoverSale[]> => {
      const { pairs, stateIds, speciesIds } = followPairs(follows);
      const { data, error } = await supabase
        .from('leftover_tag_sales')
        .select(SALE_SELECT)
        .in('state_id', stateIds)
        .in('species_id', speciesIds)
        .order('sale_start_date', { ascending: true });
      if (error) throw error;
      return upcomingSales(keepFollowed((data ?? []) as unknown as LeftoverSale[], pairs));
    },
  });
}

/** The sales in one state, for somebody browsing without an account. */
export function useBrowseSales(stateCode: string | null | undefined) {
  return useQuery({
    queryKey: ['leftover_sales', 'browse', stateCode],
    enabled: Boolean(stateCode),
    queryFn: async (): Promise<LeftoverSale[]> => {
      const { data: state, error: stateErr } = await supabase
        .from('states')
        .select('id')
        .eq('code', stateCode!)
        .maybeSingle();
      if (stateErr) throw stateErr;
      if (!state) return [];
      const { data, error } = await supabase
        .from('leftover_tag_sales')
        .select(SALE_SELECT)
        .eq('state_id', (state as { id: string }).id)
        .order('sale_start_date', { ascending: true });
      if (error) throw error;
      return upcomingSales((data ?? []) as unknown as LeftoverSale[]);
    },
  });
}

/**
 * What the Tags tab shows: your follows, or the state you are browsing.
 *
 * Mirrors useWindowsFeed deliberately. A second way of deciding "whose data is
 * this" would be a second way of getting it wrong.
 */
export function useSalesFeed(): {
  data: LeftoverSale[];
  isLoading: boolean;
  isError: boolean;
  browsing: boolean;
  stateCode: string | null;
} {
  const follows = useFollows();
  const { code, loading: codeLoading } = useBrowseStateCode();
  const browsing = !follows.isLoading && (follows.data ?? []).length === 0;

  const followed = useFollowedSales();
  const browsed = useBrowseSales(browsing ? code : null);
  const active = browsing ? browsed : followed;

  return {
    data: active.data ?? [],
    isLoading: follows.isLoading || (browsing && codeLoading) || active.isLoading,
    isError: active.isError,
    browsing,
    stateCode: code,
  };
}

export function useSaleById(id: string | undefined) {
  return useQuery({
    queryKey: ['leftover_sale', id],
    enabled: Boolean(id),
    queryFn: async (): Promise<LeftoverSale | null> => {
      const { data, error } = await supabase
        .from('leftover_tag_sales')
        .select(SALE_SELECT)
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as LeftoverSale | null;
    },
  });
}

/**
 * What is left, where we know. Most agencies publish a list of units with tags
 * and no counts at all, so a null quantity is normal and is NOT zero.
 */
export function useSaleAvailability(saleId: string | undefined) {
  return useQuery({
    queryKey: ['leftover_availability', saleId],
    enabled: Boolean(saleId),
    queryFn: async (): Promise<SaleAvailability[]> => {
      const { data, error } = await supabase
        .from('leftover_tag_availability')
        .select('*')
        .eq('sale_id', saleId!)
        .order('unit_code', { ascending: true, nullsFirst: true });
      if (error) throw error;
      return (data ?? []) as unknown as SaleAvailability[];
    },
  });
}
