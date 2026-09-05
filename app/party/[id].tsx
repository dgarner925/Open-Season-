import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Pill, Rule, Screen, Sentence, Serif, Thread } from '@/components/system';
import {
  usePartyById,
  usePartyRoster,
  useSetApplied,
  useLeaveParty,
} from '@/features/parties/queries';
import { useAuth } from '@/providers/AuthProvider';
import { queryClient } from '@/lib/queryClient';
import { daysUntil, formatDate, formatDateRange, isOpenNow } from '@/lib/date';
import { drawTitle } from '@/lib/titles';
import { lang } from '@/theme/tokens';

const { color, space, type } = lang;
const STORE_URL = 'https://apps.apple.com/us/app/id6791993537';

const NUMBER_WORDS = ['None', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
const nw = (n: number) => NUMBER_WORDS[n] ?? String(n);

export default function Party() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { data: party, isLoading } = usePartyById(id);
  const { data: roster = [] } = usePartyRoster(id);
  const setApplied = useSetApplied(id ?? '');
  const leave = useLeaveParty();

  // A roster left open goes stale while buddies apply — re-ask every time the
  // screen regains focus (the buddy-sees-old-status bug, 2026-09-06).
  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['party_roster', id] });
      queryClient.invalidateQueries({ queryKey: ['party', id] });
    }, [id]),
  );

  if (isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={color.copper} style={{ marginTop: space.x38 }} />
      </Screen>
    );
  }
  if (!party) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: 'Party' }} />
        <Sentence tone="bone" style={{ marginTop: space.section }}>
          Party not found.
        </Sentence>
        <Sentence style={{ marginTop: space.x8 }}>It may have been dissolved by its owner.</Sentence>
      </Screen>
    );
  }

  // A party targets either a draw (window, with "I applied" tracking) or a
  // season (the deer-camp crew — no application to track).
  const w = party.window;
  const s = party.season;
  const isDraw = Boolean(w);
  const seasonTitle = s
    ? `${s.state?.code ?? ''} ${s.species?.name ?? ''} — ${s.label ?? (s.method ? s.method.charAt(0).toUpperCase() + s.method.slice(1) : '')}`.trim()
    : '';
  const label = isDraw ? `${w?.state?.code ?? ''} ${drawTitle(w?.species?.name, w?.name)}`.trim() : seasonTitle;
  const d = daysUntil(w?.closes_at ?? null);
  const seasonOpen = s ? isOpenNow(s.open_date, s.close_date) : false;
  const seasonDays = s?.open_date ? daysUntil(s.open_date) : null;
  const me = roster.find((m) => m.user_id === user?.id);
  const iAmOwner = party.owner_id === user?.id;
  const appliedCount = roster.filter((m) => m.applied_at).length;
  const iApplied = Boolean(me?.applied_at);

  const partySentence =
    roster.length <= 1
      ? "It's just you so far — invite your buddies below."
      : `${nw(roster.length)} of you are in.${
          isDraw
            ? ` ${appliedCount === 0 ? 'Nobody has applied yet.' : appliedCount === roster.length ? 'Everyone has applied.' : `${nw(appliedCount)} ${appliedCount === 1 ? 'has' : 'have'} applied.`}`
            : ''
        }`;

  async function onInvite() {
    await Share.share({
      message:
        `Join my hunting party for ${isDraw ? `the ${label} draw` : `${label} season`} on Open Season: ` +
        `https://osdatesanddraws.com/join/?c=${party!.invite_code} ` +
        `(code ${party!.invite_code})`,
    }).catch(() => {});
  }

  function onLeave() {
    Alert.alert(
      iAmOwner ? 'Dissolve this party?' : 'Leave this party?',
      iAmOwner
        ? 'You created it — leaving removes the party for everyone.'
        : "You'll stop seeing the party. Your reminders for this hunt stay unless you unfollow.",
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
    <Screen scroll>
      <Stack.Screen options={{ headerShown: true, title: 'Your party' }} />

      <Serif size={33} style={{ marginTop: space.x16, lineHeight: 39 }}>
        {label}
      </Serif>
      <Sentence style={{ marginTop: space.x8 }}>{partySentence}</Sentence>

      <View style={styles.threaded}>
        <Thread />

        {isDraw ? (
          <>
            {w?.closes_at ? (
              <>
                <Serif size={30} style={{ marginTop: space.x32 }}>
                  {formatDate(w.closes_at)}
                </Serif>
                <Sentence style={{ marginTop: space.x8 }}>
                  {d !== null && d >= 0 ? (
                    <>
                      {'Applications close in '}
                      <Serif italic copper size={20}>
                        {d} {d === 1 ? 'day' : 'days'}
                      </Serif>
                      {'.'}
                    </>
                  ) : (
                    'This window has closed.'
                  )}
                </Sentence>
              </>
            ) : (
              <Sentence style={{ marginTop: space.x32 }}>The closing date hasn't been posted yet.</Sentence>
            )}
            {w?.results_expected_at ? (
              <Sentence style={{ marginTop: space.x12 }}>Results expected {formatDate(w.results_expected_at)}.</Sentence>
            ) : null}
          </>
        ) : (
          <>
            <Serif size={30} style={{ marginTop: space.x32 }}>
              {formatDateRange(s?.open_date ?? null, s?.close_date ?? null)}
            </Serif>
            <Sentence style={{ marginTop: space.x8 }}>
              {seasonOpen && s?.close_date ? (
                <>
                  <Serif italic copper size={20}>
                    Open now
                  </Serif>
                  {` — closes ${formatDate(s.close_date)}.`}
                </>
              ) : seasonDays !== null && seasonDays >= 0 ? (
                <>
                  {'Opens in '}
                  <Serif italic copper size={20}>
                    {seasonDays} {seasonDays === 1 ? 'day' : 'days'}
                  </Serif>
                  {'.'}
                </>
              ) : (
                'Closed for the year.'
              )}
            </Sentence>
          </>
        )}
      </View>

      <Rule />

      {roster.map((m, i) => {
        const mine = m.user_id === user?.id;
        const applied = Boolean(m.applied_at);
        return (
          <View key={m.user_id} style={styles.memberRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>
                {m.display_name}
                {mine ? ' (you)' : ''}
                {m.is_owner ? ' · organizer' : ''}
              </Text>
              <Text style={styles.memberSub}>
                {isDraw
                  ? applied
                    ? `Applied ${formatDate(m.applied_at!.slice(0, 10))}.`
                    : "Hasn't applied yet."
                  : `In camp since ${formatDate(m.joined_at.slice(0, 10))}.`}
              </Text>
            </View>
            {mine && isDraw ? (
              <Pressable
                onPress={() => setApplied.mutate(!applied)}
                accessibilityRole="button"
                style={[styles.appliedBtn, applied ? styles.appliedOn : styles.appliedOff]}
              >
                <Text style={[styles.appliedLabel, { color: applied ? color.copper : color.bone }]}>
                  {applied ? 'Applied ✓' : 'I applied'}
                </Text>
              </Pressable>
            ) : null}
            {i !== roster.length - 1 ? <View style={styles.rowRule} /> : null}
          </View>
        );
      })}

      <Rule />

      <Sentence>Your buddies join with this code:</Sentence>
      <Serif size={34} style={{ letterSpacing: 4, marginTop: space.x8 }}>
        {party.invite_code}
      </Serif>
      <Sentence tone="dim" style={{ fontSize: 13, marginTop: space.x8 }}>
        In the app: Profile → Hunting parties → Join with a code.
      </Sentence>

      <View style={styles.actions}>
        <Pill label="Invite your party" onPress={onInvite} style={{ flex: 1.4 }} />
        {me && w?.id ? (
          <Pill
            label="View the draw"
            variant="secondary"
            onPress={() => router.push({ pathname: '/window/[id]', params: { id: w.id } })}
            style={{ flex: 1 }}
          />
        ) : null}
        {me && s?.id ? (
          <Pill
            label="View the season"
            variant="secondary"
            onPress={() => router.push({ pathname: '/season/[id]', params: { id: s.id } })}
            style={{ flex: 1 }}
          />
        ) : null}
      </View>

      <Pressable onPress={onLeave} accessibilityRole="button" style={{ marginTop: space.section }}>
        <Sentence tone="dim">{iAmOwner ? 'Dissolve this party.' : 'Leave this party.'}</Sentence>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  threaded: { position: 'relative', paddingLeft: 26, marginTop: space.x8 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: space.x12, paddingVertical: space.x12, minHeight: 44 },
  rowRule: {
    position: 'absolute',
    left: 0,
    right: -space.gutter,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.hair,
  },
  memberName: { fontFamily: type.ui, fontSize: type.size.body + 0.5, color: color.bone },
  memberSub: { fontFamily: type.ui, fontSize: 13, color: color.muted, marginTop: 2 },
  appliedBtn: {
    height: 38,
    paddingHorizontal: space.x16,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  appliedOn: { backgroundColor: color.fill, borderColor: color.copper },
  appliedOff: { backgroundColor: 'transparent', borderColor: color.hair },
  appliedLabel: { fontFamily: type.uiSemiBold, fontSize: 13 },
  actions: { flexDirection: 'row', gap: space.x12, marginTop: space.section },
});
