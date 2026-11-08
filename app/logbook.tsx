import { Stack, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Unreachable } from '@/components/GapNote';
import { Headline, LinkSentence, Pill, Screen, Sentence, Serif, Tile } from '@/components/system';
import { useApplications } from '@/features/applications/queries';
import { useFollows } from '@/features/follows/queries';
import { useSpecies, useActiveStates } from '@/features/reference/queries';
import { keepingSince, logYears, yearSentence, type LogApplication, type LogFollow } from '@/features/logbook/years';
import { lang } from '@/theme/tokens';

const { color, space, type } = lang;

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * The logbook — your hunting years, one tile each.
 *
 * Nothing on this screen is new data; it is everything the app already holds,
 * read back as a record. That is the whole value: a season of tracking is a
 * list, three seasons is a thing you cannot replace by switching apps.
 *
 * Read-only on purpose. A year you can edit is a year you can rewrite, and a
 * logbook that can be rewritten is not a record.
 */
export default function Logbook() {
  const router = useRouter();
  const { data: apps = [], isLoading, isError } = useApplications();
  const { data: follows = [] } = useFollows();
  const { data: states = [] } = useActiveStates();
  const { data: allSpecies = [] } = useSpecies();
  const iso = todayISO();

  const stateName = useMemo(() => new Map(states.map((s) => [s.id, s.name])), [states]);
  const speciesName = useMemo(() => new Map(allSpecies.map((s) => [s.id, s.name])), [allSpecies]);

  const logApps = useMemo<LogApplication[]>(
    () =>
      apps.map((a) => ({
        status: a.status,
        applied_on: a.applied_on,
        results_on: a.results_on,
        fee_summary: a.fee_summary,
        points: a.points,
        created_at: a.created_at,
        stateName: a.state?.name ?? null,
        speciesName: a.species?.name ?? null,
      })),
    [apps],
  );

  const logFollows = useMemo<LogFollow[]>(
    () =>
      follows.map((f) => ({
        created_at: f.created_at,
        stateName: stateName.get(f.state_id) ?? null,
        speciesName: speciesName.get(f.species_id) ?? null,
      })),
    [follows, stateName, speciesName],
  );

  const years = useMemo(() => logYears(logApps), [logApps]);
  const since = useMemo(() => keepingSince(logFollows, logApps, iso), [logFollows, logApps, iso]);

  // What the record adds up to, across every year of it.
  const total = useMemo(() => {
    const drawn = years.reduce((n, y) => n + y.drawn, 0);
    const entered = years.reduce((n, y) => n + y.entered, 0);
    const fees = years.reduce<number | null>(
      (n, y) => (y.fees === null ? n : (n ?? 0) + y.fees),
      null,
    );
    return { drawn, entered, fees };
  }, [years]);

  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: true, title: 'Logbook' }} />

      <Headline style={{ marginTop: space.x16 }}>Your hunting years.</Headline>
      <Sentence style={{ marginTop: space.x8 }}>
        {since
          ? `Everything you've tracked here since ${since}, read back as a record.`
          : 'Everything you track here, read back as a record. It gets better every season.'}
      </Sentence>

      {isLoading ? (
        <ActivityIndicator color={color.copper} style={{ marginTop: space.x38 }} />
      ) : isError ? (
        /* "Nothing in the book yet" is a claim about the reader's own
           record; a failed request is in no position to make it. */
        <Unreachable what="your logbook" style={{ marginTop: space.section }} />
      ) : years.length === 0 ? (
        <>
          <Tile style={{ marginTop: space.section }}>
            <Sentence tone="bone">Nothing in the book yet.</Sentence>
            <Sentence style={{ marginTop: 2 }}>
              Track an application and this fills in behind you — the draws you entered, what they
              cost, and how they went.
            </Sentence>
          </Tile>
          <Pill
            label="Track an application"
            variant="secondary"
            onPress={() => router.push('/application-edit')}
            style={{ marginTop: space.section }}
          />
        </>
      ) : (
        <>
          {/* The record's one number, where the eye lands first. */}
          {total.entered > 0 ? (
            <Tile warm style={styles.total}>
              <View style={styles.totalRow}>
                <Serif size={38} copper>
                  {total.drawn}
                </Serif>
                <Sentence style={{ flex: 1 }}>
                  {total.drawn === 1 ? 'draw come in' : 'draws come in'} out of {total.entered}{' '}
                  entered
                  {total.fees !== null ? `, on $${Math.round(total.fees).toLocaleString()} of fees` : ''}.
                </Sentence>
              </View>
            </Tile>
          ) : null}

          {years.map((y) => (
            <Tile key={y.year} style={{ marginTop: space.x12 }}>
              {/* The year in the display serif: a season year is a date, and
                  dates are what the serif is reserved for. */}
              <Text style={styles.year}>
                {y.year}–{String((y.year + 1) % 100).padStart(2, '0')}
              </Text>
              <Sentence style={{ marginTop: space.x4 }}>{yearSentence(y)}</Sentence>
            </Tile>
          ))}

          <LinkSentence
            size={13.5}
            onPress={() => router.push('/ledger')}
            style={{ marginTop: space.section }}
          >
            See the applications behind these years
          </LinkSentence>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  total: { marginTop: space.section, padding: space.x16 + 2 },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.x12 },
  year: { fontFamily: type.display, fontSize: 30, lineHeight: 36, color: color.bone },
});
