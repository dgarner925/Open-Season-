/**
 * The store fields have hard caps, and overflowing one is the kind of mistake
 * that surfaces at submission rather than at the edit. These are cheap.
 */
import { describe, expect, it } from 'vitest';
import {
  APP_FULL_NAME,
  APP_NAME,
  HOME_SCREEN_LABEL,
  MODES_TAGLINE,
  MODE_LABEL,
  STORE_NAME,
  STORE_NAME_LIMIT,
  STORE_SUBTITLE,
  STORE_SUBTITLE_LIMIT,
} from './brand';

describe('store field limits', () => {
  it('the proposed store name fits', () => {
    expect(STORE_NAME.length).toBeLessThanOrEqual(STORE_NAME_LIMIT);
  });

  it('the proposed subtitle fits', () => {
    expect(STORE_SUBTITLE.length).toBeLessThanOrEqual(STORE_SUBTITLE_LIMIT);
  });

  it('the full brand does NOT fit, which is why STORE_NAME exists', () => {
    expect(APP_FULL_NAME.length).toBeGreaterThan(STORE_NAME_LIMIT);
  });

  it('the home-screen label stays short enough that iOS will not truncate it', () => {
    expect(HOME_SCREEN_LABEL.length).toBeLessThanOrEqual(12);
    // It must also still match app.json's `name`, which this file does not change.
    expect(HOME_SCREEN_LABEL).toBe('Open Season');
  });
});

describe('the names agree with each other', () => {
  it('the full name is the app name plus the tagline', () => {
    expect(APP_FULL_NAME).toBe(`${APP_NAME}: ${MODES_TAGLINE}`);
  });

  it('the tagline is built from the two mode names', () => {
    expect(MODES_TAGLINE).toBe(`${MODE_LABEL.hunt.long} & ${MODE_LABEL.otw.long}`);
  });

  it('the toggle labels are the same length, so neither segment dominates', () => {
    expect(MODE_LABEL.hunt.short.length).toBe(MODE_LABEL.otw.short.length);
  });

  it('every mode has a label for the toggle and for a screen reader', () => {
    for (const key of ['hunt', 'otw'] as const) {
      expect(MODE_LABEL[key].short.length).toBeGreaterThan(0);
      expect(MODE_LABEL[key].long.length).toBeGreaterThan(0);
    }
  });
});
