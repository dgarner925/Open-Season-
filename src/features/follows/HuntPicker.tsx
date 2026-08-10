import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui';
import { useActiveStates, useSpecies, useStateSpecies } from '@/features/reference/queries';
import { useFollows, useToggleFollow } from '@/features/follows/queries';
import { useRequirePro } from '@/hooks/useRequirePro';
import { radius, spacing, theme, withAlpha } from '@/theme';

const CATEGORIES: { key: string; label: string }[] = [
  { key: 'big_game', label: 'BIG GAME' },
  { key: 'turkey', label: 'TURKEY' },
  { key: 'waterfowl', label: 'WATERFOWL & MIGRATORY' },
  { key: 'upland', label: 'UPLAND BIRDS' },
  { key: 'small_game', label: 'SMALL GAME' },
  { key: 'furbearer', label: 'FURBEARERS' },
  { key: 'other', label: 'OTHER' },
];

/**
 * Add hunts with one state dropdown → animal chips, and see/remove your current
 * hunts as chips. Deliberately compact so it can live on the dashboard.
 */
export function HuntPicker() {
  const { data: states = [], isLoading } = useActiveStates();
  const { data: species = [] } = useSpecies();
  const { data: follows = [] } = useFollows();
  const toggle = useToggleFollow();
  const requirePro = useRequirePro();

  const [stateId, setStateId] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const followKey = new Map(follows.map((f) => [`${f.state_id}:${f.species_id}`, f.id]));
  const nameOf = (id: string, list: { id: string; name: string }[]) => list.find((x) => x.id === id)?.name ?? '';
  const codeOf = (id: string) => states.find((s) => s.id === id)?.code ?? '';
  const selectedState = states.find((s) => s.id === stateId) ?? null;
  const { data: stateSpecies = [], isLoading: speciesLoading } = useStateSpecies(stateId);

  if (isLoading) return <ActivityIndicator color={theme.color.accent} style={{ marginTop: spacing.md }} />;

  return (
    <View style={{ gap: spacing.md }}>
      {/* Current hunts */}
      {follows.length > 0 ? (
        <View style={styles.chipWrap}>
          {follows.map((f) => (
            <Pressable
              key={f.id}
              onPress={() => toggle.mutate({ stateId: f.state_id, speciesId: f.species_id, existingId: f.id })}
              style={styles.followChip}
            >
              <AppText variant="caption" color={theme.color.accentSoft}>
                {codeOf(f.state_id)} · {nameOf(f.species_id, species)}
              </AppText>
              <Ionicons name="close" size={13} color={theme.color.accentSoft} />
            </Pressable>
          ))}
        </View>
      ) : (
        <AppText variant="caption" color={theme.color.textMuted}>
          No hunts yet — add your first below.
        </AppText>
      )}

      {/* One dropdown for all states */}
      <Pressable style={styles.dropdown} onPress={() => setDropdownOpen((o) => !o)}>
        <AppText variant="bodyStrong" color={selectedState ? theme.color.textPrimary : theme.color.textMuted}>
          {selectedState ? selectedState.name : 'Choose a state'}
        </AppText>
        <Ionicons name={dropdownOpen ? 'chevron-up' : 'chevron-down'} size={18} color={theme.color.textSecondary} />
      </Pressable>

      {dropdownOpen ? (
        <View style={styles.menu}>
          {states.map((s, i) => (
            <Pressable
              key={s.id}
              onPress={() => {
                setStateId(s.id);
                setDropdownOpen(false);
              }}
              style={[styles.menuRow, i > 0 && styles.menuDivider]}
            >
              <AppText variant="body" color={stateId === s.id ? theme.color.accent : theme.color.textPrimary}>
                {s.name}
              </AppText>
              {stateId === s.id ? <Ionicons name="checkmark" size={16} color={theme.color.accent} /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Animals for the chosen state — only what's huntable there, by category */}
      {selectedState ? (
        <View style={{ gap: spacing.md }}>
          <AppText variant="caption" color={theme.color.textSecondary}>
            Which animals in {selectedState.name}?
          </AppText>
          {speciesLoading ? (
            <ActivityIndicator color={theme.color.accent} style={{ marginTop: spacing.sm }} />
          ) : (
            CATEGORIES.map((cat) => {
              const inCat = stateSpecies.filter((sp) => sp.category === cat.key);
              if (inCat.length === 0) return null;
              return (
                <View key={cat.key} style={{ gap: spacing.sm }}>
                  <AppText variant="overline" color={theme.color.textMuted}>
                    {cat.label}
                  </AppText>
                  <View style={styles.chipWrap}>
                    {inCat.map((sp) => {
                      const existingId = followKey.get(`${selectedState.id}:${sp.id}`);
                      const on = Boolean(existingId);
                      return (
                        <Pressable
                          key={sp.id}
                          disabled={toggle.isPending}
                          onPress={() => {
                            // Removing is always allowed; following is Pro.
                            if (!existingId && !requirePro()) return;
                            toggle.mutate({ stateId: selectedState.id, speciesId: sp.id, existingId });
                          }}
                          style={[
                            styles.speciesChip,
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
                </View>
              );
            })
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  followChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: withAlpha(theme.color.accent, 0.14),
    borderWidth: 1,
    borderColor: withAlpha(theme.color.accent, 0.35),
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.color.surfaceElevated,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.border,
  },
  menu: {
    backgroundColor: theme.color.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.border,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  menuDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.color.border },
  speciesChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
