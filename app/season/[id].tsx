import { Stack, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Micro, Pill, Screen, Sentence, Serif, SunArc } from '@/components/system';
import { Disclaimer } from '@/components/Provenance';
import { LicenseRow } from '@/components/LicenseRow';
import { useAuth } from '@/providers/AuthProvider';
import { useSeasonById } from '@/features/reference/queries';
import { useMethodReminder } from '@/features/follows/queries';
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

/** The reference implementation of the field-journal language. */
export default function SeasonDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: season, isLoading } = useSeasonById(id);
  const { profile } = useAuth();
  const requirePro = useRequirePro();
  const { width } = useWindowDimensions();

  const stateId = season?.state?.id ?? season?.state_id;
  const speciesId = season?.species?.id ?? season?.species_id;
  const reminder = useMethodReminder(stateId, speciesId);

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
      <Stack.Screen options={{ headerShown: true, title: '' }} />

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
          <Sentence style={{ marginTop: space.x12 }}>No bag limit or notes on file — check the official regulations.</Sentence>
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
        </View>
      ) : null}

      {/* Provenance stays bare — a footnote beneath the tiles, not another object. */}
      {season.last_verified_at ? (
        <Pressable
          onPress={season.source?.url ? () => openExternalUrl(season.source!.url) : undefined}
          disabled={!season.source?.url}
          accessibilityRole={season.source?.url ? 'link' : undefined}
        >
          <Sentence tone="dim" style={{ marginTop: space.x16, fontSize: 13 }}>
            Verified against {season.source?.agency_name ?? season.state?.name ?? 'the state agency'},{' '}
            {spoken(season.last_verified_at.slice(0, 10)).date}.{season.source?.url ? ' ›' : ''}
          </Sentence>
        </Pressable>
      ) : null}

      <View style={{ height: space.section }} />

      {/* The caveat sits directly above the action it qualifies. */}
      {armed ? (
        <Sentence tone="dim" style={{ marginBottom: space.x16, fontSize: 13 }}>
          We'll remind you before the opener — adjust how far ahead in Profile.
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
});
