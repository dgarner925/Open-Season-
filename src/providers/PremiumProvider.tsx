import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, type CustomerInfo } from 'react-native-purchases';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

/**
 * Pro entitlement. Three ways to be Pro, checked in order of cheapness:
 *
 * 1. `profiles.is_premium` — server truth. Set TRUE for every account that
 *    existed before the freemium switch (they bought the app at $4.99), and
 *    kept current for subscribers by the RevenueCat webhook.
 * 2. RevenueCat `pro` entitlement — an active subscription on this Apple ID.
 * 3. Receipt grandfathering — the App Store receipt's original download was
 *    from the paid era (build <= LAST_PAID_BUILD). Covers a paid-era buyer
 *    who signs up with a fresh account after the switch, or reinstalls.
 *
 * Fail-open: if RevenueCat is unreachable or unconfigured, nobody gets locked
 * out — a paying user seeing a paywall is far worse than a rare free ride.
 */

// Last iOS buildNumber sold at $4.99 up-front. Bump if more paid builds ship
// before the price flips to free.
const LAST_PAID_BUILD = 22;
const ENTITLEMENT_ID = 'pro';
const API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;

type PremiumState = {
  isPro: boolean;
  /** True until the first entitlement check settles. */
  loading: boolean;
  /** Re-check after a purchase/restore completes. */
  refresh: () => Promise<void>;
};

const PremiumContext = createContext<PremiumState>({ isPro: true, loading: false, refresh: async () => {} });
export const usePremium = () => useContext(PremiumContext);

function receiptIsGrandfathered(info: CustomerInfo): boolean {
  // On iOS this is the CFBundleVersion (our buildNumber) at first download.
  const original = Number(info.originalApplicationVersion ?? NaN);
  return Number.isFinite(original) && original <= LAST_PAID_BUILD;
}

function entitlementActive(info: CustomerInfo): boolean {
  return Boolean(info.entitlements.active[ENTITLEMENT_ID]);
}

export function PremiumProvider({ children }: { children: ReactNode }) {
  const { user, profile, refreshProfile } = useAuth();
  const [rcPro, setRcPro] = useState<boolean | null>(null); // null = not settled

  const serverPro = Boolean(profile?.is_premium);

  useEffect(() => {
    if (!API_KEY || Platform.OS !== 'ios') {
      // Unconfigured (dev) — fail open.
      setRcPro(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        Purchases.setLogLevel(LOG_LEVEL.ERROR);
        Purchases.configure({ apiKey: API_KEY, appUserID: user?.id });
        const info = await Purchases.getCustomerInfo();
        if (cancelled) return;
        const pro = entitlementActive(info) || receiptIsGrandfathered(info);
        setRcPro(pro);
        // Push receipt-grandfathered status to the server so push alerts flow
        // even before the webhook knows this user.
        if (pro && user && !serverPro) {
          await supabase.from('profiles').update({ is_premium: true }).eq('id', user.id);
          await refreshProfile();
        }
      } catch (e) {
        console.warn('[premium] entitlement check failed, failing open:', e);
        if (!cancelled) setRcPro(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const refresh = async () => {
    if (!API_KEY || Platform.OS !== 'ios') return;
    try {
      const info = await Purchases.getCustomerInfo();
      const pro = entitlementActive(info) || receiptIsGrandfathered(info);
      setRcPro(pro);
      if (pro && user) {
        await supabase.from('profiles').update({ is_premium: true }).eq('id', user.id);
        await refreshProfile();
      }
    } catch {
      // keep previous state
    }
  };

  const value = useMemo<PremiumState>(
    () => ({
      isPro: serverPro || rcPro === true,
      loading: rcPro === null && !serverPro,
      refresh,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [serverPro, rcPro, user?.id],
  );

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}
