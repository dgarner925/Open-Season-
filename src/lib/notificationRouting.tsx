import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useAuth } from '@/providers/AuthProvider';

type AppRouter = ReturnType<typeof useRouter>;

/**
 * Where a tapped notification should land. The push payload carries
 * { subjectType, subjectId } (set in the send-alerts Edge Function):
 *   - season_opener        -> the season detail
 *   - application_deadline  -> the draw/window detail
 *   - application_results   -> the draw/window detail
 * so the user opens straight onto the exact hunt the alert was about.
 */
export type NotificationData = { subjectType?: string; subjectId?: string };

export function routeForNotification(router: AppRouter, data: NotificationData): boolean {
  if (!data?.subjectId) return false;
  if (data.subjectType === 'season_opener') {
    router.push({ pathname: '/season/[id]', params: { id: data.subjectId } });
    return true;
  }
  if (data.subjectType === 'application_deadline' || data.subjectType === 'application_results') {
    router.push({ pathname: '/window/[id]', params: { id: data.subjectId } });
    return true;
  }
  return false;
}

/**
 * Mount once inside the auth + router tree. Handles both a warm tap (app already
 * open) and a cold start (app launched by tapping a notification) via
 * useLastNotificationResponse, and only navigates once we have a signed-in user
 * so the deep link doesn't fight the auth gate. Returns null (no UI).
 */
/**
 * Stands down on web. expo-notifications has no getLastNotificationResponse
 * there and the hook throws rather than returning null, which took the whole
 * app down with it — nothing deep-links into a browser anyway, and this is
 * what lets Home be previewed in one while a layout is being designed.
 *
 * The platform check lives in a wrapper that calls no hooks of its own, so
 * the hook order inside the real router is never conditional.
 */
export function NotificationRouter() {
  if (Platform.OS === 'web') return null;
  return <NativeNotificationRouter />;
}

function NativeNotificationRouter() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const response = Notifications.useLastNotificationResponse();
  const handledId = useRef<string | null>(null);

  useEffect(() => {
    if (loading || !user || !response) return;
    const id = response.notification.request.identifier;
    if (handledId.current === id) return; // don't re-route the same tap
    handledId.current = id;
    routeForNotification(router, response.notification.request.content.data as NotificationData);
  }, [response, user, loading, router]);

  return null;
}
