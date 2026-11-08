import { Redirect, Stack } from 'expo-router';
import { useRef } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { takePendingRoute } from '@/lib/pendingRoute';

export default function AuthLayout() {
  const { loading, session } = useAuth();
  // Resolved once, the moment the session appears, and held: a guest who
  // tapped Follow on a season page comes back to that page instead of a blank
  // Home. Nothing pending means the index gate routes them as before.
  const target = useRef<string | null>(null);
  if (!loading && session && target.current === null) {
    target.current = takePendingRoute() ?? '/';
  }
  if (!loading && session) return <Redirect href={target.current as never} />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
