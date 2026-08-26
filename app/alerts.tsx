import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Switch, View } from 'react-native';
import { AppText, Card, Screen } from '@/components/ui';
import { NotificationsOffBanner } from '@/components/NotificationsOffBanner';
import { ProUpsellCard } from '@/components/ProUpsellCard';
import { useAlertPreferences, useToggleOffset, type AlertPref } from '@/features/alerts/queries';
import { useRequirePro } from '@/hooks/useRequirePro';
import { useAuth } from '@/providers/AuthProvider';
import { useFollowedWindows } from '@/features/reference/queries';
import { supabase } from '@/lib/supabase';
import { radius, spacing, theme } from '@/theme';

// Cadence ladder from a year out down to the day of. Values must stay within the
// alert_preferences check constraint (1/3/7/14/30/60/90/180/365).
const OFFSETS: { days: number; label: string }[] = [
  { days: 365, label: '1y' },
  { days: 180, label: '6mo' },
  { days: 90, label: '3mo' },
  { days: 30, label: '1mo' },
  { days: 7, label: '1w' },
  { days: 1, label: '1d' },
];

// Draw results land on a known day, so the cadence ladder is short and close in.
// Must stay within the results_offsets check constraint (0/1/3/7).
const RESULTS_OFFSETS: { days: number; label: string }[] = [
  { days: 7, label: '1w' },
  { days: 3, label: '3d' },
  { days: 1, label: '1d' },
  { days: 0, label: 'Day of' },
];

export default function Alerts() {
  const router = useRouter();
  const { species: speciesFilter } = useLocalSearchParams<{ species?: string }>();
  const { data: prefs = [], isLoading } = useAlertPreferences();
  const { data: windows = [] } = useFollowedWindows();
  const toggle = useToggleOffset();
  const requirePro = useRequirePro();

  // Which (state, species) pairs actually have a draw? Only those get a "Draw
  // results" cadence — no point offering it for over-the-counter species.
  const drawPairs = new Set(windows.map((w) => `${w.state_id}:${w.species_id}`));

  // Arriving from a species' "Set reminder" scopes the list to that animal, so
  // the user sees only its alerts (one card per state they follow it in).
  const shown = speciesFilter ? prefs.filter((p) => p.follow?.species?.id === speciesFilter) : prefs;
  const filterName = speciesFilter ? shown[0]?.follow?.species?.name ?? null : null;
  const title = filterName ? `${filterName} alerts` : 'Alerts';

  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: true, title }} />
      <View style={{ gap: spacing.xs }}>
        <AppText variant="h1">{title}</AppText>
        <AppText variant="body" color={theme.color.textSecondary}>
          {filterName
            ? `Choose how far ahead you're notified for ${filterName} — before openers, tag deadlines, and draw results, in every state you follow it. Tap to toggle.`
            : "Choose how far ahead you're notified before openers, tag deadlines, and draw results — from a year out down to the day of. Tap to toggle. Push notifications require a real device."}
        </AppText>
        {speciesFilter ? (
          <Pressable onPress={() => router.setParams({ species: undefined })} hitSlop={6} style={{ marginTop: spacing.xs }}>
            <AppText variant="caption" color={theme.color.accent}>
              Show all alerts
            </AppText>
          </Pressable>
        ) : null}
      </View>

      <NotificationsOffBanner />
      <ProUpsellCard context="alerts" />

      {!speciesFilter ? <WeekendBriefToggle requirePro={requirePro} /> : null}

      {isLoading ? (
        <ActivityIndicator color={theme.color.accent} style={{ marginTop: spacing.xl }} />
      ) : shown.length === 0 ? (
        <Card>
          <AppText variant="body" color={theme.color.textSecondary}>
            {speciesFilter
              ? "You don't follow this species yet — add it, then set its alerts here."
              : 'Follow a state and species first, then set your alerts here.'}
          </AppText>
        </Card>
      ) : (
        shown.map((p) => (
          <PrefCard
            key={p.follow_id}
            pref={p}
            hasDraw={drawPairs.has(`${p.state_id}:${p.species_id}`)}
            onToggle={(kind, offset, current) => {
              // Free users can see the ladder; changing it is Pro.
              if (!requirePro()) return;
              toggle.mutate({ followId: p.follow_id, kind, offset, current });
            }}
          />
        ))
      )}
    </Screen>
  );
}

/**
 * The Weekend Brief — one Friday-morning push composed from your follows
 * (openers, last chances, deadlines). On by default for Pro; silent on empty
 * weekends, so the toggle is mostly for people who want no digest at all.
 */
function WeekendBriefToggle({ requirePro }: { requirePro: () => boolean }) {
  const { user, profile, refreshProfile } = useAuth();
  const on = profile?.weekend_brief !== false;

  async function setBrief(value: boolean) {
    if (!requirePro() || !user) return;
    await supabase.from('profiles').update({ weekend_brief: value }).eq('id', user.id);
    await refreshProfile();
  }

  return (
    <Card>
      <View style={styles.briefRow}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="h3">The Weekend Brief</AppText>
          <AppText variant="caption" color={theme.color.textSecondary}>
            One Friday-morning note: what opens, what closes, and deadlines ahead — only on weekends that matter.
          </AppText>
        </View>
        <Switch
          value={on}
          onValueChange={setBrief}
          trackColor={{ true: theme.color.accent, false: theme.color.border }}
          thumbColor="#f4f1ea"
        />
      </View>
    </Card>
  );
}

function PrefCard({
  pref,
  hasDraw,
  onToggle,
}: {
  pref: AlertPref;
  hasDraw: boolean;
  onToggle: (kind: 'opener' | 'deadline' | 'results', offset: number, current: number[]) => void;
}) {
  return (
    <Card>
      <AppText variant="h3">
        {pref.follow?.state?.name ?? '—'} · {pref.follow?.species?.name ?? '—'}
      </AppText>

      <OffsetRow
        label="Season openers"
        offsets={pref.opener_offsets}
        onToggle={(offset) => onToggle('opener', offset, pref.opener_offsets)}
      />
      <OffsetRow
        label="Tag deadlines"
        offsets={pref.deadline_offsets}
        onToggle={(offset) => onToggle('deadline', offset, pref.deadline_offsets)}
      />
      {hasDraw ? (
        <OffsetRow
          label="Draw results"
          ladder={RESULTS_OFFSETS}
          offsets={pref.results_offsets}
          onToggle={(offset) => onToggle('results', offset, pref.results_offsets)}
        />
      ) : null}
    </Card>
  );
}

function OffsetRow({
  label,
  offsets,
  onToggle,
  ladder = OFFSETS,
}: {
  label: string;
  offsets: number[];
  onToggle: (offset: number) => void;
  ladder?: { days: number; label: string }[];
}) {
  return (
    <View style={styles.row}>
      <AppText variant="caption" color={theme.color.textSecondary}>
        {label}
      </AppText>
      <View style={styles.chips}>
        {ladder.map((o) => {
          const on = offsets.includes(o.days);
          return (
            <Pressable
              key={o.days}
              onPress={() => onToggle(o.days)}
              style={[
                styles.chip,
                on
                  ? { backgroundColor: theme.color.accent, borderColor: theme.color.accent }
                  : { backgroundColor: 'transparent', borderColor: theme.color.border },
              ]}
            >
              <AppText variant="caption" color={on ? theme.color.onAccent : theme.color.textSecondary}>
                {o.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  briefRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  row: { gap: spacing.sm, marginTop: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minWidth: 44,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
