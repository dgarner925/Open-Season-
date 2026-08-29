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
import { nextPermitSegment, useFollows, usePermitFollows } from '@/features/follows/queries';
import { useLegalLight } from '@/features/legalLight/useLegalLight';
import { openExternalUrl } from '@/lib/openUrl';
import { useActiveStates, useFollowedSeasons, useFollowedWindows, useSpecies, useUpcomingCountdown } from '@/features/reference/queries';
import type { SeasonWithRefs } from '@/features/reference/types';
import { queryClient } from '@/lib/queryClient';
import { maybeRequestReview } from '@/lib/rateApp';
import { pushWidgetEvent } from '@/lib/widget';
import { fontFamily, radius, spacing, theme } from '@/theme';
import { Serif } from '@/components/system';
import { lang } from '@/theme/tokens';

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
  const { data: permitFollows = [] } = usePermitFollows();
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
          <Pressable onPress={() => router.push('/search')} hitSlop={10} style={styles.bellBtn} accessibilityRole="button" accessibilityLabel="Search">
            <Ionicons name="search" size={19} color={lang.color.muted} />
          </Pressable>
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

        <View style={{ marginTop: spacing.xl }}>
          <NotificationsOffBanner />
          <ProUpsellCard />
        </View>

        <WeekendBriefCard
          seasons={seasons}
          windows={windows}
          stateCode={states.find((s) => s.id === profile?.resident_state_id)?.code ?? trackedStates[0] ?? null}
          onPress={() => router.push('/calendar')}
        />

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
            <Serif size={22}>Your species</Serif>
            <View style={styles.tileGroup}>
              {roster.map((r, i) => (
                <RosterRow key={r.speciesId} item={r} divider={i > 0} onPress={() => router.push({ pathname: '/species/[id]', params: { id: r.speciesId } })} />
              ))}
            </View>
          </View>
        )}

        {permitFollows.length > 0 ? (
          <View style={styles.section}>
            <Serif size={22}>Permit hunts</Serif>
            <View style={styles.tileGroup}>
            {permitFollows
              .filter((f) => f.hunt)
              .sort((a, b) => (a.hunt!.name < b.hunt!.name ? -1 : 1))
              .map((f, i) => (
                <Pressable
                  key={f.id}
                  onPress={() => openExternalUrl(f.hunt!.url)}
                  style={({ pressed }) => [styles.row, i > 0 && styles.rowDivider, pressed && styles.pressed]}
                >
                  <View style={styles.permitTile}>
                    <Ionicons name="ribbon-outline" size={17} color={theme.color.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyStrong" numberOfLines={1}>
                      {f.hunt!.name}
                    </AppText>
                    <AppText variant="caption" color={theme.color.textMuted} numberOfLines={1}>
                      {[f.hunt!.agency, f.hunt!.state_code].filter(Boolean).join(' · ')}
                    </AppText>
                  </View>
                  {(() => {
                    const seg = nextPermitSegment(f.hunt, iso);
                    if (!seg || seg.open_date <= iso) return null;
                    return (
                      <Text style={[styles.rowMetric, { color: theme.color.accentSoft }]}>
                        in {diffDays(iso, seg.open_date)}d
                      </Text>
                    );
                  })()}
                  <Ionicons name="open-outline" size={13} color={theme.color.textMuted} />
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.footer}>
          <FooterLink icon="options-outline" label="Manage your hunts" onPress={() => router.push('/follows')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * The Weekend Brief, in-app: visible Friday through Sunday, only when the
 * weekend has content (openers Fri-Sun, last-chance closers, deadlines within
 * a week). The Friday push says the same thing; this card is for everyone.
 */
function WeekendBriefCard({
  seasons,
  windows,
  stateCode,
  onPress,
}: {
  seasons: SeasonWithRefs[];
  windows: { closes_at: string | null; species?: { name: string } | null; state?: { code: string; name?: string } | null }[];
  stateCode: string | null;
  onPress: () => void;
}) {
  // Tomorrow's light — the morning the brief is planning for, not the one
  // already underway when the brief lands.
  const light = useLegalLight(stateCode, 1);
  const now = new Date();
  const dow = now.getDay(); // 5 Fri, 6 Sat, 0 Sun
  const iso = todayISO();
  if (dow !== 5 && dow !== 6 && dow !== 0) return null;

  const addDays = (base: string, n: number) => {
    const [y, m, d] = base.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + n));
    return dt.toISOString().slice(0, 10);
  };
  const sunday = addDays(iso, dow === 5 ? 2 : dow === 6 ? 1 : 0);
  const dayLabel = (dateISO: string) => {
    const diff = diffDays(iso, dateISO);
    if (diff === 0) return 'today';
    if (diff === 1) return 'tomorrow';
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(dateISO + 'T12:00:00Z').getUTCDay()];
  };

  const lines: { priority: number; d: string; text: string }[] = [];
  for (const s of seasons) {
    if (!s.open_date) continue;
    if (s.open_date >= iso && s.open_date <= sunday) {
      lines.push({ priority: 1, d: s.open_date, text: `${s.species?.name} opens ${dayLabel(s.open_date)} in ${s.state?.name ?? s.state?.code}.` });
    } else if (s.close_date && s.open_date <= iso && s.close_date >= iso && s.close_date <= sunday) {
      lines.push({ priority: 2, d: s.close_date, text: `${s.species?.name} closes ${dayLabel(s.close_date)} in ${s.state?.name ?? s.state?.code} — the last days.` });
    }
  }
  for (const w of windows) {
    if (w.closes_at && w.closes_at >= iso && w.closes_at <= addDays(iso, 7)) {
      lines.push({
        priority: 3,
        d: w.closes_at,
        text: `The ${w.state?.name ?? w.state?.code} ${(w.species?.name ?? '').toLowerCase()} draw closes ${dayLabel(w.closes_at)}.`,
      });
    }
  }
  if (lines.length === 0) return null;
  const shown = lines.sort((a, b) => a.priority - b.priority || a.d.localeCompare(b.d)).slice(0, 3);

  // Masthead date range: "AUG 29–31" (Fri–Sun of this weekend).
  const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const friday = addDays(iso, dow === 5 ? 0 : dow === 6 ? -1 : -2);
  const [, fm, fd] = friday.split('-').map(Number);
  const [, sm, sd] = sunday.split('-').map(Number);
  const range = fm === sm ? `${MON[fm - 1]} ${fd}–${sd}` : `${MON[fm - 1]} ${fd} – ${MON[sm - 1]} ${sd}`;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.briefCard, pressed && styles.pressed]}>
      <View style={styles.briefHead}>
        <AppText variant="overline" color={theme.color.accentSoft}>
          THE WEEKEND BRIEF
        </AppText>
        <AppText variant="overline" color={theme.color.textMuted}>
          {range}
        </AppText>
      </View>
      <View style={styles.briefRule} />
      {shown.map((l, i) => (
        <Text key={i} style={styles.briefLine}>
          {l.text}
        </Text>
      ))}
      {light ? (
        <Text style={styles.briefLight}>
          Legal light {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][(dow + 1) % 7]}:{' '}
          {light.approx ? '≈ ' : ''}
          {light.window}
        </Text>
      ) : null}
    </Pressable>
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
  screen: { flex: 1, backgroundColor: lang.color.bg },
  content: { paddingHorizontal: lang.space.gutter, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  sectionRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: lang.color.hair,
    marginHorizontal: -lang.space.gutter,
    marginBottom: lang.space.x16,
  },

  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  locChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  locDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: lang.color.copper },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  bellBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  
  heroBlock: { marginTop: spacing.xl },
  hero: { fontSize: 62, lineHeight: 70, paddingTop: 4 },
  dateLine: { marginTop: spacing.lg },
  greeting: { fontFamily: fontFamily.sansMedium, fontSize: 15, color: theme.color.textSecondary, marginTop: spacing.xs },
  greetingName: { fontFamily: fontFamily.sansSemiBold, color: lang.color.copper },

  // The 1.3.5 brief card — flat surface, copper spine as a left border so it
  // follows the corner radius (David asked for this layout back, 2026-08-29).
  briefCard: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: theme.color.surfaceFlat,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.borderFlat,
    borderLeftWidth: 2,
    borderLeftColor: theme.color.accent,
    gap: 6,
  },
  briefHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  briefRule: { height: StyleSheet.hairlineWidth, backgroundColor: theme.color.borderFlat, marginVertical: 4 },
  briefLine: { fontFamily: fontFamily.serifItalic, fontSize: 16.5, lineHeight: 24, color: lang.color.bone },
  briefLight: { fontFamily: fontFamily.sansMedium, fontSize: 12.5, color: theme.color.textMuted, marginTop: 4 },

  stats: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
  tile: { flex: 1, padding: spacing.lg, borderRadius: radius.md, backgroundColor: theme.color.surfaceFlat, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.borderFlat, gap: 2 },
  tileValue: { fontFamily: fontFamily.serif, fontSize: 30, color: lang.color.copper },

  section: { marginTop: spacing.xl, gap: spacing.sm },
  emptyCard: { marginTop: spacing.lg, padding: spacing.xl, borderRadius: radius.lg, backgroundColor: theme.color.surfaceFlat, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.borderFlat, gap: spacing.xs },

  tileGroup: {
    marginTop: spacing.md,
    backgroundColor: lang.color.surface,
    borderRadius: lang.radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: lang.color.hair,
    overflow: 'hidden',
    paddingHorizontal: spacing.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  permitTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.color.surfaceFlat,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.borderFlat,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: lang.color.hair },
  rowMetric: { fontFamily: fontFamily.sansSemiBold, fontSize: 13, marginLeft: spacing.md },

  footer: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xxl },
  glassBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  pressed: { opacity: 0.85 },
});
