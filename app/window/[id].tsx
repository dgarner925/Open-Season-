import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Pill, Rule, Screen, Sentence, Serif, Thread } from '@/components/system';
import { ProvenanceBlock } from '@/components/Provenance';
import { LicenseRow } from '@/components/LicenseRow';
import { useWindowById } from '@/features/reference/queries';
import { useCreateParty, useMyParties } from '@/features/parties/queries';
import { useReportDate, promptReport } from '@/features/reports/queries';
import { useAuth } from '@/providers/AuthProvider';
import { useRequirePro } from '@/hooks/useRequirePro';
import { addToCalendar } from '@/lib/calendar';
import { daysUntil, formatDate } from '@/lib/date';
import { openExternalUrl } from '@/lib/openUrl';
import { drawTitle } from '@/lib/titles';
import { lang } from '@/theme/tokens';

const { color, space, type } = lang;
const SITE_URL = 'https://osdatesanddraws.com';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function spoken(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${WEEKDAYS[dt.getDay()]}, ${MONTHS[m - 1]} ${d}`;
}

/** The draw-deadline detail — the second Thread screen: opens → deadline → results. */
export default function WindowDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: w, isLoading } = useWindowById(id);
  const { profile } = useAuth();
  const report = useReportDate();
  const { data: myParties = [] } = useMyParties();
  const createParty = useCreateParty();
  const requirePro = useRequirePro();
  const myParty = myParties.find((p) => p.window_id === id);

  function onParty() {
    if (myParty) {
      router.push({ pathname: '/party/[id]', params: { id: myParty.id } });
      return;
    }
    if (!requirePro()) return;
    createParty.mutate(
      { windowId: id! },
      {
        onSuccess: ({ party_id }) => router.push({ pathname: '/party/[id]', params: { id: party_id } }),
        onError: () => Alert.alert('Could not start a party', 'Please try again in a moment.'),
      },
    );
  }

  if (isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={color.copper} style={{ marginTop: space.x38 }} />
      </Screen>
    );
  }
  if (!w) {
    return (
      <Screen>
        <Sentence tone="bone" style={{ marginTop: space.section }}>
          Application window not found.
        </Sentence>
      </Screen>
    );
  }

  const d = daysUntil(w.closes_at);
  const title = drawTitle(w.species?.name, w.name);
  const label = `${w.state?.code ?? ''} ${title}`.trim();
  const residency =
    profile?.resident_state_id && w.state?.id
      ? w.state.id === profile.resident_state_id
        ? 'Resident'
        : 'Nonresident'
      : null;
  const zonePart = w.zone?.name && w.zone.name !== 'Statewide' ? `${w.zone.name}, ` : '';
  const heroSentence = `${zonePart}${w.state?.name ?? ''}.${residency ? ` ${residency} rules apply to you.` : ''}`;

  async function onShare() {
    const when = w!.closes_at ? formatDate(w!.closes_at) : 'soon';
    await Share.share({
      message: `${label} — draw deadline ${when}. Tracking it with Open Season. ${SITE_URL}`,
    }).catch(() => {});
  }

  function onReport() {
    promptReport(
      (detail) =>
        report.mutate(
          { targetTable: 'application_windows', targetId: w!.id, label, detail },
          {
            onSuccess: () => Alert.alert('Thanks', "We'll re-check this against the official source."),
            onError: () => Alert.alert('Could not send', 'Please try again in a moment.'),
          },
        ),
      label,
    );
  }

  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: true, title: '' }} />

      {/* The cascade: the tag, then the window's dates on the thread. */}
      <Serif size={type.size.hero - 10} style={{ marginTop: space.x16, lineHeight: type.size.hero - 4 }}>
        {title}
      </Serif>
      <Sentence style={{ marginTop: space.x8 }}>{heroSentence}</Sentence>

      <View style={styles.threaded}>
        <Thread />

        {w.opens_at ? (
          <Sentence style={{ marginTop: space.x32 }}>The window opened {spoken(w.opens_at)}.</Sentence>
        ) : null}

        {w.closes_at ? (
          <>
            <Serif size={30} style={{ marginTop: w.opens_at ? space.x16 : space.x32 }}>
              {formatDate(w.closes_at)}
            </Serif>
            <Sentence style={{ marginTop: space.x8 }}>
              {d !== null && d >= 0 ? (
                <>
                  {'Applications close in '}
                  <Serif italic copper size={20}>
                    {d} {d === 1 ? 'day' : 'days'}
                  </Serif>
                  {` — ${spoken(w.closes_at)}.`}
                </>
              ) : (
                `This window closed ${spoken(w.closes_at)}.`
              )}
            </Sentence>
          </>
        ) : (
          <Sentence style={{ marginTop: space.x32 }}>The closing date hasn't been posted yet.</Sentence>
        )}

        {w.results_expected_at ? (
          <Sentence style={{ marginTop: space.x16 }}>Results expected {spoken(w.results_expected_at)}.</Sentence>
        ) : null}

        <Rule />

        {w.fee_summary ? <Sentence>{w.fee_summary}</Sentence> : null}
        {w.notes ? <Sentence style={{ marginTop: w.fee_summary ? space.x12 : 0 }}>{w.notes}</Sentence> : null}
        {!w.fee_summary && !w.notes ? <Sentence>No fees or notes on file — check the official source.</Sentence> : null}
      </View>

      <Rule />

      {/* The caveat sits above the action that leaves the app. */}
      {w.application_url ? (
        <Sentence tone="dim" style={{ marginBottom: space.x16, fontSize: 13, paddingLeft: 26 }}>
          The application itself happens on the state's official site.
        </Sentence>
      ) : null}
      <View style={styles.actions}>
        {w.application_url ? (
          <Pill label="Apply on the official site" onPress={() => openExternalUrl(w.application_url)} style={{ flex: 1.4 }} />
        ) : null}
        <Pill
          label={myParty ? 'View your party' : 'Hunt with your party'}
          variant="secondary"
          onPress={onParty}
          disabled={createParty.isPending}
          style={{ flex: 1 }}
        />
      </View>

      <Rule />
      {w.closes_at ? (
        <Pressable
          onPress={() =>
            addToCalendar({
              title: `${label} — draw deadline`,
              date: w.closes_at!,
              notes: w.fee_summary ?? undefined,
              url: w.application_url ?? w.state?.license_url ?? undefined,
            })
          }
          accessibilityRole="button"
        >
          <Sentence>
            Add the deadline to your calendar. <Text style={{ color: color.dim }}>›</Text>
          </Sentence>
        </Pressable>
      ) : null}
      {w.results_expected_at ? (
        <Pressable
          onPress={() => addToCalendar({ title: `${label} — draw results`, date: w.results_expected_at! })}
          accessibilityRole="button"
        >
          <Sentence style={{ marginTop: space.x12 }}>
            Add the results date too. <Text style={{ color: color.dim }}>›</Text>
          </Sentence>
        </Pressable>
      ) : null}
      <Pressable
        onPress={() =>
          router.push({
            pathname: '/application-edit',
            params: {
              title: `${w.state?.name ?? ''} ${title}`.trim(),
              stateId: w.state_id,
              speciesId: w.species_id,
              windowId: w.id,
              ...(w.application_url ? { url: w.application_url } : {}),
            },
          })
        }
        accessibilityRole="button"
      >
        <Sentence style={{ marginTop: space.x12 }}>
          Track this application under Tags. <Text style={{ color: color.dim }}>›</Text>
        </Sentence>
      </Pressable>
      <LicenseRow stateName={w.state?.name} url={w.state?.license_url} />
      <Pressable onPress={onShare} accessibilityRole="button">
        <Sentence style={{ marginTop: space.x12 }}>
          Share this deadline with a buddy. <Text style={{ color: color.dim }}>›</Text>
        </Sentence>
      </Pressable>

      <ProvenanceBlock
        verifiedAt={w.last_verified_at}
        agencyName={w.source?.agency_name ?? w.state?.name ?? null}
        url={w.source?.url ?? null}
      />

      <Pressable onPress={onReport} accessibilityRole="button" style={{ marginTop: space.x16 }}>
        <Sentence tone="dim" style={{ fontSize: 13 }}>
          Something look wrong? Report this date.
        </Sentence>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  threaded: { position: 'relative', paddingLeft: 26, marginTop: space.x8 },
  actions: { flexDirection: 'row', gap: space.x12 },
});
