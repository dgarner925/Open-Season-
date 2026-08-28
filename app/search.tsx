import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen, Sentence } from '@/components/system';
import { SpeciesBadge } from '@/components/midnight';
import { useAuth } from '@/providers/AuthProvider';
import { usePermitFollows, useTogglePermitFollow } from '@/features/follows/queries';
import { useActiveStates } from '@/features/reference/queries';
import { useSearchMemo, type SearchResult } from '@/features/search/useSearch';
import { openExternalUrl } from '@/lib/openUrl';
import { lang } from '@/theme/tokens';

const { color, space, type, radius } = lang;

export default function Search() {
  const router = useRouter();
  const { profile } = useAuth();
  const { data: states = [] } = useActiveStates();
  const myStateCode = states.find((s) => s.id === profile?.resident_state_id)?.code ?? null;

  const [raw, setRaw] = useState('');
  const [query, setQuery] = useState('');
  const [openNow, setOpenNow] = useState(false);
  const [myState, setMyState] = useState(false);
  const [deadlinesOnly, setDeadlinesOnly] = useState(false);

  // Debounce typing so the index runs at most a few times a second.
  useEffect(() => {
    const t = setTimeout(() => setQuery(raw), 180);
    return () => clearTimeout(t);
  }, [raw]);

  const { results, isLoading, ready } = useSearchMemo(query, {
    openNow,
    myState: myState ? myStateCode : null,
    deadlinesOnly,
  });

  // Permit hunts are followable straight from the results list.
  const { data: permitFollows = [] } = usePermitFollows();
  const togglePermit = useTogglePermitFollow();
  const permitFollowId = new Map(permitFollows.map((f) => [f.permit_id, f.id]));

  function open(r: SearchResult) {
    if (r.type === 'season') router.push(`/season/${r.id}`);
    else if (r.type === 'deadline') router.push(`/window/${r.id}`);
    else if (r.url) openExternalUrl(r.url);
  }

  const shown = results.slice(0, 60);

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: 'Search' }} />

      {/* The field is the only pill on this screen. */}
      <View style={styles.inputWrap}>
        <Ionicons name="search" size={16} color={color.dim} />
        <TextInput
          value={raw}
          onChangeText={setRaw}
          placeholder='Species, state, month, or "open now"'
          placeholderTextColor={color.dim}
          style={styles.input}
          autoFocus
          autoCorrect={false}
          returnKeyType="search"
        />
        {raw ? (
          <Pressable onPress={() => setRaw('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={color.dim} />
          </Pressable>
        ) : null}
      </View>

      {/* Filters as tappable words — state, not pills. */}
      <View style={styles.filterRow}>
        <FilterWord label="Open now" on={openNow} onPress={() => setOpenNow((v) => !v)} />
        {myStateCode ? <FilterWord label="My state" on={myState} onPress={() => setMyState((v) => !v)} /> : null}
        <FilterWord label="Deadlines" on={deadlinesOnly} onPress={() => setDeadlinesOnly((v) => !v)} />
      </View>

      {!ready || isLoading ? (
        <ActivityIndicator color={color.copper} style={{ marginTop: space.x38 }} />
      ) : shown.length === 0 ? (
        <Sentence style={{ marginTop: space.x38 }}>
          {query.trim() || openNow || myState || deadlinesOnly
            ? 'Nothing matches — try a species, a state, or a month.'
            : 'Search every season, deadline, and federal permit hunt in all 50 states.'}
        </Sentence>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(r) => `${r.type}:${r.id}`}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: space.x16, paddingBottom: space.x38 }}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListFooterComponent={
            results.length > shown.length ? (
              <Sentence tone="dim" style={{ textAlign: 'center', marginTop: space.x16, fontSize: 13 }}>
                Narrow the search — {results.length - shown.length} more match.
              </Sentence>
            ) : null
          }
          renderItem={({ item: r }) => (
            <Pressable onPress={() => open(r)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
              {r.speciesName ? (
                <SpeciesBadge name={r.speciesName} size={38} muted />
              ) : (
                <View style={styles.permitTile}>
                  <Ionicons name="ribbon-outline" size={17} color={color.dim} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {r.title}
                </Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {r.caption}
                </Text>
              </View>
              {r.type === 'permit' ? (
                <Pressable
                  hitSlop={12}
                  disabled={togglePermit.isPending}
                  onPress={() => togglePermit.mutate({ permitId: r.id, existingId: permitFollowId.get(r.id) })}
                >
                  <Ionicons
                    name={permitFollowId.has(r.id) ? 'checkmark-circle' : 'add-circle-outline'}
                    size={20}
                    color={permitFollowId.has(r.id) ? color.copper : color.dim}
                  />
                </Pressable>
              ) : (
                <Ionicons name="chevron-forward" size={13} color={color.dim} />
              )}
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

function FilterWord({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${label} filter`}>
      <Text style={[styles.filterWord, on && styles.filterWordOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.x8,
    marginTop: space.x16,
    paddingHorizontal: space.x16,
    height: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.hair,
  },
  input: { flex: 1, color: color.bone, fontSize: 15, fontFamily: type.ui },

  filterRow: { flexDirection: 'row', gap: space.section, marginTop: space.x16 },
  filterWord: { fontFamily: type.uiMedium, fontSize: 14, color: color.dim },
  filterWordOn: { color: color.copper },

  row: { flexDirection: 'row', alignItems: 'center', gap: space.x12, paddingVertical: space.x12, minHeight: 44 },
  rowTitle: { fontFamily: type.ui, fontSize: type.size.body + 0.5, color: color.bone },
  rowSub: { fontFamily: type.ui, fontSize: 13, color: color.muted, marginTop: 2 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: color.hair, marginHorizontal: -space.gutter },
  permitTile: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hair,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
