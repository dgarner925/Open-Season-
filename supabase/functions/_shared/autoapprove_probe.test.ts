/**
 * Can the auto-approve gate FAIL?
 *
 * HISTORY: the last two tests were written asserting the OPPOSITE -- that the
 * gate let a swapped limit/length and an ungrounded possession limit through at
 * 0.90 clean. Both holes were real and both are now closed; the tests were
 * inverted in the same commit that closed them. Keep them pointed at the fix,
 * not at the bug.
 *
 * 472 fishing proposals scored >= 0.90 with no validation errors; of the 438 of
 * those David decided, he approved 438 and rejected none. That is either a gate
 * worth trusting with 4,000 more rows, or a gate that cannot say no. The 549
 * decisions cannot tell the difference, because every one of them was a
 * decision about a row the extractor already believed.
 *
 * So this does to the fishing gate what shuffling names onto wrong dates did to
 * the window grader: feeds it rows that are WRONG and checks the score drops. A
 * gate that scores a corrupted row 0.90 is not measuring the rule.
 *
 * The rows are copied verbatim from Mississippi's freshwater creel table
 * (eregulations.com/mississippi/fishing/freshwater/freshwater-size-creel-limits,
 * read 2026-11-21) -- a page whose every row is already live, so a hole found
 * here is a hole in published data, not a hypothetical.
 *
 * SUBJECT CHOICE IS NOT INCIDENTAL. scoreFishingRuleConfidence caps a rule at
 * 0.60 when its subject has fewer than two distinctive tokens, so no
 * single-word species -- walleye, sauger, paddlefish -- can reach the gate at
 * all, and probing with one would prove nothing about the 222 rules that do.
 * Striped bass has two tokens and its real row carries BOTH a daily limit and a
 * length, which is exactly the shape the swap test needs.
 *
 * The `numbers` array is assembled here the way extract-source assembles it.
 * Nothing exports that construction, so if it changes these tests go stale
 * silently -- hence the comment rather than an import.
 */

import { describe, expect, it } from 'vitest';
import {
  groundFishingRule,
  scoreFishingRuleConfidence,
  type FishingNumber,
} from './extraction.ts';

const MS_BLOCKS = [
  'Freshwater Creel And Size Limits',
  'SPECIES | DAILY CREEL LIMIT',
  'Crappie** (combined white and black) 30',
  'Bluegill, bream and all other sunfish (combined)** 100',
  'Largemouth, Smallmouth and Spotted bass (combined)** 10',
  'Striped Bass and/or Striped Bass Hybrids (minimum length limit 15 inches)** 6',
  'Walleye*** 3',
  'Sauger 10',
  '2 Paddlefish* (must be less than 30 inches)',
  'Sturgeon 0',
  'Alligator Gar**** 2',
];
const MS_TEXT = MS_BLOCKS.join('\n');

/**
 * The numbers array, assembled the way extract-source assembles it -- each
 * number tagged with the FIELD claiming it. Passing bare numbers here instead
 * would exercise the legacy 'any' path and prove nothing about the real gate,
 * which is how the first run of this probe came out green after the fix.
 */
function numbersFor(r: {
  daily_limit_kind?: string;
  daily_limit?: number | null;
  min_length_inches?: number | null;
  max_length_inches?: number | null;
  trophy_min_length_inches?: number | null;
  possession_limit?: number | null;
  trophy_allowance?: number | null;
}): (FishingNumber | null)[] {
  return [
    r.daily_limit_kind === 'count' && r.daily_limit != null
      ? { value: r.daily_limit, kind: 'count' } : null,
    r.min_length_inches != null
      ? { value: r.min_length_inches, kind: 'length' } : null,
    r.max_length_inches != null
      ? { value: r.max_length_inches, kind: 'length' } : null,
    r.trophy_min_length_inches != null
      ? { value: r.trophy_min_length_inches, kind: 'length' } : null,
    r.possession_limit != null
      ? { value: r.possession_limit, kind: 'count' } : null,
    r.trophy_allowance != null
      ? { value: r.trophy_allowance, kind: 'count' } : null,
  ];
}

/**
 * The row the model says it read. A rule with no evidence quote caps at 0.60
 * (extraction.ts:1082), so omitting it would put every probe below the gate and
 * prove nothing. In all the corruptions below the quote stays TRUE -- the model
 * quotes the right row and mis-assigns the numbers inside it, which is the
 * realistic failure, and the one a quote cannot catch.
 */
const STRIPER_ROW =
  'Striped Bass and/or Striped Bass Hybrids (minimum length limit 15 inches)** 6';

/** Score a rule the way the extractor scores it, errors and all. */
function gate(row: Record<string, unknown>, subject: string, quote = STRIPER_ROW) {
  const g = groundFishingRule(
    MS_BLOCKS, MS_TEXT, quote, subject,
    numbersFor(row as Parameters<typeof numbersFor>[0]),
    [null, null],
  );
  const errors: string[] = [];
  if (g.numbersMissing.length > 0) {
    errors.push(`not stated beside ${subject}: ${g.numbersMissing.join(', ')}`);
  }
  if (g.datesMissing.length > 0) {
    errors.push(`not found on the page: ${g.datesMissing.join(', ')}`);
  }
  const confidence = scoreFishingRuleConfidence(
    { ...row, evidence: { page: null, quote } } as never,
    { ok: errors.length === 0, errors }, g);
  return {
    confidence,
    errors,
    rowText: g.rowText,
    autoApproved: confidence >= 0.9 && errors.length === 0,
  };
}

/**
 * The true striped bass rule: 6 a day, 15-inch minimum. Both numbers are in the
 * one row, which is what makes this page worth probing.
 */
const STRIPER_TRUE = {
  daily_limit_kind: 'count',
  daily_limit: 6,
  size_rule: 'minimum',
  min_length_inches: 15,
  confidence: 0.95,
};

describe('the auto-approve gate, probed with wrong rows', () => {
  it('passes the true row -- so the probe is wired to the real path', () => {
    const r = gate(STRIPER_TRUE, 'striped bass');
    expect(r.rowText).toContain('Striped Bass');
    expect(r.errors).toEqual([]);
    expect(r.confidence).toBeGreaterThanOrEqual(0.9);
    expect(r.autoApproved).toBe(true);
  });

  it('CATCHES a daily limit that is nowhere on the page', () => {
    // 6 -> 7. Seven appears nowhere in this table.
    const r = gate({ ...STRIPER_TRUE, daily_limit: 7 }, 'striped bass');
    expect(r.autoApproved).toBe(false);
    expect(r.confidence).toBeLessThanOrEqual(0.3);
    expect(r.errors.join(' ')).toContain('not stated beside');
  });

  it("CATCHES another row's limit pinned on this species", () => {
    // Crappie is 30. The striped bass row does not carry 30.
    const r = gate({ ...STRIPER_TRUE, daily_limit: 30 }, 'striped bass');
    expect(r.autoApproved).toBe(false);
    expect(r.confidence).toBeLessThanOrEqual(0.3);
  });

  it('CATCHES a length that is nowhere on the page', () => {
    const r = gate({ ...STRIPER_TRUE, min_length_inches: 22 }, 'striped bass');
    expect(r.autoApproved).toBe(false);
    expect(r.confidence).toBeLessThanOrEqual(0.3);
  });

  // ===========================================================================
  // THE TWO HOLES.
  //
  // Both assertions below state what the gate does TODAY. Whatever fixes it
  // must invert them -- they are here to fail loudly at that moment, not to
  // bless the behaviour.
  // ===========================================================================

  it('CATCHES a daily limit and a length swapped for each other', () => {
    // "6 a day, 15-inch minimum" becomes "15 a day, 6-inch minimum". Both
    // numbers are still somewhere in the matched row, and the gate pools all
    // four numbers into one unordered bag and asks only whether each appears.
    // Nothing ties a number to the field claiming it.
    //
    // This is not a cosmetic swap: it triples a creel limit. Someone keeping 15
    // striped bass on a 6-a-day water is over by nine fish.
    const swapped = { ...STRIPER_TRUE, daily_limit: 15, min_length_inches: 6 };
    const r = gate(swapped, 'striped bass');
    expect(r.autoApproved).toBe(false);
    expect(r.confidence).toBeLessThanOrEqual(0.3);
    // Both halves of the swap are named, and a length is marked so the message
    // says which field is wrong rather than only which digits.
    expect(r.errors.join(' ')).toContain('15');
    expect(r.errors.join(' ')).toContain('6"');
  });

  it('CATCHES an invented possession limit, which was never grounded at all', () => {
    // possession_limit and trophy_allowance are not in the numbers array, so no
    // value of either is ever compared against the page. 14 and 9 appear
    // nowhere here; the gate has no opinion about either.
    const invented = { ...STRIPER_TRUE, possession_limit: 14, trophy_allowance: 9 };
    const r = gate(invented, 'striped bass');
    expect(r.autoApproved).toBe(false);
    expect(r.errors.join(' ')).toContain('14');
    expect(r.errors.join(' ')).toContain('9');
  });
});
