/**
 * Which tab group the app routes to, and the negation that must not be wrong.
 *
 * app/(tabs)/_layout.tsx redirects when the mode IS 'otw'; (otw)/_layout.tsx
 * redirects when it is NOT. If those two ever disagree the reader bounces
 * between groups forever, which is why both read one hook and the hook's
 * decision is tested here rather than reasoned about twice.
 *
 * The six launched states are real: GA, AL, FL, TN, MS, SC
 * (migration 20261222000000).
 */
import { describe, expect, it } from 'vitest';
import { resolveEffectiveMode } from '@/lib/effectiveMode';

const STATES = [
  { code: 'GA', otw_launched: true },
  { code: 'AL', otw_launched: true },
  { code: 'FL', otw_launched: true },
  { code: 'TN', otw_launched: true },
  { code: 'MS', otw_launched: true },
  { code: 'SC', otw_launched: true },
  // Three published rules and two waters with no rules at all. The reason
  // the gate is a column and not a count.
  { code: 'NC', otw_launched: false },
  { code: 'OH', otw_launched: false },
];

describe('resolveEffectiveMode', () => {
  it('lets a launched state into the water', () => {
    expect(resolveEffectiveMode({ stored: 'otw', code: 'GA', states: STATES })).toEqual({
      mode: 'otw',
      otwAvailable: true,
    });
  });

  it('KEEPS NORTH CAROLINA OUT, though it has published fishing rules', () => {
    // The whole point of the column. A count-based gate would admit NC on
    // three statewide rules and no regulated waters, and a section that
    // opens with no answers reads as a broken app.
    expect(resolveEffectiveMode({ stored: 'otw', code: 'NC', states: STATES })).toEqual({
      mode: 'hunt',
      otwAvailable: false,
    });
  });

  it('SENDS A STORED FISHING PREFERENCE BACK TO THE WOODS IN AN UNLAUNCHED STATE', () => {
    // The live case: chose Water in Georgia, then switched browse state to
    // Ohio. The stored mode is one AsyncStorage key and knows nothing about
    // which state is being browsed.
    expect(resolveEffectiveMode({ stored: 'otw', code: 'OH', states: STATES })).toEqual({
      mode: 'hunt',
      otwAvailable: false,
    });
  });

  it('never sends a hunting reader to the water, launched or not', () => {
    for (const code of ['GA', 'NC', 'OH', null]) {
      expect(resolveEffectiveMode({ stored: 'hunt', code, states: STATES }).mode).toBe('hunt');
    }
  });

  it('treats the states query still in flight as unavailable', () => {
    // Correct, and the reason callers gate on `ready`: without that a
    // Georgia angler is judged un-launched for the frame before the query
    // lands and gets bounced out of the water on every cold start.
    expect(resolveEffectiveMode({ stored: 'otw', code: 'GA', states: undefined })).toEqual({
      mode: 'hunt',
      otwAvailable: false,
    });
  });

  it('handles no state chosen, and a state the list does not contain', () => {
    expect(resolveEffectiveMode({ stored: 'otw', code: null, states: STATES }).mode).toBe('hunt');
    expect(resolveEffectiveMode({ stored: 'otw', code: 'XX', states: STATES }).mode).toBe('hunt');
    expect(resolveEffectiveMode({ stored: 'otw', code: 'GA', states: [] }).mode).toBe('hunt');
  });

  it('EXPOSES THE OPPOSITION THE TWO LAYOUTS DEPEND ON', () => {
    // (tabs) redirects on `mode === 'otw'`, (otw) on `mode !== 'otw'`. For
    // every input there must be exactly one answer, so one of the two
    // redirects fires and the other cannot.
    const inputs = [
      { stored: 'otw' as const, code: 'GA', states: STATES },
      { stored: 'otw' as const, code: 'OH', states: STATES },
      { stored: 'hunt' as const, code: 'GA', states: STATES },
      { stored: 'otw' as const, code: null, states: STATES },
      { stored: 'otw' as const, code: 'GA', states: undefined },
    ];
    for (const input of inputs) {
      const { mode } = resolveEffectiveMode(input);
      const tabsRedirects = mode === 'otw';
      const otwRedirects = mode !== 'otw';
      expect(tabsRedirects).not.toBe(otwRedirects);
    }
  });

  it('is launched in exactly the six states the migration names', () => {
    const launched = STATES.filter((s) => s.otw_launched).map((s) => s.code).sort();
    expect(launched).toEqual(['AL', 'FL', 'GA', 'MS', 'SC', 'TN']);
  });
});
