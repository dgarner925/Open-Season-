import { Redirect } from 'expo-router';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { AppText, Button, Card, Divider, GlassChip, Screen } from '@/components/ui';
import { useAuth } from '@/providers/AuthProvider';
import { usePendingReviews, useApproveReview, useRejectReview } from '@/features/review/queries';
import type { ReviewQueueRow } from '@/lib/database.types';
import { formatDate } from '@/lib/date';
import { spacing, theme } from '@/theme';

/**
 * Admin review queue. Proposed changes from the extraction pipeline land here;
 * an admin approves or rejects each one. Nothing auto-publishes.
 */
export default function Admin() {
  const { isAdmin } = useAuth();
  const { data: reviews = [], isLoading } = usePendingReviews();
  const approve = useApproveReview();
  const reject = useRejectReview();

  if (!isAdmin) return <Redirect href="/(tabs)" />;

  return (
    <Screen scroll>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="h1">Review Queue</AppText>
        <AppText variant="body" color={theme.color.textSecondary}>
          Proposed changes from the automated extraction pipeline. Approving applies the change and stamps it verified.
        </AppText>
      </View>

      {isLoading ? (
        <ActivityIndicator color={theme.color.accent} style={{ marginTop: spacing.xl }} />
      ) : reviews.length === 0 ? (
        <Card>
          <AppText variant="body" color={theme.color.textSecondary}>
            Nothing to review. When the extraction function proposes changes, they appear here.
          </AppText>
        </Card>
      ) : (
        reviews.map((r) => (
          <ReviewCard
            key={r.id}
            review={r}
            busy={approve.isPending || reject.isPending}
            onApprove={() =>
              approve.mutate(r.id, {
                onError: (e) => Alert.alert('Approve failed', e instanceof Error ? e.message : 'Try again.'),
              })
            }
            onReject={() =>
              reject.mutate(r.id, {
                onError: (e) => Alert.alert('Reject failed', e instanceof Error ? e.message : 'Try again.'),
              })
            }
          />
        ))
      )}
    </Screen>
  );
}

function field(obj: Record<string, unknown> | null, key: string): string {
  const v = obj?.[key];
  return v == null || v === '' ? '—' : String(v);
}

function ReviewCard({
  review,
  busy,
  onApprove,
  onReject,
}: {
  review: ReviewQueueRow;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const p = review.proposed_payload;
  const snap = review.current_snapshot;
  const isUpdate = review.change_type === 'update';

  return (
    <Card>
      <View style={styles.header}>
        <GlassChip label={review.change_type === 'create' ? 'New season' : 'Date change'} />
        <AppText variant="caption" color={theme.color.textMuted}>
          {field(p, 'method')} · {field(p, 'season_year')}
        </AppText>
      </View>

      <AppText variant="h3">{field(p, 'label') !== '—' ? field(p, 'label') : `${field(p, 'method')} season`}</AppText>

      <Divider />
      {isUpdate ? (
        <>
          <Row label="Opens" from={formatDate(field(snap, 'open_date'))} to={formatDate(field(p, 'open_date'))} />
          <Row label="Closes" from={formatDate(field(snap, 'close_date'))} to={formatDate(field(p, 'close_date'))} />
        </>
      ) : (
        <>
          <Row label="Opens" to={formatDate(field(p, 'open_date'))} />
          <Row label="Closes" to={formatDate(field(p, 'close_date'))} />
          {field(p, 'bag_limit_summary') !== '—' && (
            <AppText variant="caption" color={theme.color.textSecondary}>
              {field(p, 'bag_limit_summary')}
            </AppText>
          )}
        </>
      )}

      <View style={styles.actions}>
        <Button title="Approve" onPress={onApprove} disabled={busy} style={{ flex: 1 }} />
        <Button title="Reject" variant="secondary" onPress={onReject} disabled={busy} style={{ flex: 1 }} />
      </View>
    </Card>
  );
}

function Row({ label, from, to }: { label: string; from?: string; to: string }) {
  return (
    <View style={styles.dataRow}>
      <AppText variant="body" color={theme.color.textMuted}>
        {label}
      </AppText>
      <View style={styles.valueGroup}>
        {from && from !== to ? (
          <>
            <AppText variant="caption" color={theme.color.textMuted} style={styles.strike}>
              {from}
            </AppText>
            <AppText variant="bodyStrong" color={theme.color.accent}>
              {to}
            </AppText>
          </>
        ) : (
          <AppText variant="bodyStrong">{to}</AppText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dataRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs },
  valueGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  strike: { textDecorationLine: 'line-through' },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
});
