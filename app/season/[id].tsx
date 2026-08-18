import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppText, Button, Card, Divider, Pill, Screen } from '@/components/ui';
import { ProvenanceBlock } from '@/components/Provenance';
import { useSeasonById } from '@/features/reference/queries';
import { formatDateRange, isOpenNow } from '@/lib/date';
import { openExternalUrl } from '@/lib/openUrl';
import { spacing, speciesColors, theme, type SpeciesKey } from '@/theme';

export default function SeasonDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: season, isLoading } = useSeasonById(id);

  if (isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={theme.color.accent} style={{ marginTop: spacing.xxl }} />
      </Screen>
    );
  }
  if (!season) {
    return (
      <Screen>
        <AppText variant="h3">Season not found</AppText>
      </Screen>
    );
  }

  const color = speciesColors[(season.species?.key ?? 'default') as SpeciesKey] ?? speciesColors.default;
  const open = isOpenNow(season.open_date, season.close_date);

  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: true, title: `${season.state?.code ?? ''} ${season.species?.name ?? ''}` }} />

      <View style={styles.titleRow}>
        <View style={[styles.stripe, { backgroundColor: color }]} />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <AppText variant="h1">
            {season.species?.name} — {season.label ?? cap(season.method)}
          </AppText>
          <AppText variant="body" color={theme.color.textSecondary}>
            {season.state?.name} · {season.zone?.name ?? 'Statewide'}
          </AppText>
        </View>
        {open && <Pill label="Open now" color={theme.color.success} />}
      </View>

      <Card>
        <AppText variant="overline" color={theme.color.textMuted}>
          SEASON DATES
        </AppText>
        <AppText variant="h3">{formatDateRange(season.open_date, season.close_date)}</AppText>

        {season.bag_limit_summary ? (
          <>
            <Divider />
            <AppText variant="overline" color={theme.color.textMuted}>
              BAG LIMIT
            </AppText>
            <AppText variant="body">{season.bag_limit_summary}</AppText>
          </>
        ) : null}

        {season.notes ? (
          <>
            <Divider />
            <AppText variant="overline" color={theme.color.textMuted}>
              NOTES
            </AppText>
            <AppText variant="body">{season.notes}</AppText>
          </>
        ) : null}
      </Card>

      {season.state?.license_url ? (
        <Button
          variant="secondary"
          title="Buy a license / tag"
          onPress={() => openExternalUrl(season.state!.license_url)}
        />
      ) : null}

      <ProvenanceBlock
        verifiedAt={season.last_verified_at}
        agencyName={season.source?.agency_name ?? season.state?.name ?? null}
        url={season.source?.url ?? null}
      />
    </Screen>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  stripe: { width: 5, alignSelf: 'stretch', borderRadius: 3, minHeight: 48 },
});
