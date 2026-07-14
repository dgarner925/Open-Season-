import { Stack } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { AppText, Card, Screen } from '@/components/ui';
import { useActiveStates, useSpecies } from '@/features/reference/queries';
import { useFollows, useToggleFollow } from '@/features/follows/queries';
import { radius, spacing, theme } from '@/theme';

/**
 * Editable follows. Each state card shows the four species as toggle chips;
 * tapping adds or removes that state+species follow immediately.
 */
export default function ManageFollows() {
  const { data: states = [], isLoading: statesLoading } = useActiveStates();
  const { data: species = [] } = useSpecies();
  const { data: follows = [] } = useFollows();
  const toggle = useToggleFollow();

  // (stateId:speciesId) -> follow.id, so we know what's on and can remove it.
  const followId = new Map(follows.map((f) => [`${f.state_id}:${f.species_id}`, f.id]));

  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: true, title: 'What you follow' }} />
      <View style={{ gap: spacing.xs }}>
        <AppText variant="h1">What you follow</AppText>
        <AppText variant="body" color={theme.color.textSecondary}>
          Tap a species under each state to follow or unfollow it. Changes save instantly.
        </AppText>
      </View>

      {statesLoading ? (
        <ActivityIndicator color={theme.color.accent} style={{ marginTop: spacing.xl }} />
      ) : (
        states.map((st) => (
          <Card key={st.id}>
            <AppText variant="h3">{st.name}</AppText>
            <View style={styles.chips}>
              {species.map((sp) => {
                const key = `${st.id}:${sp.id}`;
                const existingId = followId.get(key);
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
        ))
      )}
    </Screen>
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
