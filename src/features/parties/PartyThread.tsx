import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { clock } from '@/features/parties/format';
import {
  useBlockUser,
  useDeletePartyMessage,
  usePartyThread,
  usePostPartyMessage,
  useReportPartyMessage,
} from '@/features/parties/queries';
import type { PartyMessage } from '@/lib/database.types';
import { lang } from '@/theme/tokens';

const { color, space, type } = lang;

/**
 * Camp talk.
 *
 * Not a chat app and not trying to be one: no typing indicators, no read
 * receipts, no realtime socket. Four people settling who brings what, polled
 * every ten seconds. Their group text still exists and that is fine.
 *
 * Long-press is the moderation surface Apple's Guideline 1.2 asks for --
 * report, block, and delete-your-own. The filter itself is server side, in
 * post_party_message, where no build of this client can skip it.
 */
export function PartyThread({ partyId }: { partyId: string }) {
  const { data: messages = [], isLoading } = usePartyThread(partyId);
  const post = usePostPartyMessage(partyId);
  const report = useReportPartyMessage(partyId);
  const block = useBlockUser(partyId);
  const remove = useDeletePartyMessage(partyId);
  const [draft, setDraft] = useState('');

  function send() {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    post.mutate(body, {
      onError: (err: unknown) => {
        const msg = (err as { message?: string } | null)?.message ?? '';
        setDraft(body); // give them their words back
        if (/objectionable/i.test(msg)) {
          Alert.alert('Not that', 'That message has language the app will not carry.');
        } else if (/not a member/i.test(msg)) {
          Alert.alert('Not in this party', 'You are no longer a member of this party.');
        } else {
          Alert.alert('Could not send', msg || 'Try again in a moment.');
        }
      },
    });
  }

  function onLongPress(m: PartyMessage) {
    if (m.mine) {
      Alert.alert('Your message', undefined, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(m.id) },
      ]);
      return;
    }
    Alert.alert(m.display_name, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Report this message',
        onPress: () =>
          report.mutate(
            { id: m.id },
            {
              onSuccess: () =>
                Alert.alert('Reported', 'Thanks — we look at every report.'),
            },
          ),
      },
      {
        text: `Block ${m.display_name}`,
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            `Block ${m.display_name}?`,
            'You will not see their messages, and they will not see yours.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Block',
                style: 'destructive',
                onPress: () => block.mutate({ userId: m.user_id }),
              },
            ],
          ),
      },
    ]);
  }

  return (
    <View style={{ marginTop: space.section }}>
      <Text style={styles.heading}>CAMP TALK</Text>

      {isLoading ? (
        <ActivityIndicator color={color.copper} style={{ marginTop: space.x16 }} />
      ) : messages.length === 0 ? (
        <Text style={styles.empty}>
          Nothing said yet. Who&rsquo;s bringing what, where you&rsquo;re meeting, what the
          weather did — it all lives here instead of scrolling away in a text thread.
        </Text>
      ) : (
        messages.map((m) => (
          <Pressable
            key={m.id}
            onLongPress={() => onLongPress(m)}
            delayLongPress={350}
            accessibilityRole="button"
            accessibilityLabel={`${m.display_name} at ${clock(m.created_at)}: ${m.body}. Long press for options.`}
            style={styles.msg}
          >
            <Avatar name={m.display_name} url={m.avatar_url} size={30} />
            <View style={{ flex: 1 }}>
              <View style={styles.msgHead}>
                <Text style={styles.who}>{m.mine ? 'You' : m.display_name}</Text>
                <Text style={styles.when}>{clock(m.created_at)}</Text>
              </View>
              <Text style={styles.body}>{m.body}</Text>
            </View>
          </Pressable>
        ))
      )}

      <View style={styles.composer}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Say something to the party"
          placeholderTextColor={color.dim}
          style={styles.input}
          multiline
          maxLength={2000}
          returnKeyType="send"
          onSubmitEditing={send}
          accessibilityLabel="Message the party"
        />
        <Pressable
          onPress={send}
          disabled={!draft.trim() || post.isPending}
          accessibilityRole="button"
          accessibilityLabel="Send"
          style={[styles.send, (!draft.trim() || post.isPending) && styles.sendOff]}
        >
          <Text style={styles.sendLabel}>{post.isPending ? '…' : 'Send'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontFamily: type.uiMedium,
    fontSize: 11,
    letterSpacing: 1.4,
    color: color.dim,
    marginBottom: space.x8,
  },
  empty: { fontFamily: type.ui, fontSize: 14, color: color.muted, lineHeight: 21 },
  msg: { flexDirection: 'row', gap: space.x12, paddingVertical: space.x12 },
  msgHead: { flexDirection: 'row', alignItems: 'baseline', gap: space.x8 },
  who: { fontFamily: type.uiMedium, fontSize: 13.5, color: color.bone },
  when: { fontFamily: type.ui, fontSize: 12, color: color.dim },
  body: { fontFamily: type.ui, fontSize: 15, color: color.muted, lineHeight: 22, marginTop: 2 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: space.x8, marginTop: space.x16 },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: space.x12,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hair,
    backgroundColor: color.tile,
    color: color.bone,
    fontFamily: type.ui,
    fontSize: 15,
  },
  send: {
    height: 44,
    paddingHorizontal: space.x16,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.fill,
    borderWidth: 1,
    borderColor: color.copper,
  },
  sendOff: { opacity: 0.45 },
  sendLabel: { fontFamily: type.uiSemiBold, fontSize: 13.5, color: color.copper },
});
