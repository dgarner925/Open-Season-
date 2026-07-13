import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '@/providers/AuthProvider';
import { theme } from '@/theme';

/**
 * Entry gate. Sends the user to the right place based on auth + onboarding:
 *   no session        -> /(auth)/sign-in
 *   session, no follows-> /onboarding
 *   fully set up       -> /(tabs) home
 */
export default function Index() {
  const { loading, session, isOnboarded } = useAuth();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.color.accent} size="large" />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (!isOnboarded) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.background },
});
