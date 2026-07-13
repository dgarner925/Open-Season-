import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText, Button, Screen } from '@/components/ui';
import { useActiveStates, useSpecies } from '@/features/reference/queries';
import { useCompleteOnboarding } from '@/features/follows/queries';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { radius, spacing, theme } from '@/theme';
import { speciesColors, type SpeciesKey } from '@/theme';

export default function Onboarding() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: states = [], isLoading: statesLoading } = useActiveStates();
  const { data: species = [], isLoading: speciesLoading } = useSpecies();
  const completeOnboarding = useCompleteOnboarding();

  const [stateIds, setStateIds] = useState<Set<string>>(new Set());
  const [speciesIds, setSpeciesIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  // Inline error — Alert.alert is a no-op on web, so surface failures on screen.
  const [notice, setNotice] = useState<string | null>(null);

  function toggle(set: Set<string>, id: string, setter: (s: Set<string>) => void) {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    setter(next);
  }

  async function handleContinue() {
    setNotice(null);
    if (!user || stateIds.size === 0 || speciesIds.size === 0) {
      setNotice('Pick at least one state and one species first.');
      return;
    }
    setSaving(true);
    try {
      const rows = [...stateIds].flatMap((state_id) =>
        [...speciesIds].map((species_id) => ({ user_id: user.id, state_id, species_id })),
      );
      // Ignore duplicates so re-running onboarding is safe.
      const { error } = await supabase
        .from('follows')
        .upsert(rows, { onConflict: 'user_id,state_id,species_id', ignoreDuplicates: true });
      if (error) throw error;
      await completeOnboarding.mutateAsync();
      router.replace('/');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Please try again.';
      console.error('[onboarding] save failed:', e);
      setNotice(`Could not save: ${msg}`);
      Alert.alert('Could not save', msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen scroll>
      <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
        <AppText variant="h1">What do you hunt?</AppText>
        <AppText variant="body" color={theme.color.textSecondary}>
          We'll track seasons, tag deadlines, and regs for your picks — and alert you before every opener and deadline.
        </AppText>
      </View>

      <AppText variant="overline" color={theme.color.textMuted}>
        STATES
      </AppText>
      <View style={styles.grid}>
        {statesLoading ? (
          <AppText color={theme.color.textMuted}>Loading states…</AppText>
        ) : (
          states.map((s) => (
            <Chip
              key={s.id}
              label={s.name}
              selected={stateIds.has(s.id)}
              onPress={() => toggle(stateIds, s.id, setStateIds)}
            />
          ))
        )}
      </View>

      <AppText variant="overline" color={theme.color.textMuted}>
        SPECIES
      </AppText>
      <View style={styles.grid}>
        {speciesLoading ? (
          <AppText color={theme.color.textMuted}>Loading species…</AppText>
        ) : (
          species.map((sp) => (
            <Chip
              key={sp.id}
              label={sp.name}
              color={speciesColors[sp.key as SpeciesKey] ?? theme.color.accent}
              selected={speciesIds.has(sp.id)}
              onPress={() => toggle(speciesIds, sp.id, setSpeciesIds)}
            />
          ))
        )}
      </View>

      {notice ? (
        <AppText variant="bodyStrong" color={theme.color.danger} style={{ marginTop: spacing.md }}>
          {notice}
        </AppText>
      ) : null}
      <Button title="Continue" onPress={handleContinue} loading={saving} style={{ marginTop: spacing.lg }} />
    </Screen>
  );
}

function Chip({
  label,
  selected,
  onPress,
  color,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  color?: string;
}) {
  const accent = color ?? theme.color.accent;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: selected ? accent : theme.color.border, backgroundColor: selected ? accent : 'transparent' },
      ]}
    >
      <AppText variant="bodyStrong" color={selected ? theme.color.onAccent : theme.color.textPrimary}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
});
