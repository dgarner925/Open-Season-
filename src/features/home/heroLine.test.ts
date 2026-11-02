import { describe, expect, it } from 'vitest';
import { heroLine, type HeroInput } from './heroLine';

const NOON = Date.UTC(2026, 10, 2, 17, 0, 0); // Mon Nov 2, midday ET

const base: HeroInput = {
  nowMs: NOON,
  greeting: 'Good afternoon',
  dateLabel: 'MONDAY, NOV 2',
  homeStateCode: 'GA',
  openers: [],
  light: {
    startMs: NOON - 6 * 3600_000,
    endMs: NOON + 6 * 3600_000,
    startClock: '6:25 AM',
    endClock: '6:10 PM',
  },
  weather: null,
  rosterSpecies: ['Deer', 'Black bear'],
  openCount: 3,
};

describe('rule 1 — an opener inside 48 hours', () => {
  it('beats a front in the weather', () => {
    const h = heroLine({
      ...base,
      openers: [{ species: 'Deer', stateCode: 'GA', daysOut: 1, detail: 'Firearms, statewide' }],
      weather: { frontKind: 'pressure', frontLine: 'The glass is falling.', pressureInHg: 30.3, dayName: 'Tuesday' },
    });
    expect(h.voice).toBe('opener');
    expect(h.lead).toBe('Deer opens');
    expect(h.accent).toBe('tomorrow.');
    expect(h.species).toBe('Deer');
  });

  it('says today when the season opens today', () => {
    const h = heroLine({ ...base, openers: [{ species: 'Turkey', stateCode: 'GA', daysOut: 0 }] });
    expect(h.accent).toBe('today.');
    expect(h.overline).toBe('OPENS TODAY · GA');
  });

  it('prefers the home state over an earlier opener elsewhere', () => {
    const h = heroLine({
      ...base,
      openers: [
        { species: 'Elk', stateCode: 'MT', daysOut: 0 },
        { species: 'Deer', stateCode: 'GA', daysOut: 1 },
      ],
    });
    expect(h.species).toBe('Deer');
  });

  it('still crosses a state line when home has no opener', () => {
    const h = heroLine({ ...base, openers: [{ species: 'Elk', stateCode: 'MT', daysOut: 1 }] });
    expect(h.voice).toBe('opener');
    expect(h.overline).toBe('OPENS TOMORROW · MT');
  });

  it('ignores an opener further out than tomorrow', () => {
    const h = heroLine({ ...base, openers: [{ species: 'Deer', stateCode: 'GA', daysOut: 3 }] });
    expect(h.voice).toBe('light');
  });

  it('carries the light underneath, whatever it leads with', () => {
    const h = heroLine({ ...base, openers: [{ species: 'Deer', stateCode: 'GA', daysOut: 1, detail: 'Firearms' }] });
    expect(h.support).toContain('Firearms');
    expect(h.support).toContain('6:10 PM');
  });
});

describe('rule 2 — the weather has a verdict', () => {
  it('phrases a pressure drop in two lines of its own', () => {
    const h = heroLine({
      ...base,
      weather: { frontKind: 'pressure', frontLine: 'The glass is falling.', pressureInHg: 30.3, dayName: 'Tuesday' },
    });
    expect(h.voice).toBe('weather');
    expect(h.lead).toBe('The glass');
    expect(h.accent).toBe('is falling.');
    expect(h.support).toContain('30.3 and dropping');
    expect(h.support).toContain('Tuesday');
  });

  it('phrases a cold front differently', () => {
    const h = heroLine({
      ...base,
      weather: { frontKind: 'cold', frontLine: 'Sharply colder.', pressureInHg: 30.1, dayName: 'Tuesday' },
    });
    expect(h.lead).toBe('Sharply');
    expect(h.accent).toBe('colder.');
    // A cold front is a temperature story, so the barometer stays out of it.
    expect(h.support).not.toContain('dropping');
  });

  it('stays quiet when the forecast is ordinary', () => {
    const h = heroLine({
      ...base,
      weather: { frontKind: null, frontLine: null, pressureInHg: 30.1, dayName: 'Tuesday' },
    });
    expect(h.voice).toBe('light');
  });
});

describe('rule 3 — where the light is', () => {
  it('counts down to first light before the window opens', () => {
    const h = heroLine({ ...base, nowMs: base.light!.startMs - 90 * 60_000 });
    expect(h.lead).toBe('First light');
    expect(h.accent).toBe('in 1h 30m.');
  });

  it('says legal light inside the window', () => {
    const h = heroLine(base);
    expect(h.lead).toBe('Legal');
    expect(h.accent).toBe('light.');
    expect(h.support).toContain('6h left');
  });

  it('closes the day out after last light', () => {
    const h = heroLine({ ...base, nowMs: base.light!.endMs + 60_000 });
    expect(h.lead).toBe('Done');
    expect(h.accent).toBe('for the day.');
  });

  it('falls back to the count where there is no shooting-hours rule', () => {
    const h = heroLine({ ...base, light: null });
    expect(h.lead).toBe('3 seasons');
    expect(h.accent).toBe('open.');
  });

  it('is never blank, even with nothing followed', () => {
    const h = heroLine({ ...base, light: null, openCount: 0, rosterSpecies: [] });
    expect(h.lead).toBe('No seasons');
    expect(h.accent).toBe('open.');
    expect(h.species).toBeNull();
  });

  it('says one season in the singular', () => {
    const h = heroLine({ ...base, light: null, openCount: 1 });
    expect(h.lead).toBe('One season');
    expect(h.accent).toBe('is open.');
  });

  it('borrows the medallion from the roster', () => {
    expect(heroLine(base).species).toBe('Deer');
  });
});
