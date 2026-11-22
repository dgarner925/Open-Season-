/**
 * What the card is allowed to say when a source goes quiet.
 *
 * usgs.test.ts grades the parser. This grades the layer above it: the rules
 * that decide whether a missing field becomes a null the component drops, or
 * becomes a number somebody wades against.
 */
import { describe, expect, it } from 'vitest';
import {
  airFrom,
  almanacFor,
  clockNoSuffix,
  conditionsFrom,
  periodAt,
  skyLabel,
  sublineFor,
} from './conditions';
import { GAUGES, defaultGauge, gaugeFor } from './gauges';
import type { GaugeSeries } from './usgs';

const BUFORD = defaultGauge();
/** A real gauge from the config with no threshold set -- seven of eight. */
const NO_THRESHOLD = gaugeFor('02336000')!;

const at = (h: number) => `2026-11-21T${String(h).padStart(2, '0')}:00:00.000-05:00`;
const series = (discharge: number[], tempC: number[] = []): GaugeSeries => ({
  siteNo: BUFORD.siteNo,
  siteName: 'CHATTAHOOCHEE RIVER AT BUFORD DAM',
  discharge: discharge.map((value, i) => ({ at: at(i), value })),
  waterTempC: tempC.map((value, i) => ({ at: at(i), value })),
});

describe('the gauge config itself', () => {
  it('has a resolvable default', () => {
    expect(BUFORD.siteNo).toBe('02334430');
  });

  it('carries no duplicate site numbers', () => {
    const seen = new Set(GAUGES.map((g) => g.siteNo));
    expect(seen.size).toBe(GAUGES.length);
  });

  it('never uses zero as a threshold, which would read as a real limit', () => {
    for (const g of GAUGES) {
      expect(g.wadeableMax === null || g.wadeableMax > 0).toBe(true);
    }
  });

  it('gives every gauge a note saying where it physically is', () => {
    for (const g of GAUGES) expect(g.note.length).toBeGreaterThan(10);
  });
});

describe('conditionsFrom', () => {
  it('reads the newest discharge point as the current flow', () => {
    const c = conditionsFrom(BUFORD, series([420, 500, 613]));
    expect(c.reading.cfs).toBe(613);
    expect(c.readAt).toBe(at(2));
  });

  it('passes the configured threshold through, including when it is null', () => {
    expect(conditionsFrom(BUFORD, series([613])).reading.wadeableMax).toBe(1000);
    expect(conditionsFrom(NO_THRESHOLD, series([1330])).reading.wadeableMax).toBeNull();
  });

  it('reports no flow, not zero flow, when the gauge said nothing', () => {
    const c = conditionsFrom(BUFORD, series([]));
    expect(c.reading.cfs).toBeNull();
    expect(c.history).toEqual([]);
    expect(c.readAt).toBeNull();
  });

  it('reports no flow when the query has not resolved at all', () => {
    const c = conditionsFrom(BUFORD, undefined);
    expect(c.reading.cfs).toBeNull();
    expect(c.waterTempF).toBeNull();
  });

  it('converts water temperature, and leaves it null on a gauge without a sensor', () => {
    expect(conditionsFrom(BUFORD, series([613], [11.2])).waterTempF).toBe(52);
    expect(conditionsFrom(BUFORD, series([613], [])).waterTempF).toBeNull();
  });
});

describe('periodAt', () => {
  const periods = [
    { startTime: at(8), temperature: 44 },
    { startTime: at(9), temperature: 48 },
    { startTime: at(10), temperature: 52 },
  ];

  it('finds the hour the clock is inside, not the first in the list', () => {
    const mid = Date.parse(at(9)) + 30 * 60_000;
    expect(periodAt(periods, mid)?.temperature).toBe(48);
  });

  it('is null when every period is in the past', () => {
    expect(periodAt(periods, Date.parse(at(14)))).toBeNull();
  });

  it('is null for junk instead of throwing', () => {
    expect(periodAt([], 0)).toBeNull();
    expect(periodAt(undefined as any, 0)).toBeNull();
    expect(periodAt([{ startTime: 'not a date' }], Date.now())).toBeNull();
  });
});

describe('airFrom', () => {
  it('is all-null without a period', () => {
    expect(airFrom(null)).toEqual({ airTempF: null, sky: null });
  });

  it('takes the first clause of a compound NWS forecast', () => {
    expect(airFrom({ temperature: 48, shortForecast: 'Partly Sunny then Rain Showers' })).toEqual({
      airTempF: 48,
      sky: 'Partly Sunny',
    });
  });

  it('will not report a sky without a temperature to attach it to', () => {
    // The column is one object -- "AIR · CLEAR" over a blank value is worse
    // than no column.
    expect(airFrom({ shortForecast: 'Clear' })).toEqual({ airTempF: null, sky: null });
  });
});

describe('almanacFor', () => {
  const now = new Date('2026-11-21T14:00:00.000Z');

  it('has sun and moon with NO network data at all', () => {
    const a = almanacFor(BUFORD, now, []);
    expect(a.airTempF).toBeNull();
    expect(a.sky).toBeNull();
    expect(a.sunrise).toMatch(/^\d{1,2}:\d{2}$/);
    expect(a.sunset).toMatch(/^\d{1,2}:\d{2}$/);
    expect(a.moonPct).toBeGreaterThanOrEqual(0);
    expect(a.moonPct).toBeLessThanOrEqual(100);
    expect(typeof a.moonWaxing).toBe('boolean');
  });

  it('computes the sun at the GAUGE, not at one fixed place', () => {
    // Helen is ~0.54 degrees of longitude east of Buford Dam, so its sun
    // events differ. Same instant, different gauge, different clock.
    const helen = gaugeFor('02330450')!;
    const a = almanacFor(BUFORD, now, []);
    const b = almanacFor(helen, now, []);
    expect(a.sunset).not.toBe(b.sunset);
  });

  it('fills air and sky when NWS covers the hour', () => {
    const hour = new Date();
    const start = new Date(hour.getTime());
    start.setMinutes(0, 0, 0);
    const a = almanacFor(BUFORD, hour, [
      { startTime: start.toISOString(), temperature: 51, shortForecast: 'Clear' },
    ]);
    expect(a.airTempF).toBe(51);
    expect(a.sky).toBe('Clear');
  });
});

describe('sublineFor', () => {
  it('reports the direction the river has moved', () => {
    const c = conditionsFrom(BUFORD, series([420, 500, 613]));
    expect(sublineFor({ ...c, reading: { ...c.reading, trend: 'rising' } })).toBe(
      'Rising over the last three hours · Buford Dam Tailwater',
    );
    expect(sublineFor({ ...c, reading: { ...c.reading, trend: 'falling' } })).toContain('Falling');
    expect(sublineFor({ ...c, reading: { ...c.reading, trend: 'steady' } })).toContain('Steady');
  });

  it('says where the gauge is when there is no reading to describe', () => {
    const c = conditionsFrom(BUFORD, series([]));
    expect(sublineFor(c)).toBe(BUFORD.note);
  });

  it('promises no dam release, because none is known', () => {
    for (const g of GAUGES) {
      const c = conditionsFrom(g, series([500, 520, 540]));
      expect(sublineFor(c).toLowerCase()).not.toContain('release');
    }
  });
});

describe('skyLabel', () => {
  it('includes a sky phrase that fits the column', () => {
    expect(skyLabel('Clear')).toBe('AIR · CLEAR');
    expect(skyLabel('Sunny')).toBe('AIR · SUNNY');
  });

  it('drops one that would truncate mid-word', () => {
    // The live reply from Buford Dam's grid, 2026-11-21.
    expect(skyLabel('Slight Chance Rain Showers')).toBe('AIR');
    expect(skyLabel('Mostly Cloudy')).toBe('AIR');
  });

  it('is "AIR" with no sky at all', () => {
    expect(skyLabel(null)).toBe('AIR');
    expect(skyLabel('')).toBe('AIR');
    expect(skyLabel('   ')).toBe('AIR');
  });
});

describe('clockNoSuffix', () => {
  it('drops the meridiem the column label already implies', () => {
    expect(clockNoSuffix('7:13 AM')).toBe('7:13');
    expect(clockNoSuffix('5:31 PM')).toBe('5:31');
    expect(clockNoSuffix('—')).toBe('—');
  });
});
