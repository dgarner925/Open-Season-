import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Card } from '@/components/ui';
import quotes from '@/assets/quotes.json';
import { VerifiedStamp, SourceLink } from '@/components/Provenance';
import { useFollowedSeasons } from '@/features/reference/queries';
import { useReportDate, promptReport } from '@/features/reports/queries';
import { useAuth } from '@/providers/AuthProvider';
import type { SeasonWithRefs } from '@/features/reference/types';
import { addToCalendar } from '@/lib/calendar';
import { daysUntil, formatDate } from '@/lib/date';
import { openExternalUrl } from '@/lib/openUrl';
import { fontFamily, spacing, theme } from '@/theme';

const SITE_URL = 'https://osdatesanddraws.com';

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function cap(s: string | null | undefined): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

// rank: 0 open now · 1 upcoming · 2 past
type MethodRow = { season: SeasonWithRefs; rank: 0 | 1 | 2; open: boolean; right: string };
type StateGroup = { code: string; name: string; stateId: string; rows: MethodRow[]; anyOpen: boolean; anyUpcoming: boolean };

function methodStatus(s: SeasonWithRefs): MethodRow {
  const iso = todayISO();
  const o = s.open_date;
  const c = s.close_date;
  if (o && o <= iso && (!c || iso <= c)) return { season: s, rank: 0, open: true, right: 'Open' };
  if (o && o > iso) {
    const d = daysUntil(o);
    return { season: s, rank: 1, open: false, right: d !== null ? `in ${d}d` : 'Upcoming' };
  }
  return { season: s, rank: 2, open: false, right: 'Closed' };
}

export default function SpeciesDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: allSeasons = [], isLoading } = useFollowedSeasons();
  const { profile } = useAuth();
  const report = useReportDate();
  const residentStateId = profile?.resident_state_id ?? null;

  const seasons = allSeasons.filter((s) => s.species?.id === id);
  const name = seasons[0]?.species?.name ?? 'Species';
  const licenseUrl = seasons.find((s) => s.state?.license_url)?.state?.license_url ?? null;
  const bagLimit = seasons.find((s) => s.bag_limit_summary)?.bag_limit_summary ?? null;

  // Group by state, methods sorted open → upcoming → past.
  const byState = new Map<string, StateGroup>();
  for (const s of seasons) {
    const code = s.state?.code ?? s.state_id;
    const g = byState.get(code) ?? { code, name: s.state?.name ?? code, stateId: s.state?.id ?? s.state_id, rows: [], anyOpen: false, anyUpcoming: false };
    const row = methodStatus(s);
    g.rows.push(row);
    if (row.rank === 0) g.anyOpen = true;
    if (row.rank === 1) g.anyUpcoming = true;
    byState.set(code, g);
  }
  const groups = [...byState.values()].map((g) => ({
    ...g,
    rows: g.rows.sort((a, b) => a.rank - b.rank || (a.season.open_date ?? '').localeCompare(b.season.open_date ?? '')),
  }));
  groups.sort((a, b) => Number(b.anyOpen) - Number(a.anyOpen) || Number(b.anyUpcoming) - Number(a.anyUpcoming) || a.name.localeCompare(b.name));

  const stateNames = groups.map((g) => g.name);

  const parts = name.trim().split(' ');
  const accent = parts.pop() ?? name;
  const lead = parts.length ? parts.join(' ') : '';
  const speciesKey = seasons[0]?.species?.key ?? '';
  const quote = (quotes as Record<string, { text: string; attr: string }>)[speciesKey] ?? null;

  // Soonest still-upcoming opener — used for the calendar add and share blurb.
  const iso = todayISO();
  const nextOpener =
    seasons
      .filter((s) => s.open_date && s.open_date >= iso)
      .sort((a, b) => (a.open_date ?? '').localeCompare(b.open_date ?? ''))[0] ?? null;
  // Best available provenance across the followed seasons for this species.
  const provSeason = seasons.find((s) => s.last_verified_at) ?? seasons.find((s) => s.source) ?? null;

  async function onShare() {
    const extra = nextOpener?.open_date ? ` — next opens ${formatDate(nextOpener.open_date)}` : '';
    await Share.share({
      message: `${name} in ${stateNames.join(', ')}${extra}. Tracking seasons with Open Season. ${SITE_URL}`,
    }).catch(() => {});
  }

  function onReport() {
    const rlabel = `${name} — ${stateNames.join(', ')}`;
    promptReport(
      (detail) =>
        report.mutate(
          { targetTable: 'seasons', targetId: nextOpener?.id ?? seasons[0]?.id ?? null, label: rlabel, detail },
          {
            onSuccess: () => Alert.alert('Thanks', "We'll re-check these dates against the official source."),
            onError: () => Alert.alert('Could not send', 'Please try again in a moment.'),
          },
        ),
      rlabel,
    );
  }

  function onAddCalendar() {
    if (!nextOpener?.open_date) {
      Alert.alert('No upcoming opener', 'There\'s no upcoming season date to add yet.');
      return;
    }
    addToCalendar({
      title: `${nextOpener.state?.code ?? ''} ${name} — ${nextOpener.label ?? cap(nextOpener.method)} opener`.trim(),
      date: nextOpener.open_date,
      notes: bagLimit ?? undefined,
      url: licenseUrl ?? undefined,
    });
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      {isLoading ? (
        <ActivityIndicator color={theme.color.accent} style={{ marginTop: spacing.xxl }} />
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.navRow}>
              <CircleButton onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={18} color={theme.color.textPrimary} />
              </CircleButton>
              <View style={styles.navActions}>
                <CircleButton onPress={onAddCalendar}>
                  <Ionicons name="calendar-outline" size={17} color={theme.color.textPrimary} />
                </CircleButton>
                <CircleButton onPress={onShare}>
                  <Ionicons name="share-outline" size={17} color={theme.color.textPrimary} />
                </CircleButton>
              </View>
            </View>

            <View style={styles.headerRow}>
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.title}>
                  {lead ? `${lead}\n` : ''}
                  <Text style={styles.titleAccent}>{accent}</Text>
                </Text>
              </View>
              {quote ? (
                <View style={styles.quoteCol}>
                  <Text style={styles.quoteText}>{`“${quote.text}”`}</Text>
                  <Text style={styles.quoteAttr}>{quote.attr.toUpperCase()}</Text>
                </View>
              ) : null}
            </View>

            {groups.length > 0 ? (
              groups.map((g) => (
                <View key={g.code} style={styles.group}>
                  <View style={styles.groupHead}>
                    <View style={styles.groupHeadLeft}>
                      <AppText variant="overline" color={theme.color.textSecondary}>
                        {g.name.toUpperCase()}
                      </AppText>
                      {residentStateId ? (
                        <Text style={styles.residencyTag}>
                          {g.stateId === residentStateId ? 'RESIDENT' : 'NONRESIDENT'}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={{ gap: spacing.sm }}>
                    {g.rows.map((r) => (
                      <Card key={r.season.id} variant={r.open ? 'gradient' : 'flat'} style={styles.methodCard}>
                        <View style={{ flex: 1 }}>
                          <AppText variant="bodyStrong">{r.season.label ?? cap(r.season.method)}</AppText>
                          <AppText variant="caption" color={theme.color.textMuted} style={{ marginTop: 2 }}>
                            {r.season.open_date ? formatDate(r.season.open_date) : 'TBD'}
                            {r.season.close_date ? ` – ${formatDate(r.season.close_date)}` : ''}
                          </AppText>
                        </View>
                        <Text style={[styles.methodRight, { color: r.open ? theme.color.accent : r.rank === 1 ? theme.color.textSecondary : theme.color.textMuted }]}>
                          {r.right}
                        </Text>
                      </Card>
                    ))}
                  </View>
                </View>
              ))
            ) : (
              <AppText variant="body" color={theme.color.textMuted} style={{ marginTop: spacing.xl }}>
                No season dates published yet — they'll appear here as they're verified.
              </AppText>
            )}

            {bagLimit ? (
              <Card variant="flat" style={{ marginTop: spacing.xl }}>
                <AppText variant="overline" color={theme.color.textMuted}>
                  BAG LIMIT
                </AppText>
                <AppText variant="body" color={theme.color.textSecondary}>
                  {bagLimit}
                </AppText>
              </Card>
            ) : null}

            {groups.length > 0 ? (
              <View style={styles.provenance}>
                <VerifiedStamp verifiedAt={provSeason?.last_verified_at ?? null} />
                {provSeason?.source ? (
                  <SourceLink agencyName={provSeason.source.agency_name} url={provSeason.source.url} />
                ) : null}
                <Pressable onPress={onReport} style={styles.reportBtn}>
                  <AppText variant="caption" color={theme.color.textMuted}>
                    Something look wrong? Report these dates
                  </AppText>
                </Pressable>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.actionBar}>
            <Pressable style={styles.primaryBtn} onPress={() => router.push({ pathname: '/alerts', params: { species: id } })}>
              <Text style={styles.primaryLabel}>Set reminder</Text>
            </Pressable>
            {licenseUrl ? (
              <Pressable style={styles.squareBtn} onPress={() => openExternalUrl(licenseUrl)}>
                <Ionicons name="open-outline" size={20} color={theme.color.textPrimary} />
              </Pressable>
            ) : null}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

function CircleButton({ children, onPress }: { children: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.circle, pressed && { opacity: 0.7 }]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.background },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: 120 },

  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  navActions: { flexDirection: 'row', gap: spacing.sm },
  circle: { width: 38, height: 38, borderRadius: 19, backgroundColor: theme.color.surfaceFlat, alignItems: 'center', justifyContent: 'center' },

  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg, paddingBottom: spacing.sm },
  quoteCol: {
    flex: 1,
    minWidth: 116,
    marginTop: 40,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(217, 169, 126, 0.4)',
    alignItems: 'flex-end',
  },
  quoteText: { fontFamily: fontFamily.serifItalic, fontSize: 14.5, lineHeight: 22, color: '#b8ac9a', textAlign: 'right' },
  quoteAttr: { fontFamily: fontFamily.sansSemiBold, fontSize: 10, letterSpacing: 1.6, color: '#a68a6d', marginTop: 8, textAlign: 'right' },
  title: { fontFamily: fontFamily.serif, fontSize: 50, lineHeight: 56, color: theme.color.textPrimary, marginTop: spacing.xl, paddingTop: 4 },
  titleAccent: { fontFamily: fontFamily.serifItalic, color: theme.color.accent },

  group: { marginTop: spacing.xl, gap: spacing.md },
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  groupHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  residencyTag: { fontFamily: fontFamily.sansSemiBold, fontSize: 9, letterSpacing: 0.8, color: theme.color.textMuted },

  provenance: { marginTop: spacing.xxl, gap: spacing.md },
  reportBtn: { alignItems: 'center', paddingVertical: spacing.sm },
  methodCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  methodRight: { fontFamily: fontFamily.sansSemiBold, fontSize: 11 },

  actionBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xl, backgroundColor: theme.color.background },
  primaryBtn: { flex: 1, height: 52, borderRadius: 26, backgroundColor: theme.color.accent, alignItems: 'center', justifyContent: 'center' },
  primaryLabel: { fontFamily: fontFamily.sansBold, fontSize: 15, color: theme.color.onAccent },
  squareBtn: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
});
