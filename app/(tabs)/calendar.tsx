import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Headline, Micro, Sentence, Tile } from '@/components/system';
import { SpeciesBadge } from '@/components/midnight';
import { useSeasonsFeed } from '@/features/reference/queries';
import { BrowseStateChip, BrowseStatePrompt } from '@/components/BrowseStateChip';
import type { SeasonWithRefs } from '@/features/reference/types';
import { daysUntil, formatDate } from '@/lib/date';
import { lang } from '@/theme/tokens';

const { color, space, type } = lang;

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
  const { data: seasons, isLoading, browsing, stateCode, needsState } = useSeasonsFeed();
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
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
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
        {/* One tight sans headline saying what the screen is for, and a
            sentence saying whose dates these are. The serif masthead and the
            SEASON DATES overline above it were two titles doing one job. */}
        <View style={styles.header}>
          <View style={styles.headRow}>
            <Headline style={{ flex: 1 }}>What's open,{'\n'}and what's next.</Headline>
            <Pressable
              onPress={() => router.push('/search')}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Search"
              style={({ pressed }) => [styles.searchBtn, pressed && styles.pressed]}
            >
              <Ionicons name="search" size={19} color={color.muted} />
            </Pressable>
          </View>
          <Sentence style={{ marginTop: space.x16 }}>
            {browsing
              ? 'Every published season in one state. Follow what you hunt to narrow it down.'
              : 'When each species opens and closes, for everything you track.'}
          </Sentence>
          {browsing ? (
            <View style={{ marginTop: space.x12 }}>
              <BrowseStateChip stateCode={stateCode} />
            </View>
          ) : null}
        </View>

        {chipSpecies.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
            <FilterChip label="All" active={speciesFilter === null} onPress={() => setSpeciesFilter(null)} />
            {chipSpecies.map((sp) => (
              <FilterChip key={sp.id} label={sp.name} active={speciesFilter === sp.id} onPress={() => setSpeciesFilter(speciesFilter === sp.id ? null : sp.id)} />
            ))}
          </ScrollView>
        ) : null}

        {needsState ? (
          <BrowseStatePrompt line="Season dates for every state are free to read. Choose where you hunt." />
        ) : isLoading ? (
          <ActivityIndicator color={color.copper} style={{ marginTop: space.section }} />
        ) : open.length === 0 && upcomingMonths.length === 0 ? (
          /* Three different kinds of nothing, and the reader deserves to
             know which. Between February and July the usual one is "we hold
             last season's dates and the agencies haven't posted the next" —
             which the old single line reported as if there were no season. */
          <Sentence style={{ marginTop: space.section }}>
            {speciesFilter
              ? 'No current or upcoming dates for this species.'
              : seasons.length > 0
                ? `Every date we hold ${browsing ? 'for this state' : 'for your follows'} is last season's. The agencies publish next year's through the spring${browsing ? '.' : " — you'll hear from us as they land."}`
                : browsing
                  ? "We don't have this state's dates yet — that's our gap, not the state's. Try another while we fill it."
                  : 'No seasons for your follows yet — add species from Home.'}
          </Sentence>
        ) : (
          <>
            {open.length > 0 ? (
              <Section label="Open now">
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

/** The one place pills are allowed: they act. Copper fill marks the live one. */
function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, active ? styles.chipOn : styles.chipOff, pressed && styles.pressed]}
    >
      <Text style={[styles.chipLabel, { color: active ? color.bg : color.muted }]}>{label}</Text>
    </Pressable>
  );
}

/** One translucent tile per group: a micro label, then its entries. */
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tile style={styles.tile}>
      <Micro>{label}</Micro>
      {children}
    </Tile>
  );
}

function SeasonRow({ item, onPress }: { item: Item; onPress: () => void }) {
  const s = item.season;
  const openNow = item.status === 'open';
  const days = Math.max(item.days ?? 0, 0);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <SpeciesBadge name={s.species?.name} size={34} muted={!openNow} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {s.species?.name}
          {s.label ? ` · ${s.label}` : s.method ? ` · ${cap(s.method)}` : ''}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {s.state?.code ? `${s.state.code} · ` : ''}
          {formatDate(s.open_date)}
          {s.close_date ? ` – ${formatDate(s.close_date)}` : ''}
        </Text>
      </View>
      {/* The status pill is gone: the words carry it. An open season counts
          down to its close, an upcoming one counts down to its opener, and
          copper is spent on the one that is live. */}
      <Text style={[styles.metric, { color: openNow ? color.copper : color.muted }]}>
        {openNow ? `${days}d left` : `in ${days}d`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  content: { paddingHorizontal: space.gutter, paddingTop: space.x16, paddingBottom: 56 },

  header: { marginTop: space.x12 },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.x12 },
  searchBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginTop: 4 },

  // Groups are tiles, set close together: the lift separates them, so there
  // is no rule and no 24pt gap to add (David, 2026-11-08).
  tile: { marginTop: space.x12 },

  row: { flexDirection: 'row', alignItems: 'center', gap: space.x12, paddingVertical: 11 },
  rowTitle: { fontFamily: type.uiMedium, fontSize: 15.5, color: color.bone },
  rowSub: { fontFamily: type.ui, fontSize: 12.5, color: color.muted, marginTop: 1 },
  metric: { fontFamily: type.uiMedium, fontSize: 12.5, marginLeft: space.x8, fontVariant: ['tabular-nums'] },

  chipScroll: { marginTop: space.section, marginHorizontal: -space.gutter },
  chipRow: { paddingHorizontal: space.gutter, gap: space.x8, flexDirection: 'row' },
  chip: { paddingHorizontal: space.x16, paddingVertical: 7, borderRadius: lang.radius.pill, borderWidth: StyleSheet.hairlineWidth },
  chipOn: { backgroundColor: color.copper, borderColor: color.copper },
  chipOff: { backgroundColor: 'transparent', borderColor: color.hair },
  chipLabel: { fontFamily: type.uiMedium, fontSize: 13 },

  pressed: { opacity: 0.6 },
});
