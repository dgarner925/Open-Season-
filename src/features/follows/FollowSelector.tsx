import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { AppText, Card } from '@/components/ui';
import { useActiveStates, useSpecies } from '@/features/reference/queries';
import { useFollows, useToggleFollow } from '@/features/follows/queries';
import { radius, spacing, theme } from '@/theme';
import type { SpeciesRow, StateRow } from '@/lib/database.types';

/**
 * Collapsible states × species picker. Each state is a dropdown row showing your
 * current picks; tap to expand and toggle species. Shared by Home and the
 * "What you follow" screen. Renders plain Views so it can sit in a scroll/list.
 */
export function FollowSelector() {
  const { data: states = [], isLoading } = useActiveStates();
  const { data: species = [] } = useSpecies();
  const { data: follows = [] } = useFollows();
  const toggle = useToggleFollow();
  const [open, setOpen] = useState<Set<string>>(new Set());

  const followId = new Map(follows.map((f) => [`${f.state_id}:${f.species_id}`, f.id]));

  if (isLoading) {
    return <ActivityIndicator color={theme.color.accent} style={{ marginTop: spacing.lg }} />;
  }

  return (
    <View style={{ gap: spacing.md }}>
      {states.map((st) => (
        <StateDropdown
          key={st.id}
          state={st}
          species={species}
          followId={followId}
          expanded={open.has(st.id)}
          busy={toggle.isPending}
          onToggleExpand={() =>
            setOpen((prev) => {
              const next = new Set(prev);
              next.has(st.id) ? next.delete(st.id) : next.add(st.id);
              return next;
            })
          }
          onToggleSpecies={(speciesId, existingId) =>
            toggle.mutate({ stateId: st.id, speciesId, existingId })
          }
        />
      ))}
    </View>
  );
}

function StateDropdown({
  state,
  species,
  followId,
  expanded,
  busy,
  onToggleExpand,
  onToggleSpecies,
}: {
  state: StateRow;
  species: SpeciesRow[];
  followId: Map<string, string>;
  expanded: boolean;
  busy: boolean;
  onToggleExpand: () => void;
  onToggleSpecies: (speciesId: string, existingId?: string) => void;
}) {
  const followed = species.filter((sp) => followId.has(`${state.id}:${sp.id}`)).map((sp) => sp.name);

  return (
    <Card style={styles.card}>
      <Pressable onPress={onToggleExpand} style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <AppText variant="h3">{state.name}</AppText>
          <AppText variant="caption" color={followed.length ? theme.color.accentStrong : theme.color.textMuted}>
            {followed.length ? followed.join(', ') : 'Tap to choose species'}
          </AppText>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={theme.color.textSecondary}
        />
      </Pressable>

      {expanded ? (
        <View style={styles.chips}>
          {species.map((sp) => {
            const existingId = followId.get(`${state.id}:${sp.id}`);
            const on = Boolean(existingId);
            return (
              <Pressable
                key={sp.id}
                disabled={busy}
                onPress={() => onToggleSpecies(sp.id, existingId)}
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
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
