import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { AppText, Button, Card, Screen } from '@/components/ui';
import {
  usePartyById,
  usePartyRoster,
  useSetApplied,
  useLeaveParty,
} from '@/features/parties/queries';
import { useAuth } from '@/providers/AuthProvider';
import { countdownLabel, daysUntil, formatDate } from '@/lib/date';
import { drawTitle } from '@/lib/titles';
import { fontFamily, radius, spacing, theme, urgencyColor } from '@/theme';

const STORE_URL = 'https://apps.apple.com/us/app/id6791993537';

export default function Party() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { data: party, isLoading } = usePartyById(id);
  const { data: roster = [] } = usePartyRoster(id);
  const setApplied = useSetApplied(id ?? '');
  const leave = useLeaveParty();

  if (isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={theme.color.accent} style={{ marginTop: spacing.xxl }} />
      </Screen>
    );
  }
  if (!party) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: 'Party' }} />
        <AppText variant="h3">Party not found</AppText>
        <AppText variant="body" color={theme.color.textSecondary}>
          It may have been dissolved by its owner.
        </AppText>
      </Screen>
    );
  }

  const w = party.window;
  const label = `${w?.state?.code ?? ''} ${drawTitle(w?.species?.name, w?.name)}`.trim();
  const d = daysUntil(w?.closes_at ?? null);
  const me = roster.find((m) => m.user_id === user?.id);
  const iAmOwner = party.owner_id === user?.id;
  const appliedCount = roster.filter((m) => m.applied_at).length;

  async function onInvite() {
    await Share.share({
      message:
        `Join my hunting party for the ${label} draw on Open Season. ` +
        `Open the app → Settings → Join a hunting party → code ${party!.invite_code}. ` +
        `Don't have the app? ${STORE_URL}`,
    }).catch(() => {});
  }

  function onLeave() {
    Alert.alert(
      iAmOwner ? 'Dissolve this party?' : 'Leave this party?',
      iAmOwner
        ? 'You created it — leaving removes the party for everyone.'
        : "You'll stop seeing the party. Your reminders for this draw stay unless you unfollow.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: iAmOwner ? 'Dissolve' : 'Leave',
          style: 'destructive',
          onPress: () => leave.mutate(party!.id, { onSuccess: () => router.back() }),
        },
      ],
    );
  }

  return (
    <Screen scroll contentStyle={{ paddingBottom: spacing.xxl }}>
      <Stack.Screen options={{ headerShown: true, title: 'Your party' }} />

      <View style={{ gap: spacing.xs }}>
        <AppText variant="h1">{label}</AppText>
        <AppText variant="body" color={theme.color.textSecondary}>
          {w?.state?.name ?? ''} · party of {roster.length} · {appliedCount} applied
        </AppText>
      </View>

      <Card accentColor={theme.color.danger}>
        <AppText variant="overline" color={theme.color.textMuted}>
          APPLICATION DEADLINE
        </AppText>
        <View style={styles.deadlineRow}>
          <AppText variant="h2">{formatDate(w?.closes_at ?? null)}</AppText>
          <AppText variant="bodyStrong" color={urgencyColor(d)}>
            {countdownLabel(d)}
          </AppText>
        </View>
        {w?.results_expected_at ? (
          <AppText variant="caption" color={theme.color.textMuted}>
            Results expected {formatDate(w.results_expected_at)}
          </AppText>
        ) : null}
      </Card>

      <View style={{ gap: spacing.sm }}>
        <AppText variant="overline" color={theme.color.textMuted}>
          THE PARTY
        </AppText>
        {roster.map((m) => {
          const mine = m.user_id === user?.id;
          const applied = Boolean(m.applied_at);
          return (
            <Card key={m.user_id} variant="flat" style={styles.memberRow}>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">
                  {m.display_name}
                  {mine ? ' (you)' : ''}
                  {m.is_owner ? ' · organizer' : ''}
                </AppText>
                <AppText variant="caption" color={applied ? theme.color.accent : theme.color.textMuted}>
                  {applied ? `Applied ${formatDate(m.applied_at!.slice(0, 10))}` : 'Not applied yet'}
                </AppText>
              </View>
              {mine ? (
                <Pressable
                  onPress={() => setApplied.mutate(!applied)}
                  style={[styles.appliedBtn, applied ? styles.appliedOn : styles.appliedOff]}
                >
                  <Text style={[styles.appliedLabel, { color: applied ? theme.color.onAccent : theme.color.textSecondary }]}>
                    {applied ? 'Applied ✓' : 'I applied'}
                  </Text>
                </Pressable>
              ) : applied ? (
                <Ionicons name="checkmark-circle" size={22} color={theme.color.accent} />
              ) : (
                <Ionicons name="ellipse-outline" size={22} color={theme.color.textMuted} />
              )}
            </Card>
          );
        })}
      </View>

      <Card variant="flat" style={styles.inviteCard}>
        <AppText variant="overline" color={theme.color.textMuted}>
          INVITE CODE
        </AppText>
        <Text style={styles.code}>{party.invite_code}</Text>
        <AppText variant="caption" color={theme.color.textMuted}>
          Friends join in the app: Settings → Join a hunting party.
        </AppText>
      </Card>

      <Button title="Invite your party" onPress={onInvite} />
      {me && w?.id ? (
        <Button
          variant="secondary"
          title="View the draw"
          onPress={() => router.push({ pathname: '/window/[id]', params: { id: w.id } })}
        />
      ) : null}
      <Button variant="ghost" title={iAmOwner ? 'Dissolve party' : 'Leave party'} onPress={onLeave} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  deadlineRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: spacing.xs },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  appliedBtn: { paddingHorizontal: spacing.lg, paddingVertical: 8, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  appliedOn: { backgroundColor: theme.color.accent, borderColor: theme.color.accent },
  appliedOff: { backgroundColor: 'transparent', borderColor: theme.color.border },
  appliedLabel: { fontFamily: fontFamily.sansSemiBold, fontSize: 13 },
  inviteCard: { alignItems: 'center', gap: 4 },
  code: { fontFamily: fontFamily.sansBold, fontSize: 28, letterSpacing: 6, color: theme.color.accent, borderRadius: radius.md },
});
