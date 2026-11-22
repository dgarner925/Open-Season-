/**
 * Reading a USGS gauge.
 *
 * Source: the USGS Water Services instantaneous-values endpoint,
 * `waterservices.usgs.gov/nwis/iv/`. Checked on 2026-11-21, as the brief
 * asked: it is still live and still serving WaterML-as-JSON, and it is still
 * the documented endpoint for instantaneous values. The newer OGC API at
 * api.waterdata.usgs.gov is up alongside it but exposes monitoring locations
 * and daily values rather than this series, so there was nothing to migrate.
 *
 * It is SLOW. Measured from here: ~6-9 s warm for one site, 16 s for eight in
 * one request, 22 s cold. That is why the hook caches for fifteen minutes and
 * why the picker reads one gauge at a time rather than pre-filling them all.
 *
 * Federal, keyless, free, no attribution header required -- the same class of
 * source as the NWS calls hunting already makes.
 *
 * ---------------------------------------------------------------------------
 * THE PARSER IS SEPARATE FROM THE FETCH, AND IT IS THE PART THAT IS TESTED
 *
 * Everything that decides what a number MEANS is a pure function over the
 * decoded body: which series is discharge, whether a point is a reading or a
 * sentinel, which way the flow has moved. The network call is a thin shell
 * around them.
 *
 * Three facts about the payload drove the shape of this file, all three read
 * off real responses rather than assumed:
 *
 *   1. Values arrive as STRINGS. `"613"`, not 613.
 *   2. A missing reading is the sentinel `-999999` (declared per-variable as
 *      `noDataValue`) or an empty string -- NOT an absent point. Parsed
 *      naively, a sentinel becomes a river running negative six hundred
 *      thousand cubic feet a second, and the sparkline's auto-scale would
 *      flatten the real day into a single line at the top of the chart.
 *   3. Not every gauge reports water temperature. Four of this feature's
 *      eight do not. A gauge that omits 00010 returns an EMPTY series, not
 *      zeroes, and must stay empty all the way to the screen.
 */

/** One instant from one series. Value already parsed and sanity-checked. */
export type GaugePoint = {
  /** ISO 8601 with offset, as USGS sends it. */
  at: string;
  value: number;
};

export type GaugeSeries = {
  siteNo: string | null;
  siteName: string | null;
  /** Parameter 00060, cubic feet per second. Empty if the gauge is silent. */
  discharge: GaugePoint[];
  /** Parameter 00010, degrees Celsius. Empty when the gauge has no sensor. */
  waterTempC: GaugePoint[];
};

export const PARAM_DISCHARGE = '00060';
export const PARAM_WATER_TEMP = '00010';

/** The endpoint, built for one site. One day of 15-minute points. */
export function instantaneousValuesUrl(siteNo: string): string {
  const q = new URLSearchParams({
    format: 'json',
    sites: siteNo,
    parameterCd: `${PARAM_DISCHARGE},${PARAM_WATER_TEMP}`,
    period: 'P1D',
    siteStatus: 'active',
  });
  return `https://waterservices.usgs.gov/nwis/iv/?${q.toString()}`;
}

/**
 * A reading, or null.
 *
 * Rejects the no-data sentinel by magnitude rather than by exact equality:
 * the declared `noDataValue` is -999999.0 but it is declared per variable and
 * a response that spelled it differently would otherwise be believed.
 */
function readValue(raw: unknown): number | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const s = String(raw).trim();
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (Math.abs(n) >= 999_999) return null;
  return n;
}

/** Decoded response -> the two series we care about. Never throws. */
export function parseInstantaneousValues(body: unknown): GaugeSeries {
  const out: GaugeSeries = { siteNo: null, siteName: null, discharge: [], waterTempC: [] };
  const series = (body as any)?.value?.timeSeries;
  if (!Array.isArray(series)) return out;

  for (const s of series) {
    const code = s?.variable?.variableCode?.[0]?.value;
    if (code !== PARAM_DISCHARGE && code !== PARAM_WATER_TEMP) continue;

    if (out.siteNo === null) {
      const sc = s?.sourceInfo?.siteCode?.[0]?.value;
      if (typeof sc === 'string' && sc) out.siteNo = sc;
      const sn = s?.sourceInfo?.siteName;
      if (typeof sn === 'string' && sn) out.siteName = sn;
    }

    const points: GaugePoint[] = [];
    // A site can carry several methods for one parameter (two sensors). USGS
    // lists them as separate `values` blocks; taking only the first would
    // silently drop a gauge whose primary sensor is the second block, so all
    // blocks are read and then ordered by time.
    for (const block of Array.isArray(s?.values) ? s.values : []) {
      for (const p of Array.isArray(block?.value) ? block.value : []) {
        const v = readValue(p?.value);
        const at = typeof p?.dateTime === 'string' ? p.dateTime : null;
        if (v === null || !at) continue;
        points.push({ at, value: v });
      }
    }
    points.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

    if (code === PARAM_DISCHARGE) out.discharge = points;
    else out.waterTempC = points;
  }

  return out;
}

/** The most recent point, or null for an empty series. */
export function latest(points: GaugePoint[]): GaugePoint | null {
  return points.length ? points[points.length - 1] : null;
}

/**
 * Which way the series has moved over the last `hours`.
 *
 * Relative, not absolute: 20 cfs of movement is a flood on a 90 cfs creek and
 * noise on a 1,400 cfs tailwater, and one absolute threshold cannot be right
 * for both. 5% of the earlier reading, with a floor so a gauge hovering near
 * zero does not report a trend on rounding.
 *
 * Null when there is nothing to compare -- fewer than two points, or none old
 * enough to sit outside the window.
 */
export function trendOf(
  points: GaugePoint[],
  hours = 3,
): 'rising' | 'falling' | 'steady' | null {
  const now = latest(points);
  if (!now || points.length < 2) return null;

  const cutoff = Date.parse(now.at) - hours * 3600_000;
  // The newest point at or before the cutoff; failing that the oldest we have,
  // so a short series still reports the movement it can see.
  let before: GaugePoint | null = null;
  for (const p of points) {
    if (Date.parse(p.at) <= cutoff) before = p;
  }
  if (!before) before = points[0];
  if (before === now) return null;

  const delta = now.value - before.value;
  const threshold = Math.max(Math.abs(before.value) * 0.05, 0.5);
  if (delta > threshold) return 'rising';
  if (delta < -threshold) return 'falling';
  return 'steady';
}

export function celsiusToF(c: number): number {
  return Math.round((c * 9) / 5 + 32);
}

/**
 * The series thinned to at most `max` points for the sparkline, oldest first,
 * with the newest point always kept.
 *
 * A day of 15-minute readings is ~96 points in a strip a couple of hundred
 * pixels wide. Thinning by stride keeps the shape; what matters is that the
 * LAST point survives, because the card draws a dot there and calls it now.
 */
export function thin(points: GaugePoint[], max = 24): number[] {
  const values = points.map((p) => p.value);
  if (values.length <= max) return values;
  const stride = (values.length - 1) / (max - 1);
  const out: number[] = [];
  for (let i = 0; i < max - 1; i += 1) out.push(values[Math.round(i * stride)]);
  out.push(values[values.length - 1]);
  return out;
}

/**
 * Fetch and parse one gauge.
 *
 * Returns an empty-but-valid series on any failure, because the Today card is
 * built to render what came back and the alternative -- throwing -- would
 * blank a card that still has a correct almanac and a correct headline in it.
 * The caller distinguishes "no reading" from "not asked yet" through the
 * query's own loading state, not through an exception.
 */
export async function fetchGaugeSeries(
  siteNo: string,
  { timeoutMs = 20_000, signal }: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<GaugeSeries> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(instantaneousValuesUrl(siteNo), { signal: ctrl.signal });
    if (!res.ok) return { siteNo: null, siteName: null, discharge: [], waterTempC: [] };
    return parseInstantaneousValues(await res.json());
  } catch {
    return { siteNo: null, siteName: null, discharge: [], waterTempC: [] };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
