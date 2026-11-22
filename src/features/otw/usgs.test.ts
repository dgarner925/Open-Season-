/**
 * The gauge parser, graded against a real USGS response.
 *
 * `__fixtures__/usgs-02334430.json` is a genuine reply from
 * waterservices.usgs.gov for Chattahoochee River at Buford Dam, captured
 * 2026-11-21 and trimmed to the last eight points of each series. It is here
 * so the tests measure the shape USGS actually sends rather than the shape I
 * believed it sends -- which is the error that would otherwise reach a river.
 *
 * The sentinel tests are the ones that matter. USGS reports a missing reading
 * as -999999, not as an absent point, and a parser that trusts it puts a
 * river at six hundred thousand cubic feet a second behind a word like
 * "fishable".
 */
import { describe, expect, it } from 'vitest';
import {
  celsiusToF,
  instantaneousValuesUrl,
  latest,
  parseInstantaneousValues,
  thin,
  trendOf,
  type GaugePoint,
} from './usgs';
import real from './__fixtures__/usgs-02334430.json';

/** A minimal body carrying one series of one parameter. */
function body(code: string, values: Array<{ dateTime: string; value: string }>, extra: object = {}) {
  return {
    value: {
      timeSeries: [
        {
          sourceInfo: { siteCode: [{ value: '99999999' }], siteName: 'TEST CREEK' },
          variable: { variableCode: [{ value: code }], noDataValue: -999999 },
          values: [{ value: values }],
          ...extra,
        },
      ],
    },
  };
}

const at = (h: number) => `2026-11-21T${String(h).padStart(2, '0')}:00:00.000-05:00`;
const pts = (...vals: number[]): GaugePoint[] => vals.map((value, i) => ({ at: at(i), value }));

describe('parseInstantaneousValues, against a real response', () => {
  const parsed = parseInstantaneousValues(real);

  it('finds the site it was asked about', () => {
    expect(parsed.siteNo).toBe('02334430');
    expect(parsed.siteName).toContain('BUFORD DAM');
  });

  it('reads both series, as numbers, from USGS strings', () => {
    expect(parsed.discharge).toHaveLength(8);
    expect(parsed.waterTempC).toHaveLength(8);
    expect(latest(parsed.discharge)?.value).toBe(613);
    expect(latest(parsed.waterTempC)?.value).toBeCloseTo(11.2, 5);
    for (const p of parsed.discharge) expect(typeof p.value).toBe('number');
  });

  it('turns that water temperature into the Fahrenheit the card shows', () => {
    expect(celsiusToF(latest(parsed.waterTempC)!.value)).toBe(52);
  });
});

describe('the no-data sentinel', () => {
  it('REJECTS -999999 rather than reading it as a flow', () => {
    const parsed = parseInstantaneousValues(
      body('00060', [
        { dateTime: at(1), value: '613' },
        { dateTime: at(2), value: '-999999' },
        { dateTime: at(3), value: '615' },
      ]),
    );
    expect(parsed.discharge.map((p) => p.value)).toEqual([613, 615]);
  });

  it('rejects it however it is spelled, including as a float', () => {
    const parsed = parseInstantaneousValues(
      body('00060', [
        { dateTime: at(1), value: '-999999.0' },
        { dateTime: at(2), value: '999999' },
        { dateTime: at(3), value: '420' },
      ]),
    );
    expect(parsed.discharge.map((p) => p.value)).toEqual([420]);
  });

  it('rejects an empty string, which is the other way a reading goes missing', () => {
    const parsed = parseInstantaneousValues(
      body('00060', [
        { dateTime: at(1), value: '' },
        { dateTime: at(2), value: '  ' },
        { dateTime: at(3), value: '88' },
      ]),
    );
    expect(parsed.discharge.map((p) => p.value)).toEqual([88]);
  });

  it('drops a point with no timestamp -- it cannot be placed on the sparkline', () => {
    const parsed = parseInstantaneousValues({
      value: {
        timeSeries: [
          {
            variable: { variableCode: [{ value: '00060' }] },
            values: [{ value: [{ value: '500' }, { dateTime: at(2), value: '510' }] }],
          },
        ],
      },
    });
    expect(parsed.discharge.map((p) => p.value)).toEqual([510]);
  });
});

describe('a gauge that does not measure what was asked', () => {
  it('leaves water temperature EMPTY rather than zero', () => {
    // Four of the eight configured gauges report no 00010 at all.
    const parsed = parseInstantaneousValues(body('00060', [{ dateTime: at(1), value: '215' }]));
    expect(parsed.waterTempC).toEqual([]);
    expect(latest(parsed.waterTempC)).toBeNull();
  });

  it('ignores parameters it did not ask for', () => {
    const parsed = parseInstantaneousValues(body('00065', [{ dateTime: at(1), value: '4.2' }]));
    expect(parsed.discharge).toEqual([]);
    expect(parsed.waterTempC).toEqual([]);
  });
});

describe('two sensors on one parameter', () => {
  it('reads every values block and orders the result by time', () => {
    const parsed = parseInstantaneousValues({
      value: {
        timeSeries: [
          {
            variable: { variableCode: [{ value: '00060' }] },
            values: [
              { value: [{ dateTime: at(5), value: '50' }] },
              { value: [{ dateTime: at(1), value: '10' }, { dateTime: at(3), value: '30' }] },
            ],
          },
        ],
      },
    });
    expect(parsed.discharge.map((p) => p.value)).toEqual([10, 30, 50]);
  });
});

describe('trendOf', () => {
  it('is null with nothing to compare against', () => {
    expect(trendOf([])).toBeNull();
    expect(trendOf(pts(613))).toBeNull();
  });

  it('calls a flat tailwater steady', () => {
    expect(trendOf(pts(613, 613, 613, 612, 613))).toBe('steady');
  });

  it('sees the morning generation run rising, and its tail falling', () => {
    expect(trendOf(pts(420, 430, 520, 690, 715))).toBe('rising');
    expect(trendOf(pts(1450, 1200, 900, 700, 650))).toBe('falling');
  });

  it('is RELATIVE: the same 20 cfs is news on a creek and noise on a tailwater', () => {
    // 90 -> 110 is a fifth of the creek.
    expect(trendOf(pts(90, 95, 100, 105, 110))).toBe('rising');
    // 1400 -> 1420 is inside the gauge's own slop.
    expect(trendOf(pts(1400, 1405, 1410, 1415, 1420))).toBe('steady');
  });

  it('does not invent a trend on a gauge sitting near zero', () => {
    expect(trendOf(pts(0.1, 0.2, 0.3, 0.2, 0.4))).toBe('steady');
  });

  it('compares across the window, not against the previous point', () => {
    // Rose all day, flat for the last reading. Still rising.
    const series: GaugePoint[] = [
      { at: '2026-11-21T06:00:00.000-05:00', value: 400 },
      { at: '2026-11-21T12:00:00.000-05:00', value: 800 },
      { at: '2026-11-21T14:45:00.000-05:00', value: 1200 },
      { at: '2026-11-21T15:00:00.000-05:00', value: 1200 },
    ];
    expect(trendOf(series, 3)).toBe('rising');
  });
});

describe('thin', () => {
  it('passes a short series through untouched', () => {
    expect(thin(pts(1, 2, 3), 24)).toEqual([1, 2, 3]);
  });

  it('always keeps the newest point, because the card draws a dot on it', () => {
    const long = pts(...Array.from({ length: 96 }, (_, i) => i));
    const out = thin(long, 24);
    expect(out).toHaveLength(24);
    expect(out[out.length - 1]).toBe(95);
    expect(out[0]).toBe(0);
  });
});

describe('robustness', () => {
  it('returns an empty series for anything that is not a response', () => {
    for (const junk of [null, undefined, 0, '', [], {}, { value: {} }, { value: { timeSeries: 'no' } }]) {
      const parsed = parseInstantaneousValues(junk);
      expect(parsed.discharge).toEqual([]);
      expect(parsed.waterTempC).toEqual([]);
      expect(parsed.siteNo).toBeNull();
    }
  });
});

describe('instantaneousValuesUrl', () => {
  it('asks for both parameters over one day', () => {
    const url = instantaneousValuesUrl('02334430');
    expect(url).toContain('sites=02334430');
    expect(url).toContain('parameterCd=00060%2C00010');
    expect(url).toContain('period=P1D');
  });
});
