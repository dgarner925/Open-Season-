import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CountdownItem } from '@/features/reference/types';
import rules from '@/assets/legal-light.json';
import centroids from '@/assets/state-centroids.json';
import { getFix } from '@/features/legalLight/useLegalLight';
import { legalLight } from '@/lib/sun';

type Rule = { before: number; after: number; note?: string; none?: boolean };
const RULES = rules as Record<string, Rule>;
const CENTROIDS = centroids as Record<string, { lat: number; lng: number }>;

/** Read by LegalLightWidget.kt straight out of AsyncStorage's database. */
const KEY = 'widget_light';

/**
 * The next-opener widget is iOS-only for now; Android ships the Legal Light
 * one first because it is the one that earns its square every morning.
 */
export function pushWidgetEvent(_item: CountdownItem | undefined): void {}

/**
 * Push a week of legal-light windows (epoch ms) for the Android widget.
 *
 * iOS hands these to WidgetKit through an App Group; here they go into
 * AsyncStorage, which the widget reads directly from the app's own SQLite
 * database (see plugins/android-widget/LegalLightWidget.kt). There is no way
 * to poke the widget from JS without a native module, so a fresh table is
 * picked up on the widget's own half-hour cycle or at the next light
 * boundary — which is soon enough for a table that spans seven days.
 */
export async function pushWidgetLight(stateCode: string | null): Promise<void> {
  try {
    if (!stateCode) return;
    const rule = RULES[stateCode];
    if (!rule || rule.none) return;
    const fix = await getFix();
    const at = fix ?? CENTROIDS[stateCode];
    if (!at) return;
    const days: { s: number; e: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const ll = legalLight(d, at.lat, at.lng, rule.before, rule.after);
      if (ll) days.push({ s: ll.start.getTime(), e: ll.end.getTime() });
    }
    if (days.length === 0) return;
    await AsyncStorage.setItem(KEY, JSON.stringify(days));
  } catch {
    // Storage unavailable — the widget keeps its last table and its fallback.
  }
}
