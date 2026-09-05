import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinkSentence, Micro, Pill, Screen, Sentence, Serif, SunArc } from '@/components/system';
import { Disclaimer } from '@/components/Provenance';
import { ActionRow, LicenseRow } from '@/components/LicenseRow';
import { useAuth } from '@/providers/AuthProvider';
import { useFollowedSeasons, useSeasonById } from '@/features/reference/queries';
import type { SeasonWithRefs } from '@/features/reference/types';
import { useMethodReminder } from '@/features/follows/queries';
import { useCreateParty, useMyParties } from '@/features/parties/queries';
import { useLegalLight } from '@/features/legalLight/useLegalLight';
import { useRequirePro } from '@/hooks/useRequirePro';
import { addToCalendar } from '@/lib/calendar';
import { daysUntil, formatDateRange, isOpenNow } from '@/lib/date';
import { openExternalUrl } from '@/lib/openUrl';
import { supabase } from '@/lib/supabase';
import { lang } from '@/theme/tokens';

const { color, space, type } = lang;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function spoken(dateISO: string): { weekday: string; date: string } {
  const [y, m, d] = dateISO.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return { weekday: WEEKDAYS[dt.getDay()], date: `${MONTHS[m - 1]} ${d}` };
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Pager wrapper (David's swipe idea, approved 2026-09-06): when the season you
 * opened belongs to a followed hunt, the screen becomes horizontally pageable
 * across ALL your followed hunts — one page per (state, species) follow,
 * showing its current-or-next season, ordered open-first like Home. Copper
 * dots signal position; an unfollowed season stays a single page. Precedent:
 * Apple Weather's city paging, Flighty's flight paging.
 */
export default function SeasonDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const { data: followedSeasons = [] } = useFollowedSeasons();
  const [pageIndex, setPageIndex] = useState(0);

  // One representative season per followed pair: open now, else soonest
  // upcoming, else the most recent. The tapped season stands in for its pair.
  const pages = useMemo(() => {
    const iso = new Date().toISOString().slice(0, 10);
    const byPair = new Map<string, SeasonWithRefs[]>();
    for (const s of followedSeasons) {
      const k = `${s.state_id}|${s.species_id}`;
      const arr = byPair.get(k) ?? [];
      arr.push(s);
      byPair.set(k, arr);
    }
    const reps: { key: string; seasonId: string; openNow: boolean; nextOpen: string }[] = [];
    for (const [key, arr] of byPair) {
      const open = arr.find((s) => s.open_date && s.close_date && s.open_date <= iso && iso <= s.close_date);
      const upcoming = arr
        .filter((s) => s.open_date && s.open_date > iso)
        .sort((a, b) => (a.open_date! < b.open_date! ? -1 : 1))[0];
      const rep = open ?? upcoming ?? arr[0];
      if (!rep) continue;
      reps.push({ key, seasonId: rep.id, openNow: Boolean(open), nextOpen: rep.open_date ?? '9999' });
    }
    reps.sort((a, b) => Number(b.openNow) - Number(a.openNow) || a.nextOpen.localeCompare(b.nextOpen));
    // The tapped season replaces its pair's representative, wherever it sits.
    const tapped = followedSeasons.find((s) => s.id === id);
    if (!tapped) return null; // not followed — no pager
    const idx = reps.findIndex((r) => r.key === `${tapped.state_id}|${tapped.species_id}`);
    if (idx === -1) return null;
    reps[idx] = { ...reps[idx], seasonId: id! };
    return reps;
  }, [followedSeasons, id]);

  const startIndex = useMemo(() => Math.max(0, (pages ?? []).findIndex((p) => p.seasonId === id)), [pages, id]);
  useEffect(() => setPageIndex(startIndex), [startIndex]);

  if (!pages || pages.length <= 1) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg }}>
        <Stack.Screen options={{ headerShown: true, title: '' }} />
        <SeasonPageBody id={id} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <Stack.Screen options={{ headerShown: true, title: '' }} />
      <FlatList
        data={pages}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(p) => p.key}
        initialScrollIndex={startIndex}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(e) => setPageIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <View style={{ width }}>
            <SeasonPageBody id={item.seasonId} />
          </View>
        )}
      />
      <View style={styles.dots} pointerEvents="none">
        {pages.map((p, i) => (
          <View key={p.key} style={[styles.dot, i === pageIndex && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

/** One hunt's page — the field-journal season detail, unchanged. */
function SeasonPageBody({ id }: { id: string | undefined }) {
  const router = useRouter();
  const { data: season, isLoading } = useSeasonById(id);
  const { profile } = useAuth();
  const requirePro = useRequirePro();
  const { width } = useWindowDimensions();

  const stateId = season?.state?.id ?? season?.state_id;
  const speciesId = season?.species?.id ?? season?.species_id;
  const reminder = useMethodReminder(stateId, speciesId);
  const { data: myParties = [] } = useMyParties();
  const createParty = useCreateParty();
  const myParty = myParties.find((p) => p.season_id === id);

  function onParty() {
    if (myParty) {
      router.push({ pathname: '/party/[id]', params: { id: myParty.id } });
      return;
    }
    if (!requirePro()) return;
    createParty.mutate(
      { seasonId: id! },
      {
        onSuccess: ({ party_id }) => router.push({ pathname: '/party/[id]', params: { id: party_id } }),
        onError: (e) =>
          Alert.alert('Could not start a party', e instanceof Error && e.message ? e.message : 'Please try again in a moment.'),
      },
    );
  }

  // Every method this (state, species) pair hunts — needed when un-arming from
  // the legacy "all methods" state.
  const { data: allMethods = [] } = useQuery({
    queryKey: ['season-methods', stateId, speciesId],
    enabled: Boolean(stateId && speciesId),
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('seasons')
        .select('method')
        .eq('state_id', stateId!)
        .eq('species_id', speciesId!)
        .eq('status', 'published');
      if (error) throw error;
      return [...new Set((data ?? []).map((r: { method: string }) => r.method))];
    },
  });

  const open = season ? isOpenNow(season.open_date, season.close_date) : false;
  const days = season?.open_date ? daysUntil(season.open_date) : null;
  const light = useLegalLight(season?.state?.code, open ? 0 : Math.max(days ?? 0, 0));

  if (isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={color.copper} style={{ marginTop: space.x38 }} />
      </Screen>
    );
  }
  if (!season) {
    return (
      <Screen>
        <Sentence tone="bone" style={{ marginTop: space.section }}>
          Season not found.
        </Sentence>
      </Screen>
    );
  }

  const title = season.label ?? cap(season.method);
  const armed = reminder.isArmed(season.method);
  const residency =
    profile?.resident_state_id && stateId ? (profile.resident_state_id === stateId ? 'resident' : 'nonresident') : null;

  // The hero sentence: what this hunt is, in one breath.
  const zonePart = season.zone?.name && season.zone.name !== 'Statewide' ? `${season.zone.name}, ` : '';
  const heroSentence = `${title} — ${zonePart}${season.state?.name ?? ''}.${residency ? ` ${cap(residency)} rules apply to you.` : ''}`;

  // Fraction of the 24-hour day for a timestamp, in local time — drives the
  // lit window and the sun's position on the day-path.
  const dayFrac = (ms: number) => {
    const d = new Date(ms);
    return (d.getHours() * 60 + d.getMinutes()) / 1440;
  };

  // The rule, spoken. 30/30 is the common case; the outliers get their words.
  const lightPhrase = light
    ? light.before === 30 && light.after === 30
      ? 'half an hour past each edge of the sun'
      : light.before === 0 && light.after === 0
        ? 'sunrise to sunset, exactly'
        : light.before === 60 && light.after === 60
          ? 'a full hour past each edge of the sun'
          : light.after === 0
            ? `${light.before} minutes before sunrise, ending at sunset`
            : `${light.before} minutes before sunrise to ${light.after} after sunset`
    : '';

  function onNotify() {
    if (!requirePro()) return;
    reminder.toggle.mutate({ method: season!.method, allMethods });
  }

  function onCalendar() {
    if (!season?.open_date) return;
    addToCalendar({
      title: `${season.state?.code ?? ''} ${season.species?.name ?? ''} — ${title} opener`.trim(),
      date: season.open_date,
      notes: season.bag_limit_summary ?? undefined,
      url: season.state?.license_url ?? undefined,
    });
  }

  // Screen gutters plus the tile's own padding on each side.
  const arcWidth = width - space.gutter * 4;
  const durH = light ? Math.floor(light.durationMin / 60) : 0;
  const durM = light ? light.durationMin % 60 : 0;

  return (
    <Screen scroll>
      {/* The cascade: species first, then the hunt, then its dates, then its light. */}
      <Serif size={type.size.hero} style={{ marginTop: space.x16, lineHeight: type.size.hero + 6 }}>
        {season.species?.name ?? cap(season.method)}
      </Serif>
      <Sentence style={{ marginTop: space.x8 }}>{heroSentence}</Sentence>

      {/* THE SEASON — the facts of the hunt in one tile: dates, countdown,
          and the bag limit together (David's reflow, 2026-08-29). */}
      <View style={styles.tile}>
        <Micro>The season</Micro>
        <Serif size={30} style={{ marginTop: space.x12 }}>
          {formatDateRange(season.open_date, season.close_date)}
        </Serif>
        <Sentence style={{ marginTop: space.x8 }}>
          {open && season.close_date ? (
            <>
              <Serif italic copper size={20}>
                Open now
              </Serif>
              {` — closes ${spoken(season.close_date).weekday}, ${spoken(season.close_date).date}.`}
            </>
          ) : days !== null && days >= 0 && season.open_date ? (
            <>
              {'Opens in '}
              <Serif italic copper size={20}>
                {days} {days === 1 ? 'day' : 'days'}
              </Serif>
              {` — ${spoken(season.open_date).weekday}, ${spoken(season.open_date).date}.`}
            </>
          ) : (
            'Closed for the year.'
          )}
        </Sentence>
        {season.bag_limit_summary ? (
          <Sentence style={{ marginTop: space.x12 }}>{season.bag_limit_summary}</Sentence>
        ) : null}
        {season.notes ? (
          <Sentence style={{ marginTop: season.bag_limit_summary ? space.x8 : space.x12 }}>{season.notes}</Sentence>
        ) : null}
        {!season.bag_limit_summary && !season.notes ? (
          <Sentence style={{ marginTop: space.x12 }}>No bag limit on file. Check the state regs.</Sentence>
        ) : null}
      </View>

      {/* OPENING DAY / TODAY — the light gets its own tile, times first. */}
      {light ? (
        <View style={styles.tile}>
          <Micro>{open ? 'Today' : 'Opening day'}</Micro>
          <Serif size={28} style={{ marginTop: space.x12 }}>
            {light.approx ? '≈ ' : ''}
            {light.startClock} – {light.endClock}
          </Serif>
          <Sentence style={{ marginTop: space.x8 }}>
            {'Legal light — '}
            <Serif italic size={19}>
              {durH}h {String(durM).padStart(2, '0')}m
            </Serif>
            {`, ${lightPhrase}.`}
          </Sentence>
          <View style={{ marginTop: space.x12 }}>
            <SunArc
              width={arcWidth}
              startFrac={dayFrac(light.startMs)}
              endFrac={dayFrac(light.endMs)}
              nowFrac={dayFrac(Date.now())}
            />
            <View style={styles.tickRow}>
              <Micro style={{ position: 'absolute', left: Math.max(0, dayFrac(light.startMs) * arcWidth - 34) }}>
                First light
              </Micro>
              <Micro style={{ position: 'absolute', left: Math.min(arcWidth - 86, dayFrac(light.endMs) * arcWidth - 34) }}>
                Last light
              </Micro>
            </View>
          </View>
          {light.note ? (
            <Sentence tone="dim" style={{ marginTop: space.x8, fontSize: 13 }}>
              {light.note}
            </Sentence>
          ) : null}
          {season.open_date && season.close_date && season.state?.code ? (
            <LinkSentence
              style={{ marginTop: space.x12 }}
              onPress={() =>
                router.push({
                  pathname: '/shooting-hours',
                  params: {
                    state: season.state!.code,
                    title: `${season.species?.name ?? ''}, ${title.toLowerCase()} — ${season.state?.name ?? ''}`,
                    open: season.open_date!,
                    close: season.close_date!,
                  },
                })
              }
            >
              Shooting hours for every day.
            </LinkSentence>
          ) : null}
        </View>
      ) : null}

      {/* Provenance stays bare — a footnote beneath the tiles, not another object. */}
      {season.last_verified_at ? (
        season.source?.url ? (
          <LinkSentence size={13} style={{ marginTop: space.x16 }} onPress={() => openExternalUrl(season.source!.url)}>
            Verified against {season.source?.agency_name ?? season.state?.name ?? 'the state agency'},{' '}
            {spoken(season.last_verified_at.slice(0, 10)).date}.
          </LinkSentence>
        ) : (
          <Sentence tone="dim" style={{ marginTop: space.x16, fontSize: 13 }}>
            Verified against {season.source?.agency_name ?? season.state?.name ?? 'the state agency'},{' '}
            {spoken(season.last_verified_at.slice(0, 10)).date}.
          </Sentence>
        )
      ) : null}

      <View style={{ height: space.section }} />

      {/* The caveat sits directly above the action it qualifies. */}
      {armed ? (
        <Sentence tone="dim" style={{ marginBottom: space.x16, fontSize: 13 }}>
          You'll get a reminder before the opener. Change the timing in Profile.
        </Sentence>
      ) : null}
      <View style={styles.actions}>
        <Pill
          label={armed ? 'Notifying you ✓' : 'Notify me'}
          variant={armed ? 'secondary' : 'primary'}
          onPress={onNotify}
          disabled={reminder.toggle.isPending}
          style={{ flex: 1.4 }}
        />
        <Pill label="Add to calendar" variant="secondary" onPress={onCalendar} style={{ flex: 1 }} />
      </View>

      {/* Parties aren't just for draws — the deer camp needs a roster too. */}
      <ActionRow
        icon="people-outline"
        title={myParty ? 'View your hunting party.' : 'Hunt this season with your party.'}
        sub={myParty ? 'Your camp roster and invite code.' : 'One link invites your buddies — everyone gets the reminders.'}
        onPress={onParty}
      />

      <LicenseRow stateName={season.state?.name} url={season.state?.license_url} />

      {/* The last word on the page — the standing trust-trio disclaimer. */}
      <View style={{ marginTop: space.section }}>
        <Disclaimer />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Translucent chapter tile — a wash of light over the page, not a solid card.
  tile: {
    marginTop: space.x16,
    padding: space.gutter,
    borderRadius: lang.radius.card,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hair,
  },
  tickRow: { height: 16, marginTop: 2 },
  actions: { flexDirection: 'row', gap: space.x12 },
  dots: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)' },
  dotActive: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.copper },
});
