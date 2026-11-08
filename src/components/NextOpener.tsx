/**
 * The next opener, and the promise to say so before it arrives.
 *
 * This is the top of Home and the loudest thing in the app, because telling
 * someone when a season starts is what the app is for (David, 2026-11-08:
 * "amplify the main thing the app does, which is notifies users when seasons
 * start"). Three parts, in order of weight:
 *
 *   NextOpener  — the countdown as a sentence, then the promise with the exact
 *                 times it will be kept. Never a vague "reminders on": if the
 *                 screen can't name when the phone will buzz, the user has no
 *                 reason to believe it will.
 *   OpenerRow   — one opener in a list, carrying its own bell. Armed or not is
 *                 the only state a row needs to show.
 *   LightRow    — legal light, demoted to a single tappable line. The full
 *                 picture (sun arc, dawn conditions, the week) lives on the
 *                 outlook page, which is where it belongs (David, 2026-11-08).
 */
import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Headline, LinkSentence, Micro, Sentence, Serif } from '@/components/system';
import { firingWhen, promiseHead, type Firing } from '@/features/alerts/promise';
import { lang } from '@/theme/tokens';

const { color, space, radius, type } = lang;

/** Species named as plurals take the plural verb: "Ducks open", "Deer opens". */
const PLURAL_SPECIES = new Set(['Ducks', 'Geese', 'Doves', 'Rails', 'Snipe']);
export function openVerb(name: string | null | undefined): string {
  return PLURAL_SPECIES.has((name ?? '').trim()) ? 'open' : 'opens';
}

/** "today", "tomorrow", "in 7 days" — the countdown, spoken. */
export function whenPhrase(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

export type PromiseState =
  /** Followed, this method in scope, and notices still to come. */
  | { kind: 'armed'; firings: Firing[] }
  /** Followed and armed, but every reminder has already gone out. */
  | { kind: 'spent' }
  /** Followed, but this method isn't in the reminder's scope. */
  | { kind: 'unarmed' }
  /** Not following this species in this state. */
  | { kind: 'unfollowed' }
  /** No account, so there is nothing to hang a reminder on. */
  | { kind: 'guest' }
  /**
   * Prefs haven't landed yet. Shows nothing rather than guessing: claiming
   * "no reminder set" and then flipping to armed a beat later would teach the
   * user not to trust the block that matters most.
   */
  | { kind: 'loading' };

export function NextOpener({
  speciesName,
  detail,
  days,
  stateLabel,
  promise,
  onOpenSeason,
  onSeeNotices,
  onSignIn,
  onChangeTiming,
}: {
  speciesName: string;
  /** "Youth, Military & Veterans Days · Sat 14 Nov · Statewide" */
  detail: string;
  days: number;
  stateLabel: string | null;
  promise: PromiseState;
  onOpenSeason: () => void;
  onSeeNotices: () => void;
  onSignIn: () => void;
  onChangeTiming: () => void;
}) {
  return (
    <View>
      <Micro>{stateLabel ? `Next opener · ${stateLabel}` : 'Next opener'}</Micro>

      <Pressable onPress={onOpenSeason} accessibilityRole="button" style={({ pressed }) => [pressed && { opacity: 0.8 }]}>
        <Headline style={styles.headline}>
          {speciesName} {openVerb(speciesName)} {whenPhrase(days)}.
        </Headline>
        <Sentence style={{ marginTop: space.x12, fontSize: 13.5 }}>{detail}</Sentence>
      </Pressable>

      <PromiseBlock
        promise={promise}
        speciesName={speciesName}
        onOpenSeason={onOpenSeason}
        onSeeNotices={onSeeNotices}
        onSignIn={onSignIn}
        onChangeTiming={onChangeTiming}
      />
    </View>
  );
}

/** The promise, as a fact with times under it — not a switch. */
function PromiseBlock({
  promise,
  speciesName,
  onOpenSeason,
  onSeeNotices,
  onSignIn,
  onChangeTiming,
}: {
  promise: PromiseState;
  speciesName: string;
  onOpenSeason: () => void;
  onSeeNotices: () => void;
  onSignIn: () => void;
  onChangeTiming: () => void;
}) {
  if (promise.kind === 'loading') return null;
  const armed = promise.kind === 'armed';
  const head =
    promise.kind === 'armed'
      ? promiseHead(promise.firings)
      : promise.kind === 'spent'
        ? 'Every reminder for this one has gone out.'
        : promise.kind === 'unarmed'
          ? 'No reminder set for this hunt.'
          : promise.kind === 'unfollowed'
            ? `You don't follow ${speciesName.toLowerCase()} here.`
            : 'Reminders need an account.';

  return (
    <PromiseNote head={head} armed={armed} firings={promise.kind === 'armed' ? promise.firings.slice(1) : []}>
      <View style={{ marginTop: space.x12 }}>
        {promise.kind === 'armed' ? (
          <LinkSentence size={13} onPress={onSeeNotices}>
            See exactly what arrives
          </LinkSentence>
        ) : promise.kind === 'spent' ? (
          <LinkSentence size={13} onPress={onChangeTiming}>
            Add an earlier reminder
          </LinkSentence>
        ) : promise.kind === 'guest' ? (
          <LinkSentence size={13} onPress={onSignIn}>
            Make an account and we'll tell you
          </LinkSentence>
        ) : (
          <LinkSentence size={13} onPress={onOpenSeason}>
            Remind me before it opens
          </LinkSentence>
        )}
      </View>
    </PromiseNote>
  );
}

/**
 * The promise as an object: a bell, a claim, and the times behind it. Shared
 * with the season page so the same promise is worded the same way wherever it
 * appears — the hero states it, the season page confirms it.
 */
export function PromiseNote({
  head,
  armed,
  firings,
  children,
}: {
  head: string;
  armed: boolean;
  firings: Firing[];
  children?: ReactNode;
}) {
  return (
    <View style={styles.promise}>
      <View style={styles.promiseHead}>
        <Ionicons
          name={armed ? 'notifications' : 'notifications-off-outline'}
          size={15}
          color={armed ? color.copper : color.dim}
        />
        <Text style={styles.promiseTitle}>{head}</Text>
      </View>

      {firings.map((f) => (
        <View key={f.at.getTime()} style={styles.firing}>
          <Text style={styles.firingWhen}>{firingWhen(f)}</Text>
          <Text style={styles.firingLabel}>{f.label}</Text>
        </View>
      ))}

      {children}
    </View>
  );
}

/**
 * One opener in the list beneath the hero. The bell is the whole point: armed
 * in copper, unarmed in dim, so a glance down the list says which openers are
 * handled and which are still on you.
 */
export function OpenerRow({
  speciesName,
  detail,
  days,
  armed,
  onPress,
}: {
  speciesName: string;
  detail: string;
  days: number;
  armed: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${speciesName}, ${detail}, ${armed ? 'reminder set' : 'no reminder'}`}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
    >
      <Ionicons
        name={armed ? 'notifications' : 'notifications-off-outline'}
        size={14}
        color={armed ? color.copper : color.dim}
        style={{ width: 16 }}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {speciesName}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      {armed ? (
        <Text style={styles.rowDays}>{days <= 0 ? 'today' : `${days}d`}</Text>
      ) : (
        <Text style={styles.rowArm}>Remind me</Text>
      )}
    </Pressable>
  );
}

/** Legal light as one line, pointing at the page that tells the whole story. */
export function LightRow({
  window,
  durationMin,
  approx,
  onPress,
}: {
  window: string;
  durationMin: number;
  approx: boolean;
  onPress: () => void;
}) {
  const h = Math.floor(durationMin / 60);
  const m = durationMin % 60;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.lightRow, pressed && { opacity: 0.8 }]}>
      <View style={{ flex: 1 }}>
        <Micro>Legal light today</Micro>
        <Serif size={25} style={{ marginTop: space.x8 }}>
          {approx ? '≈ ' : ''}
          {window}
        </Serif>
      </View>
      <Text style={styles.lightLen}>
        {h}h {String(m).padStart(2, '0')}m
      </Text>
      <Ionicons name="chevron-forward" size={14} color={color.copper} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headline: { marginTop: space.x12 },

  // The one warm tile on Home. It used to be the only raised surface here;
  // now that every group gets a lift it keeps its standing by being copper
  // rather than white (David, 2026-11-08).
  promise: {
    marginTop: space.x16,
    padding: space.x16 + 2,
    borderRadius: radius.tile,
    backgroundColor: color.tileWarm,
  },
  promiseHead: { flexDirection: 'row', alignItems: 'center', gap: space.x8 },
  promiseTitle: { flex: 1, fontFamily: type.uiSemiBold, fontSize: 13.5, color: color.bone },
  firing: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.x12,
    marginTop: space.x12,
  },
  firingWhen: { fontFamily: type.uiMedium, fontSize: 13.5, color: color.bone, fontVariant: ['tabular-nums'] },
  firingLabel: { fontFamily: type.ui, fontSize: 12.5, color: color.muted },

  row: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space.x12, paddingVertical: 11 },
  rowTitle: { fontFamily: type.uiMedium, fontSize: 15.5, color: color.bone },
  rowSub: { fontFamily: type.ui, fontSize: 12.5, color: color.muted },
  rowDays: { fontFamily: type.uiMedium, fontSize: 12.5, color: color.muted, fontVariant: ['tabular-nums'] },
  rowArm: { fontFamily: type.uiMedium, fontSize: 12.5, color: color.copper },
  // Sits inside its own tile, so it carries no rule of its own.
  lightRow: { flexDirection: 'row', alignItems: 'center', gap: space.x12 },
  lightLen: { fontFamily: type.uiMedium, fontSize: 12.5, color: color.muted, fontVariant: ['tabular-nums'] },
});
