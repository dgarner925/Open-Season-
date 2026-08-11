import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '@/components/ui';
import { PageTitle, SpeciesBadge } from '@/components/midnight';
import { NotificationsOffBanner } from '@/components/NotificationsOffBanner';
import { ProUpsellCard } from '@/components/ProUpsellCard';
import { useAuth } from '@/providers/AuthProvider';
import { useFollows } from '@/features/follows/queries';
import { useActiveStates, useFollowedSeasons, useFollowedWindows, useSpecies, useUpcomingCountdown } from '@/features/reference/queries';
import type { SeasonWithRefs } from '@/features/reference/types';
import { queryClient } from '@/lib/queryClient';
import { maybeRequestReview } from '@/lib/rateApp';
import { pushWidgetEvent } from '@/lib/widget';
import { fontFamily, radius, spacing, theme } from '@/theme';

const WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function diffDays(fromISO: string, toISO: string): number {
  const [ay, am, ad] = fromISO.split('-').map(Number);
  const [by, bm, bd] = toISO.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

type RosterItem = { speciesId: string; name: string; codes: string[]; state: 'open' | 'upcoming' | 'none'; days: number | null };

/** Reduce a species' followed seasons to a single roster status. */
function rosterStatus(seasons: SeasonWithRefs[]): { state: 'open' | 'upcoming' | 'none'; days: number | null } {
  const iso = todayISO();
  const open = seasons.find((s) => s.open_date && s.close_date && s.open_date <= iso && iso <= s.close_date);
  if (open) return { state: 'open', days: open.close_date ? Math.max(diffDays(iso, open.close_date), 0) : null };
  const next = seasons.filter((s) => s.open_date && s.open_date > iso).sort((a, b) => (a.open_date! < b.open_date! ? -1 : 1))[0];
  if (next) return { state: 'upcoming', days: diffDays(iso, next.open_date!) };
  return { state: 'none', days: null };
}

export default function Home() {
  const router = useRouter();
  const { profile } = useAuth();
  const { data: follows = [] } = useFollows();
  const { data: seasons = [], isLoading } = useFollowedSeasons();
  const { data: allSpecies = [] } = useSpecies();
  const { data: states = [] } = useActiveStates();
  const { data: windows = [] } = useFollowedWindows();
  const { items } = useUpcomingCountdown(); // widget only
  const [refreshing, setRefreshing] = useState(false);
  const now = new Date();
  const iso = todayISO();

  // Time-of-day greeting, personalized with the name set in Settings. Falls back
  // to just the greeting (no dangling comma) when no name is set.
  const firstName = (profile?.display_name ?? '').trim().split(' ')[0];
  const hour = now.getHours();
  const partOfDay = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const speciesName = useMemo(() => new Map(allSpecies.map((s) => [s.id, s.name])), [allSpecies]);
  const stateCode = useMemo(() => new Map(states.map((s) => [s.id, s.code])), [states]);

  // One row per tracked species (across every state you follow), always shown.
  const roster = useMemo<RosterItem[]>(() => {
    const ids = [...new Set(follows.map((f) => f.species_id))];
    const rows = ids.map((speciesId) => {
      const name = speciesName.get(speciesId) ?? 'Species';
      const sList = seasons.filter((s) => s.species?.id === speciesId);
      const codes = [...new Set(follows.filter((f) => f.species_id === speciesId).map((f) => stateCode.get(f.state_id)).filter(Boolean) as string[])];
      return { speciesId, name, codes, ...rosterStatus(sList) };
    });
    const rank = { open: 0, upcoming: 1, none: 2 } as const;
    return rows.sort((a, b) => rank[a.state] - rank[b.state] || (a.days ?? 9e9) - (b.days ?? 9e9) || a.name.localeCompare(b.name));
  }, [follows, seasons, speciesName, stateCode]);

  const openCount = roster.filter((r) => r.state === 'open').length;
  const openerCount = seasons.filter((s) => s.open_date && s.open_date > iso).length;
  const deadlineCount = windows.filter((w) => w.closes_at && w.closes_at >= iso).length;
  const trackedStates = [...new Set(follows.map((f) => stateCode.get(f.state_id)).filter(Boolean))];
  const hasFollows = follows.length > 0;
  const locationLabel = !hasFollows ? 'Add your hunts' : trackedStates.length === 1 ? (states.find((s) => s.code === trackedStates[0])?.name ?? trackedStates[0]!) : `${trackedStates.length} states`;

  useEffect(() => {
    pushWidgetEvent(items[0]);
  }, [items[0]?.id, items[0]?.date, items[0]?.kind]);

  // Ask for a rating on the 5th session with real follows — a moment of value.
  useEffect(() => {
    if (hasFollows) maybeRequestReview(true);
  }, [hasFollows]);

  async function onRefresh() {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.accent} />}
      >
        <View style={styles.topRow}>
          <Pressable style={styles.locChip} onPress={() => router.push('/follows')}>
            <View style={styles.locDot} />
            <AppText variant="caption" color={theme.color.textSecondary} numberOfLines={1}>
              {locationLabel}
            </AppText>
          </Pressable>
          <View style={styles.topRight}>
            <Pressable onPress={() => router.push('/notifications')} hitSlop={10} style={styles.bellBtn}>
              <Ionicons name="notifications-outline" size={20} color={theme.color.textSecondary} />
            </Pressable>
            <Text style={styles.wordmark}>O·S</Text>
          </View>
        </View>

        <View style={styles.heroBlock}>
          <PageTitle lead={'Open\n'} accent="season." style={styles.hero} />
          <AppText variant="overline" color={theme.color.textMuted} style={styles.dateLine}>
            {WEEKDAYS[now.getDay()]}, {MONTHS[now.getMonth()]} {now.getDate()}
          </AppText>
          {firstName ? (
            <Text style={styles.greeting}>
              {partOfDay}, <Text style={styles.greetingName}>{firstName}</Text>
            </Text>
          ) : (
            <Text style={styles.greeting}>{partOfDay}</Text>
          )}
        </View>

        <NotificationsOffBanner />
        <ProUpsellCard />

        <View style={styles.stats}>
          <StatTile value={openCount} label="Open now" onPress={() => router.push('/calendar')} />
          <StatTile value={openerCount} label="Openers" onPress={() => router.push('/calendar')} />
          <StatTile value={deadlineCount} label="Deadlines" onPress={() => router.push('/applications')} />
        </View>

        {isLoading ? null : !hasFollows ? (
          <Pressable onPress={() => router.push('/follows')} style={styles.emptyCard}>
            <AppText variant="h3">Choose your quarry</AppText>
            <AppText variant="caption" color={theme.color.textSecondary}>
              Add states and the species you hunt to start tracking seasons and tag deadlines.
            </AppText>
          </Pressable>
        ) : (
          <View style={styles.section}>
            <AppText variant="overline" color={theme.color.textMuted}>
              YOUR SPECIES
            </AppText>
            {roster.map((r, i) => (
              <RosterRow key={r.speciesId} item={r} divider={i > 0} onPress={() => router.push({ pathname: '/species/[id]', params: { id: r.speciesId } })} />
            ))}
          </View>
        )}

        <View style={styles.footer}>
          <FooterLink icon="options-outline" label="Manage your hunts" onPress={() => router.push('/follows')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatTile({ value, label, onPress }: { value: number; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
      <Text style={styles.tileValue}>{value}</Text>
      <AppText variant="caption" color={theme.color.textMuted}>
        {label}
      </AppText>
    </Pressable>
  );
}

function RosterRow({ item, divider, onPress }: { item: RosterItem; divider: boolean; onPress: () => void }) {
  const right = item.state === 'open' ? 'Open' : item.state === 'upcoming' ? `in ${Math.max(item.days ?? 0, 0)}d` : 'No dates yet';
  const rightColor = item.state === 'open' ? theme.color.accent : item.state === 'upcoming' ? theme.color.accentSoft : theme.color.textMuted;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, divider && styles.rowDivider, pressed && styles.pressed]}>
      <SpeciesBadge name={item.name} size={40} muted={item.state !== 'open'} />
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {item.name}
        </AppText>
        <AppText variant="caption" color={theme.color.textMuted} numberOfLines={1}>
          {item.codes.length === 0
            ? 'Tracked'
            : item.codes.length <= 3
              ? item.codes.join(' · ')
              : `${item.codes.length} states`}
        </AppText>
      </View>
      <Text style={[styles.rowMetric, { color: rightColor }]}>{right}</Text>
    </Pressable>
  );
}

function FooterLink({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.glassBtn, pressed && styles.pressed]}>
      <Ionicons name={icon} size={14} color={theme.color.accentSoft} />
      <AppText variant="caption" color={theme.color.textSecondary}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.background },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl },

  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  locChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  locDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.color.accent },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  bellBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  wordmark: { fontFamily: fontFamily.sansBold, fontSize: 11, letterSpacing: 3, color: theme.color.accent },

  heroBlock: { marginTop: spacing.xl },
  hero: { fontSize: 62, lineHeight: 70, paddingTop: 4 },
  dateLine: { marginTop: spacing.lg },
  greeting: { fontFamily: fontFamily.sansMedium, fontSize: 15, color: theme.color.textSecondary, marginTop: spacing.xs },
  greetingName: { fontFamily: fontFamily.sansSemiBold, color: theme.color.accent },

  stats: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
  tile: { flex: 1, padding: spacing.lg, borderRadius: radius.md, backgroundColor: theme.color.surfaceFlat, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.borderFlat, gap: 2 },
  tileValue: { fontFamily: fontFamily.serif, fontSize: 30, color: theme.color.accent },

  section: { marginTop: spacing.xl, gap: spacing.sm },
  emptyCard: { marginTop: spacing.lg, padding: spacing.xl, borderRadius: radius.lg, backgroundColor: theme.color.surfaceFlat, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.borderFlat, gap: spacing.xs },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.color.hairline },
  rowMetric: { fontFamily: fontFamily.sansSemiBold, fontSize: 13, marginLeft: spacing.md },

  footer: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xxl },
  glassBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  pressed: { opacity: 0.85 },
});
