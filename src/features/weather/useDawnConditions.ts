/**
 * Tomorrow's dawn, as an almanac row: temperature and sky, wind, barometric
 * pressure with its trend, and the moon. The Weekend Brief's conditions block.
 *
 * Weather: the National Weather Service API (api.weather.gov) — free, keyless,
 * US-only, and a federal source like everything else we cite. Moon: suncalc,
 * on-device. Location: the same session-cached fix legal light uses; falls
 * back to the state centroid, flagged approx.
 *
 * Every field is optional — NWS grids sometimes omit pressure, and the whole
 * fetch can fail in the field. The card renders whatever came back; the moon
 * never needs a network.
 */
import { useEffect, useState } from 'react';
import * as SunCalc from 'suncalc';
import centroids from '@/assets/state-centroids.json';
import { getFix } from '@/features/legalLight/useLegalLight';

const CENTROIDS = centroids as Record<string, { lat: number; lng: number }>;
const UA = { 'User-Agent': 'OpenSeason-DatesAndDraws (osdatesanddraws.com)' };
const PA_PER_INHG = 3386.39;

export type DawnConditions = {
  /** "Saturday" — the morning these numbers describe. */
  dayName: string;
  tempF: number | null;
  /** "Clear", "Chance Rain Showers" — NWS's short forecast, trimmed. */
  sky: string | null;
  windDir: string | null;
  windMph: number | null;
  pressureInHg: number | null;
  pressureTrend: 'falling' | 'rising' | 'steady' | null;
  moonPct: number;
  moonWaxing: boolean;
  /** One editorial line when the forecast has real news (a front), else null. */
  frontLine: string | null;
  approx: boolean;
} | null;

// One NWS round-trip per session per gridpoint.
const cache = new Map<string, DawnConditions>();

async function fetchJson(url: string, timeoutMs = 8000): Promise<any | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: UA, signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type LatLng = { lat: number; lng: number };

// The /points lookup and the hourly forecast, session-cached per gridpoint —
// shared with the outlook page, which reads a whole week of dawns from the
// same periods list. Failures aren't cached, so the next mount tries again.
const pointsCache = new Map<string, any>();
const hourlyCache = new Map<string, any[]>();

export async function fetchNwsPoints(at: LatLng): Promise<any | null> {
  const key = `${at.lat.toFixed(2)},${at.lng.toFixed(2)}`;
  const hit = pointsCache.get(key);
  if (hit) return hit;
  const points = await fetchJson(`https://api.weather.gov/points/${at.lat.toFixed(4)},${at.lng.toFixed(4)}`);
  if (points?.properties) pointsCache.set(key, points);
  return points;
}

export async function fetchHourlyPeriods(at: LatLng): Promise<any[]> {
  const key = `${at.lat.toFixed(2)},${at.lng.toFixed(2)}`;
  const hit = hourlyCache.get(key);
  if (hit) return hit;
  const points = await fetchNwsPoints(at);
  const hourlyUrl = points?.properties?.forecastHourly;
  if (!hourlyUrl) return [];
  const hourly = await fetchJson(hourlyUrl);
  const periods: any[] = hourly?.properties?.periods ?? [];
  if (periods.length) hourlyCache.set(key, periods);
  return periods;
}

export function useDawnConditions(stateCode: string | null | undefined, dayOffset = 1): DawnConditions {
  const [result, setResult] = useState<DawnConditions>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fix = await getFix();
      const at = fix ?? (stateCode ? CENTROIDS[stateCode] : null);
      if (!at) return;

      const day = new Date();
      day.setDate(day.getDate() + dayOffset);
      let dawn = SunCalc.getTimes(day, at.lat, at.lng).sunrise;
      if (!dawn || isNaN(dawn.getTime())) return;
      // A dawn already behind us can't be forecast (NWS only looks forward),
      // and an evening hunter is planning tomorrow morning anyway — advance to
      // the NEXT first light (David's evening moon-only card, 2026-09-06).
      if (dawn.getTime() < Date.now()) {
        day.setDate(day.getDate() + 1);
        dawn = SunCalc.getTimes(day, at.lat, at.lng).sunrise;
        if (!dawn || isNaN(dawn.getTime())) return;
      }
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day.getDay()];

      // The moon needs no network — it anchors the row even offline.
      const illum = SunCalc.getMoonIllumination(dawn);
      const moonPct = Math.round(illum.fraction * 100);
      const moonWaxing = illum.phase < 0.5;

      const key = `${at.lat.toFixed(2)},${at.lng.toFixed(2)},${day.toISOString().slice(0, 10)}`;
      const cached = cache.get(key);
      if (cached) {
        if (!cancelled) setResult(cached);
        return;
      }

      let tempF: number | null = null;
      let sky: string | null = null;
      let windDir: string | null = null;
      let windMph: number | null = null;
      let pressureInHg: number | null = null;
      let pressureTrend: 'falling' | 'rising' | 'steady' | null = null;
      let frontLine: string | null = null;

      const points = await fetchNwsPoints(at);
      const stationsUrl = points?.properties?.observationStations;

      {
        const periods = await fetchHourlyPeriods(at);
        const dawnT = dawn.getTime();
        const atDawn = periods.find((p) => {
          const s = new Date(p.startTime).getTime();
          return s <= dawnT && dawnT < s + 3600_000;
        });
        if (atDawn) {
          tempF = typeof atDawn.temperature === 'number' ? atDawn.temperature : null;
          sky = typeof atDawn.shortForecast === 'string' ? atDawn.shortForecast.split(' then ')[0] : null;
          windDir = typeof atDawn.windDirection === 'string' && atDawn.windDirection ? atDawn.windDirection : null;
          const mph = parseInt(String(atDawn.windSpeed ?? ''), 10);
          windMph = Number.isFinite(mph) ? mph : null;
        }
        // A sharply colder dawn than the one before it is news.
        const prevDawn = SunCalc.getTimes(new Date(day.getTime() - 86400_000), at.lat, at.lng).sunrise;
        const prevAt = prevDawn
          ? periods.find((p) => {
              const s = new Date(p.startTime).getTime();
              return s <= prevDawn.getTime() && prevDawn.getTime() < s + 3600_000;
            })
          : undefined;
        if (tempF != null && typeof prevAt?.temperature === 'number' && prevAt.temperature - tempF >= 12) {
          frontLine = `Sharply colder — ${tempF}° at first light, ${prevAt.temperature - tempF}° down from ${
            ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(day.getTime() - 86400_000).getDay()]
          }.`;
        }
      }

      // NWS gridpoints don't forecast pressure reliably, so we read the glass
      // the traditional way: the nearest observation station's actual
      // barometer, and its movement over the last six hours.
      if (stationsUrl) {
        const stations = await fetchJson(stationsUrl);
        const sid = stations?.features?.[0]?.properties?.stationIdentifier;
        if (sid) {
          const since = new Date(Date.now() - 6 * 3600_000).toISOString();
          const obs = await fetchJson(`https://api.weather.gov/stations/${sid}/observations?start=${encodeURIComponent(since)}`);
          const readings: number[] = (obs?.features ?? [])
            .map((f: any) => f?.properties?.barometricPressure?.value)
            .filter((v: any) => typeof v === 'number');
          if (readings.length > 0) {
            const newest = readings[0]; // NWS returns newest first
            pressureInHg = Math.round((newest / PA_PER_INHG) * 10) / 10;
            if (readings.length > 1) {
              const oldest = readings[readings.length - 1];
              const deltaInHg = (newest - oldest) / PA_PER_INHG;
              pressureTrend = deltaInHg <= -0.03 ? 'falling' : deltaInHg >= 0.03 ? 'rising' : 'steady';
              if (deltaInHg <= -0.08 && !frontLine) {
                frontLine = `The glass is falling — a front on its way into ${dayName}.`;
              }
            }
          }
        }
      }

      const out: DawnConditions = {
        dayName,
        tempF,
        sky,
        windDir,
        windMph,
        pressureInHg,
        pressureTrend,
        moonPct,
        moonWaxing,
        frontLine,
        approx: !fix,
      };
      // A moon-only result means the network flaked — show it, but don't
      // cache it, so the next mount tries the weather again.
      if (tempF != null || pressureInHg != null) cache.set(key, out);
      if (!cancelled) setResult(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [stateCode, dayOffset]);

  return result;
}
