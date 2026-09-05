/**
 * Shooting hours, the whole season — every day's legal window from opener to
 * closer, computed on-device (suncalc + the state's verified offsets), grouped
 * by month, shareable as a plain-text table for the dash. Works offline: the
 * only network involved is the one-time GPS fix, and the state centroid covers
 * even that.
 */
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { LinkSentence, Micro, Screen, Sentence, Serif } from '@/components/system';
import rules from '@/assets/legal-light.json';
import centroids from '@/assets/state-centroids.json';
import { getFix } from '@/features/legalLight/useLegalLight';
import { formatClock, legalLight } from '@/lib/sun';
import { lang } from '@/theme/tokens';

const { color, space, type } = lang;

type Rule = { before: number; after: number; note?: string; none?: boolean };
const RULES = rules as Record<string, Rule>;
const CENTROIDS = centroids as Record<string, { lat: number; lng: number }>;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_DAYS = 200; // a sane cap for the odd multi-month season

type DayRow = { label: string; month: string; start: string; end: string; dur: string; opener: boolean };

function phrase(r: Rule): string {
  if (r.before === 30 && r.after === 30) return 'Half an hour past each edge of the sun.';
  if (r.before === 0 && r.after === 0) return 'Sunrise to sunset, exactly.';
  if (r.before === 60 && r.after === 60) return 'A full hour past each edge of the sun.';
  if (r.after === 0) return `${r.before} minutes before sunrise, ending at sunset.`;
  return `${r.before} minutes before sunrise to ${r.after} after sunset.`;
}

export default function ShootingHours() {
  const { state, title, open, close } = useLocalSearchParams<{ state: string; title: string; open: string; close: string }>();
  const [rows, setRows] = useState<DayRow[] | null>(null);
  const [approx, setApprox] = useState(false);

  const rule = state ? RULES[state] : undefined;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!state || !open || !close || !rule || rule.none) return;
      const fix = await getFix();
      const at = fix ?? CENTROIDS[state];
      if (!at || cancelled) return;
      const [oy, om, od] = open.split('-').map(Number);
      const [cy, cm, cd] = close.split('-').map(Number);
      const first = new Date(oy, om - 1, od);
      const last = new Date(cy, cm - 1, cd);
      const out: DayRow[] = [];
      for (let d = new Date(first); d <= last && out.length < MAX_DAYS; d.setDate(d.getDate() + 1)) {
        const ll = legalLight(new Date(d), at.lat, at.lng, rule.before, rule.after);
        if (!ll) continue;
        const min = Math.round((ll.end.getTime() - ll.start.getTime()) / 60000);
        out.push({
          label: `${DAYS[d.getDay()]} ${d.getDate()}`,
          month: MONTHS[d.getMonth()].toUpperCase() + (d.getFullYear() !== first.getFullYear() ? ` ${d.getFullYear()}` : ''),
          start: formatClock(ll.start),
          end: formatClock(ll.end),
          dur: `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`,
          opener: out.length === 0,
        });
      }
      if (!cancelled) {
        setRows(out);
        setApprox(!fix);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, open, close]);

  const months = useMemo(() => {
    const order: string[] = [];
    for (const r of rows ?? []) if (!order.includes(r.month)) order.push(r.month);
    return order;
  }, [rows]);

  async function onShare() {
    if (!rows) return;
    const lines: string[] = [`Shooting hours — ${title ?? ''}`, phrase(rule!), ''];
    let m = '';
    for (const r of rows) {
      if (r.month !== m) {
        m = r.month;
        lines.push(m);
      }
      lines.push(`${r.label.padEnd(8)} ${r.start} – ${r.end}`);
    }
    lines.push('', 'Computed by Open Season for your location — carry the official table where required.');
    await Share.share({ message: lines.join('\n') }).catch(() => {});
  }

  if (!rule || rule.none) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: 'Shooting hours' }} />
        <Sentence tone="bone" style={{ marginTop: space.section }}>
          This state doesn't set legal shooting hours for this hunt — check the official regulations.
        </Sentence>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: true, title: '' }} />
      <Serif size={type.size.hero - 12} style={{ marginTop: space.x16, lineHeight: type.size.hero - 6 }}>
        Shooting hours
      </Serif>
      <Sentence style={{ marginTop: space.x8 }}>
        {title}. {phrase(rule)}
      </Sentence>

      {rows === null ? (
        <Sentence style={{ marginTop: space.section }}>Reading the sun…</Sentence>
      ) : (
        <View style={styles.tile}>
          {months.map((m) => (
            <View key={m}>
              <Micro style={{ marginTop: space.x16, marginBottom: space.x4 }}>{m}</Micro>
              {rows
                .filter((r) => r.month === m)
                .map((r, i, arr) => (
                  <View key={r.label + m} style={[styles.row, i !== arr.length - 1 && styles.rowRule]}>
                    <Text style={[styles.day, r.opener && { color: color.copper, fontFamily: type.uiSemiBold }]}>
                      {r.label}
                      {r.opener ? '  ·  opener' : ''}
                    </Text>
                    <Serif size={17}>
                      {approx ? '≈ ' : ''}
                      {r.start} – {r.end}
                    </Serif>
                    <Text style={styles.dur}>{r.dur}</Text>
                  </View>
                ))}
            </View>
          ))}
          {rows.length >= MAX_DAYS ? (
            <Sentence tone="dim" style={{ marginTop: space.x12, fontSize: 13 }}>
              Showing the first {MAX_DAYS} days.
            </Sentence>
          ) : null}
        </View>
      )}

      {rows && rows.length > 0 ? (
        <LinkSentence style={{ marginTop: space.section }} onPress={onShare}>
          Share or print this table.
        </LinkSentence>
      ) : null}
      {rule.note ? (
        <Sentence tone="dim" style={{ marginTop: space.x12, fontSize: 13 }}>
          {rule.note}
        </Sentence>
      ) : null}
      <Sentence tone="dim" style={{ marginTop: space.x12, marginBottom: space.section, fontSize: 13 }}>
        Computed for your location{approx ? " (state center — enable location for your spot's times)" : ''} — carry the
        official table where required.
      </Sentence>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tile: {
    marginTop: space.x16,
    paddingHorizontal: space.gutter,
    paddingBottom: space.x16,
    borderRadius: lang.radius.card,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hair,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.x8, minHeight: 40 },
  rowRule: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.hair },
  day: { fontFamily: type.ui, fontSize: 14.5, color: color.bone, width: 132 },
  dur: { fontFamily: type.ui, fontSize: 12.5, color: color.dim, width: 64, textAlign: 'right' },
});
