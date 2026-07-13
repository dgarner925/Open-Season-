import { StyleSheet, View } from 'react-native';
import { countdownLabel, formatDate } from '@/lib/date';
import { radius, spacing, speciesColors, theme, urgencyColor, type SpeciesKey } from '@/theme';
import type { CountdownItem } from '@/features/reference/types';
import { AppText, Card, Pill } from './ui';

/**
 * The hero of the home screen. Glanceable: big day count, urgency color,
 * species stripe. A hunter should know in 3 seconds what's next.
 */
export function CountdownCard({ item, onPress }: { item: CountdownItem; onPress?: () => void }) {
  const speciesColor = speciesColors[item.speciesKey as SpeciesKey] ?? speciesColors.default;
  const urgency = urgencyColor(item.daysUntil);

  return (
    <Card onPress={onPress} accentColor={speciesColor}>
      <View style={styles.header}>
        <Pill
          label={item.kind === 'deadline' ? 'Deadline' : 'Opener'}
          color={item.kind === 'deadline' ? theme.color.danger : speciesColor}
        />
        <AppText variant="caption" color={theme.color.textMuted}>
          {formatDate(item.date)}
        </AppText>
      </View>

      <AppText variant="h3" numberOfLines={2}>
        {item.title}
      </AppText>
      <AppText variant="caption" color={theme.color.textSecondary}>
        {item.subtitle}
      </AppText>

      <View style={styles.countRow}>
        <AppText variant="display" color={urgency} style={styles.count}>
          {Math.max(item.daysUntil, 0)}
        </AppText>
        <AppText variant="body" color={theme.color.textSecondary} style={styles.countUnit}>
          {item.daysUntil === 1 ? 'day' : 'days'}
        </AppText>
        <View style={styles.spacer} />
        <View style={[styles.urgencyChip, { borderColor: urgency }]}>
          <AppText variant="caption" color={urgency}>
            {countdownLabel(item.daysUntil)}
          </AppText>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  countRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: spacing.sm },
  count: { lineHeight: 44 },
  countUnit: { marginLeft: spacing.sm },
  spacer: { flex: 1 },
  urgencyChip: {
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});
