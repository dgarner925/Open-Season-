/**
 * The home hero, chosen rather than rotated.
 *
 * The masthead used to read "Open season." — the name of the app, in the most
 * valuable 130px on the screen, telling the reader something they knew before
 * they tapped the icon. This picks a line that is actually worth that space,
 * from three voices in strict order of news value:
 *
 *   1. An opener within 48 hours. Rare, dated, and the reason people keep the
 *      app. Beats everything.
 *   2. A real verdict in the weather. "Real" is not re-decided here —
 *      useDawnConditions already sets frontLine only for a pressure drop over
 *      0.08 inHg or a 12° fall, and that bar is the bar.
 *   3. Where the light is. Always true, never empty, and therefore the floor:
 *      the hero is never blank and never has to invent something.
 *
 * Rotation without a rule would be worse than no rotation — a screen that
 * changes for no reason reads as decoration. Every line here is picked because
 * the day earned it, and the caller can say which rule fired.
 */

export type HeroVoice = 'opener' | 'weather' | 'light';

export type Hero = {
  voice: HeroVoice;
  /** Small-caps context line above the hero. */
  overline: string;
  /** First line, upright serif. */
  lead: string;
  /** Second line, italic copper. */
  accent: string;
  /** The line beneath — always carries the light, whatever the hero says. */
  support: string;
  /** Species name for the medallion behind the hero; null draws nothing. */
  species: string | null;
};

export type HeroOpener = {
  /** Species display name, as the database spells it. */
  species: string;
  /** State code the season belongs to. */
  stateCode: string | null;
  /** Whole days from today: 0 = today, 1 = tomorrow. */
  daysOut: number;
  /** "Firearms, statewide" — method and zone, already phrased. Optional. */
  detail?: string | null;
};

export type HeroLight = {
  startMs: number;
  endMs: number;
  startClock: string;
  endClock: string;
} | null;

export type HeroWeather = {
  frontKind: 'cold' | 'pressure' | null;
  frontLine: string | null;
  pressureInHg: number | null;
  dayName: string;
} | null;

export type HeroInput = {
  nowMs: number;
  /** Greeting already resolved for the hour ("Good evening"). */
  greeting: string;
  /** "MONDAY, NOV 2". */
  dateLabel: string;
  /** The user's home state, which the hero speaks for by default. */
  homeStateCode: string | null;
  /** Every followed season opening soon, any state. */
  openers: HeroOpener[];
  light: HeroLight;
  weather: HeroWeather;
  /** Followed species, most relevant first — the medallion falls back to this. */
  rosterSpecies: string[];
  /** How many followed species are open right now, for the light-voice support. */
  openCount: number;
};

/** Openers inside this window are news; beyond it they are just a calendar. */
const OPENER_DAYS = 1;

function hoursMinutes(ms: number): string {
  const total = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Pick the opener to lead with: home state first, because that is where the
 * reader is standing — but an opener in the OTHER state still beats no opener
 * at all, so news is allowed to cross a state line.
 */
function pickOpener(openers: HeroOpener[], homeStateCode: string | null): HeroOpener | null {
  const near = openers.filter((o) => o.daysOut >= 0 && o.daysOut <= OPENER_DAYS);
  if (near.length === 0) return null;
  const sorted = [...near].sort((a, b) => {
    const home = (o: HeroOpener) => (homeStateCode && o.stateCode === homeStateCode ? 0 : 1);
    return home(a) - home(b) || a.daysOut - b.daysOut || a.species.localeCompare(b.species);
  });
  return sorted[0];
}

export function heroLine(input: HeroInput): Hero {
  const { nowMs, greeting, dateLabel, homeStateCode, light, weather, rosterSpecies, openCount } = input;
  const fallbackSpecies = rosterSpecies[0] ?? null;

  // Whatever the hero says, the light goes underneath it. The one number a
  // hunter opens this app for must never fall off the screen because the
  // weather had something to say.
  const lightSupport = (() => {
    if (!light) return openCount > 0 ? `${openCount} open now` : '';
    if (nowMs < light.startMs) return `First light ${light.startClock} · ${hoursMinutes(light.startMs - nowMs)}`;
    if (nowMs <= light.endMs) return `Last light ${light.endClock} · ${hoursMinutes(light.endMs - nowMs)} left`;
    return `First light ${light.startClock}`;
  })();

  // --- 1. an opener is near -------------------------------------------------
  const opener = pickOpener(input.openers, homeStateCode);
  if (opener) {
    const when = opener.daysOut === 0 ? 'today' : 'tomorrow';
    const where = opener.stateCode ? ` · ${opener.stateCode}` : '';
    return {
      voice: 'opener',
      overline: `OPENS ${when.toUpperCase()}${where}`,
      lead: `${opener.species} opens`,
      accent: `${when}.`,
      support: [opener.detail, lightSupport].filter(Boolean).join(' · '),
      species: opener.species,
    };
  }

  // --- 2. the weather has a verdict ----------------------------------------
  if (weather?.frontKind) {
    const pressure =
      weather.pressureInHg != null ? `${weather.pressureInHg.toFixed(1)} and dropping` : null;
    const isPressure = weather.frontKind === 'pressure';
    return {
      voice: 'weather',
      overline: `${dateLabel}${homeStateCode ? ` · ${homeStateCode}` : ''}`,
      lead: isPressure ? 'The glass' : 'Sharply',
      accent: isPressure ? 'is falling.' : 'colder.',
      support: [
        isPressure ? `A front into ${weather.dayName}` : `${weather.dayName} at first light`,
        isPressure ? pressure : null,
        lightSupport,
      ]
        .filter(Boolean)
        .join(' · '),
      species: fallbackSpecies,
    };
  }

  // --- 3. where the light is ------------------------------------------------
  const overline = `${dateLabel} · ${greeting.toUpperCase()}`;
  if (!light) {
    // No shooting-hours rule for this state (Alaska), or the sun never set.
    // Fall back to the count, which is the next most useful true thing.
    return {
      voice: 'light',
      overline,
      lead: openCount === 1 ? 'One season' : `${openCount || 'No'} seasons`,
      accent: openCount === 1 ? 'is open.' : 'open.',
      species: fallbackSpecies,
      support: '',
    };
  }
  if (nowMs < light.startMs) {
    return {
      voice: 'light',
      overline,
      lead: 'First light',
      accent: `in ${hoursMinutes(light.startMs - nowMs)}.`,
      support: `Opens ${light.startClock} · last light ${light.endClock}`,
      species: fallbackSpecies,
    };
  }
  if (nowMs <= light.endMs) {
    return {
      voice: 'light',
      overline,
      lead: 'Legal',
      accent: 'light.',
      support: `Last light ${light.endClock} · ${hoursMinutes(light.endMs - nowMs)} left`,
      species: fallbackSpecies,
    };
  }
  return {
    voice: 'light',
    overline,
    lead: 'Done',
    accent: 'for the day.',
    support: `First light ${light.startClock} · ${hoursMinutes(light.startMs + 86400000 - nowMs)}`,
    species: fallbackSpecies,
  };
}
