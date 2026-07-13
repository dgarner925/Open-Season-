import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Card, Pill } from '@/components/ui';
import { Disclaimer } from '@/components/Provenance';
import { useFollowedRegs } from '@/features/reference/queries';
import { verifiedAgo } from '@/lib/date';
import { spacing, speciesColors, theme, type SpeciesKey } from '@/theme';

export default function Regs() {
  const router = useRouter();
  const { data: regs = [], isLoading } = useFollowedRegs();

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <ActivityIndicator color={theme.color.accent} />
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
          <View style={styles.header}>
            <AppText variant="h1">Regulations</AppText>
            <AppText variant="body" color={theme.color.textSecondary}>
              Plain-English summaries. Always confirm against the official source.
            </AppText>
          </View>
        }
        renderItem={({ item }) => {
          const color = speciesColors[(item.species?.key ?? 'default') as SpeciesKey] ?? speciesColors.default;
          return (
            <Card onPress={() => router.push(`/regs/${item.id}`)} accentColor={color}>
              <AppText variant="h3">
                {item.state?.name} · {item.species?.name}
              </AppText>
              <AppText variant="caption" color={theme.color.textMuted}>
                {verifiedAgo(item.last_verified_at)}
              </AppText>
            </Card>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          <AppText color={theme.color.textMuted} style={{ marginTop: spacing.xl }}>
            No published summaries for your follows yet.
          </AppText>
        }
        ListFooterComponent={regs.length ? <View style={{ marginTop: spacing.lg }}><Disclaimer /></View> : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.background },
  content: { padding: spacing.lg },
  header: { gap: spacing.xs, marginBottom: spacing.lg },
});
