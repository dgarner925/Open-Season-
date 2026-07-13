import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useState } from 'react';
import { CountdownCard } from '@/components/CountdownCard';
import { AppText, Button } from '@/components/ui';
import { Disclaimer } from '@/components/Provenance';
import { useUpcomingCountdown } from '@/features/reference/queries';
import { queryClient } from '@/lib/queryClient';
import { spacing, theme } from '@/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Home() {
  const router = useRouter();
  const { isLoading, items } = useUpcomingCountdown();
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <FlatList
        data={items}
        keyExtractor={(i) => `${i.kind}:${i.id}`}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.accent} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <AppText variant="h1">Next Up</AppText>
            <AppText variant="body" color={theme.color.textSecondary}>
              Your soonest openers and tag deadlines.
            </AppText>
          </View>
        }
        renderItem={({ item }) => (
          <CountdownCard
            item={item}
            onPress={() =>
              router.push(item.kind === 'deadline' ? `/window/${item.id}` : `/season/${item.id}`)
            }
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator color={theme.color.accent} style={{ marginTop: spacing.xxl }} />
          ) : (
            <View style={styles.empty}>
              <AppText variant="h3">Nothing on the horizon yet</AppText>
              <AppText variant="body" color={theme.color.textSecondary}>
                Once seasons and tag windows are published for what you follow, your countdowns show up here.
              </AppText>
              <Button variant="secondary" title="Edit what you follow" onPress={() => router.push('/onboarding')} />
            </View>
          )
        }
        ListFooterComponent={items.length > 0 ? <View style={{ marginTop: spacing.lg }}><Disclaimer /></View> : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.background },
  content: { padding: spacing.lg },
  header: { gap: spacing.xs, marginBottom: spacing.lg },
  empty: { gap: spacing.md, marginTop: spacing.xxl, alignItems: 'flex-start' },
});
