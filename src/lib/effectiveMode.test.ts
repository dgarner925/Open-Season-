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
import { resolveEffectiveMode, viewerStateCode } from '@/lib/effectiveMode';

const STATES = [
  { id: 'id-ga', code: 'GA', otw_launched: true },
  { id: 'id-al', code: 'AL', otw_launched: true },
  { id: 'id-fl', code: 'FL', otw_launched: true },
  { id: 'id-tn', code: 'TN', otw_launched: true },
  { id: 'id-ms', code: 'MS', otw_launched: true },
  { id: 'id-sc', code: 'SC', otw_launched: true },
  // Three published rules and two waters with no rules at all. The reason
  // the gate is a column and not a count.
  { id: 'id-nc', code: 'NC', otw_launched: false },
  { id: 'id-oh', code: 'OH', otw_launched: false },
];

/** The common case before the fix: onboarded, resident state, no browse code. */
const resident = (id: string | null) => ({
  residentStateId: id,
  browseCode: null,
  states: STATES,
});

/** A guest: no profile, one state picked on the device. */
const browsing = (code: string | null) => ({
  residentStateId: null,
  browseCode: code,
  states: STATES,
});

describe('viewerStateCode', () => {
  it('ANSWERS FOR AN ONBOARDED READER WITH NO BROWSE CODE', () => {
    // THE 1.4.8 BUG, in one line. The gate read browseCode on its own, so
    // this returned null, no state matched, and On the Water was hidden
    // from everyone who had finished onboarding -- which is to say, from
    // every real user. The feature shipped in the binary and was unreachable.
    expect(viewerStateCode(resident('id-ga'))).toBe('GA');
  });

  it('prefers where you live over what you were browsing', () => {
    // Both Home screens resolve in this order; the gate now matches them.
    // Disagreeing would put the toggle and the screen on different states.
    expect(
      viewerStateCode({ residentStateId: 'id-ga', browseCode: 'OH', states: STATES }),
    ).toBe('GA');
  });

  it('falls back to the browse code for a guest, or an unknown resident id', () => {
    expect(viewerStateCode(browsing('GA'))).toBe('GA');
    expect(
      viewerStateCode({ residentStateId: 'id-gone', browseCode: 'AL', states: STATES }),
    ).toBe('AL');
  });

  it('is null when nothing is known', () => {
    expect(viewerStateCode(resident(null))).toBeNull();
    expect(viewerStateCode(browsing(null))).toBeNull();
    expect(
      viewerStateCode({ residentStateId: 'id-ga', browseCode: null, states: undefined }),
    ).toBeNull();
  });
});

describe('resolveEffectiveMode', () => {
  it('LETS AN ONBOARDED GEORGIA ANGLER INTO THE WATER', () => {
    // The regression test for 1.4.8. Before the fix this was `hunt`.
    expect(resolveEffectiveMode({ stored: 'otw', ...resident('id-ga') })).toEqual({
      mode: 'otw',
      otwAvailable: true,
      code: 'GA',
    });
  });

  it('lets a launched state into the water', () => {
    expect(resolveEffectiveMode({ stored: 'otw', ...browsing('GA') })).toEqual({
      mode: 'otw',
      otwAvailable: true,
      code: 'GA',
    });
  });

  it('KEEPS NORTH CAROLINA OUT, though it has published fishing rules', () => {
    // The whole point of the column. A count-based gate would admit NC on
    // three statewide rules and no regulated waters, and a section that
    // opens with no answers reads as a broken app.
    expect(resolveEffectiveMode({ stored: 'otw', ...browsing('NC') })).toEqual({
      mode: 'hunt',
      otwAvailable: false,
      code: 'NC',
    });
    expect(resolveEffectiveMode({ stored: 'otw', ...resident('id-nc') }).mode).toBe('hunt');
  });

  it('SENDS A STORED FISHING PREFERENCE BACK TO THE WOODS IN AN UNLAUNCHED STATE', () => {
    // The live case: chose Water in Georgia, then switched browse state to
    // Ohio. The stored mode is one AsyncStorage key and knows nothing about
    // which state is being browsed.
    expect(resolveEffectiveMode({ stored: 'otw', ...browsing('OH') })).toEqual({
      mode: 'hunt',
      otwAvailable: false,
      code: 'OH',
    });
  });

  it('never sends a hunting reader to the water, launched or not', () => {
    for (const code of ['GA', 'NC', 'OH', null]) {
      expect(resolveEffectiveMode({ stored: 'hunt', ...browsing(code) }).mode).toBe('hunt');
    }
    expect(resolveEffectiveMode({ stored: 'hunt', ...resident('id-ga') }).mode).toBe('hunt');
  });

  it('treats the states query still in flight as unavailable', () => {
    // Correct, and the reason callers gate on `ready`: without that a
    // Georgia angler is judged un-launched for the frame before the query
    // lands and gets bounced out of the water on every cold start. The same
    // now goes for the profile, which is why `ready` folds in auth loading.
    expect(
      resolveEffectiveMode({
        stored: 'otw',
        residentStateId: 'id-ga',
        browseCode: null,
        states: undefined,
      }),
    ).toEqual({ mode: 'hunt', otwAvailable: false, code: null });
  });

  it('handles no state chosen, and a state the list does not contain', () => {
    expect(resolveEffectiveMode({ stored: 'otw', ...browsing(null) }).mode).toBe('hunt');
    expect(resolveEffectiveMode({ stored: 'otw', ...browsing('XX') }).mode).toBe('hunt');
    expect(
      resolveEffectiveMode({ stored: 'otw', residentStateId: null, browseCode: 'GA', states: [] })
        .mode,
    ).toBe('hunt');
  });

  it('EXPOSES THE OPPOSITION THE TWO LAYOUTS DEPEND ON', () => {
    // (tabs) redirects on `mode === 'otw'`, (otw) on `mode !== 'otw'`. For
    // every input there must be exactly one answer, so one of the two
    // redirects fires and the other cannot.
    const inputs = [
      { stored: 'otw' as const, ...browsing('GA') },
      { stored: 'otw' as const, ...browsing('OH') },
      { stored: 'hunt' as const, ...browsing('GA') },
      { stored: 'otw' as const, ...browsing(null) },
      { stored: 'otw' as const, ...resident('id-ga') },
      { stored: 'otw' as const, ...resident('id-oh') },
      { stored: 'otw' as const, ...resident(null) },
      {
        stored: 'otw' as const,
        residentStateId: 'id-ga',
        browseCode: null,
        states: undefined,
      },
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
