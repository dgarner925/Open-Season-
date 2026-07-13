import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';

export default function AuthLayout() {
  const { loading, session } = useAuth();
  // Already signed in? Let the index gate route them onward.
  if (!loading && session) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
