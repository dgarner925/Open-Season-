import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Card, Pill } from '@/components/ui';
import { Disclaimer } from '@/components/Provenance';
import { useFollowedRegs } from '@/features/reference/queries';
import { useRegulationChanges, type RegulationChange } from '@/features/changes/queries';
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
          <View>
            <View style={styles.header}>
              <AppText variant="h1">Regulations</AppText>
              <AppText variant="body" color={theme.color.textSecondary}>
                Plain-English summaries. Always confirm against the official source.
              </AppText>
            </View>
            <WhatChanged />
            {regs.length > 0 ? (
              <AppText variant="overline" color={theme.color.textMuted} style={{ marginBottom: spacing.md }}>
                SUMMARIES
              </AppText>
            ) : null}
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

/**
 * What changed this year, for the states you follow. Each line is one
 * record-level difference against last year's regulations — moved openers,
 * seasons added or dropped, bag limits revised.
 */
function WhatChanged() {
  const { data: changes = [], isLoading } = useRegulationChanges();
  if (isLoading || changes.length === 0) return null;
  const shown = changes.slice(0, 8);

  return (
    <View style={styles.changesWrap}>
      <AppText variant="overline" color={theme.color.accentSoft}>
        WHAT CHANGED THIS YEAR
      </AppText>
      <View style={styles.changesBox}>
        {shown.map((c, i) => (
          <ChangeLine key={c.id} change={c} first={i === 0} />
        ))}
      </View>
      {changes.length > shown.length ? (
        <AppText variant="caption" color={theme.color.textMuted} style={{ marginTop: spacing.sm }}>
          {changes.length - shown.length} more across your states.
        </AppText>
      ) : null}
    </View>
  );
}

function ChangeLine({ change, first }: { change: RegulationChange; first: boolean }) {
  const mark =
    change.change_type === 'added' ? 'New' : change.change_type === 'removed' ? 'Gone' : 'Moved';
  return (
    <View style={[styles.changeRow, !first && styles.changeDivider]}>
      <AppText variant="caption" color={theme.color.accentSoft} style={styles.changeMark}>
        {mark}
      </AppText>
      <AppText variant="body" color={theme.color.textSecondary} style={{ flex: 1 }}>
        {change.note}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  changesWrap: { marginBottom: spacing.xl },
  changesBox: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 16,
    backgroundColor: theme.color.surfaceFlat,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.borderFlat,
  },
  changeRow: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md },
  changeDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.color.borderFlat },
  changeMark: { width: 42, paddingTop: 2 },
  screen: { flex: 1, backgroundColor: theme.color.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.background },
  content: { padding: spacing.lg },
  header: { gap: spacing.xs, marginBottom: spacing.lg },
});
