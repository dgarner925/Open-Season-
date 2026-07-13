import { StyleSheet, View } from 'react-native';
import { countdownLabel, formatDate } from '@/lib/date';
import { spacing, speciesColors, theme, urgencyColor, type SpeciesKey } from '@/theme';
import type { CountdownItem } from '@/features/reference/types';
import { AppText, Card, Dot } from './ui';

/**
 * Home hero. Editorial layout: a quiet meta row, a serif title, and one large
 * countdown number as the focal point. Species is a single small dot, not a fill.
 */
export function CountdownCard({ item, onPress }: { item: CountdownItem; onPress?: () => void }) {
  const speciesColor = speciesColors[item.speciesKey as SpeciesKey] ?? speciesColors.default;
  const urgency = urgencyColor(item.daysUntil);

  return (
    <Card onPress={onPress}>
      <View style={styles.metaRow}>
        <View style={styles.metaLeft}>
          <Dot color={speciesColor} />
          <AppText variant="overline" color={theme.color.textMuted}>
            {(item.kind === 'deadline' ? 'Deadline' : 'Opener').toUpperCase()}
            {item.stateCode ? `  ·  ${item.stateCode}` : ''}
          </AppText>
        </View>
        <AppText variant="caption" color={theme.color.textMuted}>
          {formatDate(item.date)}
        </AppText>
      </View>

      <AppText variant="h2" numberOfLines={2}>
        {item.title}
      </AppText>
      <AppText variant="caption" color={theme.color.textSecondary}>
        {item.subtitle}
      </AppText>

      <View style={styles.countRow}>
        <AppText variant="display" color={urgency}>
          {Math.max(item.daysUntil, 0)}
        </AppText>
        <View style={styles.countMeta}>
          <AppText variant="bodyStrong" color={theme.color.textSecondary}>
            {item.daysUntil === 1 ? 'day' : 'days'}
          </AppText>
          <AppText variant="caption" color={urgency}>
            {countdownLabel(item.daysUntil)}
          </AppText>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  countRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, marginTop: spacing.sm },
  countMeta: { paddingBottom: 8, gap: 2 },
});
