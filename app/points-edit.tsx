import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { AppText, Button, Screen } from '@/components/ui';
import { useActiveStates, useSpecies } from '@/features/reference/queries';
import {
  usePointBalance,
  useSavePointBalance,
  useDeletePointBalance,
  type PointInput,
} from '@/features/points/queries';
import type { PointType } from '@/lib/database.types';
import { radius, spacing, theme } from '@/theme';

type Form = { state_id: string | null; species_id: string | null; point_type: PointType; points: string; notes: string };
const EMPTY: Form = { state_id: null, species_id: null, point_type: 'preference', points: '0', notes: '' };

export default function PointsEdit() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editing = Boolean(params.id);

  const { data: states = [] } = useActiveStates();
  const { data: species = [] } = useSpecies();
  const { data: existing, isLoading } = usePointBalance(params.id);
  const save = useSavePointBalance();
  const del = useDeletePointBalance();

  const [form, setForm] = useState<Form>(EMPTY);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (existing) {
      setForm({
        state_id: existing.state_id,
        species_id: existing.species_id,
        point_type: existing.point_type,
        points: String(existing.points),
        notes: existing.notes ?? '',
      });
    }
  }, [existing]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function onSave() {
    setNotice(null);
    if (!form.state_id || !form.species_id) {
      setNotice('Pick a state and a species.');
      return;
    }
    const input: PointInput = {
      id: params.id,
      state_id: form.state_id,
      species_id: form.species_id,
      point_type: form.point_type,
      points: Math.max(0, Number(form.points) || 0),
      notes: form.notes.trim() || null,
    };
    try {
      await save.mutateAsync(input);
      router.back();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not save.');
    }
  }

  function onDelete() {
    if (!params.id) return;
    Alert.alert('Delete this points balance?', 'This only removes your tracked number.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          del.mutate(params.id!, {
            onSuccess: () => router.back(),
            onError: (e) => setNotice(e instanceof Error ? e.message : 'Could not delete.'),
          }),
      },
    ]);
  }

  if (editing && isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: 'Points' }} />
        <AppText color={theme.color.textMuted}>Loading…</AppText>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: true, title: editing ? 'Edit points' : 'Add points' }} />

      <Picker
        label="State"
        options={states.map((s) => ({ value: s.id, label: s.code }))}
        value={form.state_id}
        onChange={(v) => set('state_id', v)}
      />
      <Picker
        label="Species"
        options={species.map((s) => ({ value: s.id, label: s.name }))}
        value={form.species_id}
        onChange={(v) => set('species_id', v)}
      />
      <Picker
        label="Point type"
        options={[
          { value: 'preference', label: 'Preference' },
          { value: 'bonus', label: 'Bonus' },
        ]}
        value={form.point_type}
        onChange={(v) => set('point_type', (v ?? 'preference') as PointType)}
        allowClear={false}
      />

      <Field label="Points you have">
        <TextInput
          value={form.points}
          onChangeText={(v) => set('points', v.replace(/[^0-9]/g, ''))}
          placeholder="0"
          placeholderTextColor={theme.color.textMuted}
          keyboardType="number-pad"
          style={styles.input}
        />
      </Field>

      <Field label="Notes">
        <TextInput
          value={form.notes}
          onChangeText={(v) => set('notes', v)}
          placeholder="e.g. bought a point in 2026, not applying this year"
          placeholderTextColor={theme.color.textMuted}
          multiline
          style={[styles.input, styles.multiline]}
        />
      </Field>

      {notice ? (
        <AppText variant="bodyStrong" color={theme.color.danger}>
          {notice}
        </AppText>
      ) : null}

      <Button title={editing ? 'Save changes' : 'Save'} onPress={onSave} loading={save.isPending} />
      {editing ? <Button variant="ghost" title="Delete" onPress={onDelete} /> : null}
    </Screen>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="overline" color={theme.color.textMuted}>
        {label.toUpperCase()}
      </AppText>
      {children}
    </View>
  );
}

function Picker({
  label,
  options,
  value,
  onChange,
  allowClear = true,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (v: string | null) => void;
  allowClear?: boolean;
}) {
  return (
    <Field label={label}>
      <View style={styles.chips}>
        {options.map((o) => {
          const on = value === o.value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(on && allowClear ? null : o.value)}
              style={[
                styles.chip,
                on
                  ? { backgroundColor: theme.color.accent, borderColor: theme.color.accent }
                  : { backgroundColor: 'transparent', borderColor: theme.color.border },
              ]}
            >
              <AppText variant="caption" color={on ? theme.color.onAccent : theme.color.textSecondary}>
                {o.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </Field>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: theme.color.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: theme.color.textPrimary,
    fontSize: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.border,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
});
