import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlmanacCol, almanacStyles } from '@/components/AlmanacRow';
import { LightRow, NextOpener, OpenerRow, type PromiseState } from '@/components/NextOpener';
import { Micro, Monogram, Sentence, Serif } from '@/components/system';
import { armedFor, openerOffsetsFor, useAlertPreferences } from '@/features/alerts/queries';
import { firingsFor } from '@/features/alerts/promise';
import { dayAndDate } from '@/lib/date';
import { PageTitle, SpeciesBadge } from '@/components/midnight';
import { NotificationsOffBanner } from '@/components/NotificationsOffBanner';
import { ProUpsellCard } from '@/components/ProUpsellCard';
import { useAuth } from '@/providers/AuthProvider';
import { nextPermitSegment, useFollows, usePermitFollows } from '@/features/follows/queries';
import { useLegalLight } from '@/features/legalLight/useLegalLight';
import { useDawnConditions } from '@/features/weather/useDawnConditions';
import { openExternalUrl } from '@/lib/openUrl';
import { useActiveStates, useSeasonsFeed, useSpecies, useUpcomingCountdown, useWeekendStateOpeners, useWindowsFeed } from '@/features/reference/queries';
import type { SeasonWithRefs } from '@/features/reference/types';
import { queryClient } from '@/lib/queryClient';
import { maybeRequestReview } from '@/lib/rateApp';
import { pushWidgetEvent, pushWidgetLight } from '@/lib/widget';
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

function methodLabel(method: string): string {
  return method.charAt(0).toUpperCase() + method.slice(1);
}

/**
 * "Youth, Military & Veterans Days · Sat 14 Nov · Statewide" — what this
 * opener is, when it lands, and where. The season's own label wins when it has
 * one; otherwise the method names it.
 */
function openerDetail(s: SeasonWithRefs, withZone: boolean): string {
  const what = (s.label ?? '').trim() || methodLabel(s.method);
  const zone = withZone ? (s.zone?.name ?? null) : null;
  return [what, dayAndDate(s.open_date), zone].filter(Boolean).join(' · ');
}

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
  const { profile, isGuest } = useAuth();
  const { data: follows = [], isError: followsError } = useFollows();
  const { data: permitFollows = [] } = usePermitFollows();
  // Follows when there are any, otherwise the state being browsed -- so the
  // stat tiles, the weekend brief and the daily outlook all have something to
  // say to someone who hasn't made an account yet.
  const { data: seasons, isLoading, browsing, stateCode: browseCode } = useSeasonsFeed();
  const { data: allSpecies = [] } = useSpecies();
  const { data: states = [] } = useActiveStates();
  const { data: windows } = useWindowsFeed();
  const { items } = useUpcomingCountdown(); // widget only
  const [refreshing, setRefreshing] = useState(false);
  const now = new Date();
  const iso = todayISO();

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

  const trackedStates = [...new Set(follows.map((f) => stateCode.get(f.state_id)).filter(Boolean))];
  // Which state's sky this screen is talking about: the one you said you live
  // in, else the first you follow, else the one you're browsing. The last of
  // those is what gives a guest a legal-light time on their first screen.
  const homeStateCode =
    states.find((s) => s.id === profile?.resident_state_id)?.code ?? trackedStates[0] ?? browseCode ?? null;
  const browseStateId = browseCode ? states.find((s) => s.code === browseCode)?.id : undefined;
  const trackedStateIdList = [
    ...new Set([
      ...follows.map((f) => f.state_id),
      ...(profile?.resident_state_id ? [profile.resident_state_id] : []),
      ...(browseStateId ? [browseStateId] : []),
    ]),
  ];
  const followedPairs = new Set(follows.map((f) => `${f.state_id}|${f.species_id}`));
  const hasFollows = follows.length > 0;
  const browseName = browsing && browseCode ? (states.find((s) => s.code === browseCode)?.name ?? browseCode) : null;
  const locationLabel =
    browseName ??
    (!hasFollows
      ? 'Add your hunts'
      : trackedStates.length === 1
        ? (states.find((s) => s.code === trackedStates[0])?.name ?? trackedStates[0]!)
        : `${trackedStates.length} states`);

  // ---- The next opener, and whether we have promised to say so ------------
  // The top of this screen answers one question now: what opens next, and
  // will my phone tell me before it does? (David, 2026-11-08 — "amplify the
  // main thing the app does".) Today counts as an opener: "Ducks open today."
  const { data: alertPrefs = [], isLoading: prefsLoading } = useAlertPreferences();
  const upcoming = useMemo(
    () =>
      seasons
        .filter((s) => s.open_date && s.open_date >= iso)
        .sort((a, b) => a.open_date!.localeCompare(b.open_date!)),
    [seasons, iso],
  );
  const nextOpener = upcoming[0] ?? null;
  const laterOpeners = upcoming.slice(1);
  const light = useLegalLight(homeStateCode, 0);

  const promise = useMemo<PromiseState>(() => {
    if (!nextOpener) return { kind: 'loading' };
    if (isGuest) return { kind: 'guest' };
    if (prefsLoading) return { kind: 'loading' };
    const followed = follows.some(
      (f) => f.state_id === nextOpener.state_id && f.species_id === nextOpener.species_id,
    );
    if (!followed) return { kind: 'unfollowed' };
    if (!armedFor(alertPrefs, nextOpener.state_id, nextOpener.species_id, nextOpener.method)) {
      return { kind: 'unarmed' };
    }
    const firings = firingsFor(
      nextOpener.open_date!,
      openerOffsetsFor(alertPrefs, nextOpener.state_id, nextOpener.species_id),
    );
    return firings.length > 0 ? { kind: 'armed', firings } : { kind: 'spent' };
  }, [nextOpener, isGuest, prefsLoading, follows, alertPrefs]);

  useEffect(() => {
    pushWidgetEvent(items[0]);
  }, [items[0]?.id, items[0]?.date, items[0]?.kind]);

  // Feed the Legal Light widget a week of windows whenever Home has a state.
  useEffect(() => {
    pushWidgetLight(homeStateCode);
  }, [homeStateCode]);

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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={lang.color.copper} />}
      >
        {/* The mark holds the corner the "Open season." masthead used to hold.
            The chip drops its own copper dot — two copper dots an inch apart
            read as a stutter, and the monogram's is the one that means
            something. */}
        <View style={styles.topRow}>
          <Monogram size={23} />
          <Pressable style={styles.locChip} onPress={() => router.push(browsing ? '/pick-state' : '/follows')}>
            <Text style={styles.chipText} numberOfLines={1}>
              {locationLabel}
            </Text>
            <Ionicons name="chevron-down" size={11} color={lang.color.muted} />
          </Pressable>
          <Pressable onPress={() => router.push('/search')} hitSlop={10} style={styles.bellBtn} accessibilityRole="button" accessibilityLabel="Search">
            <Ionicons name="search" size={19} color={lang.color.muted} />
          </Pressable>
        </View>

        {/* The next opener, and the promise to say so before it lands. This is
            the hero now: legal light used to own the space and the reminder was
            a switch buried two screens down (David, 2026-11-08). Light reads as
            one line further down, and the full picture of today lives on the
            outlook page. */}
        {nextOpener ? (
          <View style={styles.heroBlock}>
            <NextOpener
              speciesName={nextOpener.species?.name ?? 'The next season'}
              detail={openerDetail(nextOpener, true)}
              days={diffDays(iso, nextOpener.open_date!)}
              stateLabel={nextOpener.state?.name ?? nextOpener.state?.code ?? null}
              promise={promise}
              onOpenSeason={() => router.push({ pathname: '/season/[id]', params: { id: nextOpener.id } })}
              onSeeNotices={() => router.push('/what-arrives')}
              onSignIn={() => router.push('/(auth)/sign-in')}
              onChangeTiming={() => router.push('/alerts')}
            />
          </View>
        ) : (
          /* Nothing ahead in these states — the masthead carries the screen. */
          <View style={styles.heroBlock}>
            <PageTitle lead={'Open\n'} accent="season." style={styles.hero} />
            <Micro style={styles.dateLine}>
              {`${WEEKDAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`}
            </Micro>
          </View>
        )}

        {/* Directly under the promise, because an unarmed phone makes a liar
            of everything above it. */}
        <View style={{ marginTop: lang.space.gutter }}>
          <NotificationsOffBanner />
        </View>

        {laterOpeners.length > 0 ? (
          <View style={styles.openerSection}>
            <View style={styles.openerHead}>
              <Micro>
                {laterOpeners.length === 1 ? '1 more opener ahead' : `${laterOpeners.length} more openers ahead`}
              </Micro>
              <Micro>Bell = armed</Micro>
            </View>
            {laterOpeners.slice(0, 4).map((s, i, shown) => (
              <OpenerRow
                key={s.id}
                speciesName={s.species?.name ?? 'Season'}
                detail={openerDetail(s, false)}
                days={diffDays(iso, s.open_date!)}
                armed={armedFor(alertPrefs, s.state_id, s.species_id, s.method)}
                last={i === shown.length - 1}
                onPress={() => router.push({ pathname: '/season/[id]', params: { id: s.id } })}
              />
            ))}
          </View>
        ) : null}

        {/* Legal light, demoted to a line — the outlook page tells the rest. */}
        {light && homeStateCode ? (
          <LightRow
            window={light.window}
            durationMin={light.durationMin}
            approx={light.approx}
            onPress={() => router.push({ pathname: '/outlook', params: { state: homeStateCode } })}
          />
        ) : null}

        <WeekendBriefCard
          seasons={seasons}
          windows={windows}
          stateCode={homeStateCode}
          stateIds={trackedStateIdList}
          followedPairs={followedPairs}
          onPress={() => router.push('/calendar')}
        />

        <ProUpsellCard />

        {permitFollows.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionRule} />
            <Micro>Permit hunts</Micro>
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
                    <Ionicons name="ribbon-outline" size={16} color={lang.color.dim} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {f.hunt!.name}
                    </Text>
                    <Text style={styles.rowSub} numberOfLines={1}>
                      {[f.hunt!.agency, f.hunt!.state_code].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  {(() => {
                    const seg = nextPermitSegment(f.hunt, iso);
                    if (!seg || seg.open_date <= iso) return null;
                    return (
                      <Text style={[styles.rowMetric, { color: lang.color.copperDim }]}>
                        in {diffDays(iso, seg.open_date)}d
                      </Text>
                    );
                  })()}
                  <Ionicons name="open-outline" size={12} color={lang.color.dim} />
                </Pressable>
              ))}
          </View>
        ) : null}

        {/* What you follow ends the page (David, 2026-09-07) — managing it
            lives on Profile now. */}
        {isLoading ? null : followsError && !hasFollows ? (
          /* A failed fetch must never dress up as a fresh account — that
             looked like a wiped app on a Sunday morning (2026-09-06). */
          <Pressable onPress={() => queryClient.invalidateQueries()} style={styles.emptyBlock}>
            <View style={styles.sectionRule} />
            <Serif size={27}>Couldn't reach camp.</Serif>
            <Sentence>Your hunts are safe — the connection hiccuped. Tap to try again.</Sentence>
          </Pressable>
        ) : !hasFollows ? (
          isGuest ? (
            /* A guest has nothing to follow -- there is no account to hang a
               follow on yet. So ask for the account, and be honest about what
               it is for: the dates stay free either way. */
            <Pressable onPress={() => router.push('/(auth)/sign-in')} style={styles.emptyBlock}>
              <View style={styles.sectionRule} />
              <Serif size={27}>Make it yours</Serif>
              <Sentence>
                Reading dates is free, and stays free. Create an account to follow the species you
                hunt and get told before each opener.
              </Sentence>
            </Pressable>
          ) : (
            <Pressable onPress={() => router.push('/follows')} style={styles.emptyBlock}>
              <View style={styles.sectionRule} />
              <Serif size={27}>Choose your quarry</Serif>
              <Sentence>
                Add states and the species you hunt to start tracking seasons and tag deadlines.
              </Sentence>
            </Pressable>
          )
        ) : (
          <View style={styles.section}>
            <View style={styles.sectionRule} />
            <Micro>Your species</Micro>
            {roster.map((r, i) => (
              <RosterRow key={r.speciesId} item={r} divider={i > 0} onPress={() => router.push({ pathname: '/species/[id]', params: { id: r.speciesId } })} />
            ))}
          </View>
        )}
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
  stateIds,
  followedPairs,
  onPress,
}: {
  seasons: SeasonWithRefs[];
  windows: { closes_at: string | null; species?: { name: string } | null; state?: { code: string; name?: string } | null }[];
  stateCode: string | null;
  stateIds: string[];
  followedPairs: Set<string>;
  onPress: () => void;
}) {
  const now = new Date();
  const dow = now.getDay(); // 5 Fri, 6 Sat, 0 Sun
  const iso = todayISO();
  const isWeekend = dow === 5 || dow === 6 || dow === 0;

  const addDays = (base: string, n: number) => {
    const [y, m, d] = base.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + n));
    return dt.toISOString().slice(0, 10);
  };
  const sunday = addDays(iso, dow === 5 ? 2 : dow === 6 ? 1 : 0);

  // Tomorrow's light and dawn conditions — the morning the brief is planning
  // for, not the one already underway when the brief lands. Discovery mirrors
  // the push: openers in your states this weekend, followed or not.
  const light = useLegalLight(stateCode, 1);
  const dawn = useDawnConditions(stateCode, 1);
  const { data: stateOpeners = [] } = useWeekendStateOpeners(isWeekend ? stateIds : [], iso, sunday);
  if (!isWeekend) return null;
  const dayLabel = (dateISO: string) => {
    const diff = diffDays(iso, dateISO);
    if (diff === 0) return 'today';
    if (diff === 1) return 'tomorrow';
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(dateISO + 'T12:00:00Z').getUTCDay()];
  };

  // "Geese open", "Deer opens" — plural species names take the plural verb.
  const PLURAL_SPECIES = new Set(['Geese', 'Ducks']);
  const verb = (name: string | null | undefined, base: string) => (PLURAL_SPECIES.has(name ?? '') ? base : `${base}s`);

  // One sentence per fact: two seasons of the same species opening the same
  // day in the same state ("Archery" + "Extended Archery") must not say
  // "Deer opens tomorrow in Georgia." twice (David's screenshot, 2026-09-11).
  const lines: { priority: number; d: string; text: string }[] = [];
  const seen = new Set<string>();
  const add = (l: { priority: number; d: string; text: string }) => {
    if (seen.has(l.text)) return;
    seen.add(l.text);
    lines.push(l);
  };
  for (const s of seasons) {
    if (!s.open_date) continue;
    if (s.open_date >= iso && s.open_date <= sunday) {
      add({ priority: 1, d: s.open_date, text: `${s.species?.name} ${verb(s.species?.name, 'open')} ${dayLabel(s.open_date)} in ${s.state?.name ?? s.state?.code}.` });
    } else if (s.close_date && s.open_date <= iso && s.close_date >= iso && s.close_date <= sunday) {
      add({ priority: 2, d: s.close_date, text: `${s.species?.name} ${verb(s.species?.name, 'close')} ${dayLabel(s.close_date)} in ${s.state?.name ?? s.state?.code} — the last days.` });
    }
  }
  for (const w of windows) {
    if (w.closes_at && w.closes_at >= iso && w.closes_at <= addDays(iso, 7)) {
      add({
        priority: 3,
        d: w.closes_at,
        text: `The ${w.state?.name ?? w.state?.code} ${(w.species?.name ?? '').toLowerCase()} draw closes ${dayLabel(w.closes_at)}.`,
      });
    }
  }
  // Discovery: weekend openers in your states for species you don't follow.
  for (const s of stateOpeners) {
    if (!s.open_date || !s.state_id || !s.species_id) continue;
    if (followedPairs.has(`${s.state_id}|${s.species_id}`)) continue;
    add({
      priority: 4,
      d: s.open_date,
      text: `${s.species?.name} ${verb(s.species?.name, 'open')} ${dayLabel(s.open_date)} in ${s.state?.name ?? s.state?.code}.`,
    });
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
    <Pressable onPress={onPress} style={({ pressed }) => [styles.section, pressed && styles.pressed]}>
      <View style={styles.sectionRule} />
      <View style={styles.sectionHead}>
        <Micro style={{ color: lang.color.copperDim }}>The weekend brief</Micro>
        <Micro>{range}</Micro>
      </View>
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
      {dawn ? (
        <>
          <View style={styles.hairRule} />
          <Text style={almanacStyles.head}>
            {dawn.dayName.toUpperCase()} DAWN{dawn.approx ? ' · ≈' : ''}
          </Text>
          <View style={almanacStyles.row}>
            {dawn.tempF != null ? (
              <AlmanacCol value={`${dawn.tempF}°`} label={(dawn.sky ?? 'temp').toUpperCase()} first />
            ) : null}
            {dawn.windDir && dawn.windMph != null ? (
              <AlmanacCol value={`${dawn.windDir} ${dawn.windMph}`} label="WIND · MPH" first={dawn.tempF == null} />
            ) : null}
            {dawn.pressureInHg != null ? (
              <AlmanacCol
                value={dawn.pressureInHg.toFixed(1)}
                label={dawn.pressureTrend ? `PRESSURE · ${dawn.pressureTrend.toUpperCase()}` : 'PRESSURE'}
                trend={dawn.pressureTrend}
                first={false}
              />
            ) : null}
            <AlmanacCol value={`${dawn.moonPct}%`} label={`MOON · ${dawn.moonWaxing ? 'WAXING' : 'WANING'}`} first={false} />
          </View>
          {dawn.frontLine ? <Text style={styles.briefLight}>{dawn.frontLine}</Text> : null}
        </>
      ) : null}
    </Pressable>
  );
}

function RosterRow({ item, divider, onPress }: { item: RosterItem; divider: boolean; onPress: () => void }) {
  const right = item.state === 'open' ? 'Open' : item.state === 'upcoming' ? `in ${Math.max(item.days ?? 0, 0)}d` : 'No dates yet';
  const rightColor = item.state === 'open' ? lang.color.copper : item.state === 'upcoming' ? lang.color.copperDim : lang.color.dim;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, divider && styles.rowDivider, pressed && styles.pressed]}>
      <SpeciesBadge name={item.name} size={34} muted={item.state !== 'open'} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {item.codes.length === 0
            ? 'Tracked'
            : item.codes.length <= 3
              ? item.codes.join(' · ')
              : `${item.codes.length} states`}
        </Text>
      </View>
      <Text style={[styles.rowMetric, { color: rightColor }]}>{right}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lang.color.bg },
  content: { paddingHorizontal: lang.space.gutter, paddingTop: lang.space.x16, paddingBottom: 56 },

  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  locChip: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, minHeight: 44 },
  chipText: { fontFamily: lang.type.uiMedium, fontSize: 13, color: lang.color.muted },
  bellBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  heroBlock: { marginTop: lang.space.section },
  hero: { fontSize: 62, lineHeight: 70, paddingTop: 4 },
  dateLine: { marginTop: lang.space.x16 },

  // The openers beneath the hero: a plain hairline list, no card. The bell is
  // the only ornament it needs.
  openerSection: { marginTop: lang.space.section },
  openerHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: lang.space.x12,
    marginBottom: lang.space.x4,
  },

  // Every section below the hero is the same object: a copper rule that bleeds
  // to both edges, a micro label naming what follows, then entries separated
  // by hairlines. No surfaces, no radii, no borders -- the flat cards with the
  // copper spine were the last of the Midnight language on this screen
  // (David, 2026-11-08: "I thought the color was going to change, the layout").
  section: { marginTop: lang.space.section },
  sectionRule: {
    height: 1,
    backgroundColor: lang.color.rule,
    marginHorizontal: -lang.space.gutter,
    marginBottom: lang.space.x12,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: lang.space.x12,
  },
  hairRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: lang.color.hair,
    marginTop: lang.space.x16,
    marginRight: -lang.space.gutter,
  },

  // The brief's sentences are the one place the italic serif runs at length --
  // it is the app's own voice, so it is set as prose, not as card copy.
  briefLine: {
    fontFamily: lang.type.displayItalic,
    fontSize: 19.5,
    lineHeight: 28,
    color: lang.color.bone,
    marginTop: lang.space.x12,
  },
  briefLight: { fontFamily: lang.type.ui, fontSize: 13, lineHeight: 19, color: lang.color.muted, marginTop: lang.space.x12 },

  emptyBlock: { marginTop: lang.space.section, gap: lang.space.x8 },

  row: { flexDirection: 'row', alignItems: 'center', gap: lang.space.x12, paddingVertical: lang.space.x16 },
  rowTitle: { fontFamily: lang.type.uiMedium, fontSize: 15.5, color: lang.color.bone },
  rowSub: { fontFamily: lang.type.ui, fontSize: 12.5, color: lang.color.muted, marginTop: 1 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: lang.color.hair },
  rowMetric: {
    fontFamily: lang.type.uiMedium,
    fontSize: 12.5,
    marginLeft: lang.space.x12,
    fontVariant: ['tabular-nums'],
  },
  // The ribbon sits in the text column's own margin -- a 40pt tile with its
  // own border was a card inside a list.
  permitTile: { width: 28, alignItems: 'center' },

  pressed: { opacity: 0.6 },
});
