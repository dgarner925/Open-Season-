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
// "On the Water" sets its headlines, section titles and plate names in IM Fell
// English. Loaded here with the rest because useFonts holds the splash until
// every face is ready -- a mode the user can reach from the first screen must
// not arrive with its type missing. Small caps is a sibling package; that face
// has no italic.
import {
  IMFellEnglish_400Regular,
  IMFellEnglish_400Regular_Italic,
} from '@expo-google-fonts/im-fell-english';
import { IMFellEnglishSC_400Regular } from '@expo-google-fonts/im-fell-english-sc';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useState } from 'react';
import { queryClient } from '@/lib/queryClient';
import { AuthProvider } from '@/providers/AuthProvider';
import { LaunchQuote } from '@/components/LaunchQuote';
import { PremiumProvider } from '@/providers/PremiumProvider';
import { ModeProvider, useMode } from '@/providers/ModeProvider';
import { HeaderBack } from '@/components/HeaderBack';
import { NotificationRouter } from '@/lib/notificationRouting';
import { theme } from '@/theme';

/**
 * The status bar follows the mode: light glyphs on the woods' near-black,
 * dark glyphs on the water's creek paper. Its own component because the hook
 * cannot be called in the component that provides the context.
 */
function ModeStatusBar() {
  const { mode } = useMode();
  return <StatusBar style={mode === 'otw' ? 'dark' : 'light'} />;
}

export default function RootLayout() {
  const [launchQuoteDone, setLaunchQuoteDone] = useState(false);
  const [fontsLoaded] = useFonts({
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
    Archivo_700Bold,
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    IMFellEnglish_400Regular,
    IMFellEnglish_400Regular_Italic,
    IMFellEnglishSC_400Regular,
  });

  // Hold the native splash (configured via expo-splash-screen) until the bespoke
  // fonts are ready, so the first paint is already in the Midnight type system.
  if (!fontsLoaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PremiumProvider>
        <ModeProvider>
        <SafeAreaProvider>
          <ModeStatusBar />
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
            <Stack.Screen name="pick-state" options={{ headerShown: false }} />
          </Stack>
          {!launchQuoteDone ? <LaunchQuote onDone={() => setLaunchQuoteDone(true)} /> : null}
        </SafeAreaProvider>
        </ModeProvider>
        </PremiumProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
