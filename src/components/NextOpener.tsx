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
import { LinkSentence, Serif } from '@/components/system';
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

/** The countdown as a tail beside a date: "today", "tomorrow", "6 days out". */
export function countdownTail(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `${days} days out`;
}

export function NextOpener({
  speciesName,
  dateLabel,
  detail,
  days,
  promise,
  onOpenSeason,
  onSeeNotices,
  onSignIn,
  onChangeTiming,
}: {
  speciesName: string;
  /** "Sat 14 Nov" — the payload, so it gets the serif and the copper. */
  dateLabel: string;
  /** What and where, without the date: "Youth Days · Statewide" */
  detail: string;
  days: number;
  promise: PromiseState;
  onOpenSeason: () => void;
  onSeeNotices: () => void;
  onSignIn: () => void;
  onChangeTiming: () => void;
}) {
  return (
    <View>
      {/* No eyebrow. "NEXT OPENER · GEORGIA" was an uppercase label saying
          what the plate already says, in a state the header already names —
          and the language has no uppercase section headers (D-rules). The
          species is the heading. */}
      <Pressable
        onPress={onOpenSeason}
        accessibilityRole="button"
        // The sentence this block used to print survives for a screen
        // reader, which wants prose where the eye wants a plate.
        accessibilityLabel={`${speciesName} ${openVerb(speciesName)} ${whenPhrase(days)}. ${detail}`}
        style={({ pressed }) => [pressed && { opacity: 0.8 }]}
      >
        <Serif size={44} style={styles.species}>
          {speciesName}
        </Serif>
        <View style={styles.dateRow}>
          <Serif size={29} copper>
            {dateLabel}
          </Serif>
          <Text style={styles.countdown}>{countdownTail(days)}</Text>
        </View>
        <Text style={styles.detail}>{detail}</Text>
      </Pressable>

      {/* A rule, not a tile edge: it closes the plate and separates it from
          the promise without wrapping the hero in another rounded box. */}
      <View style={styles.heroRule} />

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
        /* A count, so it takes the serif. It also gives the row a right-hand
           anchor, which is what stops a list of these reading as a wall. */
        <Serif size={21} copper>
          {days <= 0 ? 'today' : `${days}d`}
        </Serif>
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
  const length = `${h}h ${String(m).padStart(2, '0')}m`;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Legal light today, ${approx ? 'about ' : ''}${window}, ${length}`}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
    >
      {/* Shaped exactly like an opener row, because it now shares a panel with
          them. The uppercase "LEGAL LIGHT TODAY" label is gone: a row whose
          title is "Legal light" does not need a header announcing it. */}
      <Ionicons name="sunny-outline" size={14} color={color.dim} style={{ width: 16 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.rowTitle}>Legal light</Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {approx ? '≈ ' : ''}
          {window}
        </Text>
      </View>
      {/* A span of time, so it takes the serif like the counts beside it. */}
      <Serif size={21} copper>
        {length}
      </Serif>
      <Ionicons name="chevron-forward" size={14} color={color.copper} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The species is a species and the date is a date, so both take the display
  // serif — the rule the old sans headline broke while the only serif on the
  // screen was the sun times.
  species: { lineHeight: 48, marginTop: space.x16 },
  dateRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.x12, marginTop: space.x12 },
  countdown: { fontFamily: type.ui, fontSize: 13, color: color.dim },
  detail: { fontFamily: type.ui, fontSize: 13, color: color.dim, marginTop: space.x4 },
  heroRule: { height: StyleSheet.hairlineWidth, backgroundColor: color.rule, marginTop: space.x16 },

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
  rowArm: { fontFamily: type.uiMedium, fontSize: 12.5, color: color.copper },
});
