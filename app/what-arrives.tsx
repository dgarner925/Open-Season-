/**
 * What arrives — every notice the app will send you, in the order it will
 * send them, worded exactly as it will word them.
 *
 * The point (David, 2026-11-08): telling someone a season is starting is what
 * this app is for, and nobody can tell that from a list of dates. So this
 * screen shows the actual queue — the same titles and bodies `notifications_due()`
 * builds on the server, at the times pg_cron will fire them — and then says
 * what is switched on. Nothing here is a mock-up of a notification; if the
 * queue is empty it says so rather than inventing one.
 *
 * It is deliberately not Pro-gated: it is the promise, not a feature.
 */
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Headline, LinkSentence, Micro, Row, Screen, Sentence, Tile } from '@/components/system';
import { NotificationsOffBanner } from '@/components/NotificationsOffBanner';
import { useAlertPreferences, type AlertPref } from '@/features/alerts/queries';
import { firingWhen, firingsFor, localISO, offsetLabel, type Firing } from '@/features/alerts/promise';
import { useFollowedSeasons, useFollowedWindows } from '@/features/reference/queries';
import { useAuth } from '@/providers/AuthProvider';
import { lang } from '@/theme/tokens';

const { color, space, radius, type } = lang;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'Nov 14' — Postgres `to_char(date, 'Mon DD')`, which is what the body says. */
function monDD(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${String(d).padStart(2, '0')}`;
}

const COUNT_WORD = ['No', 'One', 'Two', 'Three', 'Four', 'Five'];

type Notice = { firing: Firing; title: string; body: string; kind: 'opener' | 'deadline' };

/**
 * The queue, built from the same three inputs the server uses: what you
 * follow, how far ahead you asked to hear, and the dates themselves. Wording
 * mirrors notifications_due() — see
 * supabase/migrations/20260731210100_date_change_watchdog.sql.
 */
function useQueue(limit = 5): Notice[] {
  const { data: prefs = [] } = useAlertPreferences();
  const { data: seasons = [] } = useFollowedSeasons();
  const { data: windows = [] } = useFollowedWindows();

  return useMemo(() => {
    const today = localISO();
    const prefFor = (stateId: string, speciesId: string): AlertPref | undefined =>
      prefs.find((p) => p.state_id === stateId && p.species_id === speciesId);
    const out: Notice[] = [];

    for (const s of seasons) {
      if (!s.open_date || s.open_date < today) continue;
      const p = prefFor(s.state_id, s.species_id);
      if (!p) continue;
      // A follow scoped to certain methods only speaks for those.
      if (p.methods !== null && !p.methods.includes(s.method)) continue;
      const species = s.species?.name ?? 'Season';
      for (const f of firingsFor(s.open_date, p.opener_offsets)) {
        out.push({
          firing: f,
          kind: 'opener',
          title: `${species} opens in ${f.offset} day${f.offset === 1 ? '' : 's'}`,
          body: `${s.state?.code ?? ''} ${species} (${s.method}) opens ${monDD(s.open_date)}`.trim(),
        });
      }
    }

    for (const w of windows) {
      if (!w.closes_at || w.closes_at < today) continue;
      const p = prefFor(w.state_id, w.species_id);
      if (!p) continue;
      const species = w.species?.name ?? 'Draw';
      for (const f of firingsFor(w.closes_at, p.deadline_offsets)) {
        out.push({
          firing: f,
          kind: 'deadline',
          title: `${species} tag deadline in ${f.offset} day${f.offset === 1 ? '' : 's'}`,
          body: `${w.state?.code ?? ''} ${species} ${w.name ?? 'draw'} closes ${monDD(w.closes_at)}`.trim(),
        });
      }
    }

    return out.sort((a, b) => a.firing.at.getTime() - b.firing.at.getTime()).slice(0, limit);
  }, [prefs, seasons, windows, limit]);
}

/** "a year · a month · a week · the day before" — the cadence, spoken. */
function cadence(offsets: number[]): string {
  if (offsets.length === 0) return 'Switched off';
  return offsets
    .slice()
    .sort((a, b) => b - a)
    .map((o) => offsetLabel(o))
    .join(' · ');
}

export default function WhatArrives() {
  const router = useRouter();
  const { isGuest } = useAuth();
  const { data: prefs = [] } = useAlertPreferences();
  const queue = useQueue();

  // The cadences are per-follow, so a user with several follows can have
  // several. Show the widest set — the question this screen answers is "how
  // early does this app speak", not "what did I set for elk in Montana".
  const widest = (pick: (p: AlertPref) => number[]): number[] => {
    let best: number[] = [];
    for (const p of prefs) if (pick(p).length > best.length) best = pick(p);
    return best;
  };

  const n = Math.min(queue.length, COUNT_WORD.length - 1);

  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: true, title: '' }} />

      <Headline size={38} style={{ marginTop: space.x16 }}>
        {isGuest
          ? 'Nothing yet.'
          : queue.length === 0
            ? 'Quiet for now.'
            : `${COUNT_WORD[n]} notice${n === 1 ? '' : 's'},\nthen quiet.`}
      </Headline>

      <Sentence style={{ marginTop: space.x12 }}>
        {isGuest
          ? 'Reminders need an account to hang on — the dates stay free either way.'
          : queue.length === 0
            ? 'Nothing is queued for the hunts you follow. Follow a species, or ask to hear about it earlier, and the notices show up here.'
            : 'No digest, no feed, nothing to check. This is everything the app will send you, worded the way it will arrive.'}
      </Sentence>

      {isGuest ? (
        <LinkSentence style={{ marginTop: space.x16 }} onPress={() => router.push('/(auth)/sign-in')}>
          Make an account and we'll tell you
        </LinkSentence>
      ) : null}

      <View style={{ marginTop: space.x16 }}>
        <NotificationsOffBanner />
      </View>

      {queue.map((notice) => (
        <View key={`${notice.title}-${notice.firing.at.getTime()}`} style={styles.notice}>
          <View style={styles.noticeHead}>
            <View style={styles.mark}>
              <Ionicons name={notice.kind === 'opener' ? 'calendar-outline' : 'alarm-outline'} size={11} color={color.copper} />
            </View>
            <Micro style={{ flex: 1 }}>Open Season</Micro>
            <Text style={styles.noticeWhen}>{firingWhen(notice.firing)}</Text>
          </View>
          <Text style={styles.noticeTitle}>{notice.title}</Text>
          <Text style={styles.noticeBody}>{notice.body}</Text>
        </View>
      ))}

      {!isGuest ? (
        <Tile style={{ marginTop: space.section }}>
          <Micro>What you get told</Micro>
          <Row
            title="Openers"
            subtitle={cadence(widest((p) => p.opener_offsets))}
            onPress={() => router.push('/alerts')}
          />
          <Row
            title="Tag deadlines"
            subtitle={cadence(widest((p) => p.deadline_offsets))}
            onPress={() => router.push('/alerts')}
          />
          <Row
            title="Draw results"
            subtitle={cadence(widest((p) => p.results_offsets))}
            onPress={() => router.push('/alerts')}
          />
          <Row
            title="When a date changes"
            subtitle="Always. If the agency moves a date you were following, you hear about it."
            last
          />
          <Sentence tone="dim" style={{ marginTop: space.x16, fontSize: 13 }}>
            Every notice goes out in one morning pass, so the app never speaks twice in a day about the
            same hunt. Times above are your phone's.
          </Sentence>
        </Tile>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // A notice looks like a notice: the app's mark, the hour, two lines. Not a
  // fake lock screen — no status bar, no borrowed iOS chrome.
  notice: {
    marginTop: space.x12,
    padding: space.x16,
    borderRadius: radius.card,
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hair,
  },
  noticeHead: { flexDirection: 'row', alignItems: 'center', gap: space.x8 },
  mark: {
    width: 20,
    height: 20,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.fill,
  },
  noticeWhen: { fontFamily: type.ui, fontSize: 11.5, color: color.muted, fontVariant: ['tabular-nums'] },
  noticeTitle: { marginTop: space.x12, fontFamily: type.uiSemiBold, fontSize: 14.5, color: color.bone },
  noticeBody: { marginTop: space.x4, fontFamily: type.ui, fontSize: 13, lineHeight: 19, color: color.muted },
});
