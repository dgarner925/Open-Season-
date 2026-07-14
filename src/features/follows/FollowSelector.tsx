import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { AppText, Card } from '@/components/ui';
import { useActiveStates, useSpecies } from '@/features/reference/queries';
import { useFollows, useToggleFollow } from '@/features/follows/queries';
import { radius, spacing, theme } from '@/theme';

/**
 * The states × species picker: one card per state with per-species toggle chips.
 * Tapping a chip adds/removes that follow immediately. Shared by the Home hub
 * and the "What you follow" screen. Renders plain Views so it can sit inside a
 * scroll/list header.
 */
export function FollowSelector() {
  const { data: states = [], isLoading } = useActiveStates();
  const { data: species = [] } = useSpecies();
  const { data: follows = [] } = useFollows();
  const toggle = useToggleFollow();

  const followId = new Map(follows.map((f) => [`${f.state_id}:${f.species_id}`, f.id]));

  if (isLoading) {
    return <ActivityIndicator color={theme.color.accent} style={{ marginTop: spacing.lg }} />;
  }

  return (
    <View style={{ gap: spacing.lg }}>
      {states.map((st) => (
        <Card key={st.id}>
          <AppText variant="h3">{st.name}</AppText>
          <View style={styles.chips}>
            {species.map((sp) => {
              const existingId = followId.get(`${st.id}:${sp.id}`);
              const on = Boolean(existingId);
              return (
                <Pressable
                  key={sp.id}
                  disabled={toggle.isPending}
                  onPress={() => toggle.mutate({ stateId: st.id, speciesId: sp.id, existingId })}
                  style={[
                    styles.chip,
                    on
                      ? { backgroundColor: theme.color.accent, borderColor: theme.color.accent }
                      : { backgroundColor: 'transparent', borderColor: theme.color.border },
                  ]}
                >
                  <AppText variant="bodyStrong" color={on ? theme.color.onAccent : theme.color.textSecondary}>
                    {sp.name}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
