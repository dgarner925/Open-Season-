/**
 * The first screen on a fresh install: pick a state, see season dates.
 *
 * It replaces the sign-in wall that used to sit here. The paywall says "every
 * date in the app is free", and until now you had to create an account and
 * finish a three-step setup before you could see one. This is one tap, no
 * account, no species step -- straight to the Seasons tab with a real dated
 * list in it.
 *
 * It writes only `os.browseStateCode` on the device. Nothing here touches the
 * server, which is why it works with no session at all.
 */
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Sentence, Serif } from '@/components/system';
import { useActiveStates } from '@/features/reference/queries';
import { setBrowseStateCode } from '@/lib/browseState';
import { lang } from '@/theme/tokens';

const { color, space, type } = lang;

export default function PickState() {
  const router = useRouter();
  const { data: states = [], isLoading } = useActiveStates();
  const [query, setQuery] = useState('');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return states;
    return states.filter((s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase() === q);
  }, [states, query]);

  async function choose(code: string) {
    await setBrowseStateCode(code);
    // Land on Seasons, not Home: a dated list is the thing worth arriving at.
    router.replace('/(tabs)/calendar');
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.head}>
          <Serif size={40} style={{ lineHeight: 46 }}>
            Where do you{'\n'}
            <Serif italic copper size={40}>
              hunt?
            </Serif>
          </Serif>
          <Sentence style={{ marginTop: space.x8, maxWidth: 320 }}>
            Pick a state and start reading season dates. No account needed.
          </Sentence>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={16} color={color.dim} />
            <TextInput
              placeholder="Find a state"
              placeholderTextColor={color.dim}
              autoCapitalize="words"
              autoCorrect={false}
              value={query}
              onChangeText={setQuery}
              style={styles.search}
            />
          </View>
        </View>

        {isLoading ? (
          <ActivityIndicator color={color.copper} style={{ marginTop: space.x32 }} />
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {shown.map((s, i) => (
              <Pressable
                key={s.id}
                onPress={() => choose(s.code)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.rowLabel} numberOfLines={1}>
                  {s.name}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={color.copper} />
                {i < shown.length - 1 ? <View style={styles.rowRule} /> : null}
              </Pressable>
            ))}
            {shown.length === 0 ? <Sentence tone="dim">No state by that name.</Sentence> : null}
          </ScrollView>
        )}

        <Pressable
          onPress={() => router.push('/(auth)/sign-in')}
          hitSlop={10}
          accessibilityRole="button"
          style={styles.footer}
        >
          <Sentence tone="muted">Already have an account? Sign in.</Sentence>
        </Pressable>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  head: { paddingHorizontal: space.gutter, paddingTop: space.x32 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.x8,
    marginTop: space.x16,
    paddingVertical: space.x12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.hair,
  },
  search: { flex: 1, fontFamily: type.ui, fontSize: 16, color: color.bone, padding: 0 },
  list: { paddingHorizontal: space.gutter, paddingTop: space.x8, paddingBottom: space.x32 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.x12, minHeight: 44 },
  rowLabel: { flex: 1, fontFamily: type.ui, fontSize: type.size.body + 0.5, color: color.bone },
  rowRule: {
    position: 'absolute',
    left: 0,
    right: -space.gutter,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.hair,
  },
  footer: { paddingHorizontal: space.gutter, paddingVertical: space.x16, alignItems: 'center' },
});
