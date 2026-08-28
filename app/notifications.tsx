import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { Alert, ActivityIndicator, Pressable, View } from 'react-native';
import { Row, Rule, Screen, Sentence, Serif } from '@/components/system';
import {
  useNotificationHistory,
  useHideNotification,
  useClearNotifications,
  sentAgo,
  type NotifItem,
  type NotifKind,
} from '@/features/notifications/queries';
import { routeForNotification } from '@/lib/notificationRouting';
import { lang } from '@/theme/tokens';

const { color, space } = lang;

const KIND_ICON: Record<NotifKind, keyof typeof Ionicons.glyphMap> = {
  opener: 'calendar-outline',
  deadline: 'alarm-outline',
  results: 'trophy-outline',
  change: 'swap-horizontal',
};

export default function Notifications() {
  const router = useRouter();
  const { data: items = [], isLoading } = useNotificationHistory();
  const hide = useHideNotification();
  const clearAll = useClearNotifications();

  function onRemove(item: NotifItem) {
    Alert.alert('Remove this notification?', item.title, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => hide.mutate(item.id) },
    ]);
  }

  function onClearAll() {
    Alert.alert('Clear all notifications?', 'This removes every entry from your history.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear all', style: 'destructive', onPress: () => clearAll.mutate() },
    ]);
  }

  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: true, title: 'Notifications' }} />
      <Sentence style={{ marginTop: space.x16 }}>
        Every opener, tag deadline, and draw-results alert we've sent you. Tap one to open the hunt it's
        about — press and hold to remove it.
      </Sentence>

      {isLoading ? (
        <ActivityIndicator color={color.copper} style={{ marginTop: space.x32 }} />
      ) : items.length === 0 ? (
        <Sentence style={{ marginTop: space.section }}>
          Nothing yet. When one of your seasons opens or a tag deadline gets close, the reminder shows up
          here — set how far ahead in Profile → Reminders.
        </Sentence>
      ) : (
        <>
          <Rule />
          {items.map((n, i) => (
            <Pressable key={n.id} onLongPress={() => onRemove(n)}>
              <Row
                title={n.title}
                subtitle={n.subtitle}
                onPress={() => routeForNotification(router, n)}
                right={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.x8 }}>
                    <Ionicons name={KIND_ICON[n.kind]} size={14} color={color.dim} />
                    <Serif italic size={16} style={{ color: color.muted }}>
                      {sentAgo(n.sentAt)}
                    </Serif>
                  </View>
                }
                last={i === items.length - 1}
              />
            </Pressable>
          ))}
          <Rule />
          <Pressable onPress={onClearAll} accessibilityRole="button">
            <Sentence tone="dim">Clear this history — every entry, for good.</Sentence>
          </Pressable>
        </>
      )}
    </Screen>
  );
}
