import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Headline, Micro, Sentence } from '@/components/system';
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
      <FlatList
        data={regs}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
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
              <View style={styles.sectionHead}>
                <View style={styles.sectionRule} />
                <Micro>Summaries</Micro>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item, index }) => (
          <Pressable
            onPress={() => router.push(`/regs/${item.id}`)}
            style={({ pressed }) => [styles.row, index > 0 && styles.rowDivider, pressed && styles.pressed]}
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
        )}
        ListEmptyComponent={
          needsState ? (
            <BrowseStatePrompt line="Regulation summaries are free to read. Choose where you hunt." />
          ) : (
            <Sentence style={{ marginTop: space.section }}>
              {browsing ? 'No published summaries for this state yet.' : 'No published summaries for your follows yet.'}
            </Sentence>
          )
        }
        ListFooterComponent={regs.length ? <View style={{ marginTop: space.section }}><Disclaimer /></View> : null}
      />
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
    <View style={styles.sectionHead}>
      <View style={styles.sectionRule} />
      <Micro style={{ color: color.copperDim }}>What changed this year</Micro>
      {shown.map((c, i) => (
        <ChangeLine key={c.id} change={c} first={i === 0} />
      ))}
      {changes.length > shown.length ? (
        <Sentence tone="dim" style={{ marginTop: space.x12 }}>
          {`${changes.length - shown.length} more across your states.`}
        </Sentence>
      ) : null}
    </View>
  );
}

function ChangeLine({ change, first }: { change: RegulationChange; first: boolean }) {
  const mark = change.change_type === 'added' ? 'New' : change.change_type === 'removed' ? 'Gone' : 'Moved';
  return (
    <View style={[styles.changeRow, !first && styles.rowDivider]}>
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

  sectionHead: { marginTop: space.section },
  sectionRule: {
    height: 1,
    backgroundColor: color.rule,
    marginHorizontal: -space.gutter,
    marginBottom: space.x12,
  },

  row: { flexDirection: 'row', alignItems: 'center', gap: space.x12, paddingVertical: space.x16 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hair },
  rowTitle: { fontFamily: type.uiMedium, fontSize: 15.5, color: color.bone },
  rowSub: { fontFamily: type.ui, fontSize: 12.5, color: color.muted, marginTop: 1 },

  changeRow: { flexDirection: 'row', gap: space.x12, paddingVertical: space.x12 },
  changeMark: { width: 44, paddingTop: 2, fontFamily: type.uiMedium, fontSize: 12.5, color: color.copperDim },
  changeNote: { flex: 1, fontFamily: type.ui, fontSize: 14.5, lineHeight: 21, color: color.bone },

  pressed: { opacity: 0.6 },
});
