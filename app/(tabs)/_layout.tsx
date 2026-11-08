import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View, type ColorValue } from 'react-native';
import { useAuth } from '@/providers/AuthProvider';
import { useBrowseStateCode } from '@/lib/browseState';
import { registerForPushNotifications } from '@/lib/push';
import { fontFamily, theme } from '@/theme';

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
        <ActivityIndicator color={theme.color.accent} size="large" />
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
  // The one thing a guest cannot do without is a state to browse, so a fresh
  // install goes to the picker -- one tap, no account -- and comes straight
  // back. Signed-in users are never sent there: they have follows, or the
  // tabs offer them the picker inline.
  if (!session && !browseCode) return <Redirect href="/pick-state" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.bar,
        tabBarActiveTintColor: theme.color.accent,
        tabBarInactiveTintColor: theme.color.textMuted,
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
  gate: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.background },
  bar: {
    backgroundColor: theme.color.surface,
    borderTopColor: theme.color.hairline,
    borderTopWidth: StyleSheet.hairlineWidth,
    height: 88,
    paddingBottom: 30,
  },
  label: { fontFamily: fontFamily.sansMedium, fontSize: 10, marginTop: 2 },
});
