import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Card, Pill } from '@/components/ui';
import { useFollowedSeasons } from '@/features/reference/queries';
import type { SeasonWithRefs } from '@/features/reference/types';
import { formatDateRange, isOpenNow, parseDateOnly } from '@/lib/date';
import { spacing, speciesColors, theme, type SpeciesKey } from '@/theme';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function Calendar() {
  const router = useRouter();
  const { data: seasons = [], isLoading } = useFollowedSeasons();

  // Group published seasons by open-month for a scannable list.
  const sections = useMemo(() => {
    const buckets = new Map<string, { title: string; sortKey: number; data: SeasonWithRefs[] }>();
    for (const s of seasons) {
      if (!s.open_date) continue;
      const d = parseDateOnly(s.open_date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!buckets.has(key)) {
        buckets.set(key, {
          title: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
          sortKey: d.getFullYear() * 12 + d.getMonth(),
          data: [],
        });
      }
      buckets.get(key)!.data.push(s);
    }
    return [...buckets.values()].sort((a, b) => a.sortKey - b.sortKey);
  }, [seasons]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <ActivityIndicator color={theme.color.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <AppText variant="overline" color={theme.color.textMuted} style={styles.sectionHeader}>
            {section.title.toUpperCase()}
          </AppText>
        )}
        renderItem={({ item }) => <SeasonRow season={item} onPress={() => router.push(`/season/${item.id}`)} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          <AppText color={theme.color.textMuted} style={{ marginTop: spacing.xxl }}>
            No published seasons for your follows yet.
          </AppText>
        }
      />
    </SafeAreaView>
  );
}

function SeasonRow({ season, onPress }: { season: SeasonWithRefs; onPress: () => void }) {
  const color = speciesColors[(season.species?.key ?? 'default') as SpeciesKey] ?? speciesColors.default;
  const open = isOpenNow(season.open_date, season.close_date);
  return (
    <Card onPress={onPress} accentColor={color}>
      <View style={styles.rowTop}>
        <AppText variant="h3" numberOfLines={1} style={{ flex: 1 }}>
          {season.state?.code} {season.species?.name}
        </AppText>
        {open && <Pill label="Open now" color={theme.color.success} />}
      </View>
      <AppText variant="body" color={theme.color.textSecondary}>
        {formatDateRange(season.open_date, season.close_date)}
      </AppText>
      <View style={styles.tags}>
        <Pill label={season.method} color={theme.color.surfaceElevated} textColor={theme.color.textSecondary} />
        {season.zone?.name ? (
          <Pill label={season.zone.name} color={theme.color.surfaceElevated} textColor={theme.color.textSecondary} />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.background },
  content: { padding: spacing.lg },
  sectionHeader: { marginTop: spacing.lg, marginBottom: spacing.sm },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
});
