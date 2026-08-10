import { useRouter } from 'expo-router';
import { usePremium } from '@/providers/PremiumProvider';

/**
 * Gate for save-actions (follow, party, tracker, points). Browsing is never
 * gated. Usage:
 *
 *   const requirePro = useRequirePro();
 *   function onAdd() {
 *     if (!requirePro()) return; // routed to the paywall
 *     ...do the thing
 *   }
 *
 * While the entitlement check is still settling we let the action through —
 * a paying user blocked by a race is worse than a free action slipping by.
 */
export function useRequirePro(): () => boolean {
  const router = useRouter();
  const { isPro, loading } = usePremium();
  return () => {
    if (isPro || loading) return true;
    router.push('/paywall');
    return false;
  };
}
