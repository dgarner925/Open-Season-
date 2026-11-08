import { usePathname, useRouter } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { setPendingRoute } from '@/lib/pendingRoute';

/**
 * Gate for actions that need a row on the server with your name on it --
 * following, arming a reminder, joining a party, logging an application,
 * saving points. Browsing is never gated; this is only about writes.
 *
 * Order matters at every call site: account first, then Pro.
 *
 *   const requireAccount = useRequireAccount();
 *   const requirePro = useRequirePro();
 *   function onArm() {
 *     if (!requireAccount()) return; // routed to sign-in
 *     if (!requirePro()) return;     // routed to the paywall
 *     ...do the thing
 *   }
 *
 * A guest who taps Follow should be asked to sign in, not sold a subscription.
 * Getting that order backwards shows the paywall to someone who doesn't yet
 * have an account to attach it to, which is the worst version of both screens.
 *
 * The route they were on is handed to `pendingRoute`, so signing in returns
 * them where they were instead of dropping them on a blank Home.
 */
export function useRequireAccount(): () => boolean {
  const router = useRouter();
  const pathname = usePathname();
  const { session, loading } = useAuth();

  return () => {
    // Mid-restore, let it through: the write itself still checks for a user,
    // and blocking a signed-in person because their session hadn't settled is
    // the same mistake useRequirePro deliberately avoids.
    if (session || loading) return true;
    setPendingRoute(pathname);
    router.push('/(auth)/sign-in');
    return false;
  };
}
