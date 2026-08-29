import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Card, GlassChip } from '@/components/ui';
import { PageTitle } from '@/components/midnight';
import { useFollowedWindows } from '@/features/reference/queries';
import type { ApplicationWindowWithRefs } from '@/features/reference/types';
import { countdownLabel, daysUntil, formatDate } from '@/lib/date';
import { drawTitle } from '@/lib/titles';
import { spacing, speciesColors, theme, urgencyColor, type SpeciesKey } from '@/theme';

export default function Applications() {
  const router = useRouter();
  const { data: windows = [], isLoading } = useFollowedWindows();

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <ActivityIndicator color={theme.color.accent} />
      </SafeAreaView>
    );
  }

  // Upcoming (and undated) deadlines only — a passed deadline is just noise.
  const upcoming = windows.filter((w) => {
    const d = daysUntil(w.closes_at);
    return d === null || d >= 0;
  });

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <FlatList
        data={upcoming}
        keyExtractor={(w) => w.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <PageTitle lead="Tag " accent="deadlines" style={{ fontSize: 44, lineHeight: 50, paddingTop: 3 }} />
            <AppText variant="body" color={theme.color.textSecondary}>
              Draw and application windows. Miss a deadline, miss the season.
            </AppText>
          </View>
        }
        renderItem={({ item }) => <WindowRow window={item} onPress={() => router.push(`/window/${item.id}`)} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          <AppText color={theme.color.textMuted} style={{ marginTop: spacing.xl }}>
            No upcoming tag deadlines for your follows right now.
          </AppText>
        }
      />
    </SafeAreaView>
  );
}

function WindowRow({ window: w, onPress }: { window: ApplicationWindowWithRefs; onPress: () => void }) {
  const color = speciesColors[(w.species?.key ?? 'default') as SpeciesKey] ?? speciesColors.default;
  const d = daysUntil(w.closes_at);
  const urgency = urgencyColor(d);
  return (
    <Card onPress={onPress} accentColor={color}>
      <View style={styles.rowTop}>
        <AppText variant="h3" numberOfLines={1} style={{ flex: 1 }}>
          {w.state?.code} {drawTitle(w.species?.name, w.name)}
        </AppText>
        <GlassChip label="Deadline" />
      </View>
      <AppText variant="body" color={theme.color.textSecondary}>
        Closes {formatDate(w.closes_at)}
      </AppText>
      <View style={styles.rowBottom}>
        <AppText variant="bodyStrong" color={urgency}>
          {countdownLabel(d)}
        </AppText>
      </View>
      {w.fee_summary ? (
        <AppText variant="caption" color={theme.color.textMuted} numberOfLines={2} style={{ marginTop: spacing.xs }}>
          {w.fee_summary}
        </AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.background },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  header: { gap: spacing.xs, marginBottom: spacing.lg },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
});
