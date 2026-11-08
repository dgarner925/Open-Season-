import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Headline, LinkSentence, Micro, Sentence } from '@/components/system';
import { SpeciesBadge } from '@/components/midnight';
import { useWindowsFeed } from '@/features/reference/queries';
import { BrowseStateChip, BrowseStatePrompt } from '@/components/BrowseStateChip';
import type { ApplicationWindowWithRefs } from '@/features/reference/types';
import { countdownLabel, daysUntil, formatDate } from '@/lib/date';
import { drawTitle } from '@/lib/titles';
import { lang } from '@/theme/tokens';

const { color, space, type } = lang;

export default function Applications() {
  const router = useRouter();
  const { data: windows, isLoading, browsing, stateCode, needsState } = useWindowsFeed();

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <ActivityIndicator color={color.copper} />
      </SafeAreaView>
    );
  }

  // Upcoming (and undated) deadlines only — a passed deadline is just noise.
  const upcoming = windows.filter((w) => {
    const d = daysUntil(w.closes_at);
    return d === null || d >= 0;
  });

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <FlatList
        data={upcoming}
        keyExtractor={(w) => w.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <Headline>Miss the deadline,{'\n'}miss the season.</Headline>
            <Sentence style={{ marginTop: space.x16 }}>
              Draw and application windows for everything you track, soonest first.
            </Sentence>
            {browsing ? (
              <View style={{ marginTop: space.x12 }}>
                <BrowseStateChip stateCode={stateCode} />
              </View>
            ) : null}
            {upcoming.length > 0 ? (
              <View style={styles.sectionHead}>
                <View style={styles.sectionRule} />
                <Micro>Closing next</Micro>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item, index }) => (
          <WindowRow window={item} divider={index > 0} onPress={() => router.push(`/window/${item.id}`)} />
        )}
        ListEmptyComponent={
          needsState ? (
            <BrowseStatePrompt line="Draw deadlines are free to read too. Choose where you hunt." />
          ) : (
            <Sentence style={{ marginTop: space.section }}>
              {browsing
                ? 'No upcoming draw deadlines in this state right now.'
                : 'No upcoming tag deadlines for your follows right now.'}
            </Sentence>
          )
        }
        ListFooterComponent={
          <View style={{ marginTop: space.section }}>
            <LinkSentence onPress={() => router.push({ pathname: '/ledger' })}>
              The ledger — your applications, costs, and results
            </LinkSentence>
          </View>
        }
      />
    </SafeAreaView>
  );
}

/**
 * One deadline, one hairline row. The countdown is the only coloured thing in
 * it, and it only earns copper inside the last two weeks — the language keeps
 * copper scarce, and a deadline three months out is not a warning.
 */
function WindowRow({
  window: w,
  divider,
  onPress,
}: {
  window: ApplicationWindowWithRefs;
  divider: boolean;
  onPress: () => void;
}) {
  const d = daysUntil(w.closes_at);
  const near = d !== null && d <= 14;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, divider && styles.rowDivider, pressed && styles.pressed]}>
      <SpeciesBadge name={w.species?.name} size={34} muted={!near} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {w.state?.code} {drawTitle(w.species?.name, w.name)}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          Closes {formatDate(w.closes_at)}
        </Text>
        {w.fee_summary ? (
          <Text style={styles.rowFee} numberOfLines={2}>
            {w.fee_summary}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.metric, { color: near ? color.copper : color.muted }]}>{countdownLabel(d)}</Text>
    </Pressable>
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
  rowFee: { fontFamily: type.ui, fontSize: 12, lineHeight: 17, color: color.dim, marginTop: 3 },
  metric: { fontFamily: type.uiMedium, fontSize: 12.5, marginLeft: space.x8, fontVariant: ['tabular-nums'] },

  pressed: { opacity: 0.6 },
});
