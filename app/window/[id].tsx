import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Share, StyleSheet, View } from 'react-native';
import { LinkSentence, Micro, Rule, Screen, Sentence, Serif } from '@/components/system';
import { ProvenanceBlock } from '@/components/Provenance';
import { ActionRow, LicenseRow } from '@/components/LicenseRow';
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
function todayISO(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}
function weekdayOf(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
}
function monthDay(dateISO: string): string {
  const [, m, d] = dateISO.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

/** The draw-deadline detail: THE DRAW tile, then the actions. */
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
    if (createParty.isPending) return;
    if (!requirePro()) return;
    createParty.mutate(
      { windowId: id! },
      {
        onSuccess: ({ party_id }) => router.push({ pathname: '/party/[id]', params: { id: party_id } }),
        onError: (e) =>
          Alert.alert('Could not start a party', e instanceof Error && e.message ? e.message : 'Please try again in a moment.'),
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

      {/* THE DRAW — the deadline said once: the date, the countdown, the
          window's history. Fee and notes only when we have them (the "No fee
          info on file" row is gone — David's reflow, 2026-09-07). */}
      <View style={styles.tile}>
        <Micro>The draw</Micro>
        {w.closes_at ? (
          <>
            <Serif size={30} style={{ marginTop: space.x12 }}>
              {formatDate(w.closes_at)}
            </Serif>
            <Sentence style={{ marginTop: space.x8 }}>
              {d !== null && d >= 0 ? (
                <>
                  {'Applications close in '}
                  <Serif italic copper size={20}>
                    {d} {d === 1 ? 'day' : 'days'}
                  </Serif>
                  {d === 0 ? ' — today.' : ` — that's a ${weekdayOf(w.closes_at)}.`}
                </>
              ) : (
                `This window closed ${spoken(w.closes_at)}.`
              )}
            </Sentence>
          </>
        ) : (
          <Sentence style={{ marginTop: space.x12 }}>The closing date hasn't been posted yet.</Sentence>
        )}
        {w.opens_at ? (
          <Sentence style={{ marginTop: space.x8 }}>
            {w.opens_at <= todayISO()
              ? `The window has been open since ${monthDay(w.opens_at)}.`
              : `The window opens ${spoken(w.opens_at)}.`}
          </Sentence>
        ) : null}
        {w.results_expected_at ? (
          <Sentence style={{ marginTop: space.x8 }}>Results expected {spoken(w.results_expected_at)}.</Sentence>
        ) : null}
        {w.fee_summary || w.notes ? (
          <>
            <Rule />
            {w.fee_summary ? <Sentence>{w.fee_summary}</Sentence> : null}
            {w.notes ? <Sentence style={{ marginTop: w.fee_summary ? space.x12 : 0 }}>{w.notes}</Sentence> : null}
          </>
        ) : null}
      </View>

      {w.application_url ? (
        <ActionRow
          icon="open-outline"
          title="Apply on the official site"
          sub="You'll finish on the state's site."
          onPress={() => openExternalUrl(w.application_url)}
        />
      ) : null}
      <ActionRow
        icon="people-outline"
        title={myParty ? 'View your party' : 'Hunt with your party'}
        sub={myParty ? 'See who has applied.' : 'Plan the draw with your crew.'}
        onPress={onParty}
      />

      <Rule />
      {w.closes_at ? (
        <LinkSentence
          onPress={() =>
            addToCalendar({
              title: `${label} — draw deadline`,
              date: w.closes_at!,
              notes: w.fee_summary ?? undefined,
              url: w.application_url ?? w.state?.license_url ?? undefined,
            })
          }
        >
          Add the deadline to your calendar.
        </LinkSentence>
      ) : null}
      {w.results_expected_at ? (
        <LinkSentence
          style={{ marginTop: space.x12 }}
          onPress={() => addToCalendar({ title: `${label} — draw results`, date: w.results_expected_at! })}
        >
          Add the results date too.
        </LinkSentence>
      ) : null}
      <LinkSentence
        style={{ marginTop: space.x12 }}
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
      >
        Track this application in your ledger.
      </LinkSentence>
      <LicenseRow stateName={w.state?.name} url={w.state?.license_url} />
      <LinkSentence style={{ marginTop: space.x12 }} onPress={onShare}>
        Share this deadline with a buddy.
      </LinkSentence>

      <ProvenanceBlock
        verifiedAt={w.last_verified_at}
        agencyName={w.source?.agency_name ?? w.state?.name ?? null}
        url={w.source?.url ?? null}
      />

      <LinkSentence size={13} style={{ marginTop: space.x16 }} onPress={onReport}>
        Something look wrong? Report this date.
      </LinkSentence>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tile: {
    marginTop: space.x16,
    padding: space.gutter,
    borderRadius: lang.radius.card,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hair,
  },
});
