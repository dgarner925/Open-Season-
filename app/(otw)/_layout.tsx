/**
 * On the Water's tabs.
 *
 * A separate route group from (tabs) rather than one Tabs navigator that
 * swaps its screens, for two reasons. The first is that React Navigation
 * re-keys a navigator when its screen list changes, so a switching layout
 * would throw away tab state and any open stack on every toggle. The second
 * matters more: with a separate group, app/(tabs)/_layout.tsx needs no
 * conditionals at all, so "hunting is unchanged" is something the file
 * structure guarantees rather than something to re-check by eye.
 *
 * The cost is that the auth gate has two call sites, which is why the
 * decision itself lives in useAppGate and only the spinner is local.
 */
import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, StyleSheet, View, type ColorValue } from 'react-native';
import { useAppGate } from '@/hooks/useAppGate';
import { useMode } from '@/providers/ModeProvider';
import { otwLang } from '@/theme/otwTokens';

const { color, type } = otwLang;

function icon(base: keyof typeof Ionicons.glyphMap) {
  return ({ color: tint, focused }: { color: ColorValue; focused: boolean }) => (
    <Ionicons
      name={focused ? base : (`${base}-outline` as keyof typeof Ionicons.glyphMap)}
      color={tint}
      size={23}
    />
  );
}

export default function OtwTabsLayout() {
  const gate = useAppGate();
  const { mode, ready } = useMode();

  // `ready` is folded in here rather than handled separately: the gate is
  // already waiting on auth, browse state and setup, all of which are slower
  // than one AsyncStorage read, so this costs no extra frame.
  if (gate.status === 'loading' || !ready) {
    return (
      <View style={styles.gate}>
        <ActivityIndicator color={color.river} size="large" />
      </View>
    );
  }

  if (gate.status === 'redirect') return <Redirect href={gate.href} />;

  // Someone who switched back to the woods, or who deep-linked in here while
  // the mode says hunting. The mirror of this lives in (tabs)/_layout.tsx;
  // the two conditions are exact opposites, so they cannot ping-pong.
  if (mode !== 'otw') return <Redirect href="/(tabs)" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.bar,
        tabBarActiveTintColor: color.river,
        tabBarInactiveTintColor: color.tabInactive,
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: { paddingTop: 6 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home') }} />
      {/* Ionicons has no triple-wave glyph; the mockup's is custom art. The
          droplet reads as water and holds the slot until that ships. */}
      <Tabs.Screen name="waters" options={{ title: 'Waters', tabBarIcon: icon('water') }} />
      {/*
        STOCKING AND PROFILE ARE OFF THE BAR, not deleted.

        `href: null` keeps each route reachable by link and keeps the file,
        while taking the slot out of the tab bar. Deleting the files would
        drop routes that deep links and Home still reference.

        Profile re-exports app/(tabs)/settings, which imports `lang`
        statically -- so it renders the woods' near-black under this cream
        tab bar. That mismatch is why it read as out of place here. Settings
        is one tap away through the ModeToggle in the Home header, which is
        where account, sign-out and alerts now live.

        Stocking was an OtwPlaceholder over a `stockings` table holding ZERO
        rows: a tab that costs a fifth of the bar to tell the reader there is
        nothing here yet. It comes back when a stocking feed is loaded.

        Regs is still on the bar but is ALSO a placeholder -- see the note by
        its line below.
      */}
      <Tabs.Screen name="stocking" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      {/* Placeholder too. Left on the bar only because the Home screen links
          to it; under the State -> Water -> Fish model the Waters tab IS the
          regulations browser, so this slot is the one to re-use rather than
          fill. */}
      <Tabs.Screen name="regs" options={{ title: 'Regs', tabBarIcon: icon('document-text') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  gate: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: color.bg },
  // The same shape as the woods' bar -- one hairline, no raised surface --
  // in paper rather than near-black. The border is a full pixel here because
  // a hairline disappears into cream.
  bar: {
    backgroundColor: color.tabBar,
    borderTopColor: color.tabBarBorder,
    borderTopWidth: 1,
    height: 88,
    paddingBottom: 30,
  },
  label: {
    fontFamily: type.uiSemiBold,
    fontSize: 9.5,
    letterSpacing: 0.8,
    marginTop: 2,
  },
});
