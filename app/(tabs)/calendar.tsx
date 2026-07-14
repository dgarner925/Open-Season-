import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Card, Pill } from '@/components/ui';
import { useFollowedSeasons } from '@/features/reference/queries';
import type { SeasonWithRefs } from '@/features/reference/types';
import { formatDateRange, isOpenNow, parseDateOnly, today } from '@/lib/date';
import { spacing, speciesColors, theme, type SpeciesKey } from '@/theme';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function Calendar() {
  const router = useRouter();
  const { data: seasons = [], isLoading } = useFollowedSeasons();

  // Group by open-month. Lead with current + upcoming (a full year forward),
  // then past seasons below an "Earlier" divider.
  const sections = useMemo(() => {
    const now = today().getTime();
    const buckets = new Map<string, { title: string; month: number; past: boolean; data: SeasonWithRefs[] }>();
    for (const s of seasons) {
      if (!s.open_date) continue;
      const d = parseDateOnly(s.open_date);
      const endsAt = parseDateOnly(s.close_date ?? s.open_date).getTime();
      const past = endsAt < now; // the season has fully ended
      const key = `${past ? 'p' : 'u'}-${d.getFullYear()}-${d.getMonth()}`;
      if (!buckets.has(key)) {
        buckets.set(key, {
          title: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
          month: d.getFullYear() * 12 + d.getMonth(),
          past,
          data: [],
        });
      }
      buckets.get(key)!.data.push(s);
    }
    const all = [...buckets.values()];
    const upcoming = all.filter((b) => !b.past).sort((a, b) => a.month - b.month);
    const pastSecs = all.filter((b) => b.past).sort((a, b) => b.month - a.month); // most recent first
    // Mark the first past section so we can draw an "Earlier" divider above it.
    return [...upcoming, ...pastSecs].map((s, i) => ({ ...s, firstPast: s.past && i === upcoming.length }));
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
          <View>
            {section.firstPast ? (
              <View style={styles.pastDivider}>
                <AppText variant="overline" color={theme.color.textMuted}>
                  EARLIER SEASONS
                </AppText>
              </View>
            ) : null}
            <AppText variant="overline" color={theme.color.textMuted} style={styles.sectionHeader}>
              {section.title.toUpperCase()}
            </AppText>
          </View>
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
  pastDivider: {
    marginTop: spacing.xxl,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.color.border,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
});
