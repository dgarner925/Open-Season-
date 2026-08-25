import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
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

  // Species filter — chips over the list. null = all.
  const [speciesFilter, setSpeciesFilter] = useState<string | null>(null);

  const { open, upcomingMonths, chipSpecies } = useMemo(() => {
    const openList: Item[] = [];
    const upcomingList: Item[] = [];
    const byId = new Map<string, string>(); // species id -> name (only current/upcoming)
    for (const s of seasons) {
      if (!s.open_date) continue;
      if (s.close_date && s.close_date < iso) continue; // fully past
      if (s.species?.id) byId.set(s.species.id, s.species.name);
      if (speciesFilter && s.species?.id !== speciesFilter) continue;
      if (s.open_date <= iso && (!s.close_date || iso <= s.close_date)) {
        openList.push({ season: s, status: 'open', days: daysUntil(s.close_date) });
      } else if (s.open_date > iso) {
        upcomingList.push({ season: s, status: 'upcoming', days: daysUntil(s.open_date) });
      }
    }
    openList.sort((a, b) => (a.days ?? 0) - (b.days ?? 0));
    upcomingList.sort((a, b) => (a.days ?? 0) - (b.days ?? 0));
    const chips = [...byId.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));

    // Group upcoming by opening month, so the list reads like a season
    // calendar ("August is gator, September is the pile-up").
    const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
    const thisYear = iso.slice(0, 4);
    const months: { key: string; label: string; items: Item[] }[] = [];
    for (const it of upcomingList) {
      const [y, m] = it.season.open_date!.split('-');
      const key = `${y}-${m}`;
      let bucket = months[months.length - 1];
      if (!bucket || bucket.key !== key) {
        bucket = { key, label: `${MONTHS[Number(m) - 1]}${y !== thisYear ? ` ${y}` : ''}`, items: [] };
        months.push(bucket);
      }
      bucket.items.push(it);
    }
    return { open: openList, upcomingMonths: months, chipSpecies: chips };
  }, [seasons, iso, speciesFilter]);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <AppText variant="overline" color={theme.color.textMuted}>
              SEASON DATES
            </AppText>
            <Pressable
              onPress={() => router.push('/search')}
              hitSlop={10}
              style={({ pressed }) => [styles.searchBtn, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="search" size={17} color={theme.color.textPrimary} />
            </Pressable>
          </View>
          <PageTitle lead="Your " accent="seasons." style={{ fontSize: 44, lineHeight: 50, marginTop: spacing.xs, paddingTop: 3 }} />
          <AppText variant="body" color={theme.color.textSecondary} style={{ marginTop: spacing.sm }}>
            When each species opens and closes, for everything you track.
          </AppText>
        </View>

        {chipSpecies.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
            <FilterChip label="All" active={speciesFilter === null} onPress={() => setSpeciesFilter(null)} />
            {chipSpecies.map((sp) => (
              <FilterChip key={sp.id} label={sp.name} active={speciesFilter === sp.id} onPress={() => setSpeciesFilter(speciesFilter === sp.id ? null : sp.id)} />
            ))}
          </ScrollView>
        ) : null}

        {isLoading ? (
          <ActivityIndicator color={theme.color.accent} style={{ marginTop: spacing.xl }} />
        ) : open.length === 0 && upcomingMonths.length === 0 ? (
          <AppText variant="body" color={theme.color.textMuted} style={{ marginTop: spacing.xl }}>
            {speciesFilter ? 'No current or upcoming dates for this species.' : 'No upcoming seasons for your follows yet — add species from Home.'}
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
            {upcomingMonths.map((m) => (
              <Section key={m.key} label={m.label}>
                {m.items.map((it) => (
                  <SeasonRow key={it.season.id} item={it} onPress={() => router.push(`/season/${it.season.id}`)} />
                ))}
              </Section>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        active
          ? { backgroundColor: theme.color.accent, borderColor: theme.color.accent }
          : { backgroundColor: theme.color.surfaceFlat, borderColor: theme.color.borderFlat },
      ]}
    >
      <Text style={[styles.chipLabel, { color: active ? theme.color.onAccent : theme.color.textSecondary }]}>{label}</Text>
    </Pressable>
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
          {s.label ? ` · ${s.label}` : s.method ? ` · ${cap(s.method)}` : ''}
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
  searchBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: theme.color.surfaceFlat, alignItems: 'center', justifyContent: 'center' },
  screen: { flex: 1, backgroundColor: theme.color.background },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  header: {},
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  right: { alignItems: 'flex-end', gap: 4 },
  metric: { fontFamily: fontFamily.serifItalic, fontSize: 18 },

  chipScroll: { marginTop: spacing.lg, marginHorizontal: -spacing.xl },
  chipRow: { paddingHorizontal: spacing.xl, gap: spacing.sm, flexDirection: 'row' },
  chip: { paddingHorizontal: spacing.lg, paddingVertical: 8, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  chipLabel: { fontFamily: fontFamily.sansSemiBold, fontSize: 13 },
});
