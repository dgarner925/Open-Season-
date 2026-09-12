/**
 * The season ahead — every date you follow on one scrolling line: openers,
 * closers, and draw deadlines in order, today glowing on the spine, the
 * months that hold nothing admitting it. Below the hunter's own line, the
 * discovery rule (same law as the Weekend Brief): openers in their states
 * they don't follow yet, dimmed, one tap to claim.
 *
 * Lives behind the "Openers" stat tile on Home. The Seasons tab stays the
 * reference view; this is the felt one.
 */
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinkSentence, Micro, Screen, Sentence, Serif } from '@/components/system';
import { useAuth } from '@/providers/AuthProvider';
import { useFollows, useToggleFollow } from '@/features/follows/queries';
import { useFollowedSeasons, useFollowedWindows, useWeekendStateOpeners } from '@/features/reference/queries';
import { lang } from '@/theme/tokens';

const { color, space, type } = lang;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const DATE_COL = 62;
const NODE_COL = 30;
const SPINE_X = DATE_COL + NODE_COL / 2;

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDaysISO(base: string, n: number): string {
  const [y, m, d] = base.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
function cap(s: string | null | undefined): string {
  const t = (s ?? '').trim();
  return t ? t[0].toUpperCase() + t.slice(1) : '';
}
function dateChip(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${MON[m - 1]} ${d}`;
}
/** "September" / "January 2027" — year only once it differs from today's. */
function monthKey(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  const thisYear = new Date().getFullYear();
  return y === thisYear ? MONTHS[m - 1] : `${MONTHS[m - 1]} ${y}`;
}
function monthIndex(iso: string): number {
  const [y, m] = iso.split('-').map(Number);
  return y * 12 + (m - 1);
}

type Ev = {
  key: string;
  d: string;
  species: string;
  sub: string;
  today: boolean;
  soon: boolean;
  route: { pathname: '/season/[id]' | '/window/[id]'; params: { id: string } };
};

export default function Timeline() {
  const router = useRouter();
  const { profile } = useAuth();
  const { data: follows = [] } = useFollows();
  const { data: seasons = [] } = useFollowedSeasons();
  const { data: windows = [] } = useFollowedWindows();
  const toggleFollow = useToggleFollow();

  const iso = todayISO();
  const horizon = addDaysISO(iso, 365);
  const trackedStateIds = useMemo(
    () => [...new Set([...follows.map((f) => f.state_id), ...(profile?.resident_state_id ? [profile.resident_state_id] : [])])],
    [follows, profile?.resident_state_id],
  );
  const followedPairs = useMemo(() => new Set(follows.map((f) => `${f.state_id}|${f.species_id}`)), [follows]);
  const { data: stateOpeners = [] } = useWeekendStateOpeners(trackedStateIds, iso, horizon);

  // The hunter's own line: openers, closers, draw deadlines — one entry per
  // fact (same dedup law as the Weekend Brief).
  const events = useMemo<Ev[]>(() => {
    const out: Ev[] = [];
    const seen = new Set<string>();
    const soonEdge = addDaysISO(iso, 7);
    const add = (e: Ev) => {
      const sig = `${e.d}|${e.species}|${e.sub}`;
      if (seen.has(sig)) return;
      seen.add(sig);
      out.push(e);
    };
    for (const s of seasons) {
      const what = s.label ?? cap(s.method);
      const state = s.state?.name ?? s.state?.code ?? '';
      if (s.open_date && s.open_date >= iso && s.open_date <= horizon) {
        add({
          key: `o-${s.id}`,
          d: s.open_date,
          species: s.species?.name ?? 'Season',
          sub: `${state} · ${what} opens${s.open_date === iso ? ' today' : ''}`,
          today: s.open_date === iso,
          soon: s.open_date <= soonEdge,
          route: { pathname: '/season/[id]', params: { id: s.id } },
        });
      }
      if (s.close_date && s.close_date >= iso && s.close_date <= horizon && s.open_date && s.open_date <= iso) {
        add({
          key: `c-${s.id}`,
          d: s.close_date,
          species: s.species?.name ?? 'Season',
          sub: `${state} · ${what} closes — the last day`,
          today: false,
          soon: s.close_date <= soonEdge,
          route: { pathname: '/season/[id]', params: { id: s.id } },
        });
      }
    }
    for (const w of windows) {
      if (w.closes_at && w.closes_at >= iso && w.closes_at <= horizon) {
        add({
          key: `w-${w.id}`,
          d: w.closes_at,
          species: w.species?.name ?? 'Draw',
          sub: `${w.state?.name ?? w.state?.code ?? ''} · ${w.name ?? 'Draw'} closes`,
          today: w.closes_at === iso,
          soon: w.closes_at <= soonEdge,
          route: { pathname: '/window/[id]', params: { id: w.id } },
        });
      }
    }
    return out.sort((a, b) => a.d.localeCompare(b.d) || a.species.localeCompare(b.species));
  }, [seasons, windows, iso, horizon]);

  // Discovery: earliest upcoming opener per unfollowed (state, species) pair
  // in the hunter's states, dimmed below their line.
  const discovery = useMemo(() => {
    const seenPair = new Set<string>();
    const out: typeof stateOpeners = [];
    for (const s of stateOpeners) {
      if (!s.open_date || !s.state_id || !s.species_id) continue;
      const pair = `${s.state_id}|${s.species_id}`;
      if (followedPairs.has(pair) || seenPair.has(pair)) continue;
      seenPair.add(pair);
      out.push(s);
      if (out.length >= 8) break;
    }
    return out;
  }, [stateOpeners, followedPairs]);

  // Rows in render order: month headers, entries, and the quiet months
  // between them, admitted rather than hidden.
  const rows = useMemo(() => {
    const r: ({ t: 'month'; label: string } | { t: 'quiet'; label: string } | { t: 'ev'; ev: Ev })[] = [];
    let lastMonth: string | null = null;
    let lastIdx: number | null = null;
    for (const ev of events) {
      const mk = monthKey(ev.d);
      const mi = monthIndex(ev.d);
      if (mk !== lastMonth) {
        if (lastIdx !== null && mi - lastIdx === 2) {
          const [y, m] = ev.d.split('-').map(Number);
          const qm = m - 2 < 0 ? MONTHS[m - 2 + 12] : MONTHS[m - 2];
          r.push({ t: 'quiet', label: `Nothing opens in ${qm}.` });
        } else if (lastIdx !== null && mi - lastIdx > 2) {
          r.push({ t: 'quiet', label: 'A quiet stretch — nothing on the line.' });
        }
        r.push({ t: 'month', label: mk });
        lastMonth = mk;
        lastIdx = mi;
      }
      r.push({ t: 'ev', ev });
    }
    return r;
  }, [events]);

  const hasFollows = follows.length > 0;

  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: true, title: '' }} />
      <Serif size={type.size.hero - 12} style={{ marginTop: space.x16, lineHeight: type.size.hero - 6 }}>
        The season ahead
      </Serif>
      <Sentence style={{ marginTop: space.x8 }}>
        {hasFollows ? 'Every date you follow, in order. Scroll into winter.' : 'Follow a hunt and its dates take the line.'}
      </Sentence>

      <View style={styles.line}>
        <LinearGradient
          colors={['rgba(224,164,128,0.9)', 'rgba(184,122,90,0.35)', 'rgba(184,122,90,0.06)']}
          style={styles.spine}
          pointerEvents="none"
        />

        {rows.map((row, i) =>
          row.t === 'month' ? (
            <Micro key={`m-${row.label}`} style={[styles.month, i === 0 && { marginTop: 0 }]}>
              {row.label}
            </Micro>
          ) : row.t === 'quiet' ? (
            <Text key={`q-${i}`} style={styles.quiet}>
              {row.label}
            </Text>
          ) : (
            <Pressable
              key={row.ev.key}
              onPress={() => router.push(row.ev.route)}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
            >
              <Text style={[styles.date, (row.ev.today || row.ev.soon) && { color: color.copper }]}>{dateChip(row.ev.d)}</Text>
              <View style={styles.nodeCol}>
                {row.ev.today ? (
                  <View style={styles.halo}>
                    <View style={styles.nodeToday} />
                  </View>
                ) : (
                  <View style={[styles.node, row.ev.soon && styles.nodeSoon]} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Serif size={24}>{row.ev.species}</Serif>
                <Text style={[styles.sub, row.ev.today && { color: color.copper, fontFamily: type.uiSemiBold }]}>{row.ev.sub}</Text>
              </View>
            </Pressable>
          ),
        )}

        {hasFollows && events.length === 0 ? (
          <Sentence tone="dim" style={{ marginTop: space.section, marginLeft: DATE_COL + NODE_COL }}>
            Nothing upcoming on your line — the year's dates may not be posted yet.
          </Sentence>
        ) : null}

        {/* Also in your states — the discovery arm. */}
        {discovery.length > 0 ? (
          <>
            <View style={styles.discRule} />
            <Micro style={[styles.month, { color: 'rgba(217,158,127,0.65)' }]}>Also in your states</Micro>
            <Text style={styles.quietSub}>Openers you don't follow yet — one tap adds them to your line.</Text>
            {discovery.map((s) => (
              <Pressable
                key={`d-${s.id}`}
                onPress={() => router.push({ pathname: '/season/[id]', params: { id: s.id } })}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
              >
                <Text style={[styles.date, { color: color.dim }]}>{dateChip(s.open_date!)}</Text>
                <View style={styles.nodeCol}>
                  <View style={[styles.node, { borderColor: 'rgba(138,130,121,0.55)' }]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Serif size={24} style={{ color: color.muted }}>
                    {s.species?.name ?? 'Season'}
                  </Serif>
                  <Text style={[styles.sub, { color: color.dim }]}>
                    {(s.state?.name ?? '') + ' · ' + (s.label ?? cap(s.method)) + ' opens'}
                  </Text>
                </View>
                <Pressable
                  hitSlop={10}
                  disabled={toggleFollow.isPending}
                  onPress={() => toggleFollow.mutate({ stateId: s.state_id, speciesId: s.species_id })}
                >
                  <Text style={styles.follow}>Follow ›</Text>
                </Pressable>
              </Pressable>
            ))}
          </>
        ) : null}
      </View>

      {!hasFollows ? (
        <LinkSentence style={{ marginTop: space.section }} onPress={() => router.push('/follows')}>
          Choose your quarry.
        </LinkSentence>
      ) : null}

      <Sentence tone="dim" style={{ marginTop: space.section, marginBottom: space.section, fontSize: 13 }}>
        Openers, closers, and draw deadlines for the next twelve months. Tap any date for its page.
      </Sentence>
    </Screen>
  );
}

const styles = StyleSheet.create({
  line: { position: 'relative', marginTop: space.section },
  spine: { position: 'absolute', left: SPINE_X - 1, top: 6, bottom: 0, width: 2 },
  month: { marginLeft: DATE_COL + NODE_COL, marginTop: space.section, marginBottom: space.x4 },
  quiet: {
    marginLeft: DATE_COL + NODE_COL,
    marginTop: space.section,
    fontFamily: type.ui,
    fontSize: 14,
    color: color.dim,
  },
  quietSub: { marginLeft: DATE_COL + NODE_COL, marginTop: 2, fontFamily: type.ui, fontSize: 13.5, color: color.dim },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.x12 },
  date: {
    width: DATE_COL,
    textAlign: 'right',
    paddingRight: 10,
    fontFamily: type.uiSemiBold,
    fontSize: 12.5,
    letterSpacing: 0.8,
    color: color.muted,
  },
  nodeCol: { width: NODE_COL, alignItems: 'center' },
  node: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: lang.color.bg,
    borderWidth: 1.6,
    borderColor: color.dim,
  },
  nodeSoon: { backgroundColor: color.copper, borderColor: color.copper },
  halo: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(242,239,236,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeToday: { width: 12, height: 12, borderRadius: 6, backgroundColor: color.copper },
  sub: { marginTop: 2, fontFamily: type.ui, fontSize: 13.5, color: color.muted },
  discRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.hair,
    marginTop: space.section,
    marginLeft: DATE_COL + NODE_COL,
  },
  follow: { fontFamily: type.uiSemiBold, fontSize: 14.5, color: color.copper, marginLeft: space.x8 },
});
