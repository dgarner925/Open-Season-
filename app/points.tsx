import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { AppText, Button, Card, Pill, Screen } from '@/components/ui';
import { usePointBalances, useAdjustPointBalance, type PointBalanceWithRefs } from '@/features/points/queries';
import { spacing, theme } from '@/theme';

export default function Points() {
  const router = useRouter();
  const { data: balances = [], isLoading } = usePointBalances();
  const adjust = useAdjustPointBalance();

  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: true, title: 'Points' }} />
      <View style={{ gap: spacing.xs }}>
        <AppText variant="h1">Preference points</AppText>
        <AppText variant="body" color={theme.color.textSecondary}>
          Track the points you're banking toward each draw. Tap + when you buy or earn one.
        </AppText>
      </View>

      <Button title="+ Add points" onPress={() => router.push('/points-edit')} />

      {isLoading ? (
        <ActivityIndicator color={theme.color.accent} style={{ marginTop: spacing.lg }} />
      ) : balances.length === 0 ? (
        <Card>
          <AppText variant="body" color={theme.color.textSecondary}>
            No points tracked yet. Add a state and species above and set how many you've built up.
          </AppText>
        </Card>
      ) : (
        balances.map((b) => (
          <BalanceRow
            key={b.id}
            balance={b}
            busy={adjust.isPending}
            onEdit={() => router.push(`/points-edit?id=${b.id}`)}
            onAdjust={(delta) => adjust.mutate({ id: b.id, current: b.points, delta })}
          />
        ))
      )}
    </Screen>
  );
}

function BalanceRow({
  balance,
  busy,
  onEdit,
  onAdjust,
}: {
  balance: PointBalanceWithRefs;
  busy: boolean;
  onEdit: () => void;
  onAdjust: (delta: number) => void;
}) {
  return (
    <Card onPress={onEdit}>
      <View style={styles.row}>
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="h3">
            {balance.state?.code} {balance.species?.name}
          </AppText>
          <Pill
            label={balance.point_type === 'bonus' ? 'Bonus' : 'Preference'}
            color={theme.color.surfaceElevated}
            textColor={theme.color.textSecondary}
          />
        </View>

        <View style={styles.stepper}>
          <Pressable onPress={() => onAdjust(-1)} disabled={busy} hitSlop={8}>
            <Ionicons name="remove-circle-outline" size={30} color={theme.color.textSecondary} />
          </Pressable>
          <AppText variant="display" color={theme.color.accent} style={styles.count}>
            {balance.points}
          </AppText>
          <Pressable onPress={() => onAdjust(1)} disabled={busy} hitSlop={8}>
            <Ionicons name="add-circle-outline" size={30} color={theme.color.accent} />
          </Pressable>
        </View>
      </View>
      {balance.notes ? (
        <AppText variant="caption" color={theme.color.textMuted}>
          {balance.notes}
        </AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  count: { minWidth: 48, textAlign: 'center', fontSize: 34, lineHeight: 40 },
});
