import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View, type ColorValue } from 'react-native';
import { useAuth } from '@/providers/AuthProvider';
import { useAppGate } from '@/hooks/useAppGate';
import { useMode } from '@/providers/ModeProvider';
import { pushPermissionState, syncPushToken } from '@/lib/push';
import { useFollows } from '@/features/follows/queries';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lang } from '@/theme/tokens';

function icon(base: keyof typeof Ionicons.glyphMap) {
  return ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Ionicons name={focused ? base : (`${base}-outline` as keyof typeof Ionicons.glyphMap)} color={color} size={23} />
  );
}

export default function TabsLayout() {
  const { session } = useAuth();
  const gate = useAppGate();
  const { mode, ready } = useMode();

  const router = useRouter();
  const { data: follows = [] } = useFollows();

  const userId = session?.user.id;
  useEffect(() => {
    // Registers an already-granted device and NEVER prompts. This used to fire
    // the OS permission dialog here, in the first seconds of a first session,
    // before the app had shown anyone a single date -- and on iOS that dialog
    // comes once in an app's life. Half our users spent theirs on "no".
    if (userId) syncPushToken(userId);
  }, [userId]);

  // The ask moved to where it can be earned: once somebody has told us what
  // they hunt, "we will tell you seven days before your tags go on sale" is a
  // sentence about them. Shown once, and never to someone who has decided.
  useEffect(() => {
    if (!userId || follows.length === 0) return;
    let active = true;
    (async () => {
      const key = `push-explainer-shown:${userId}`;
      try {
        if (await AsyncStorage.getItem(key)) return;
        const state = await pushPermissionState();
        if (state !== 'undetermined' || !active) return;
        await AsyncStorage.setItem(key, new Date().toISOString());
        router.push('/notifications-why');
      } catch {
        /* a storage failure must never cost somebody their reminders, and it
           must never turn into a dialog on every launch either -- so do
           nothing, and let the Profile and alerts entry points carry it. */
      }
    })();
    return () => {
      active = false;
    };
  }, [userId, follows.length, router]);

  // The decision lives in useAppGate so (otw) cannot answer it differently.
  // What is rendered while it waits stays here: the spinner is copper in the
  // woods, and river on the water.
  if (gate.status === 'loading' || !ready) {
    return (
      <View style={styles.gate}>
        <ActivityIndicator color={lang.color.copper} size="large" />
      </View>
    );
  }

  if (gate.status === 'redirect') return <Redirect href={gate.href} />;

  // The persisted mode decides which group you land in on launch. Inert for
  // every hunting user -- 'hunt' is the default and the only value until the
  // toggle ships -- and the mirror of this lives in (otw)/_layout.tsx. The
  // two conditions are exact opposites, so they cannot ping-pong.
  //
  // Deep links and push notifications are unaffected: routeForNotification
  // pushes /season/[id], /window/[id] and /leftover/[id], which are root
  // stack routes outside both groups, so they land in hunting screens from
  // either mode.
  if (mode === 'otw') return <Redirect href="/(otw)" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.bar,
        tabBarActiveTintColor: lang.color.copper,
        tabBarInactiveTintColor: lang.color.dim,
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: { paddingTop: 6 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="calendar" options={{ title: 'Seasons', tabBarIcon: icon('calendar') }} />
      <Tabs.Screen name="applications" options={{ title: 'Tags', tabBarIcon: icon('pricetag') }} />
      <Tabs.Screen name="regs" options={{ title: 'Regs', tabBarIcon: icon('document-text') }} />
      <Tabs.Screen name="settings" options={{ title: 'Profile', tabBarIcon: icon('person') }} />
      {/* Admin — hidden from the bar, reached from Settings */}
      <Tabs.Screen name="admin" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  gate: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: lang.color.bg },
  // The bar sits on the page's own background with a single hairline above it
  // — no raised surface. The language does not use cards for chrome.
  bar: {
    backgroundColor: lang.color.bg,
    borderTopColor: lang.color.hair,
    borderTopWidth: StyleSheet.hairlineWidth,
    height: 88,
    paddingBottom: 30,
  },
  label: {
    fontFamily: lang.type.uiSemiBold,
    fontSize: 9.5,
    letterSpacing: 0.8,
    marginTop: 2,
  },
});
