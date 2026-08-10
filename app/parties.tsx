import { Stack, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Platform, View } from 'react-native';
import { AppText, Button, Card, Screen } from '@/components/ui';
import { useJoinParty, useMyParties } from '@/features/parties/queries';
import { countdownLabel, daysUntil } from '@/lib/date';
import { drawTitle } from '@/lib/titles';
import { spacing, theme, urgencyColor } from '@/theme';

export default function Parties() {
  const router = useRouter();
  const { data: parties = [], isLoading } = useMyParties();
  const join = useJoinParty();

  function onJoin() {
    if (Platform.OS === 'ios') {
      Alert.prompt('Join a hunting party', 'Enter the invite code your buddy sent you.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Join',
          onPress: (code?: string) => {
            if (!code?.trim()) return;
            join.mutate(code, {
              onSuccess: (partyId) => router.push({ pathname: '/party/[id]', params: { id: partyId } }),
              onError: () => Alert.alert('Invalid code', 'Double-check the invite code and try again.'),
            });
          },
        },
      ]);
    }
  }

  return (
    <Screen scroll contentStyle={{ paddingBottom: spacing.xxl }}>
      <Stack.Screen options={{ headerShown: true, title: 'Hunting parties' }} />
      <View style={{ gap: spacing.xs }}>
        <AppText variant="h1">Hunting parties</AppText>
        <AppText variant="body" color={theme.color.textSecondary}>
          Apply for draws together — everyone sees the deadline, and who's actually applied.
        </AppText>
      </View>

      <Button title="Join with a code" onPress={onJoin} loading={join.isPending} />

      {isLoading ? (
        <ActivityIndicator color={theme.color.accent} style={{ marginTop: spacing.xl }} />
      ) : parties.length === 0 ? (
        <Card style={{ marginTop: spacing.md }}>
          <AppText variant="h3">No parties yet</AppText>
          <AppText variant="body" color={theme.color.textSecondary}>
            Open any draw on the Tags tab and tap "Hunt with your party" to start one — or join a
            buddy's with their code.
          </AppText>
        </Card>
      ) : (
        parties.map((p) => {
          const w = p.window;
          const d = daysUntil(w?.closes_at ?? null);
          return (
            <Card
              key={p.id}
              onPress={() => router.push({ pathname: '/party/[id]', params: { id: p.id } })}
            >
              <AppText variant="h3">
                {`${w?.state?.code ?? ''} ${drawTitle(w?.species?.name, w?.name)}`.trim()}
              </AppText>
              <AppText variant="body" color={urgencyColor(d)}>
                Deadline {countdownLabel(d)}
              </AppText>
            </Card>
          );
        })
      )}
    </Screen>
  );
}
