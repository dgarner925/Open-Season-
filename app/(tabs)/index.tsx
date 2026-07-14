import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CountdownCard } from '@/components/CountdownCard';
import { AppText } from '@/components/ui';
import { FollowSelector } from '@/features/follows/FollowSelector';
import { useUpcomingCountdown } from '@/features/reference/queries';
import { queryClient } from '@/lib/queryClient';
import { spacing, theme } from '@/theme';

/**
 * Home hub — the app's landing. Pick your states + species up top, see your
 * soonest openers and tag deadlines below. This is where you come back to
 * change what you follow.
 */
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
            <AppText variant="display" color={theme.color.accent}>
              OpenSeason
            </AppText>
            <AppText variant="body" color={theme.color.textSecondary}>
              Pick your states and species — your openers and tag deadlines follow below.
            </AppText>

            <AppText variant="overline" color={theme.color.textMuted} style={styles.sectionLabel}>
              YOUR STATES & SPECIES
            </AppText>
            <FollowSelector />

            <AppText variant="overline" color={theme.color.textMuted} style={styles.sectionLabel}>
              COMING UP
            </AppText>
            {!isLoading && items.length === 0 ? (
              <AppText variant="body" color={theme.color.textSecondary} style={{ marginBottom: spacing.md }}>
                Nothing upcoming for your picks yet. Colorado and Montana have live 2026 dates if you want to see
                countdowns right away.
              </AppText>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <CountdownCard
            item={item}
            onPress={() => router.push(item.kind === 'deadline' ? `/window/${item.id}` : `/season/${item.id}`)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.background },
  content: { padding: spacing.xl },
  header: { gap: spacing.sm },
  sectionLabel: { marginTop: spacing.xl, marginBottom: spacing.md },
});
