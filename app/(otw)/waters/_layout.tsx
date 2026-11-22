/**
 * The Waters tab is a stack, not a screen.
 *
 * State -> Water -> Fish needs two levels: the list of a state's waters, and
 * one water with every species resolved. A Stack inside the tab is what makes
 * the second a push rather than a tab switch -- so the back gesture works,
 * the list keeps its scroll position and its search text, and the tab bar
 * stays put underneath.
 *
 * The alternative was a hidden sibling tab with `href: null`, which renders
 * but navigates wrong: moving between tabs is a switch, not a push, so
 * router.back() from the water would land wherever the reader had been before
 * opening the Waters tab at all.
 *
 * `waters.tsx` became `waters/index.tsx` for this, so every existing link to
 * /(otw)/waters still resolves -- the Home screen has one.
 */
import { Stack } from 'expo-router';
import { otwLang } from '@/theme/otwTokens';

export default function WatersStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: otwLang.color.bg },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="[slug]" />
    </Stack>
  );
}
