import type { CountdownItem } from '@/features/reference/types';

const APP_GROUP = 'group.com.openseason.app';

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
