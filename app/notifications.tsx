import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { AppText, Card, Screen } from '@/components/ui';
import { useNotificationHistory, sentAgo, type NotifItem, type NotifKind } from '@/features/notifications/queries';
import { routeForNotification } from '@/lib/notificationRouting';
import { radius, spacing, theme } from '@/theme';

const KIND_ICON: Record<NotifKind, keyof typeof Ionicons.glyphMap> = {
  opener: 'calendar-outline',
  deadline: 'alarm-outline',
  results: 'trophy-outline',
};

export default function Notifications() {
  const router = useRouter();
  const { data: items = [], isLoading } = useNotificationHistory();

  return (
    <Screen scroll contentStyle={{ paddingBottom: spacing.xxl }}>
      <Stack.Screen options={{ headerShown: true, title: 'Notifications' }} />
      <View style={{ gap: spacing.xs }}>
        <AppText variant="h1">Notifications</AppText>
        <AppText variant="body" color={theme.color.textSecondary}>
          Every opener, tag deadline, and draw-results alert we've sent you. Tap one to open the hunt it's
          about.
        </AppText>
      </View>

      {isLoading ? (
        <ActivityIndicator color={theme.color.accent} style={{ marginTop: spacing.xl }} />
      ) : items.length === 0 ? (
        <Card style={{ marginTop: spacing.lg }}>
          <AppText variant="h3">No notifications yet</AppText>
          <AppText variant="body" color={theme.color.textSecondary}>
            When one of your seasons opens or a tag deadline gets close, the reminder will show up here.
            Set how far ahead you're notified in Alerts.
          </AppText>
        </Card>
      ) : (
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          {items.map((n) => (
            <NotificationRow key={n.id} item={n} onPress={() => routeForNotification(router, n)} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function NotificationRow({ item, onPress }: { item: NotifItem; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
      <Card variant="flat" style={styles.row}>
        <View style={styles.iconWrap}>
          <Ionicons name={KIND_ICON[item.kind]} size={18} color={theme.color.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {item.title}
          </AppText>
          <AppText variant="caption" color={theme.color.textMuted} numberOfLines={1}>
            {item.subtitle}
          </AppText>
        </View>
        <AppText variant="caption" color={theme.color.textMuted}>
          {sentAgo(item.sentAt)}
        </AppText>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: theme.color.accentFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
