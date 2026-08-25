import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppText, Screen } from '@/components/ui';
import { PageTitle, SpeciesBadge } from '@/components/midnight';
import { useAuth } from '@/providers/AuthProvider';
import { usePermitFollows, useTogglePermitFollow } from '@/features/follows/queries';
import { useActiveStates } from '@/features/reference/queries';
import { useSearchMemo, type SearchResult } from '@/features/search/useSearch';
import { openExternalUrl } from '@/lib/openUrl';
import { fontFamily, radius, spacing, theme } from '@/theme';

const BADGE_LABEL: Record<string, string> = { season: 'SEASON', deadline: 'DEADLINE', permit: 'PERMIT' };

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
      <Stack.Screen options={{ headerShown: true, title: '' }} />
      <PageTitle lead="Find your " accent="hunt." />

      <View style={styles.inputWrap}>
        <Ionicons name="search" size={16} color={theme.color.textMuted} />
        <TextInput
          value={raw}
          onChangeText={setRaw}
          placeholder='Species, state, month, or "open now"'
          placeholderTextColor={theme.color.textMuted}
          style={styles.input}
          autoFocus
          autoCorrect={false}
          returnKeyType="search"
        />
        {raw ? (
          <Pressable onPress={() => setRaw('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={theme.color.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.chips}>
        <Chip label="Open now" on={openNow} onPress={() => setOpenNow((v) => !v)} />
        {myStateCode ? <Chip label="My state" on={myState} onPress={() => setMyState((v) => !v)} /> : null}
        <Chip label="Deadlines" on={deadlinesOnly} onPress={() => setDeadlinesOnly((v) => !v)} />
      </View>

      {!ready || isLoading ? (
        <ActivityIndicator color={theme.color.accent} style={{ marginTop: spacing.xxl }} />
      ) : shown.length === 0 ? (
        <AppText variant="body" color={theme.color.textMuted} style={{ marginTop: spacing.xxl, textAlign: 'center' }}>
          {query.trim() || openNow || myState || deadlinesOnly
            ? 'Nothing matches — try a species, a state, or a month.'
            : 'Search every season, deadline, and federal permit hunt in all 50 states.'}
        </AppText>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(r) => `${r.type}:${r.id}`}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: spacing.lg, paddingBottom: spacing.xxl }}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListFooterComponent={
            results.length > shown.length ? (
              <AppText variant="caption" color={theme.color.textMuted} style={{ textAlign: 'center', marginTop: spacing.lg }}>
                {results.length - shown.length} more — narrow the search
              </AppText>
            ) : null
          }
          renderItem={({ item: r }) => (
            <Pressable onPress={() => open(r)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
              {r.speciesName ? (
                <SpeciesBadge name={r.speciesName} size={38} muted />
              ) : (
                <View style={styles.permitTile}>
                  <Ionicons name="ribbon-outline" size={17} color={theme.color.textMuted} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong" numberOfLines={1}>
                  {r.title}
                </AppText>
                <AppText variant="caption" color={theme.color.textMuted} numberOfLines={1} style={{ marginTop: 2 }}>
                  {r.caption}
                </AppText>
              </View>
              <View style={[styles.typeBadge, r.type !== 'season' && styles.typeBadgeAccent]}>
                <Text style={[styles.typeBadgeText, r.type !== 'season' && { color: theme.color.accent }]}>
                  {BADGE_LABEL[r.type]}
                </Text>
              </View>
              {r.type === 'permit' ? (
                <Pressable
                  hitSlop={12}
                  disabled={togglePermit.isPending}
                  onPress={() => togglePermit.mutate({ permitId: r.id, existingId: permitFollowId.get(r.id) })}
                  style={({ pressed }) => pressed && { opacity: 0.5 }}
                >
                  <Ionicons
                    name={permitFollowId.has(r.id) ? 'checkmark-circle' : 'add-circle-outline'}
                    size={20}
                    color={permitFollowId.has(r.id) ? theme.color.accent : theme.color.textMuted}
                  />
                </Pressable>
              ) : (
                <Ionicons name="chevron-forward" size={13} color={theme.color.textMuted} />
              )}
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.color.surfaceFlat,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.borderFlat,
  },
  input: { flex: 1, color: theme.color.textPrimary, fontSize: 15, fontFamily: fontFamily.sansMedium },

  chips: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  chip: {
    paddingHorizontal: spacing.lg,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: theme.color.accent, borderColor: theme.color.accent },
  chipText: { fontFamily: fontFamily.sansMedium, fontSize: 12.5, color: theme.color.textSecondary },
  chipTextOn: { color: theme.color.onAccent },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: theme.color.border, marginLeft: 50 },
  permitTile: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: theme.color.surfaceFlat,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.borderFlat,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBadge: {
    paddingHorizontal: spacing.sm,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: theme.color.surfaceFlat,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBadgeAccent: { backgroundColor: theme.color.accentFill },
  typeBadgeText: { fontFamily: fontFamily.sansSemiBold, fontSize: 8.5, letterSpacing: 1, color: theme.color.textMuted },
});
