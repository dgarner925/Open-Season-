import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Card } from '@/components/ui';
import { PageTitle, SpeciesBadge, StatusPill } from '@/components/midnight';
import { useFollowedSeasons } from '@/features/reference/queries';
import type { SeasonWithRefs } from '@/features/reference/types';
import { daysUntil, formatDate } from '@/lib/date';
import { fontFamily, spacing, theme } from '@/theme';

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function cap(s: string | null | undefined): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

type Item = {
  season: SeasonWithRefs;
  status: 'open' | 'upcoming';
  days: number | null; // days left (open) or days until open (upcoming)
};

/** Seasons — a clear, dated list of what's open now and what's opening next. */
export default function Seasons() {
  const router = useRouter();
  const { data: seasons = [], isLoading } = useFollowedSeasons();
  const iso = todayISO();

  const { open, upcoming } = useMemo(() => {
    const openList: Item[] = [];
    const upcomingList: Item[] = [];
    for (const s of seasons) {
      if (!s.open_date) continue;
      if (s.close_date && s.close_date < iso) continue; // fully past
      if (s.open_date <= iso && (!s.close_date || iso <= s.close_date)) {
        openList.push({ season: s, status: 'open', days: daysUntil(s.close_date) });
      } else if (s.open_date > iso) {
        upcomingList.push({ season: s, status: 'upcoming', days: daysUntil(s.open_date) });
      }
    }
    openList.sort((a, b) => (a.days ?? 0) - (b.days ?? 0));
    upcomingList.sort((a, b) => (a.days ?? 0) - (b.days ?? 0));
    return { open: openList, upcoming: upcomingList };
  }, [seasons, iso]);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <AppText variant="overline" color={theme.color.textMuted}>
            SEASON DATES
          </AppText>
          <PageTitle lead="Your " accent="seasons." style={{ fontSize: 44, lineHeight: 50, marginTop: spacing.xs, paddingTop: 3 }} />
          <AppText variant="body" color={theme.color.textSecondary} style={{ marginTop: spacing.sm }}>
            When each species opens and closes, for everything you track.
          </AppText>
        </View>

        {isLoading ? (
          <ActivityIndicator color={theme.color.accent} style={{ marginTop: spacing.xl }} />
        ) : open.length === 0 && upcoming.length === 0 ? (
          <AppText variant="body" color={theme.color.textMuted} style={{ marginTop: spacing.xl }}>
            No upcoming seasons for your follows yet — add species from Home.
          </AppText>
        ) : (
          <>
            {open.length > 0 ? (
              <Section label="OPEN NOW">
                {open.map((it) => (
                  <SeasonRow key={it.season.id} item={it} onPress={() => router.push(`/season/${it.season.id}`)} />
                ))}
              </Section>
            ) : null}
            {upcoming.length > 0 ? (
              <Section label="UPCOMING">
                {upcoming.map((it) => (
                  <SeasonRow key={it.season.id} item={it} onPress={() => router.push(`/season/${it.season.id}`)} />
                ))}
              </Section>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
      <AppText variant="overline" color={theme.color.textMuted}>
        {label}
      </AppText>
      {children}
    </View>
  );
}

function SeasonRow({ item, onPress }: { item: Item; onPress: () => void }) {
  const s = item.season;
  const openNow = item.status === 'open';
  const days = Math.max(item.days ?? 0, 0);
  return (
    <Card onPress={onPress} variant={openNow ? 'gradient' : 'flat'} style={styles.row}>
      <SpeciesBadge name={s.species?.name} size={40} muted={!openNow} />
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {s.species?.name}
          {s.method ? ` · ${cap(s.method)}` : ''}
        </AppText>
        <AppText variant="caption" color={theme.color.textMuted} numberOfLines={1}>
          {s.state?.code ? `${s.state.code} · ` : ''}
          {formatDate(s.open_date)}
          {s.close_date ? ` – ${formatDate(s.close_date)}` : ''}
        </AppText>
      </View>
      <View style={styles.right}>
        {openNow ? <StatusPill status="open" /> : null}
        <Text style={[styles.metric, { color: openNow ? theme.color.textMuted : theme.color.accent }]}>
          {openNow ? `ends ${days}d` : `in ${days}d`}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.background },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  header: {},
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  right: { alignItems: 'flex-end', gap: 4 },
  metric: { fontFamily: fontFamily.serifItalic, fontSize: 18 },
});
