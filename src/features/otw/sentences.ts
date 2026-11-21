/**
 * The sentences On the Water speaks, as pure data.
 *
 * The mirror of src/features/home/sentences.ts: kept out of the component so
 * it can be tested without a renderer.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS ONE IS CAREFUL
 *
 * Hunting's headline says when a season opens. This one says what a river is
 * doing, and someone may be standing in it. Two rules follow, and both are
 * enforced by tests:
 *
 * 1. A MISSING READING NEVER PRODUCES A CONFIDENT SENTENCE. No gauge data,
 *    or no configured threshold, and the headline says so. It does not fall
 *    back to a cheerful default -- a default that reads as data is the worst
 *    defect this codebase has shipped, and it shipped five times in one
 *    feature.
 *
 * 2. THE WORDS ARE GUIDANCE, NOT A SAFETY RULING. "Fishable" describes the
 *    flow against a number someone configured for that gauge. It is not a
 *    claim that the water is safe, and nothing here should ever be phrased
 *    as one. The thresholds are editorial, the river is not.
 */

/** Which way the flow has moved over the last few hours. */
export type Trend = 'rising' | 'falling' | 'steady' | null;

export type FlowReading = {
  /** Discharge in cubic feet per second. Null when the gauge did not report. */
  cfs: number | null;
  /**
   * The flow at or below which this gauge is usually wadeable, as configured
   * for that gauge. Null when nobody has set one, which is not the same as
   * zero and must not be treated as one.
   */
  wadeableMax: number | null;
  trend: Trend;
};

/**
 * A headline in three parts, because the middle one is set in italic river
 * and the rest is not. Returning a single string would make the component
 * search it for the word to emphasise.
 */
export type ConditionSentence = {
  lead: string;
  emphasis: string;
  tail: string;
  /**
   * False when the sentence is reporting an absence rather than a condition.
   * The component uses it to drop the status pill, which would otherwise read
   * as a verdict the data does not support.
   */
  hasVerdict: boolean;
};

/** A usable discharge number, or null. */
function usableFlow(cfs: number | null): number | null {
  if (cfs === null || !Number.isFinite(cfs)) return null;
  // Some gauges report negative discharge where flow reverses. It is a real
  // reading and a meaningless one to wade against, so it is treated as no
  // reading rather than silently compared to a threshold.
  if (cfs < 0) return null;
  return cfs;
}

/** A usable threshold, or null. Zero and below are configuration mistakes. */
function usableThreshold(max: number | null): number | null {
  if (max === null || !Number.isFinite(max) || max <= 0) return null;
  return max;
}

/** 650 -> "650", 1250 -> "1,250". Deterministic, no locale lookup. */
export function formatCfs(cfs: number): string {
  const n = Math.round(cfs);
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * The headline.
 *
 * `waterName` carries its own article: "The Hooch", "Smith Creek". The
 * sentence does not add one, because "The Smith Creek is fishable" is not
 * something anybody says.
 */
export function conditionSentence(waterName: string, reading: FlowReading): ConditionSentence {
  const name = (waterName ?? '').trim() || 'This water';
  const cfs = usableFlow(reading.cfs);
  const max = usableThreshold(reading.wadeableMax);

  // 1. Nothing came back. Say that, and say nothing else.
  if (cfs === null) {
    return { lead: '', emphasis: 'No reading', tail: ` from ${name}.`, hasVerdict: false };
  }

  // 2. A number, but nothing to judge it against. Report the fact; a flow
  //    with no threshold cannot be called fishable or blown out.
  if (max === null) {
    return { lead: `${name} is running `, emphasis: `${formatCfs(cfs)} cfs`, tail: '.', hasVerdict: false };
  }

  const ratio = cfs / max;

  // 3. Above the threshold.
  if (ratio > 1) {
    return reading.trend === 'falling'
      ? { lead: `${name} is `, emphasis: 'dropping', tail: '.', hasVerdict: true }
      : { lead: `${name} is `, emphasis: 'blown out', tail: '.', hasVerdict: true };
  }

  // 4. Within a tenth of it. Close enough that "fishable" would be overclaiming.
  if (ratio > 0.9) {
    return { lead: `${name} is `, emphasis: 'near the top', tail: '.', hasVerdict: true };
  }

  // 5. Comfortably under, but climbing.
  if (reading.trend === 'rising') {
    return { lead: `${name} is `, emphasis: 'on the rise', tail: '.', hasVerdict: true };
  }

  // 6. Comfortably under.
  return { lead: `${name} is `, emphasis: 'fishable', tail: '.', hasVerdict: true };
}

/** The whole sentence as one string, for accessibility labels and tests. */
export function sentenceText(s: ConditionSentence): string {
  return `${s.lead}${s.emphasis}${s.tail}`;
}

/**
 * The status pill beside the flow: "Wadeable", "Near the top", "High".
 *
 * Null when there is nothing to claim, which is the same condition that makes
 * the headline verdict-free. Kept in step with it by construction rather than
 * by two sets of thresholds that can drift.
 */
export function flowStatus(reading: FlowReading): string | null {
  const cfs = usableFlow(reading.cfs);
  const max = usableThreshold(reading.wadeableMax);
  if (cfs === null || max === null) return null;
  const ratio = cfs / max;
  if (ratio > 1) return 'High';
  if (ratio > 0.9) return 'Near the top';
  return 'Wadeable';
}

/**
 * The headline steps down as it lengthens, so a short river name and a long
 * one both read as one object.
 *
 * Its own thresholds rather than hunting's: IM Fell English runs narrower
 * than Archivo at the same point size, so it fits more characters per line,
 * and the mockup sets the headline at 37 where hunting's sits at 44.
 */
export function otwHeadlineSize(sentence: string): number {
  if (sentence.length <= 26) return 37;
  if (sentence.length <= 44) return 31;
  return 26;
}
