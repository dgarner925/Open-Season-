/**
 * The outlook — where the Home card leads. Today's legal light in full, the
 * next first light's conditions, and the week of dawns ahead: first-light
 * time, dawn temperature as far as NWS forecasts reach, and the moon. Days
 * that open one of your seasons carry the flag.
 *
 * Sun and moon are on-device (suncalc); only the temperatures need a network.
 */
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import * as SunCalc from 'suncalc';
import { Micro, Screen, Sentence, Serif, SunArc } from '@/components/system';
import { AlmanacCol, almanacStyles } from '@/components/AlmanacRow';
import rules from '@/assets/legal-light.json';
import centroids from '@/assets/state-centroids.json';
import { getFix, useLegalLight } from '@/features/legalLight/useLegalLight';
import { fetchHourlyPeriods, useDawnConditions } from '@/features/weather/useDawnConditions';
import { useFollowedSeasons } from '@/features/reference/queries';
import { formatClock, legalLight } from '@/lib/sun';
import { lang } from '@/theme/tokens';

const { color, space, type } = lang;

type Rule = { before: number; after: number; note?: string; none?: boolean };
const RULES = rules as Record<string, Rule>;
const CENTROIDS = centroids as Record<string, { lat: number; lng: number }>;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

type WeekRow = {
  iso: string;
  label: string; // "Tue 8"
  firstLight: string;
  tempF: number | null;
  moonPct: number;
  opener: string | null; // "DEER OPENER"
};

function phrase(r: Rule): string {
  if (r.before === 30 && r.after === 30) return 'half an hour past each edge of the sun';
  if (r.before === 0 && r.after === 0) return 'sunrise to sunset, exactly';
  if (r.before === 60 && r.after === 60) return 'a full hour past each edge of the sun';
  if (r.after === 0) return `${r.before} minutes before sunrise, ending at sunset`;
  return `${r.before} minutes before sunrise to ${r.after} after sunset`;
}

function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Outlook() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  const { width } = useWindowDimensions();
  const stateCode = state || null;
  const rule = stateCode ? RULES[stateCode] : undefined;

  const light = useLegalLight(stateCode, 0);
  const dawn = useDawnConditions(stateCode, 0);
  const { data: seasons = [] } = useFollowedSeasons();
  const [week, setWeek] = useState<WeekRow[] | null>(null);
  const [approx, setApprox] = useState(false);

  const now = new Date();
  const todayName = DAY_NAMES[now.getDay()];

  // The seven days ahead that open one of your seasons, by local date.
  const openers = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of seasons) {
      if (!s.open_date || !s.species?.name) continue;
      if (!map.has(s.open_date)) map.set(s.open_date, `${s.species.name.toUpperCase()} OPENER`);
    }
    return map;
  }, [seasons]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fix = await getFix();
      const at = fix ?? (stateCode ? CENTROIDS[stateCode] : null);
      if (!at || cancelled) return;
      // No shooting-hours rule (Alaska)? First light is plain sunrise.
      const before = rule && !rule.none ? rule.before : 0;
      const after = rule && !rule.none ? rule.after : 0;

      const rows: WeekRow[] = [];
      for (let i = 1; i <= 7; i++) {
        const day = new Date();
        day.setDate(day.getDate() + i);
        const ll = legalLight(day, at.lat, at.lng, before, after);
        if (!ll) continue;
        const iso = localISO(day);
        rows.push({
          iso,
          label: `${DAYS_SHORT[day.getDay()]} ${day.getDate()}`,
          firstLight: formatClock(ll.start),
          tempF: null,
          moonPct: Math.round(SunCalc.getMoonIllumination(ll.start).fraction * 100),
          opener: null,
        });
      }
      if (cancelled) return;
      setWeek(rows);
      setApprox(!fix);

      // Dawn temperatures, as far ahead as the hourly forecast reaches
      // (~6 days). Beyond that a row simply shows no temperature.
      const periods = await fetchHourlyPeriods(at);
      if (cancelled || periods.length === 0) return;
      setWeek((prev) =>
        (prev ?? rows).map((r) => {
          const day = new Date(r.iso + 'T12:00:00');
          const ll = legalLight(day, at.lat, at.lng, before, after);
          if (!ll) return r;
          const t = ll.start.getTime();
          const p = periods.find((x) => {
            const s = new Date(x.startTime).getTime();
            return s <= t && t < s + 3600_000;
          });
          return typeof p?.temperature === 'number' ? { ...r, tempF: p.temperature } : r;
        }),
      );
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateCode]);

  const weekRows = useMemo(
    () => (week ?? []).map((r) => ({ ...r, opener: openers.get(r.iso) ?? null })),
    [week, openers],
  );

  const dayFrac = (ms: number) => {
    const d = new Date(ms);
    return (d.getHours() * 60 + d.getMinutes()) / 1440;
  };
  const arcWidth = width - space.gutter * 4;
  const durH = light ? Math.floor(light.durationMin / 60) : 0;
  const durM = light ? light.durationMin % 60 : 0;

  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: true, title: '' }} />
      <Serif size={type.size.hero - 12} style={{ marginTop: space.x16, lineHeight: type.size.hero - 6 }}>
        The outlook
      </Serif>
      <Sentence style={{ marginTop: space.x8 }}>
        {todayName}, {MONTH_NAMES[now.getMonth()]} {now.getDate()}
        {rule && !rule.none ? ` — legal light runs ${phrase(rule)}.` : '.'}
      </Sentence>

      {light ? (
        <View style={styles.tile}>
          <Micro>Today</Micro>
          <Serif size={28} style={{ marginTop: space.x12 }}>
            {light.approx ? '≈ ' : ''}
            {light.startClock} – {light.endClock}
          </Serif>
          <Sentence style={{ marginTop: space.x8 }}>
            {'Legal light — '}
            <Serif italic size={19}>
              {durH}h {String(durM).padStart(2, '0')}m
            </Serif>
            {`. Sunrise ${light.sunrise}, sunset ${light.sunset}.`}
          </Sentence>
          <View style={{ marginTop: space.x12 }}>
            <SunArc width={arcWidth} startFrac={dayFrac(light.startMs)} endFrac={dayFrac(light.endMs)} nowFrac={dayFrac(Date.now())} />
            <View style={styles.tickRow}>
              <Micro style={{ position: 'absolute', left: Math.max(0, dayFrac(light.startMs) * arcWidth - 34) }}>
                First light
              </Micro>
              <Micro style={{ position: 'absolute', left: Math.min(arcWidth - 86, dayFrac(light.endMs) * arcWidth - 34) }}>
                Last light
              </Micro>
            </View>
          </View>
          {light.note ? (
            <Sentence tone="dim" style={{ marginTop: space.x8, fontSize: 13 }}>
              {light.note}
            </Sentence>
          ) : null}
        </View>
      ) : null}

      {dawn ? (
        <View style={styles.tile}>
          <Micro>{dawn.dayName === todayName ? 'At first light' : `${dawn.dayName} at first light`}</Micro>
          <View style={almanacStyles.row}>
            {dawn.tempF != null ? <AlmanacCol value={`${dawn.tempF}°`} label={(dawn.sky ?? 'temp').toUpperCase()} first /> : null}
            {dawn.windDir && dawn.windMph != null ? (
              <AlmanacCol value={`${dawn.windDir} ${dawn.windMph}`} label="WIND · MPH" first={dawn.tempF == null} />
            ) : null}
            {dawn.pressureInHg != null ? (
              <AlmanacCol
                value={dawn.pressureInHg.toFixed(1)}
                label={dawn.pressureTrend ? `PRESSURE · ${dawn.pressureTrend.toUpperCase()}` : 'PRESSURE'}
                trend={dawn.pressureTrend}
                first={false}
              />
            ) : null}
            <AlmanacCol value={`${dawn.moonPct}%`} label={`MOON · ${dawn.moonWaxing ? 'WAXING' : 'WANING'}`} first={false} />
          </View>
          {dawn.frontLine ? <Sentence style={{ marginTop: space.x8, fontSize: 14 }}>{dawn.frontLine}</Sentence> : null}
          {dawn.tempF == null && dawn.pressureInHg == null ? (
            <Sentence tone="dim" style={{ marginTop: space.x8, fontSize: 13 }}>
              Couldn't reach the weather service — the moon never needs it.
            </Sentence>
          ) : null}
        </View>
      ) : null}

      {weekRows.length > 0 ? (
        <View style={styles.tile}>
          <Micro>The week at first light</Micro>
          <View style={{ marginTop: space.x8 }}>
            {weekRows.map((r, i) => (
              <View key={r.iso} style={[styles.weekRow, i > 0 && styles.weekRule]}>
                <View style={styles.weekDayCell}>
                  <Text style={[styles.weekDay, r.opener && { color: color.copper, fontFamily: type.uiSemiBold }]}>{r.label}</Text>
                  {r.opener ? <Text style={styles.openerFlag}>{r.opener}</Text> : null}
                </View>
                <Serif size={17}>
                  {approx ? '≈ ' : ''}
                  {r.firstLight}
                </Serif>
                <Text style={styles.weekTemp}>{r.tempF != null ? `${r.tempF}°` : '—'}</Text>
                <Text style={styles.weekMoon}>☾ {r.moonPct}%</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <Sentence tone="dim" style={{ marginTop: space.x16, marginBottom: space.section, fontSize: 13 }}>
        Sun and moon computed for your location{approx ? " (state center — enable location for your spot's times)" : ''};
        weather from the National Weather Service. Carry the official table where required.
      </Sentence>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tile: {
    marginTop: space.x16,
    padding: space.gutter,
    borderRadius: lang.radius.card,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hair,
  },
  tickRow: { height: 16, marginTop: 2 },
  weekRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.x8, minHeight: 40, gap: space.x8 },
  weekRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hair },
  weekDayCell: { width: 118 },
  weekDay: { fontFamily: type.ui, fontSize: 14.5, color: color.bone },
  openerFlag: { fontFamily: type.uiSemiBold, fontSize: 9, letterSpacing: 1.2, color: color.copper, marginTop: 1 },
  weekTemp: { flex: 1, fontFamily: type.ui, fontSize: 13, color: color.muted, textAlign: 'right' },
  weekMoon: { width: 64, fontFamily: type.ui, fontSize: 12.5, color: color.dim, textAlign: 'right' },
});
