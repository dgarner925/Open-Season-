import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, View } from 'react-native';
import { AppText, Button, Card, Divider, GlassChip, Screen } from '@/components/ui';
import { ProvenanceBlock } from '@/components/Provenance';
import { useWindowById } from '@/features/reference/queries';
import { useCreateParty, useMyParties } from '@/features/parties/queries';
import { useReportDate, promptReport } from '@/features/reports/queries';
import { useAuth } from '@/providers/AuthProvider';
import { addToCalendar } from '@/lib/calendar';
import { countdownLabel, daysUntil, formatDate } from '@/lib/date';
import { openExternalUrl } from '@/lib/openUrl';
import { drawTitle } from '@/lib/titles';
import { spacing, speciesColors, theme, urgencyColor, type SpeciesKey } from '@/theme';

const SITE_URL = 'https://osdatesanddraws.com';

export default function WindowDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: w, isLoading } = useWindowById(id);
  const { profile } = useAuth();
  const report = useReportDate();
  const { data: myParties = [] } = useMyParties();
  const createParty = useCreateParty();
  const myParty = myParties.find((p) => p.window_id === id);

  function onParty() {
    if (myParty) {
      router.push({ pathname: '/party/[id]', params: { id: myParty.id } });
      return;
    }
    createParty.mutate(id!, {
      onSuccess: ({ party_id }) => router.push({ pathname: '/party/[id]', params: { id: party_id } }),
      onError: () => Alert.alert('Could not start a party', 'Please try again in a moment.'),
    });
  }

  if (isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={theme.color.accent} style={{ marginTop: spacing.xxl }} />
      </Screen>
    );
  }
  if (!w) {
    return (
      <Screen>
        <AppText variant="h3">Application window not found</AppText>
      </Screen>
    );
  }

  const color = speciesColors[(w.species?.key ?? 'default') as SpeciesKey] ?? speciesColors.default;
  const d = daysUntil(w.closes_at);
  const urgency = urgencyColor(d);

  const title = drawTitle(w.species?.name, w.name);
  const label = `${w.state?.code ?? ''} ${title}`.trim();
  // Residency context — only shown once the user has set a home state.
  const residency =
    profile?.resident_state_id && w.state?.id
      ? w.state.id === profile.resident_state_id
        ? 'Resident'
        : 'Nonresident'
      : null;

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
      <Stack.Screen options={{ headerShown: true, title: `${w.state?.code ?? ''} ${w.species?.name ?? ''} Tag` }} />

      <View style={{ gap: spacing.xs }}>
        <AppText variant="h1">{title}</AppText>
        <AppText variant="body" color={theme.color.textSecondary}>
          {w.state?.name} · {w.zone?.name ?? 'Statewide'}
        </AppText>
        {residency ? (
          <View style={styles.pillRow}>
            <GlassChip label={residency} />
          </View>
        ) : null}
      </View>

      <Card accentColor={theme.color.danger}>
        <View style={styles.row}>
          <GlassChip label="Application deadline" />
          <AppText variant="bodyStrong" color={urgency}>
            {countdownLabel(d)}
          </AppText>
        </View>
        <AppText variant="h2" style={{ marginTop: spacing.xs }}>
          {formatDate(w.closes_at)}
        </AppText>

        <Divider />
        <Row label="Opens" value={formatDate(w.opens_at)} />
        <Row label="Closes" value={formatDate(w.closes_at)} />
        <Row label="Results" value={formatDate(w.results_expected_at)} />
        {w.fee_summary ? (
          <View style={styles.feeBlock}>
            <AppText variant="overline" color={theme.color.textMuted}>
              FEES
            </AppText>
            <AppText variant="body" color={theme.color.textSecondary}>
              {w.fee_summary}
            </AppText>
          </View>
        ) : null}
        {w.notes ? (
          <View style={styles.feeBlock}>
            <AppText variant="overline" color={theme.color.textMuted}>
              NOTES
            </AppText>
            <AppText variant="body" color={theme.color.textSecondary}>
              {w.notes}
            </AppText>
          </View>
        ) : null}
      </Card>

      {w.application_url ? (
        <Button title="Apply on the official site" onPress={() => openExternalUrl(w.application_url)} />
      ) : null}
      <Button
        variant="secondary"
        title={myParty ? 'View your party' : 'Hunt with your party'}
        onPress={onParty}
        loading={createParty.isPending}
      />

      {w.closes_at ? (
        <Button
          variant="secondary"
          title="Add deadline to Calendar"
          onPress={() =>
            addToCalendar({
              title: `${label} — draw deadline`,
              date: w.closes_at!,
              notes: w.fee_summary ?? undefined,
              url: w.application_url ?? w.state?.license_url ?? undefined,
            })
          }
        />
      ) : null}
      {w.results_expected_at ? (
        <Button
          variant="secondary"
          title="Add results date to Calendar"
          onPress={() =>
            addToCalendar({ title: `${label} — draw results`, date: w.results_expected_at! })
          }
        />
      ) : null}
      {w.state?.license_url ? (
        <Button
          variant="secondary"
          title="Buy a license / tag"
          onPress={() => openExternalUrl(w.state!.license_url)}
        />
      ) : null}
      <Button
        variant="secondary"
        title="Track this application"
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
      />
      <Button variant="secondary" title="Share" onPress={onShare} />

      <ProvenanceBlock
        verifiedAt={w.last_verified_at}
        agencyName={w.source?.agency_name ?? w.state?.name ?? null}
        url={w.source?.url ?? null}
      />

      <Pressable onPress={onReport} style={styles.reportBtn}>
        <AppText variant="caption" color={theme.color.textMuted}>
          Something look wrong? Report this date
        </AppText>
      </Pressable>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.dataRow}>
      <AppText variant="body" color={theme.color.textMuted}>
        {label}
      </AppText>
      <AppText variant="bodyStrong" style={styles.dataValue}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pillRow: { flexDirection: 'row', marginTop: spacing.xs },
  dataRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.xs },
  dataValue: { flex: 1, textAlign: 'right' },
  feeBlock: { marginTop: spacing.sm, gap: 4 },
  reportBtn: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.sm },
});
