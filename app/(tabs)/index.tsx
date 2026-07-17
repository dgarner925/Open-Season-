import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Dot, GlassChip } from '@/components/ui';
import { HuntPicker } from '@/features/follows/HuntPicker';
import { useApplications } from '@/features/applications/queries';
import { useUpcomingCountdown } from '@/features/reference/queries';
import { useAuth } from '@/providers/AuthProvider';
import type { CountdownItem } from '@/features/reference/types';
import { formatDate } from '@/lib/date';
import { queryClient } from '@/lib/queryClient';
import { fontFamily, radius, spacing, speciesColors, theme, urgencyColor, withAlpha, type SpeciesKey } from '@/theme';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function timeGreeting(now: Date): string {
  const h = now.getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Home dashboard — the app's landing. A warm greeting, the single most-imminent
 * hunt as a hero, quick stats, then your hunt picker and everything on the
 * horizon. This is where you come back to change what you follow.
 */
export default function Home() {
  const router = useRouter();
  const { profile } = useAuth();
  const { items } = useUpcomingCountdown();
  const { data: apps = [] } = useApplications();
  const [refreshing, setRefreshing] = useState(false);

  const now = new Date();
  const firstName = profile?.display_name?.trim().split(/\s+/)[0];
  const hero = items[0];
  const rest = items.slice(1);
  const openers = items.filter((i) => i.kind === 'opener').length;
  const deadlines = items.filter((i) => i.kind === 'deadline').length;

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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.accent} />
        }
      >
        {/* Greeting */}
        <View style={styles.greeting}>
          <AppText variant="overline" color={theme.color.accent}>
            OPENSEASON
          </AppText>
          <AppText variant="display" style={styles.greetingTitle}>
            {timeGreeting(now)}
            {firstName ? `, ${firstName}` : ''}
          </AppText>
          <AppText variant="body" color={theme.color.textSecondary}>
            {WEEKDAYS[now.getDay()]}, {MONTHS[now.getMonth()]} {now.getDate()} — here's what's on the horizon.
          </AppText>
        </View>

        {/* Hero — the next thing that matters */}
        {hero ? (
          <Hero
            item={hero}
            onPress={() => router.push(hero.kind === 'deadline' ? `/window/${hero.id}` : `/season/${hero.id}`)}
          />
        ) : (
          <View style={styles.emptyHero}>
            <Ionicons name="trail-sign-outline" size={30} color={theme.color.accent} />
            <AppText variant="h2" style={{ marginTop: spacing.sm }}>
              The woods are quiet — for now.
            </AppText>
            <AppText variant="body" color={theme.color.textSecondary}>
              Add a state and an animal below to start your first countdown.
            </AppText>
          </View>
        )}

        {/* Quick stats */}
        <View style={styles.tiles}>
          <StatTile value={openers} label="OPENERS" onPress={() => router.push('/calendar')} />
          <StatTile value={deadlines} label="DEADLINES" onPress={() => router.push('/applications')} />
          <StatTile value={apps.length} label="TRACKED" onPress={() => router.push('/tracker')} />
        </View>

        {/* Hunt picker */}
        <Section label="YOUR HUNTS">
          <HuntPicker />
        </Section>

        {/* Everything else coming up */}
        <Section label="ON THE HORIZON">
          {rest.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              {rest.map((item) => (
                <ComingRow
                  key={`${item.kind}:${item.id}`}
                  item={item}
                  onPress={() => router.push(item.kind === 'deadline' ? `/window/${item.id}` : `/season/${item.id}`)}
                />
              ))}
            </View>
          ) : (
            <AppText variant="body" color={theme.color.textMuted}>
              {hero ? "That's everything on your radar for now." : 'Nothing yet — add a hunt above.'}
            </AppText>
          )}
        </Section>

        {/* Help link — quiet, for anyone finding their feet */}
        <Pressable onPress={() => router.push('/how-to')} style={styles.howTo}>
          <Ionicons name="help-circle-outline" size={18} color={theme.color.textMuted} />
          <AppText variant="caption" color={theme.color.textMuted}>
            New here? How OpenSeason works
          </AppText>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Hero({ item, onPress }: { item: CountdownItem; onPress: () => void }) {
  const speciesColor = speciesColors[item.speciesKey as SpeciesKey] ?? speciesColors.default;
  const urgency = urgencyColor(item.daysUntil);
  const days = Math.max(item.daysUntil, 0);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.hero, pressed && styles.pressed]}>
      <View style={[styles.accentBar, { backgroundColor: speciesColor }]} />
      <View style={styles.heroMeta}>
        <View style={styles.metaLeft}>
          {item.kind === 'deadline' ? <GlassChip label="Deadline" /> : <Dot color={speciesColor} />}
          <AppText variant="overline" color={theme.color.textMuted}>
            {item.kind === 'deadline' ? 'NEXT DEADLINE' : 'NEXT OPENER'}
            {item.stateCode ? `  ·  ${item.stateCode}` : ''}
          </AppText>
        </View>
        <AppText variant="caption" color={theme.color.textMuted}>
          {formatDate(item.date)}
        </AppText>
      </View>

      <AppText variant="h1" numberOfLines={2} style={{ marginTop: spacing.xs }}>
        {item.title}
      </AppText>
      <AppText variant="caption" color={theme.color.textSecondary}>
        {item.subtitle}
      </AppText>

      <View style={styles.heroCount}>
        <Text style={[styles.heroNumber, { color: urgency }]}>{days}</Text>
        <View style={styles.heroCountMeta}>
          <AppText variant="bodyStrong" color={theme.color.textSecondary}>
            {days === 1 ? 'day' : 'days'}
          </AppText>
          <AppText variant="caption" color={urgency}>
            {item.kind === 'deadline' ? 'until the deadline' : 'until opening day'}
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}

function StatTile({ value, label, onPress }: { value: number; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
      <Text style={styles.tileValue}>{value}</Text>
      <AppText variant="overline" color={theme.color.textMuted}>
        {label}
      </AppText>
    </Pressable>
  );
}

function ComingRow({ item, onPress }: { item: CountdownItem; onPress: () => void }) {
  const speciesColor = speciesColors[item.speciesKey as SpeciesKey] ?? speciesColors.default;
  const urgency = urgencyColor(item.daysUntil);
  const days = Math.max(item.daysUntil, 0);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Dot color={speciesColor} size={10} />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {item.title}
        </AppText>
        <AppText variant="caption" color={theme.color.textMuted}>
          {formatDate(item.date)} · {item.kind === 'deadline' ? 'Deadline' : 'Opener'}
        </AppText>
      </View>
      <View style={styles.rowCount}>
        <AppText variant="h3" color={urgency}>
          {days}
        </AppText>
        <AppText variant="overline" color={theme.color.textMuted}>
          {days === 1 ? 'DAY' : 'DAYS'}
        </AppText>
      </View>
    </Pressable>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.md }}>
      <AppText variant="overline" color={theme.color.textMuted}>
        {label}
      </AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.background },
  content: { padding: spacing.xl, gap: spacing.xl },
  greeting: { gap: spacing.xs },
  greetingTitle: { fontSize: 44, lineHeight: 48, letterSpacing: -1.5 },

  hero: {
    backgroundColor: withAlpha(theme.color.accent, 0.05),
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha(theme.color.accent, 0.28),
    overflow: 'hidden',
    gap: spacing.xs,
  },
  accentBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heroCount: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, marginTop: spacing.md },
  heroNumber: { fontFamily: fontFamily.serif, fontSize: 76, lineHeight: 76, letterSpacing: -2.5, fontWeight: '600' },
  heroCountMeta: { paddingBottom: 12, gap: 2 },

  emptyHero: {
    backgroundColor: theme.color.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.border,
    gap: spacing.xs,
  },

  tiles: { flexDirection: 'row', gap: spacing.sm },
  tile: {
    flex: 1,
    backgroundColor: theme.color.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.border,
    gap: 2,
    alignItems: 'flex-start',
  },
  tileValue: {
    fontFamily: fontFamily.serif,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.5,
    fontWeight: '600',
    color: theme.color.accentStrong,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: theme.color.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.border,
  },
  howTo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.sm },
  rowCount: { alignItems: 'flex-end', minWidth: 40 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.994 }] },
});
