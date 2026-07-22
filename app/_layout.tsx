import { QueryClientProvider } from '@tanstack/react-query';
import {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
} from '@expo-google-fonts/archivo';
import {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from '@expo-google-fonts/instrument-serif';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryClient } from '@/lib/queryClient';
import { AuthProvider } from '@/providers/AuthProvider';
import { HeaderBack } from '@/components/HeaderBack';
import { NotificationRouter } from '@/lib/notificationRouting';
import { theme } from '@/theme';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
    Archivo_700Bold,
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
  });

  // Hold the native splash (configured via expo-splash-screen) until the bespoke
  // fonts are ready, so the first paint is already in the Midnight type system.
  if (!fontsLoaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <NotificationRouter />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: theme.color.background },
              headerTintColor: theme.color.textPrimary,
              headerTitleStyle: { color: theme.color.textPrimary },
              contentStyle: { backgroundColor: theme.color.background },
              headerShadowVisible: false,
              // Consistent "‹ Back" on every stacked (non-tab) screen.
              headerLeft: () => <HeaderBack />,
              headerBackVisible: false,
            }}
          >
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          </Stack>
        </SafeAreaProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
