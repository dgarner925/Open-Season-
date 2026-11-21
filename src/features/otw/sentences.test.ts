import { describe, expect, it } from 'vitest';
import {
  conditionSentence,
  flowStatus,
  formatCfs,
  otwHeadlineSize,
  sentenceText,
  type FlowReading,
} from './sentences';

const HOOCH = 'The Hooch';
/** A gauge with a configured threshold, so the verdict branches are reachable. */
const reading = (cfs: number | null, trend: FlowReading['trend'] = 'steady'): FlowReading => ({
  cfs,
  wadeableMax: 1000,
  trend,
});

const say = (name: string, r: FlowReading) => sentenceText(conditionSentence(name, r));

describe('formatCfs', () => {
  it('groups thousands', () => {
    expect(formatCfs(650)).toBe('650');
    expect(formatCfs(1250)).toBe('1,250');
    expect(formatCfs(12500)).toBe('12,500');
    expect(formatCfs(1250000)).toBe('1,250,000');
  });

  it('rounds to whole cfs, because a gauge reports more precision than matters', () => {
    expect(formatCfs(649.6)).toBe('650');
    expect(formatCfs(0.2)).toBe('0');
  });
});

describe('a missing reading never becomes a confident sentence', () => {
  it('says so when the gauge did not report', () => {
    expect(say(HOOCH, reading(null))).toBe('No reading from The Hooch.');
    expect(conditionSentence(HOOCH, reading(null)).hasVerdict).toBe(false);
  });

  it.each([
    ['NaN', NaN],
    ['Infinity', Infinity],
  ])('treats %s as no reading rather than comparing it', (_label, cfs) => {
    expect(conditionSentence(HOOCH, reading(cfs)).hasVerdict).toBe(false);
    expect(say(HOOCH, reading(cfs))).toBe('No reading from The Hooch.');
  });

  it('treats reversed flow as no reading, not as a very low one', () => {
    // A negative discharge is a real reading at some gauges and a meaningless
    // one to wade against. The bug this prevents is -50 cfs reading as
    // "fishable" because it is comfortably under the threshold.
    expect(say(HOOCH, reading(-50))).toBe('No reading from The Hooch.');
    expect(flowStatus(reading(-50))).toBeNull();
  });

  it('reports the number but passes no judgement when no threshold is configured', () => {
    const r: FlowReading = { cfs: 650, wadeableMax: null, trend: 'steady' };
    expect(say(HOOCH, r)).toBe('The Hooch is running 650 cfs.');
    expect(conditionSentence(HOOCH, r).hasVerdict).toBe(false);
    expect(flowStatus(r)).toBeNull();
  });

  it.each([
    ['zero', 0],
    ['negative', -100],
  ])('treats a %s threshold as unconfigured, not as a real limit', (_label, wadeableMax) => {
    const r: FlowReading = { cfs: 650, wadeableMax, trend: 'steady' };
    // The bug this prevents: a threshold of 0 makes every reading "blown out".
    expect(conditionSentence(HOOCH, r).hasVerdict).toBe(false);
    expect(flowStatus(r)).toBeNull();
  });
});

describe('the verdicts', () => {
  it('is fishable comfortably under the threshold', () => {
    expect(say(HOOCH, reading(650))).toBe('The Hooch is fishable.');
  });

  it('is on the rise when climbing from under it', () => {
    expect(say(HOOCH, reading(650, 'rising'))).toBe('The Hooch is on the rise.');
  });

  it('is near the top within a tenth of it, rather than overclaiming', () => {
    expect(say(HOOCH, reading(950))).toBe('The Hooch is near the top.');
    // The boundary: 900 is exactly 0.9 and still fishable.
    expect(say(HOOCH, reading(900))).toBe('The Hooch is fishable.');
    expect(say(HOOCH, reading(901))).toBe('The Hooch is near the top.');
  });

  it('is blown out above it', () => {
    expect(say(HOOCH, reading(1800))).toBe('The Hooch is blown out.');
    // The boundary: exactly at the threshold is not above it.
    expect(say(HOOCH, reading(1000))).toBe('The Hooch is near the top.');
    expect(say(HOOCH, reading(1001))).toBe('The Hooch is blown out.');
  });

  it('is dropping when high but falling', () => {
    expect(say(HOOCH, reading(1800, 'falling'))).toBe('The Hooch is dropping.');
  });

  it('does not call a falling river "dropping" when it is already low', () => {
    // "Dropping" is news only when it is coming back from high.
    expect(say(HOOCH, reading(650, 'falling'))).toBe('The Hooch is fishable.');
  });
});

describe('the pill agrees with the headline', () => {
  it.each([
    [650, 'Wadeable'],
    [950, 'Near the top'],
    [1800, 'High'],
  ])('%d cfs reads as %s', (cfs, expected) => {
    expect(flowStatus(reading(cfs))).toBe(expected);
  });

  it('is null exactly when the headline has no verdict', () => {
    const cases: FlowReading[] = [
      reading(null),
      reading(-50),
      { cfs: 650, wadeableMax: null, trend: 'steady' },
      { cfs: 650, wadeableMax: 0, trend: 'steady' },
      reading(650),
      reading(1800),
    ];
    for (const r of cases) {
      expect(flowStatus(r) === null).toBe(conditionSentence(HOOCH, r).hasVerdict === false);
    }
  });
});

describe('the sentence is built for italics', () => {
  it('splits so the component never has to search for the word to emphasise', () => {
    const s = conditionSentence(HOOCH, reading(650));
    expect(s.lead).toBe('The Hooch is ');
    expect(s.emphasis).toBe('fishable');
    expect(s.tail).toBe('.');
    expect(sentenceText(s)).toBe('The Hooch is fishable.');
  });

  it('never leaves the emphasis empty, or the headline loses its accent word', () => {
    const cases: FlowReading[] = [
      reading(null),
      reading(650),
      reading(950),
      reading(1800),
      reading(1800, 'falling'),
      reading(650, 'rising'),
      { cfs: 650, wadeableMax: null, trend: null },
    ];
    for (const r of cases) {
      expect(conditionSentence(HOOCH, r).emphasis.length).toBeGreaterThan(0);
    }
  });
});

describe('the water name carries its own article', () => {
  it('does not prepend one, because "The Smith Creek" is not a thing anyone says', () => {
    expect(say('Smith Creek', reading(650))).toBe('Smith Creek is fishable.');
    expect(say(HOOCH, reading(650))).toBe('The Hooch is fishable.');
  });

  it.each([
    ['empty', ''],
    ['whitespace', '   '],
  ])('falls back to a neutral subject for a %s name', (_label, name) => {
    expect(say(name, reading(650))).toBe('This water is fishable.');
  });
});

describe('otwHeadlineSize', () => {
  it('steps down as the sentence lengthens', () => {
    expect(otwHeadlineSize('The Hooch is fishable.')).toBe(37);
    expect(otwHeadlineSize('Smith Creek Delayed Harvest is fishable.')).toBe(31);
    expect(otwHeadlineSize('No reading from the Chattahoochee below Buford Dam.')).toBe(26);
  });

  it('is monotonic -- a longer sentence never gets a bigger size', () => {
    let last = Infinity;
    for (let n = 1; n <= 80; n++) {
      const size = otwHeadlineSize('x'.repeat(n));
      expect(size).toBeLessThanOrEqual(last);
      last = size;
    }
  });
});
