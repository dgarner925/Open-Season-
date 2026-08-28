import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Sentence, Serif } from '@/components/system';
import { SpeciesBadge } from '@/components/midnight';
import { useFollowedSeasons } from '@/features/reference/queries';
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

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Seasons — a clear, dated list of what's open now and what's opening next. */
export default function Seasons() {
  const router = useRouter();
  const { data: seasons = [], isLoading } = useFollowedSeasons();
  const iso = todayISO();

  // Species filter — tappable words over the list. null = all.
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

    // Group upcoming by opening month, so the list reads like a season calendar.
    const thisYear = iso.slice(0, 4);
    const months: { key: string; label: string; items: Item[] }[] = [];
    for (const it of upcomingList) {
      const [y, m] = it.season.open_date!.split('-');
      const key = `${y}-${m}`;
      let bucket = months[months.length - 1];
      if (!bucket || bucket.key !== key) {
        bucket = { key, label: `${MONTH_NAMES[Number(m) - 1]}${y !== thisYear ? ` ${y}` : ''}`, items: [] };
        months.push(bucket);
      }
      bucket.items.push(it);
    }
    return { open: openList, upcomingMonths: months, chipSpecies: chips };
  }, [seasons, iso, speciesFilter]);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Serif size={40} style={{ lineHeight: 46 }}>
            Seasons
          </Serif>
          <Pressable
            onPress={() => router.push('/search')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Search"
          >
            <Ionicons name="search" size={19} color={color.muted} />
          </Pressable>
        </View>
        <Sentence style={{ marginTop: space.x8 }}>
          When each species opens and closes, for everything you track.
        </Sentence>

        {chipSpecies.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
            <FilterWord label="All" on={speciesFilter === null} onPress={() => setSpeciesFilter(null)} />
            {chipSpecies.map((sp) => (
              <FilterWord
                key={sp.id}
                label={sp.name}
                on={speciesFilter === sp.id}
                onPress={() => setSpeciesFilter(speciesFilter === sp.id ? null : sp.id)}
              />
            ))}
          </ScrollView>
        ) : null}

        {isLoading ? (
          <ActivityIndicator color={color.copper} style={{ marginTop: space.x32 }} />
        ) : open.length === 0 && upcomingMonths.length === 0 ? (
          <Sentence style={{ marginTop: space.x32 }}>
            {speciesFilter
              ? 'No current or upcoming dates for this species.'
              : 'No upcoming seasons for your follows yet — add species from Home.'}
          </Sentence>
        ) : (
          <>
            {open.length > 0 ? (
              <Section label="Open now">
                {open.map((it, i) => (
                  <SeasonRow key={it.season.id} item={it} last={i === open.length - 1} onPress={() => router.push(`/season/${it.season.id}`)} />
                ))}
              </Section>
            ) : null}
            {upcomingMonths.map((m) => (
              <Section key={m.key} label={m.label}>
                {m.items.map((it, i) => (
                  <SeasonRow key={it.season.id} item={it} last={i === m.items.length - 1} onPress={() => router.push(`/season/${it.season.id}`)} />
                ))}
              </Section>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function FilterWord({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <Text style={[styles.filterWord, on && { color: color.copper }]}>{label}</Text>
    </Pressable>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: space.section }}>
      <View style={styles.rule} />
      <Serif size={22} style={{ marginTop: space.x16, marginBottom: space.x4 }}>
        {label}
      </Serif>
      {children}
    </View>
  );
}

function SeasonRow({ item, last, onPress }: { item: Item; last: boolean; onPress: () => void }) {
  const s = item.season;
  const openNow = item.status === 'open';
  const days = Math.max(item.days ?? 0, 0);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}>
      <SpeciesBadge name={s.species?.name} size={40} muted={!openNow} />
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
      <Text style={[styles.metric, { color: openNow ? color.copper : color.muted }]}>
        {openNow ? `Open · ${days}d left` : `in ${days}d`}
      </Text>
      {!last ? <View style={styles.rowRule} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  content: { paddingHorizontal: space.gutter, paddingTop: space.x16, paddingBottom: space.x38 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  filterScroll: { marginTop: space.x16, marginHorizontal: -space.gutter },
  filterRow: { paddingHorizontal: space.gutter, gap: space.section, flexDirection: 'row' },
  filterWord: { fontFamily: type.uiMedium, fontSize: 14, color: color.dim },

  rule: { height: StyleSheet.hairlineWidth, backgroundColor: color.hair, marginHorizontal: -space.gutter },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.x12, paddingVertical: space.x12, minHeight: 44 },
  rowRule: {
    position: 'absolute',
    left: 52,
    right: -space.gutter,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.hair,
  },
  rowTitle: { fontFamily: type.ui, fontSize: type.size.body + 0.5, color: color.bone },
  rowSub: { fontFamily: type.ui, fontSize: 13, color: color.muted, marginTop: 2 },
  metric: { fontFamily: type.displayItalic, fontSize: 17, marginLeft: space.x8 },
});
