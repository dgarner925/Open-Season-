import type { CountdownItem } from '@/features/reference/types';

/**
 * No-op fallback for web/Android. The real implementation lives in
 * widget.ios.ts and writes the next event into the iOS App Group so the
 * home-screen widget can show it. Metro resolves the .ios.ts variant on iOS.
 */
export function pushWidgetEvent(_item: CountdownItem | undefined): void {}
