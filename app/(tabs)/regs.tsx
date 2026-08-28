import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Sentence, Serif } from '@/components/system';
import { SpeciesBadge } from '@/components/midnight';
import { Disclaimer } from '@/components/Provenance';
import { useFollowedRegs } from '@/features/reference/queries';
import { verifiedAgo } from '@/lib/date';
import { lang } from '@/theme/tokens';

const { color, space, type } = lang;

export default function Regs() {
  const router = useRouter();
  const { data: regs = [], isLoading } = useFollowedRegs();

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
          <View style={{ marginBottom: space.x16 }}>
            <Serif size={40} style={{ lineHeight: 46 }}>
              Regulations
            </Serif>
            <Sentence style={{ marginTop: space.x8 }}>
              Plain-English summaries. Always confirm against the official source.
            </Sentence>
            <View style={styles.rule} />
          </View>
        }
        renderItem={({ item, index }) => (
          <Pressable
            onPress={() => router.push(`/regs/${item.id}`)}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
          >
            <SpeciesBadge name={item.species?.name} size={40} muted />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.species?.name} in {item.state?.name}
              </Text>
              <Text style={styles.rowSub} numberOfLines={1}>
                {verifiedAgo(item.last_verified_at)}
              </Text>
            </View>
            <Text style={styles.chev}>›</Text>
            {index !== regs.length - 1 ? <View style={styles.rowRule} /> : null}
          </Pressable>
        )}
        ListEmptyComponent={
          <Sentence style={{ marginTop: space.x16 }}>No published summaries for your follows yet.</Sentence>
        }
        ListFooterComponent={regs.length ? <View style={{ marginTop: space.section }}><Disclaimer /></View> : null}
      />
    </SafeAreaView>
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
  chev: { fontFamily: type.ui, fontSize: 16, color: color.dim },
});
