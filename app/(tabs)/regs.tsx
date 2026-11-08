import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Headline, Micro, Sentence, Tile } from '@/components/system';
import { Disclaimer } from '@/components/Provenance';
import { useRegsFeed } from '@/features/reference/queries';
import { BrowseStateChip, BrowseStatePrompt } from '@/components/BrowseStateChip';
import { useRegulationChanges, type RegulationChange } from '@/features/changes/queries';
import { verifiedAgo } from '@/lib/date';
import { lang } from '@/theme/tokens';

const { color, space, type } = lang;

export default function Regs() {
  const router = useRouter();
  const { data: regs, isLoading, browsing, stateCode, needsState } = useRegsFeed();

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <ActivityIndicator color={color.copper} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {/* A ScrollView, not a FlatList: the summaries live in one tile, and a
          list that renders its own rows cannot be wrapped in one. */}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Headline>What the rules{'\n'}say this year.</Headline>
          <Sentence style={{ marginTop: space.x16 }}>
            Plain-English summaries. Always confirm against the official source.
          </Sentence>
          {browsing ? (
            <View style={{ marginTop: space.x12 }}>
              <BrowseStateChip stateCode={stateCode} />
            </View>
          ) : null}
        </View>

        <WhatChanged />

        {regs.length > 0 ? (
          <Tile style={styles.tile}>
            <Micro>Summaries</Micro>
            {regs.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => router.push(`/regs/${item.id}`)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {item.state?.name} · {item.species?.name}
                  </Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {verifiedAgo(item.last_verified_at)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </Tile>
        ) : needsState ? (
          <BrowseStatePrompt line="Regulation summaries are free to read. Choose where you hunt." />
        ) : (
          <Sentence style={{ marginTop: space.section }}>
            {browsing ? 'No published summaries for this state yet.' : 'No published summaries for your follows yet.'}
          </Sentence>
        )}

        {regs.length ? (
          <View style={{ marginTop: space.section }}>
            <Disclaimer />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * What changed this year, for the states you follow. Each line is one
 * record-level difference against last year's regulations — moved openers,
 * seasons added or dropped, bag limits revised. The box around it is gone:
 * hairlines carry the list, and the copper label is the one accent.
 */
function WhatChanged() {
  const { data: changes = [], isLoading } = useRegulationChanges();
  if (isLoading || changes.length === 0) return null;
  const shown = changes.slice(0, 8);

  return (
    <Tile style={styles.tile}>
      <Micro style={{ color: color.copperDim }}>What changed this year</Micro>
      {shown.map((c) => (
        <ChangeLine key={c.id} change={c} />
      ))}
      {changes.length > shown.length ? (
        <Sentence tone="dim" style={{ marginTop: space.x12 }}>
          {`${changes.length - shown.length} more across your states.`}
        </Sentence>
      ) : null}
    </Tile>
  );
}

function ChangeLine({ change }: { change: RegulationChange }) {
  const mark = change.change_type === 'added' ? 'New' : change.change_type === 'removed' ? 'Gone' : 'Moved';
  return (
    <View style={styles.changeRow}>
      <Text style={styles.changeMark}>{mark}</Text>
      <Text style={styles.changeNote}>{change.note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: color.bg },
  content: { paddingHorizontal: space.gutter, paddingTop: space.x16, paddingBottom: 56 },
  header: { marginTop: space.x12 },

  tile: { marginTop: space.x12 },

  row: { flexDirection: 'row', alignItems: 'center', gap: space.x12, paddingVertical: 11 },
  rowTitle: { fontFamily: type.uiMedium, fontSize: 15.5, color: color.bone },
  rowSub: { fontFamily: type.ui, fontSize: 12.5, color: color.muted, marginTop: 1 },

  changeRow: { flexDirection: 'row', gap: space.x12, paddingVertical: 10 },
  changeMark: { width: 44, paddingTop: 2, fontFamily: type.uiMedium, fontSize: 12.5, color: color.copperDim },
  changeNote: { flex: 1, fontFamily: type.ui, fontSize: 14.5, lineHeight: 21, color: color.bone },

  pressed: { opacity: 0.6 },
});
