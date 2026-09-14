import type { CountdownItem } from '@/features/reference/types';
import rules from '@/assets/legal-light.json';
import centroids from '@/assets/state-centroids.json';
import { getFix } from '@/features/legalLight/useLegalLight';
import { legalLight } from '@/lib/sun';

const APP_GROUP = 'group.com.openseason.shared';

type Rule = { before: number; after: number; note?: string; none?: boolean };
const RULES = rules as Record<string, Rule>;
const CENTROIDS = centroids as Record<string, { lat: number; lng: number }>;

/**
 * Push the user's soonest opener/deadline into the shared App Group and refresh
 * the home-screen widget. The widget (targets/widget/index.swift) reads these
 * keys and computes the day count itself, so it stays correct even when the app
 * never opens. Wrapped in try/catch so a build without the native target (or a
 * dev client) degrades to a no-op instead of crashing.
 */
export function pushWidgetEvent(item: CountdownItem | undefined): void {
  try {
    // Lazy require: only loaded on iOS, and only when this runs.
    const { ExtensionStorage } = require('@bacons/apple-targets');
    const storage = new ExtensionStorage(APP_GROUP);
    if (item) {
      storage.set('widget_title', item.title);
      storage.set('widget_sub', item.subtitle);
      storage.set('widget_kind', item.kind);
      storage.set('widget_date', item.date);
    } else {
      storage.set('widget_title', '');
    }
    ExtensionStorage.reloadWidget();
  } catch {
    // Native target not present (e.g. dev client without the widget) — ignore.
  }
}

/**
 * Push a week of legal-light windows (epoch ms) into the App Group for the
 * Legal Light widget. The widget builds its own timeline from the table and
 * lets WidgetKit tick the countdown natively — no refreshes, no battery.
 * Recomputed every time Home mounts, so the table never runs dry for anyone
 * who opens the app within a week.
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
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ExtensionStorage } = require('@bacons/apple-targets');
    const storage = new ExtensionStorage(APP_GROUP);
    storage.set('widget_light', JSON.stringify(days));
    ExtensionStorage.reloadWidget();
  } catch {
    // Native target not present — ignore.
  }
}
