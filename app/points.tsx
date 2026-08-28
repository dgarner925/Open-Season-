import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Pill, Rule, Screen, Sentence, Serif } from '@/components/system';
import { usePointBalances, useAdjustPointBalance, type PointBalanceWithRefs } from '@/features/points/queries';
import { useRequirePro } from '@/hooks/useRequirePro';
import { lang } from '@/theme/tokens';

const { color, space, type } = lang;

export default function Points() {
  const router = useRouter();
  const { data: balances = [], isLoading } = usePointBalances();
  const adjust = useAdjustPointBalance();
  const requirePro = useRequirePro();

  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: true, title: 'Preference points' }} />
      <Sentence style={{ marginTop: space.x16 }}>
        Track the points you're banking toward each draw. Tap + when you buy or earn one.
      </Sentence>

      {isLoading ? (
        <ActivityIndicator color={color.copper} style={{ marginTop: space.x32 }} />
      ) : balances.length === 0 ? (
        <Sentence style={{ marginTop: space.section }}>
          No points tracked yet. Add a state and species below and set how many you've built up.
        </Sentence>
      ) : (
        <>
          <Rule />
          {balances.map((b, i) => (
            <BalanceRow
              key={b.id}
              balance={b}
              last={i === balances.length - 1}
              busy={adjust.isPending}
              onEdit={() => router.push(`/points-edit?id=${b.id}`)}
              onAdjust={(delta) => adjust.mutate({ id: b.id, current: b.points, delta })}
            />
          ))}
        </>
      )}

      <Rule />
      <Pill label="Add points" variant="secondary" onPress={() => requirePro() && router.push('/points-edit')} />
    </Screen>
  );
}

function BalanceRow({
  balance,
  last,
  busy,
  onEdit,
  onAdjust,
}: {
  balance: PointBalanceWithRefs;
  last: boolean;
  busy: boolean;
  onEdit: () => void;
  onAdjust: (delta: number) => void;
}) {
  const kind = balance.point_type === 'bonus' ? 'bonus' : 'preference';
  return (
    <View style={styles.row}>
      {/* Only the text area edits — the stepper stays its own target (no more
          mis-taps navigating away mid-adjustment). */}
      <Pressable style={{ flex: 1 }} onPress={onEdit} accessibilityRole="button">
        <Text style={styles.rowTitle}>
          {balance.species?.name} in {balance.state?.code}
        </Text>
        <Text style={styles.rowSub}>
          {balance.points} {kind} point{balance.points === 1 ? '' : 's'} banked.
          {balance.notes ? ` ${balance.notes}` : ''}
        </Text>
      </Pressable>
      <View style={styles.stepper}>
        <Pressable onPress={() => onAdjust(-1)} disabled={busy} hitSlop={8} accessibilityLabel="Remove one point">
          <Ionicons name="remove-circle-outline" size={26} color={color.dim} />
        </Pressable>
        <Text style={styles.count}>{balance.points}</Text>
        <Pressable onPress={() => onAdjust(1)} disabled={busy} hitSlop={8} accessibilityLabel="Add one point">
          <Ionicons name="add-circle-outline" size={26} color={color.copper} />
        </Pressable>
      </View>
      {!last ? <View style={styles.rowRule} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.x12, paddingVertical: space.x12, minHeight: 44 },
  rowRule: {
    position: 'absolute',
    left: 0,
    right: -space.gutter,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.hair,
  },
  rowTitle: { fontFamily: type.ui, fontSize: type.size.body + 0.5, color: color.bone },
  rowSub: { fontFamily: type.ui, fontSize: 13, color: color.muted, marginTop: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.x8 },
  count: { fontFamily: type.display, fontSize: 28, color: color.bone, minWidth: 40, textAlign: 'center' },
});
