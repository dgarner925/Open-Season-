import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View, type ColorValue } from 'react-native';
import { useAuth } from '@/providers/AuthProvider';
import { useBrowseStateCode } from '@/lib/browseState';
import { registerForPushNotifications } from '@/lib/push';
import { lang } from '@/theme/tokens';

function icon(base: keyof typeof Ionicons.glyphMap) {
  return ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Ionicons name={focused ? base : (`${base}-outline` as keyof typeof Ionicons.glyphMap)} color={color} size={23} />
  );
}

export default function TabsLayout() {
  const { loading, session } = useAuth();
  const { code: browseCode, loading: browseLoading } = useBrowseStateCode();

  const userId = session?.user.id;
  useEffect(() => {
    // Guests have no id to register, so this no-ops for them.
    if (userId) registerForPushNotifications(userId);
  }, [userId]);

  if (loading || browseLoading) {
    return (
      <View style={styles.gate}>
        <ActivityIndicator color={lang.color.copper} size="large" />
      </View>
    );
  }

  // The tabs used to redirect to sign-in with no session, and to onboarding
  // with no `onboarded_at`. Both are gone: RLS already lets `anon` read every
  // published season, window and regulation summary, so the gate was purely
  // client-side and cost us every install that wasn't ready to make an account
  // first. Onboarding is now entered on purpose (Profile -> Set up your hunts),
  // not by redirect.
  //
  // A fresh install now opens on sign-in (David, 2026-11-08) rather than the
  // state picker. The door stays unlocked: "Look around first" on that screen
  // goes to the picker, and from there everything reads without an account.
  // It must not point back at the tabs, or this redirect bounces it straight
  // back to sign-in.
  if (!session && !browseCode) return <Redirect href="/(auth)/sign-in" />;

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
