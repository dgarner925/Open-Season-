import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TextInput, View } from 'react-native';
import { Pill, Row, Screen, Sentence, Serif, Tile } from '@/components/system';
import { useJoinParty, useMyParties } from '@/features/parties/queries';
import { useRequirePro } from '@/hooks/useRequirePro';
import { useRequireAccount } from '@/hooks/useRequireAccount';
import { countdownLabel, daysUntil } from '@/lib/date';
import { drawTitle } from '@/lib/titles';
import { lang } from '@/theme/tokens';

const { color, space, type } = lang;

export default function Parties() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const { data: parties = [], isLoading } = useMyParties();
  const join = useJoinParty();
  const requirePro = useRequirePro();
  const requireAccount = useRequireAccount();

  // Inline code entry — works on both platforms (Alert.prompt was iOS-only,
  // which left Android's join button dead).
  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState('');

  // An invite link (osdatesanddraws.com/join/?c=CODE -> openseason://parties?code=CODE)
  // lands here with the code aboard: open the join flow pre-filled, one tap
  // from the roster. The Pro gate still applies, same as tapping Join by hand.
  useEffect(() => {
    const c = typeof params.code === 'string' ? params.code.trim() : '';
    if (!c) return;
    setCode(c.toUpperCase());
    if (requireAccount() && requirePro()) setJoining(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.code]);

  function onJoinStart() {
    if (!requireAccount()) return;
    if (!requirePro()) return;
    setJoining(true);
  }

  function onJoinSubmit() {
    const c = code.trim();
    if (!c) return;
    join.mutate(c, {
      onSuccess: (partyId) => {
        setJoining(false);
        setCode('');
        router.push({ pathname: '/party/[id]', params: { id: partyId } });
      },
      // Every failure used to say "Invalid code", which is the one thing it
      // usually was not. On 2026-11-08 a valid, working Smithgall code
      // (someone joined with it 69 seconds after it was minted) was reported
      // as invalid, and this alert is why: it sends people off to re-check a
      // code that is fine while hiding the real cause. join_party raises
      // 'not signed in' when the session has lapsed, and an offline device
      // never reaches the function at all.
      onError: (err: unknown) => {
        const msg = (err as { message?: string } | null)?.message ?? '';
        if (/not signed in|JWT|session/i.test(msg)) {
          Alert.alert('Sign in again', 'Your session expired. Sign in and the code will work.');
          return;
        }
        if (/network|fetch|timeout|offline/i.test(msg)) {
          Alert.alert('No connection', 'The code could not be checked. Try again on a signal.');
          return;
        }
        if (/invalid invite code/i.test(msg)) {
          Alert.alert('Invalid code', 'Double-check the invite code and try again.');
          return;
        }
        Alert.alert('Could not join', msg || 'Something went wrong joining that party.');
      },
    });
  }

  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: true, title: 'Hunting parties' }} />
      <Sentence style={{ marginTop: space.x16 }}>
        Hunt together — a party for a draw shows who's applied; a party for a season is your camp
        roster.
      </Sentence>

      {isLoading ? (
        <ActivityIndicator color={color.copper} style={{ marginTop: space.x32 }} />
      ) : parties.length === 0 ? (
        <Sentence style={{ marginTop: space.section }}>
          No parties yet. Open any season or draw and tap "Hunt with your party" to start one — or
          join a buddy's with their code below.
        </Sentence>
      ) : (
        <Tile style={{ marginTop: space.section }}>
          {parties.map((p, i) => {
            const w = p.window;
            const s = p.season;
            const title = w
              ? `${w.state?.code ?? ''} ${drawTitle(w.species?.name, w.name)}`.trim()
              : `${s?.state?.code ?? ''} ${s?.species?.name ?? ''} — ${
                  s?.label ?? (s?.method ? s.method.charAt(0).toUpperCase() + s.method.slice(1) : '')
                }`.trim();
            const d = w ? daysUntil(w.closes_at ?? null) : daysUntil(s?.open_date ?? null);
            const subtitle = w ? `Deadline ${countdownLabel(d)}.` : d !== null && d >= 0 ? `Opens ${countdownLabel(d)}.` : 'Season party.';
            return (
              <Row
                key={p.id}
                title={title}
                subtitle={subtitle}
                onPress={() => router.push({ pathname: '/party/[id]', params: { id: p.id } })}
                right={
                  d !== null && d >= 0 ? (
                    <Serif italic size={19} copper>
                      {d}d
                    </Serif>
                  ) : undefined
                }
                last={i === parties.length - 1}
              />
            );
          })}
        </Tile>
      )}

      <View style={{ marginTop: space.section }} />
      {joining ? (
        <View style={{ gap: space.x16 }}>
          <Sentence>Enter the invite code your buddy sent you.</Sentence>
          <TextInput
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            placeholder="INVITE CODE"
            placeholderTextColor={color.dim}
            style={styles.codeInput}
            onSubmitEditing={onJoinSubmit}
          />
          <View style={{ flexDirection: 'row', gap: space.x12 }}>
            <Pill label={join.isPending ? 'Joining…' : 'Join the party'} onPress={onJoinSubmit} disabled={join.isPending} style={{ flex: 1.4 }} />
            <Pill label="Cancel" variant="secondary" onPress={() => setJoining(false)} style={{ flex: 1 }} />
          </View>
        </View>
      ) : (
        <Pill label="Join with a code" variant="secondary" onPress={onJoinStart} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  codeInput: {
    fontFamily: type.uiSemiBold,
    fontSize: 18,
    letterSpacing: 3,
    color: color.bone,
    paddingVertical: space.x12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.hair,
  },
});
