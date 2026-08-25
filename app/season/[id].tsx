import { Stack, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppText, Button, Card, Divider, Pill, Screen } from '@/components/ui';
import { ProvenanceBlock } from '@/components/Provenance';
import { useAuth } from '@/providers/AuthProvider';
import { useSeasonById } from '@/features/reference/queries';
import { useMethodReminder } from '@/features/follows/queries';
import { useRequirePro } from '@/hooks/useRequirePro';
import { addToCalendar } from '@/lib/calendar';
import { daysUntil, formatDateRange, isOpenNow } from '@/lib/date';
import { openExternalUrl } from '@/lib/openUrl';
import { supabase } from '@/lib/supabase';
import { fontFamily, radius, spacing, theme } from '@/theme';

export default function SeasonDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: season, isLoading } = useSeasonById(id);
  const { profile } = useAuth();
  const requirePro = useRequirePro();

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

  const open = isOpenNow(season.open_date, season.close_date);
  const days = season.open_date ? daysUntil(season.open_date) : null;
  const title = season.label ?? cap(season.method);
  const armed = reminder.isArmed(season.method);
  const residency =
    profile?.resident_state_id && stateId
      ? profile.resident_state_id === stateId
        ? 'RESIDENT'
        : 'NONRESIDENT'
      : null;

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

  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: true, title: '' }} />

      <Text style={styles.context}>
        {(season.state?.name ?? '').toUpperCase()} · {(season.species?.name ?? '').toUpperCase()}
        {residency ? `  ·  ${residency}` : ''}
      </Text>

      <Text style={styles.title}>
        {title}
        <Text style={styles.titleAccent}> season.</Text>
      </Text>
      <AppText variant="body" color={theme.color.textSecondary} style={{ marginTop: spacing.sm }}>
        {formatDateRange(season.open_date, season.close_date)}
        {season.zone?.name && season.zone.name !== 'Statewide' ? ` · ${season.zone.name}` : ''}
      </AppText>

      <View style={styles.countdownRow}>
        {open ? (
          <Pill label="Open now" color={theme.color.success} />
        ) : days !== null && days >= 0 ? (
          <Text style={styles.countdown}>
            {days}
            <Text style={styles.countdownUnit}> day{days === 1 ? '' : 's'} to the opener</Text>
          </Text>
        ) : (
          <AppText variant="bodyStrong" color={theme.color.textMuted}>
            Closed for the year
          </AppText>
        )}
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={onNotify}
          disabled={reminder.toggle.isPending}
          style={({ pressed }) => [styles.notifyBtn, armed && styles.notifyBtnArmed, pressed && { opacity: 0.8 }]}
        >
          <Text style={[styles.notifyLabel, armed && styles.notifyLabelArmed]}>
            {armed ? 'Notifying you ✓' : 'Notify me'}
          </Text>
        </Pressable>
        <Pressable onPress={onCalendar} style={({ pressed }) => [styles.calBtn, pressed && { opacity: 0.7 }]}>
          <Text style={styles.calLabel}>Add to calendar</Text>
        </Pressable>
      </View>
      {armed ? (
        <AppText variant="caption" color={theme.color.textMuted} style={{ marginTop: spacing.sm }}>
          We'll remind you before the opener — adjust how far ahead in Profile → Reminders.
        </AppText>
      ) : null}

      <Card style={{ marginTop: spacing.xl }}>
        {season.bag_limit_summary ? (
          <>
            <AppText variant="overline" color={theme.color.textMuted}>
              BAG LIMIT
            </AppText>
            <AppText variant="body">{season.bag_limit_summary}</AppText>
          </>
        ) : null}
        {season.notes ? (
          <>
            {season.bag_limit_summary ? <Divider /> : null}
            <AppText variant="overline" color={theme.color.textMuted}>
              NOTES
            </AppText>
            <AppText variant="body">{season.notes}</AppText>
          </>
        ) : null}
        {!season.bag_limit_summary && !season.notes ? (
          <AppText variant="body" color={theme.color.textMuted}>
            No bag limit or notes on file — check the official regulations.
          </AppText>
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
  context: {
    fontFamily: fontFamily.sansSemiBold,
    fontSize: 11,
    letterSpacing: 1.6,
    color: theme.color.textMuted,
    marginTop: spacing.sm,
  },
  title: {
    fontFamily: fontFamily.serif,
    fontSize: 40,
    lineHeight: 46,
    color: theme.color.textPrimary,
    marginTop: spacing.md,
  },
  titleAccent: { fontFamily: fontFamily.serifItalic, color: theme.color.accent },

  countdownRow: { marginTop: spacing.xl },
  countdown: { fontFamily: fontFamily.serifItalic, fontSize: 44, color: theme.color.accent },
  countdownUnit: { fontFamily: fontFamily.serifItalic, fontSize: 16, color: theme.color.textMuted },

  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  notifyBtn: {
    flex: 1.6,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifyBtnArmed: {
    backgroundColor: theme.color.accentFill,
    borderWidth: 1.2,
    borderColor: theme.color.accent,
  },
  notifyLabel: { fontFamily: fontFamily.sansBold, fontSize: 14.5, color: theme.color.onAccent },
  notifyLabelArmed: { color: theme.color.accent },
  calBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calLabel: { fontFamily: fontFamily.sansMedium, fontSize: 13.5, color: theme.color.textSecondary },
});
