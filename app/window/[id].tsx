import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppText, Button, Card, Divider, GlassChip, Screen } from '@/components/ui';
import { ProvenanceBlock } from '@/components/Provenance';
import { useWindowById } from '@/features/reference/queries';
import { countdownLabel, daysUntil, formatDate } from '@/lib/date';
import { openExternalUrl } from '@/lib/openUrl';
import { spacing, speciesColors, theme, urgencyColor, type SpeciesKey } from '@/theme';

export default function WindowDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: w, isLoading } = useWindowById(id);

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

  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: true, title: `${w.state?.code ?? ''} ${w.species?.name ?? ''} Tag` }} />

      <View style={{ gap: spacing.xs }}>
        <AppText variant="h1">
          {w.species?.name} {w.name ?? 'Draw'}
        </AppText>
        <AppText variant="body" color={theme.color.textSecondary}>
          {w.state?.name} · {w.zone?.name ?? 'Statewide'}
        </AppText>
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
        {w.fee_summary ? <Row label="Fees" value={w.fee_summary} /> : null}
      </Card>

      {w.application_url ? (
        <Button title="Apply on the official site" onPress={() => openExternalUrl(w.application_url)} />
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
              title: `${w.state?.name ?? ''} ${w.species?.name ?? ''} ${w.name ?? 'Draw'}`.trim(),
              stateId: w.state_id,
              speciesId: w.species_id,
              windowId: w.id,
              ...(w.application_url ? { url: w.application_url } : {}),
            },
          })
        }
      />

      <ProvenanceBlock
        verifiedAt={w.last_verified_at}
        agencyName={w.source?.agency_name ?? w.state?.name ?? null}
        url={w.source?.url ?? null}
      />
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.dataRow}>
      <AppText variant="body" color={theme.color.textMuted}>
        {label}
      </AppText>
      <AppText variant="bodyStrong">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dataRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs },
});
