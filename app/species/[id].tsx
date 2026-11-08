import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import quotes from '@/assets/quotes.json';
import { attrName, attrTitle } from '@/components/LaunchQuote';
import { Medallion } from '@/components/Medallion';
import { VerifiedStamp, SourceLink } from '@/components/Provenance';
import { GapNote, Unreachable } from '@/components/GapNote';
import { Sentence, Serif } from '@/components/system';
import { coverageOf } from '@/features/coverage/gaps';
import { useFollowedSeasons } from '@/features/reference/queries';
import { useReportDate, promptReport } from '@/features/reports/queries';
import { useAuth } from '@/providers/AuthProvider';
import type { SeasonWithRefs } from '@/features/reference/types';
import { addToCalendar } from '@/lib/calendar';
import { daysUntil, formatDate } from '@/lib/date';
import { openExternalUrl } from '@/lib/openUrl';
import { lang } from '@/theme/tokens';

const { color, space, type, radius } = lang;

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
  if (o && o <= iso && (!c || iso <= c)) return { season: s, rank: 0, open: true, right: 'Open now' };
  if (o && o > iso) {
    const d = daysUntil(o);
    return { season: s, rank: 1, open: false, right: d !== null ? `in ${d} days` : 'Upcoming' };
  }
  return { season: s, rank: 2, open: false, right: 'Closed' };
}

export default function SpeciesDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: allSeasons = [], isLoading, isError } = useFollowedSeasons();
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
        <ActivityIndicator color={color.copper} style={{ marginTop: space.x38 }} />
      ) : isError ? (
        <Unreachable what="this species' dates" style={{ marginTop: space.x38, paddingHorizontal: space.gutter }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.navRow}>
            <CircleButton onPress={() => router.back()} label="Back">
              <Ionicons name="chevron-back" size={18} color={color.bone} />
            </CircleButton>
            <View style={styles.navActions}>
              <CircleButton onPress={onAddCalendar} label="Add the opener to your calendar">
                <Ionicons name="calendar-outline" size={17} color={color.bone} />
              </CircleButton>
              <CircleButton onPress={onShare} label="Share">
                <Ionicons name="share-outline" size={17} color={color.bone} />
              </CircleButton>
            </View>
          </View>

          <View style={styles.headerWrap}>
            {/* Rendered first so it paints behind the title — no zIndex,
                which Android honours unreliably inside a ScrollView. */}
            <Medallion species={name} size={248} opacity={0.22} style={styles.watermark} />
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
                  <Text style={styles.quoteAttrName}>{attrName(quote.attr)}</Text>
                  {attrTitle(quote.attr) ? <Text style={styles.quoteAttrTitle}>{attrTitle(quote.attr)}</Text> : null}
                </View>
              ) : null}
            </View>
          </View>

          {groups.length > 0 ? (
            groups.map((g) => (
              <View key={g.code} style={styles.group}>
                <View style={styles.groupHead}>
                  <Serif size={22}>{g.name}</Serif>
                  {residentStateId ? (
                    <Text style={styles.residencyTag}>
                      {g.stateId === residentStateId ? 'RESIDENT' : 'NONRESIDENT'}
                    </Text>
                  ) : null}
                </View>

                {/* One tile per state: the methods for that state belong
                    together, and the lift is what groups them. */}
                <View style={styles.tile}>
                  {g.rows.map((r) => (
                    <Pressable
                      key={r.season.id}
                      onPress={() => router.push(`/season/${r.season.id}`)}
                      accessibilityRole="button"
                      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.method}>{r.season.label ?? cap(r.season.method)}</Text>
                        <Text style={styles.dates}>
                          {r.season.open_date ? formatDate(r.season.open_date) : 'TBD'}
                          {r.season.close_date ? ` – ${formatDate(r.season.close_date)}` : ''}
                        </Text>
                      </View>
                      {/* Copper is scarce: only what is open right now earns it. */}
                      <Text
                        style={[
                          styles.right,
                          r.open
                            ? { color: color.copper, fontFamily: type.uiSemiBold }
                            : r.rank === 1
                              ? { color: color.muted }
                              : { color: color.dim },
                        ]}
                      >
                        {r.right}
                      </Text>
                      <Ionicons name="chevron-forward" size={14} color={color.copper} style={{ marginLeft: space.x8 }} />
                    </Pressable>
                  ))}
                </View>

                {/* Every row in this state is in the past, so the dates above
                    are last season's. Say which year they are rather than
                    letting them read as current. */}
                <GapNote
                  coverage={coverageOf(g.rows.map((r) => r.season), iso)}
                  species={name}
                  state={g.name}
                  agency={g.rows.find((r) => r.season.source)?.season.source?.agency_name ?? null}
                  sourceUrl={g.rows.find((r) => r.season.source)?.season.source?.url ?? null}
                  followed
                  style={{ marginTop: space.x12 }}
                />
              </View>
            ))
          ) : (
            /* No rows at all for this species in any state the reader
               follows. "No dates published yet" was the old line, and it put
               the blame on the agencies for what is usually our own hole. */
            <Sentence style={{ marginTop: space.section }}>
              We don't have {name.toLowerCase()} dates for the states you follow yet — that's our gap,
              not the states'. You'll hear from us the day they land.
            </Sentence>
          )}

          {bagLimit ? (
            <View style={[styles.tile, styles.bag]}>
              <Sentence tone="bone">What you may take</Sentence>
              <Sentence style={{ marginTop: 2 }}>{bagLimit}</Sentence>
            </View>
          ) : null}

          {groups.length > 0 ? (
            /* Provenance stays bare — a footnote beneath the tiles, not
               another object (same as the season screen). */
            <View style={styles.provenance}>
              <VerifiedStamp verifiedAt={provSeason?.last_verified_at ?? null} />
              {provSeason?.source ? (
                <SourceLink agencyName={provSeason.source.agency_name} url={provSeason.source.url} />
              ) : null}
              {licenseUrl ? (
                <Pressable onPress={() => openExternalUrl(licenseUrl)} hitSlop={6} accessibilityRole="button">
                  <Text style={styles.footLink}>
                    Buy your {name.toLowerCase()} licence <Text style={{ color: color.copperDim }}>›</Text>
                  </Text>
                </Pressable>
              ) : null}
              <Pressable onPress={onReport} style={styles.reportBtn} accessibilityRole="button">
                <Sentence tone="dim" style={{ fontSize: 13 }}>
                  Something look wrong? Report these dates.
                </Sentence>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function CircleButton({ children, onPress, label }: { children: React.ReactNode; onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.circle, pressed && { opacity: 0.7 }]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  content: { paddingHorizontal: space.gutter, paddingTop: space.x16, paddingBottom: 48 },

  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  navActions: { flexDirection: 'row', gap: space.x8 },
  circle: { width: 38, height: 38, borderRadius: 19, backgroundColor: color.tile, alignItems: 'center', justifyContent: 'center' },

  headerWrap: { position: 'relative' },
  // Bleeds off the right edge so it reads as letterpress under the title
  // rather than as a picture sitting in a box.
  watermark: { position: 'absolute', right: -56, top: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.x16, paddingBottom: space.x8 },
  quoteCol: {
    flex: 1,
    minWidth: 116,
    marginTop: 40,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.rule,
    alignItems: 'flex-end',
  },
  quoteText: { fontFamily: type.displayItalic, fontSize: 15.5, lineHeight: 23, color: color.muted, textAlign: 'right', paddingLeft: 6 },
  quoteAttrName: { fontFamily: type.uiSemiBold, fontSize: 10.5, letterSpacing: 1.8, color: color.copper, marginTop: 8, textAlign: 'right' },
  quoteAttrTitle: { fontFamily: type.uiSemiBold, fontSize: 9, letterSpacing: 1.4, color: color.dim, marginTop: 4, textAlign: 'right' },
  title: { fontFamily: type.display, fontSize: 50, lineHeight: 56, color: color.bone, marginTop: space.section, paddingTop: 4 },
  titleAccent: { fontFamily: type.displayItalic, color: color.copper },

  group: { marginTop: space.section },
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.x8 },
  residencyTag: { fontFamily: type.uiSemiBold, fontSize: 9, letterSpacing: 0.8, color: color.dim },

  tile: { paddingHorizontal: space.x16, borderRadius: radius.tile, backgroundColor: color.tile },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.x12, paddingVertical: space.x12, minHeight: 52 },
  method: { fontFamily: type.uiSemiBold, fontSize: type.size.body, color: color.bone },
  dates: { fontFamily: type.ui, fontSize: 13, color: color.muted, marginTop: 2 },
  right: { fontFamily: type.ui, fontSize: 12.5 },

  bag: { marginTop: space.section, paddingVertical: space.x16 },

  provenance: { marginTop: space.x38, gap: space.x12 },
  footLink: { fontFamily: type.uiMedium, fontSize: 13.5, color: color.copper },
  reportBtn: { alignItems: 'center', paddingVertical: space.x8 },
});
