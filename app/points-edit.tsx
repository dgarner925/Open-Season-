import { useEffect, useState } from 'react';
import { Alert, Pressable } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Field, Input, Pill, Screen, Sentence, WordChoice } from '@/components/system';
import { useActiveStates, useSpecies } from '@/features/reference/queries';
import {
  usePointBalance,
  useSavePointBalance,
  useDeletePointBalance,
  type PointInput,
} from '@/features/points/queries';
import type { PointType } from '@/lib/database.types';
import { lang } from '@/theme/tokens';

const { space } = lang;

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
        <Sentence tone="dim" style={{ marginTop: space.section }}>
          Loading…
        </Sentence>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: true, title: editing ? 'Edit points' : 'Add points' }} />

      <Field label="Which state?">
        <WordChoice
          options={states.map((s) => ({ value: s.id, label: s.code }))}
          value={form.state_id}
          onChange={(v) => set('state_id', v)}
        />
      </Field>
      <Field label="Which species?">
        <WordChoice
          options={species.map((s) => ({ value: s.id, label: s.name }))}
          value={form.species_id}
          onChange={(v) => set('species_id', v)}
        />
      </Field>
      <Field label="What kind of points?">
        <WordChoice
          options={[
            { value: 'preference', label: 'Preference' },
            { value: 'bonus', label: 'Bonus' },
          ]}
          value={form.point_type}
          onChange={(v) => set('point_type', (v ?? 'preference') as PointType)}
          allowClear={false}
        />
      </Field>

      <Field label="How many do you have?">
        <Input
          value={form.points}
          onChangeText={(v) => set('points', v.replace(/[^0-9]/g, ''))}
          placeholder="0"
          keyboardType="number-pad"
        />
      </Field>

      <Field label="Anything worth remembering?">
        <Input
          value={form.notes}
          onChangeText={(v) => set('notes', v)}
          placeholder="e.g. bought a point in 2026, not applying this year"
          multiline
          style={{ minHeight: 70 }}
        />
      </Field>

      {notice ? (
        <Sentence tone="bone" style={{ marginTop: space.section, color: '#c96f5a' }}>
          {notice}
        </Sentence>
      ) : null}

      <Pill
        label={save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Save'}
        onPress={onSave}
        disabled={save.isPending}
        style={{ marginTop: space.section }}
      />
      {editing ? (
        <Pressable onPress={onDelete} accessibilityRole="button" style={{ marginTop: space.section }}>
          <Sentence tone="dim">Delete this points balance.</Sentence>
        </Pressable>
      ) : null}
    </Screen>
  );
}
