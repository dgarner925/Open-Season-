/**
 * Legal shooting light — computed on-device from sunrise/sunset (suncalc's
 * NOAA-based solar math, ~1-minute accuracy) plus the state's legal-light
 * rule. Coordinates never leave the phone.
 */
import * as SunCalc from 'suncalc';

export type LegalLight = {
  sunrise: Date;
  sunset: Date;
  /** Legal window after applying the state rule's offsets. */
  start: Date;
  end: Date;
};

/**
 * Offsets are minutes: beforeSunriseMin extends earlier, afterSunsetMin
 * extends later. CT deer is {30, 0}; AZ big game is {0, 0}.
 */
export function legalLight(
  date: Date,
  lat: number,
  lng: number,
  beforeSunriseMin: number,
  afterSunsetMin: number,
): LegalLight | null {
  // Noon anchor keeps the computed events on the intended calendar day.
  const noon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const t = SunCalc.getTimes(noon, lat, lng);
  if (!t.sunrise || !t.sunset || isNaN(t.sunrise.getTime()) || isNaN(t.sunset.getTime())) {
    return null; // polar day/night (midsummer Alaska)
  }
  return {
    sunrise: t.sunrise,
    sunset: t.sunset,
    start: new Date(t.sunrise.getTime() - beforeSunriseMin * 60000),
    end: new Date(t.sunset.getTime() + afterSunsetMin * 60000),
  };
}

export function formatClock(d: Date): string {
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ap}`;
}
