import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Sentence, Serif } from '@/components/system';
import { SpeciesBadge } from '@/components/midnight';
import { useFollowedWindows } from '@/features/reference/queries';
import type { ApplicationWindowWithRefs } from '@/features/reference/types';
import { daysUntil, formatDate } from '@/lib/date';
import { drawTitle } from '@/lib/titles';
import { lang } from '@/theme/tokens';

const { color, space, type } = lang;

export default function Applications() {
  const router = useRouter();
  const { data: windows = [], isLoading } = useFollowedWindows();

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
          <View style={{ marginBottom: space.x16 }}>
            <Serif size={40} style={{ lineHeight: 46 }}>
              Tag deadlines
            </Serif>
            <Sentence style={{ marginTop: space.x8 }}>
              Draw and application windows. Miss a deadline, miss the season.
            </Sentence>
            <View style={styles.rule} />
          </View>
        }
        renderItem={({ item, index }) => (
          <WindowRow window={item} last={index === upcoming.length - 1} onPress={() => router.push(`/window/${item.id}`)} />
        )}
        ListEmptyComponent={
          <Sentence style={{ marginTop: space.x16 }}>
            No upcoming tag deadlines for your follows right now.
          </Sentence>
        }
      />
    </SafeAreaView>
  );
}

function WindowRow({ window: w, last, onPress }: { window: ApplicationWindowWithRefs; last: boolean; onPress: () => void }) {
  const d = daysUntil(w.closes_at);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}>
      <SpeciesBadge name={w.species?.name} size={40} muted />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {w.state?.code} {drawTitle(w.species?.name, w.name)}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          Closes {formatDate(w.closes_at)}.{w.fee_summary ? ` ${w.fee_summary}` : ''}
        </Text>
      </View>
      {d !== null && d >= 0 ? (
        <Text style={styles.metric}>{d === 0 ? 'today' : `${d}d`}</Text>
      ) : null}
      {!last ? <View style={styles.rowRule} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: color.bg },
  content: { paddingHorizontal: space.gutter, paddingTop: space.x16, paddingBottom: space.x38 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: color.hair, marginHorizontal: -space.gutter, marginTop: space.section },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.x12, paddingVertical: space.x12, minHeight: 44 },
  rowRule: {
    position: 'absolute',
    left: 52,
    right: -space.gutter,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.hair,
  },
  rowTitle: { fontFamily: type.ui, fontSize: type.size.body + 0.5, color: color.bone },
  rowSub: { fontFamily: type.ui, fontSize: 13, color: color.muted, marginTop: 2 },
  metric: { fontFamily: type.displayItalic, fontSize: 19, color: color.copper, marginLeft: space.x8 },
});
