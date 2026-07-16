import { Stack } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { AppText, Card, Screen } from '@/components/ui';
import { useAlertPreferences, useToggleOffset, type AlertPref } from '@/features/alerts/queries';
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

export default function Alerts() {
  const { data: prefs = [], isLoading } = useAlertPreferences();
  const toggle = useToggleOffset();

  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: true, title: 'Alerts' }} />
      <View style={{ gap: spacing.xs }}>
        <AppText variant="h1">Alerts</AppText>
        <AppText variant="body" color={theme.color.textSecondary}>
          Choose how far ahead you're notified — from a year out down to the day of. Tap to toggle. Push
          notifications require a real device.
        </AppText>
      </View>

      {isLoading ? (
        <ActivityIndicator color={theme.color.accent} style={{ marginTop: spacing.xl }} />
      ) : prefs.length === 0 ? (
        <Card>
          <AppText variant="body" color={theme.color.textSecondary}>
            Follow a state and species first, then set your alerts here.
          </AppText>
        </Card>
      ) : (
        prefs.map((p) => (
          <PrefCard key={p.follow_id} pref={p} onToggle={(kind, offset, current) => toggle.mutate({ followId: p.follow_id, kind, offset, current })} />
        ))
      )}
    </Screen>
  );
}

function PrefCard({
  pref,
  onToggle,
}: {
  pref: AlertPref;
  onToggle: (kind: 'opener' | 'deadline', offset: number, current: number[]) => void;
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
    </Card>
  );
}

function OffsetRow({
  label,
  offsets,
  onToggle,
}: {
  label: string;
  offsets: number[];
  onToggle: (offset: number) => void;
}) {
  return (
    <View style={styles.row}>
      <AppText variant="caption" color={theme.color.textSecondary}>
        {label}
      </AppText>
      <View style={styles.chips}>
        {OFFSETS.map((o) => {
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
