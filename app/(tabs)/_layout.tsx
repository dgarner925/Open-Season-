import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/providers/AuthProvider';
import { registerForPushNotifications } from '@/lib/push';
import { theme } from '@/theme';

export default function TabsLayout() {
  const { loading, session, isOnboarded, isAdmin } = useAuth();

  // Register this device for push notifications once signed in (no-op on web).
  const userId = session?.user.id;
  useEffect(() => {
    if (userId) registerForPushNotifications(userId);
  }, [userId]);

  // This layout owns "/" — it's the app's entry gate.
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.background }}>
        <ActivityIndicator color={theme.color.accent} size="large" />
      </View>
    );
  }
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (!isOnboarded) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.color.background },
        headerTitleStyle: { color: theme.color.textPrimary, fontFamily: 'Georgia' },
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: theme.color.surface,
          borderTopColor: theme.color.border,
        },
        tabBarActiveTintColor: theme.color.accent,
        tabBarInactiveTintColor: theme.color.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Next Up',
          tabBarIcon: ({ color, size }) => <Ionicons name="flame-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Seasons',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="applications"
        options={{
          title: 'Tags',
          tabBarIcon: ({ color, size }) => <Ionicons name="ticket-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="regs"
        options={{
          title: 'Regs',
          tabBarIcon: ({ color, size }) => <Ionicons name="document-text-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          href: isAdmin ? '/(tabs)/admin' : null, // hide the tab for non-admins
          tabBarIcon: ({ color, size }) => <Ionicons name="shield-checkmark-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
