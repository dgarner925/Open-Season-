/**
 * What the Today card shows, once the gauge and the sky are real.
 *
 * The pure half of Phase 2. Everything here is a function of data already
 * fetched, so the rules about what an absent reading is allowed to look like
 * are testable without a network or a renderer.
 *
 * ---------------------------------------------------------------------------
 * THE ONE RULE
 *
 * A field that did not come back is NULL, all the way to the screen, and the
 * component drops it. It never becomes a zero, a dash, or the last value we
 * happened to have. The almanac's air column disappears rather than printing
 * "—°", because a dash in a column headed AIR is a reading of nothing and
 * reads exactly like a reading of something.
 *
 * Sunrise, sunset and the moon are exempt from all of this because they need
 * no network: they are computed on-device from the gauge's own coordinates,
 * so they are present even on a phone with no signal, which is most phones
 * standing in a river.
 */
import * as SunCalc from 'suncalc';
import { formatClock, legalLight } from '@/lib/sun';
import type { Gauge } from './gauges';
import type { FlowReading } from './sentences';
import { celsiusToF, latest, thin, trendOf, type GaugeSeries } from './usgs';

export type OtwAlmanac = {
  /** Null when the NWS forecast did not come back. The column drops out. */
  airTempF: number | null;
  /** Null with airTempF, or when NWS omitted a short forecast. */
  sky: string | null;
  /** On-device. Always present. */
  sunrise: string;
  sunset: string;
  moonPct: number;
  moonWaxing: boolean;
};

export type GaugeConditions = {
  gauge: Gauge;
  reading: FlowReading;
  /** Null when this gauge has no temperature sensor, which four of eight do not. */
  waterTempF: number | null;
  /** Thinned discharge for the sparkline, oldest first. Empty if silent. */
  history: number[];
  /** When the newest reading was taken, ISO with offset. Null if none. */
  readAt: string | null;
};

/** "7:13 AM" -> "7:13". The column label already says which end of the day. */
export function clockNoSuffix(formatted: string): string {
  return formatted.replace(/\s*[AP]M$/i, '');
}

/**
 * The air column's label: "AIR · CLEAR", or just "AIR".
 *
 * NWS short forecasts run long -- the live reply at Buford Dam right now is
 * "Slight Chance Rain Showers", 26 characters. The almanac gives each of four
 * columns about a quarter of the screen, so anything past ~9 characters
 * truncates mid-word to "AIR · SLIGHT CH…", which is worse than saying less.
 *
 * Nothing is lost by dropping it: the full phrase is already on the card's
 * detail line, beside the gauge and the water temperature. This only decides
 * whether it ALSO fits in a micro label.
 */
export function skyLabel(sky: string | null): string {
  if (!sky) return 'AIR';
  const short = sky.trim();
  if (!short || short.length > 9) return 'AIR';
  return `AIR · ${short.toUpperCase()}`;
}

/**
 * The gauge's series plus its configured threshold, as the card's props.
 *
 * `wadeableMax` comes from the gauge config and is editorial -- see
 * gauges.ts. It is passed through untouched, including when it is null,
 * because null is what makes conditionSentence() decline to call a river
 * fishable.
 */
export function conditionsFrom(gauge: Gauge, series: GaugeSeries | undefined): GaugeConditions {
  const discharge = series?.discharge ?? [];
  const now = latest(discharge);
  const temp = latest(series?.waterTempC ?? []);

  return {
    gauge,
    reading: {
      cfs: now ? now.value : null,
      wadeableMax: gauge.wadeableMax,
      trend: trendOf(discharge),
    },
    waterTempF: temp ? celsiusToF(temp.value) : null,
    history: thin(discharge),
    readAt: now ? now.at : null,
  };
}

/**
 * The line under the headline.
 *
 * The brief's example was "Wade it till the 2 PM release · Buford Dam", which
 * needs a USACE generation schedule. Those are explicitly out of scope, and a
 * static release time printed beside a live flow would be the worst of both:
 * it reads as today's schedule because everything around it is today's.
 *
 * So this says the two things actually known -- which way the river has moved
 * over the window the trend was computed on, and which gauge said so. When
 * there is no reading it falls back to where the gauge is, because that is
 * still true and still useful.
 */
export function sublineFor(c: GaugeConditions): string {
  const where = c.gauge.name;
  if (c.reading.cfs === null) return c.gauge.note;
  switch (c.reading.trend) {
    case 'rising':
      return `Rising over the last three hours · ${where}`;
    case 'falling':
      return `Falling over the last three hours · ${where}`;
    case 'steady':
      return `Steady over the last three hours · ${where}`;
    default:
      return where === c.gauge.note ? where : `${where} · ${c.gauge.note}`;
  }
}

/**
 * The NWS hourly period covering `now`, or null.
 *
 * `useDawnConditions` does the same search for a dawn an hour wide; this one
 * wants the hour somebody is standing in. Periods are one hour and come
 * ordered, but the list is a forecast and its first period can already be in
 * the past by the time it is read, so this matches on the interval rather
 * than taking periods[0].
 */
export function periodAt(periods: any[], nowMs: number): any | null {
  for (const p of Array.isArray(periods) ? periods : []) {
    const start = Date.parse(p?.startTime ?? '');
    if (!Number.isFinite(start)) continue;
    if (start <= nowMs && nowMs < start + 3600_000) return p;
  }
  return null;
}

/** Air temperature and sky from one NWS hourly period. Both null, or both set. */
export function airFrom(period: any | null): { airTempF: number | null; sky: string | null } {
  if (!period) return { airTempF: null, sky: null };
  const airTempF = typeof period.temperature === 'number' ? period.temperature : null;
  const raw = typeof period.shortForecast === 'string' ? period.shortForecast : null;
  // NWS writes compound forecasts as "Partly Sunny then Rain Showers". The
  // card has room for the first clause.
  const sky = raw ? raw.split(' then ')[0] : null;
  return { airTempF, sky: airTempF === null ? null : sky };
}

/**
 * The whole almanac for a gauge at a moment.
 *
 * Sun and moon are computed at the gauge's coordinates, not the user's. The
 * card describes a river, and the river's sunset is the one that matters --
 * and it means these numbers are right without the phone's location at all.
 */
export function almanacFor(gauge: Gauge, now: Date, periods: any[] = []): OtwAlmanac {
  const { airTempF, sky } = airFrom(periodAt(periods, now.getTime()));
  const light = legalLight(now, gauge.lat, gauge.lng, 0, 0);
  const illum = SunCalc.getMoonIllumination(now);

  return {
    airTempF,
    sky,
    // legalLight returns null only inside the polar circle, which no US
    // fishing gauge is. A missing sun is still handled rather than asserted.
    sunrise: light ? clockNoSuffix(formatClock(light.sunrise)) : '—',
    sunset: light ? clockNoSuffix(formatClock(light.sunset)) : '—',
    moonPct: Math.round(illum.fraction * 100),
    moonWaxing: illum.phase < 0.5,
  };
}
