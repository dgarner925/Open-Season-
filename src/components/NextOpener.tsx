/**
 * The parts Home is built from, in the order Home asks them (David,
 * 2026-11-08): what is open, what opens next, what you follow.
 *
 * The screen used to lead with the next opener, which meant the one thing a
 * hunter could act on *this morning* — a season already running — sat at the
 * bottom of the page as a 34pt medallion row marked "Open", while something
 * six days away took the hero. That is the fault no amount of restyling the
 * boxes could fix; it was an ordering problem, not a surface problem.
 *
 *   TodayHero   — what is open today, as one tight sans sentence. The single
 *                 loudest thing on the screen. When nothing is open the next
 *                 opener takes the sentence instead, so the zone is never
 *                 empty and the page never has two heroes.
 *   LightLine   — legal light, attached to the hero rather than floating in a
 *                 tile of its own. It is the subtitle of *today*: the question
 *                 after "deer is open" is "what hours".
 *   OpenerRow   — one opener in the ledger, carrying its own bell. The next
 *                 opener is just the first row now (David, 2026-11-08: "the
 *                 Next Opener could be listed like the More ahead, use the
 *                 same titles"), so the sort order does the work a special
 *                 case used to do.
 *   PromiseNote — the promise, with the exact times it will be kept. Never a
 *                 vague "reminders on": if the screen can't name when the
 *                 phone will buzz, the user has no reason to believe it will.
 */
import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Headline, LinkSentence } from '@/components/system';
import { firingWhen, promiseHead, type Firing } from '@/features/alerts/promise';
import { headlineSize, lightRuleNote } from '@/features/home/sentences';
import { lang } from '@/theme/tokens';

const { color, space, radius, type } = lang;

// The sentences live in src/features/home/sentences.ts so they can be
// tested without a renderer. Re-exported here because Home imports its
// whole vocabulary from this file.
export {
  headlineSize,
  lightRuleNote,
  nextOpenerSentence,
  openVerb,
  todaySentence,
  whenPhrase,
} from '@/features/home/sentences';

/** What is open today — the loudest thing on the screen, and the only one. */
export function TodayHero({ sentence }: { sentence: string }) {
  return (
    <Headline size={headlineSize(sentence)} style={styles.todayHead}>
      {sentence}
    </Headline>
  );
}

/** Legal light, as the subtitle of today. Taps through to the full picture. */
export function LightLine({
  window,
  durationMin,
  before,
  after,
  approx,
  onPress,
}: {
  window: string;
  durationMin: number;
  before: number;
  after: number;
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
      style={({ pressed }) => [styles.lightLine, pressed && { opacity: 0.75 }]}
    >
      <Ionicons name="sunny-outline" size={15} color={color.copper} style={{ width: 16 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.lightTitle} numberOfLines={1}>
          Legal light {approx ? '≈ ' : ''}
          {window}
        </Text>
        <Text style={styles.lightSub} numberOfLines={1}>
          {length} · {lightRuleNote(before, after)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color={color.copper} />
    </Pressable>
  );
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

/**
 * The promise, as a fact with times under it — not a switch.
 *
 * It names its own subject now. It used to sit directly beneath a headline
 * that said "Bobwhite quail opens in 6 days", so "You'll hear from us Friday"
 * could only mean one thing; with the next opener folded into the ledger
 * there is no headline above it, so the species goes on the line below.
 */
export function PromiseBlock({
  promise,
  speciesName,
  openerLabel,
  onOpenSeason,
  onSeeNotices,
  onSignIn,
  onChangeTiming,
}: {
  promise: PromiseState;
  speciesName: string;
  /** "General · Sat 14 Nov" — what the promise is about, under the claim. */
  openerLabel: string;
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
    <PromiseNote
      head={head}
      subject={`${speciesName} · ${openerLabel}`}
      armed={armed}
      firings={promise.kind === 'armed' ? promise.firings.slice(1) : []}
    >
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
 * appears — Home states it, the season page confirms it.
 */
export function PromiseNote({
  head,
  subject,
  armed,
  firings,
  children,
}: {
  head: string;
  /** Who the promise is about. Omitted where the page already says. */
  subject?: string;
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

      {subject ? <Text style={styles.promiseSubject}>{subject}</Text> : null}

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
 * One opener in the ledger. The bell is the whole point: copper when armed,
 * dim when not, so a glance down the list says which openers are handled and
 * which are still on you.
 *
 * Copper does exactly one job in this list. It used to mark both the bell
 * (armed) and the "Remind me" text (unarmed) — the same colour on the handled
 * row and the unhandled one, which is no signal at all. "Remind me" is bone
 * now (David, 2026-11-08): it is the only text in that slot, so it still
 * reads as tappable, and the grey bell beside it already says unarmed.
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
      {/* The countdown is always here. It used to give way to the words
          "Remind me" on an unarmed row, which was survivable while the next
          opener had its own headline saying "opens in 6 days" — with that
          folded into this ledger, a guest saw five rows and not one number.
          A page about when seasons open has to say when. Armed rows print it
          brighter, so the bell is not the only thing carrying that state. */}
      <Text style={[styles.rowCount, armed && styles.rowCountArmed]}>
        {days <= 0 ? 'today' : `${days}d`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  todayHead: { marginTop: space.x12 },

  // Hung off the headline by a rule, not wrapped in a tile: it is part of
  // today, not a separate fact about it.
  lightLine: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.x12,
    marginTop: space.x16,
    paddingTop: space.x12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.rule,
  },
  lightTitle: { fontFamily: type.uiMedium, fontSize: 14.5, color: color.bone },
  lightSub: { fontFamily: type.ui, fontSize: 12.5, color: color.dim },

  // The one raised surface on Home. Everything else below the hero is
  // hairlines on the page, so a tile here means "this is a commitment we are
  // making you" rather than "these rows belong together".
  promise: {
    marginTop: space.x16,
    padding: space.x16 + 2,
    borderRadius: radius.tile,
    backgroundColor: color.tileWarm,
  },
  promiseHead: { flexDirection: 'row', alignItems: 'center', gap: space.x8 },
  promiseTitle: { flex: 1, fontFamily: type.uiSemiBold, fontSize: 13.5, color: color.bone },
  promiseSubject: { fontFamily: type.ui, fontSize: 12.5, color: color.muted, marginTop: space.x4 + 1 },
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
  rowCount: { fontFamily: type.ui, fontSize: 12.5, color: color.dim, fontVariant: ['tabular-nums'] },
  rowCountArmed: { fontFamily: type.uiMedium, color: color.bone },
});
