import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Rule, Sentence, Serif } from '@/components/system';
import quotes from '@/assets/quotes.json';
import { attrName, attrTitle } from '@/components/LaunchQuote';
import { ProvenanceBlock } from '@/components/Provenance';
import { useFollowedSeasons } from '@/features/reference/queries';
import { useReportDate, promptReport } from '@/features/reports/queries';
import { useAuth } from '@/providers/AuthProvider';
import type { SeasonWithRefs } from '@/features/reference/types';
import { addToCalendar } from '@/lib/calendar';
import { daysUntil, formatDate } from '@/lib/date';
import { lang } from '@/theme/tokens';

const { color, space, type } = lang;
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
      Alert.alert('No upcoming opener', "There's no upcoming season date to add yet.");
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
        <ActivityIndicator color={color.copper} style={{ marginTop: space.x38 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.navRow}>
            <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
              <Ionicons name="chevron-back" size={22} color={color.bone} />
            </Pressable>
            <View style={styles.navActions}>
              <Pressable onPress={onAddCalendar} hitSlop={10} accessibilityRole="button" accessibilityLabel="Add to calendar">
                <Ionicons name="calendar-outline" size={20} color={color.muted} />
              </Pressable>
              <Pressable onPress={onShare} hitSlop={10} accessibilityRole="button" accessibilityLabel="Share">
                <Ionicons name="share-outline" size={20} color={color.muted} />
              </Pressable>
            </View>
          </View>

          <Serif size={type.size.hero - 4} style={{ marginTop: space.section, lineHeight: type.size.hero + 2 }}>
            {name}
          </Serif>

          {/* The epigraph — the species' line from the sporting canon, kept quiet. */}
          {quote ? (
            <View style={styles.quoteBlock}>
              <Text style={styles.quoteText}>{`“${quote.text}”`}</Text>
              <Text style={styles.quoteAttrName}>{attrName(quote.attr)}</Text>
              {attrTitle(quote.attr) ? <Text style={styles.quoteAttrTitle}>{attrTitle(quote.attr)}</Text> : null}
            </View>
          ) : null}

          {groups.length > 0 ? (
            groups.map((g) => (
              <View key={g.code}>
                <Rule />
                <Serif size={22}>{g.name}</Serif>
                {residentStateId ? (
                  <Sentence tone="dim" style={{ fontSize: 13, marginTop: 2 }}>
                    {g.stateId === residentStateId ? 'Resident rules apply to you.' : 'Nonresident rules apply to you.'}
                  </Sentence>
                ) : null}
                <View style={{ marginTop: space.x8 }}>
                  {g.rows.map((r, i) => (
                    <Pressable
                      key={r.season.id}
                      onPress={() => router.push(`/season/${r.season.id}`)}
                      style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>{r.season.label ?? cap(r.season.method)}</Text>
                        <Text style={styles.rowSub}>
                          {r.season.open_date ? formatDate(r.season.open_date) : 'TBD'}
                          {r.season.close_date ? ` – ${formatDate(r.season.close_date)}` : ''}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.rowMetric,
                          { color: r.open ? color.copper : r.rank === 1 ? color.muted : color.dim },
                        ]}
                      >
                        {r.right}
                      </Text>
                      <Ionicons name="chevron-forward" size={13} color={color.dim} />
                      {i !== g.rows.length - 1 ? <View style={styles.rowRule} /> : null}
                    </Pressable>
                  ))}
                </View>
              </View>
            ))
          ) : (
            <Sentence style={{ marginTop: space.x32 }}>
              No season dates published yet — they'll appear here as they're verified.
            </Sentence>
          )}

          {bagLimit ? (
            <>
              <Rule />
              <Sentence>{bagLimit}</Sentence>
            </>
          ) : null}

          {groups.length > 0 ? (
            <>
              <ProvenanceBlock
                verifiedAt={provSeason?.last_verified_at ?? null}
                agencyName={provSeason?.source?.agency_name ?? null}
                url={provSeason?.source?.url ?? null}
              />
              <Pressable onPress={onReport} accessibilityRole="button" style={{ marginTop: space.x16 }}>
                <Sentence tone="dim" style={{ fontSize: 13 }}>
                  Something look wrong? Report these dates.
                </Sentence>
              </Pressable>
            </>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  content: { paddingHorizontal: space.gutter, paddingTop: space.x16, paddingBottom: space.x38 },

  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  navActions: { flexDirection: 'row', gap: space.section },

  quoteBlock: { marginTop: space.x16 },
  quoteText: { fontFamily: type.displayItalic, fontSize: 16, lineHeight: 24, color: color.muted },
  quoteAttrName: { fontFamily: type.uiSemiBold, fontSize: 10.5, letterSpacing: 1.8, color: color.dim, marginTop: space.x8 },
  quoteAttrTitle: { fontFamily: type.uiSemiBold, fontSize: 9, letterSpacing: 1.4, color: color.dim, marginTop: 3 },

  row: { flexDirection: 'row', alignItems: 'center', gap: space.x12, paddingVertical: space.x12, minHeight: 44 },
  rowRule: {
    position: 'absolute',
    left: 0,
    right: -space.gutter,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.hair,
  },
  rowTitle: { fontFamily: type.ui, fontSize: type.size.body + 0.5, color: color.bone },
  rowSub: { fontFamily: type.ui, fontSize: 13, color: color.muted, marginTop: 2 },
  rowMetric: { fontFamily: type.displayItalic, fontSize: 17 },
});
