/**
 * Legal shooting light for a state, today, where the hunter stands.
 *
 * Location: device GPS when permitted (computed on-device; coordinates never
 * leave the phone). Fallback: the state's geographic center, flagged approx —
 * sunrise varies across a wide state, so the ≈ matters.
 *
 * Rules: src/assets/legal-light.json — per-state big-game offsets verified
 * against official regulations (most states 30/30; CT 30/0; AZ 0/0 daylight;
 * AK has no shooting hours for big game at all).
 */
import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import rules from '@/assets/legal-light.json';
import centroids from '@/assets/state-centroids.json';
import { formatClock, legalLight } from '@/lib/sun';

type Rule = { before: number; after: number; note?: string; none?: boolean };

const RULES = rules as Record<string, Rule>;
const CENTROIDS = centroids as Record<string, { lat: number; lng: number }>;

// One position fix per app session is plenty — legal light moves ~1 min/day.
// Shared with the Weekend Brief's dawn conditions, which use the same fix.
let cachedFix: { lat: number; lng: number } | null | undefined;

export async function getFix(): Promise<{ lat: number; lng: number } | null> {
  if (cachedFix !== undefined) return cachedFix;
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    let granted = perm.granted;
    if (!granted && perm.canAskAgain) {
      granted = (await Location.requestForegroundPermissionsAsync()).granted;
    }
    if (!granted) {
      cachedFix = null;
      return null;
    }
    const last = await Location.getLastKnownPositionAsync();
    const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
    cachedFix = pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude } : null;
  } catch {
    cachedFix = null;
  }
  return cachedFix;
}

export type LegalLightToday = {
  /** "6:38 AM – 8:42 PM" */
  window: string;
  sunrise: string;
  sunset: string;
  /** Legal window edges, individually. */
  startClock: string;
  endClock: string;
  startMs: number;
  endMs: number;
  durationMin: number;
  /** The state rule's offsets, minutes (for phrasing the sentence). */
  before: number;
  after: number;
  /** True when computed from the state's center rather than device GPS. */
  approx: boolean;
  /** The rule's own wording note, when the state has one. */
  note?: string;
} | null;

/**
 * null while loading, when the state has no shooting-hours rule (AK), or when
 * the sun never rises/sets (midsummer Alaska).
 *
 * dayOffset: 0 = today (the season page's in-field case), 1 = tomorrow (the
 * Weekend Brief's case — by the time the brief lands, today's first light is
 * already behind you).
 */
export function useLegalLight(stateCode: string | null | undefined, dayOffset = 0): LegalLightToday {
  const [result, setResult] = useState<LegalLightToday>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!stateCode) return;
      const rule = RULES[stateCode];
      if (!rule || rule.none) return; // Alaska: no legal-hours rule for big game
      const fix = await getFix();
      const centroid = CENTROIDS[stateCode];
      const at = fix ?? centroid;
      if (!at) return;
      const day = new Date();
      day.setDate(day.getDate() + dayOffset);
      const ll = legalLight(day, at.lat, at.lng, rule.before, rule.after);
      if (!ll || cancelled) return;
      setResult({
        window: `${formatClock(ll.start)} – ${formatClock(ll.end)}`,
        sunrise: formatClock(ll.sunrise),
        sunset: formatClock(ll.sunset),
        startClock: formatClock(ll.start),
        endClock: formatClock(ll.end),
        startMs: ll.start.getTime(),
        endMs: ll.end.getTime(),
        durationMin: Math.round((ll.end.getTime() - ll.start.getTime()) / 60000),
        before: rule.before,
        after: rule.after,
        approx: !fix,
        note: rule.note,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [stateCode]);

  return result;
}
