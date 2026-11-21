/**
 * The OTW palette's contrast, measured.
 *
 * Five values in otwTokens.ts are deliberately darker than the design brief
 * asked for, because the brief's values fail WCAG AA at the size they are
 * used. A hex that is 4% darker than the one in the spec document is exactly
 * the kind of thing someone "corrects" later, so the reason is a test rather
 * than only a comment.
 *
 * Pure arithmetic — no renderer, nothing from React Native — so this runs in
 * the same vitest pass as the rest of src/.
 */
import { describe, expect, it } from 'vitest';
import { otwLang } from './otwTokens';
import { lang } from './tokens';

/** WCAG 2.1 relative luminance. */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** WCAG 2.1 contrast ratio, order-independent. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const AA = 4.5;
const c = otwLang.color;

describe('contrast ratio helper', () => {
  it('agrees with the known anchors', () => {
    expect(contrast('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
    expect(contrast('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    // Order must not matter.
    expect(contrast('#1B2B36', '#F3EDE0')).toBeCloseTo(contrast('#F3EDE0', '#1B2B36'), 10);
  });
});

describe('text on creek paper', () => {
  it.each([
    ['ink (primary text)', c.ink],
    ['muted (supporting sentences)', c.muted],
    ['dim (micro labels)', c.dim],
    ['river (the accent)', c.river],
    ['brassText (links)', c.brassText],
    ['mossText (open status)', c.mossText],
  ])('%s passes AA on bg', (_label, fg) => {
    expect(contrast(fg, c.bg)).toBeGreaterThanOrEqual(AA);
  });
});

describe('text on the Today on the Water card', () => {
  it.each([
    ['riverText', c.riverText],
    ['riverTextDim', c.riverTextDim],
    ['brassOnRiver (micro labels)', c.brassOnRiver],
  ])('%s passes AA on river', (_label, fg) => {
    expect(contrast(fg, c.river)).toBeGreaterThanOrEqual(AA);
  });
});

describe('filled pills, where the brief failed', () => {
  it('cream on the Renew button passes AA', () => {
    expect(contrast('#FBF6EA', c.brassDeep)).toBeGreaterThanOrEqual(AA);
  });

  it('cream on the Wadeable pill passes AA', () => {
    expect(contrast(c.riverText, c.mossText)).toBeGreaterThanOrEqual(AA);
  });

  it("documents why the brief's own values could not be used", () => {
    // Kept as an executable record: these are the values in the design brief.
    // If a future change makes them pass, the brief was right and this test
    // should go -- but it should go on purpose, not by accident.
    expect(contrast('#8C6A2E', c.bg)).toBeLessThan(AA); // brassText as briefed
    expect(contrast('#FBF6EA', '#A8823F')).toBeLessThan(AA); // Renew as briefed
    // The Wadeable pill failed under BOTH candidate text colours, which is
    // why the fill changed rather than the text.
    expect(contrast('#F3EDE0', '#6B8A3E')).toBeLessThan(AA);
    expect(contrast('#1B2B36', '#6B8A3E')).toBeLessThan(AA);
  });
});

describe('the tab bar', () => {
  it('the active tab passes AA', () => {
    expect(contrast(c.river, c.tabBar)).toBeGreaterThanOrEqual(AA);
  });

  it('the inactive tab passes AA, as hunting’s already does', () => {
    expect(contrast(c.tabInactive, c.tabBar)).toBeGreaterThanOrEqual(AA);
    // The precedent being matched.
    expect(contrast(lang.color.dim, lang.color.bg)).toBeGreaterThanOrEqual(AA);
  });
});

describe('the shape contract with lang', () => {
  it('carries every colour role lang does, so useLang() can return either', () => {
    for (const key of Object.keys(lang.color)) {
      expect(otwLang.color, `otwLang.color is missing the "${key}" role`).toHaveProperty(key);
    }
  });

  it('carries every type role lang does', () => {
    for (const key of Object.keys(lang.type)) {
      expect(otwLang.type, `otwLang.type is missing the "${key}" role`).toHaveProperty(key);
    }
  });

  it('keeps the skeleton identical -- space and radius are not the mode’s to change', () => {
    expect(otwLang.space).toBe(lang.space);
    expect(otwLang.radius).toBe(lang.radius);
  });

  it('keeps values in Instrument Serif and UI in Archivo, in both modes', () => {
    expect(otwLang.type.display).toBe(lang.type.display);
    expect(otwLang.type.ui).toBe(lang.type.ui);
    expect(otwLang.type.uiSemiBold).toBe(lang.type.uiSemiBold);
  });

  it('the OTW-native names are aliases, not second opinions', () => {
    expect(otwLang.color.ink).toBe(otwLang.color.bone);
    expect(otwLang.color.river).toBe(otwLang.color.copper);
    expect(otwLang.color.riverDeep).toBe(otwLang.color.copperDim);
  });
});

describe('hunting is untouched', () => {
  it('still holds the values it had before OTW existed', () => {
    // otwTokens.ts imports lang. If it ever mutated it, this catches it.
    expect(lang.color.bg).toBe('#0A0A0A');
    expect(lang.color.copper).toBe('#E0A480');
    expect(lang.color.bone).toBe('#F2EFEC');
    expect(lang.type.size.headline).toBe(44);
  });
});
