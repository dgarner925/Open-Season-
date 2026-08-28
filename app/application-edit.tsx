import { useEffect, useState } from 'react';
import { Alert, Pressable } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Field, Input, Pill, Screen, Sentence, WordChoice } from '@/components/system';
import { useActiveStates, useSpecies } from '@/features/reference/queries';
import {
  useApplication,
  useDeleteApplication,
  useSaveApplication,
  type ApplicationInput,
} from '@/features/applications/queries';
import type { ApplicationStatus } from '@/lib/database.types';
import { lang } from '@/theme/tokens';

const { space } = lang;

const STATUSES: { value: ApplicationStatus; label: string }[] = [
  { value: 'planned', label: 'Planned' },
  { value: 'applied', label: 'Applied' },
  { value: 'successful', label: 'Drawn' },
  { value: 'unsuccessful', label: 'Unsuccessful' },
  { value: 'purchased', label: 'Purchased' },
];

type Form = {
  title: string;
  state_id: string | null;
  species_id: string | null;
  window_id: string | null;
  application_url: string;
  portal_username: string;
  status: ApplicationStatus;
  applied_on: string;
  results_on: string;
  fee_summary: string;
  points: string;
  notes: string;
};

const EMPTY: Form = {
  title: '', state_id: null, species_id: null, window_id: null, application_url: '',
  portal_username: '', status: 'applied', applied_on: '', results_on: '', fee_summary: '',
  points: '', notes: '',
};

/** Loose but honest date guard: accepts YYYY-MM-DD, rejects other shapes. */
function validDateOrEmpty(v: string): boolean {
  const t = v.trim();
  if (!t) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(t) && !isNaN(new Date(t + 'T12:00:00').getTime());
}

export default function ApplicationEdit() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string; title?: string; stateId?: string; speciesId?: string; windowId?: string; url?: string;
  }>();
  const editing = Boolean(params.id);

  const { data: states = [] } = useActiveStates();
  const { data: species = [] } = useSpecies();
  const { data: existing, isLoading } = useApplication(params.id);
  const save = useSaveApplication();
  const del = useDeleteApplication();

  const [form, setForm] = useState<Form>(EMPTY);
  const [notice, setNotice] = useState<string | null>(null);

  // Seed the form: from the existing row when editing, else from prefill params.
  useEffect(() => {
    if (existing) {
      setForm({
        title: existing.title,
        state_id: existing.state_id,
        species_id: existing.species_id,
        window_id: existing.window_id,
        application_url: existing.application_url ?? '',
        portal_username: existing.portal_username ?? '',
        status: existing.status,
        applied_on: existing.applied_on ?? '',
        results_on: existing.results_on ?? '',
        fee_summary: existing.fee_summary ?? '',
        points: existing.points != null ? String(existing.points) : '',
        notes: existing.notes ?? '',
      });
    } else if (!editing) {
      setForm((f) => ({
        ...f,
        title: params.title ?? f.title,
        state_id: params.stateId ?? f.state_id,
        species_id: params.speciesId ?? f.species_id,
        window_id: params.windowId ?? f.window_id,
        application_url: params.url ?? f.application_url,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing, editing]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function onSave() {
    setNotice(null);
    if (!form.title.trim()) {
      setNotice('Give it a title (e.g. "Colorado Elk — Primary Draw").');
      return;
    }
    if (!validDateOrEmpty(form.applied_on) || !validDateOrEmpty(form.results_on)) {
      setNotice('Dates need the YYYY-MM-DD shape (e.g. 2026-03-14).');
      return;
    }
    const input: ApplicationInput = {
      id: params.id,
      title: form.title.trim(),
      state_id: form.state_id,
      species_id: form.species_id,
      window_id: form.window_id,
      application_url: form.application_url.trim() || null,
      portal_username: form.portal_username.trim() || null,
      status: form.status,
      applied_on: form.applied_on.trim() || null,
      results_on: form.results_on.trim() || null,
      fee_summary: form.fee_summary.trim() || null,
      points: form.points.trim() ? Number(form.points) : null,
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
    Alert.alert('Delete application?', 'This removes it from your tracker.', [
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
        <Stack.Screen options={{ headerShown: true, title: 'Application' }} />
        <Sentence tone="dim" style={{ marginTop: space.section }}>
          Loading…
        </Sentence>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: true, title: editing ? 'Edit application' : 'New application' }} />

      <Field label="What do you call this application?">
        <Input value={form.title} onChangeText={(v) => set('title', v)} placeholder="Colorado Elk — Primary Draw" />
      </Field>

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
      <Field label="Where does it stand?">
        <WordChoice
          options={STATUSES.map((s) => ({ value: s.value, label: s.label }))}
          value={form.status}
          onChange={(v) => set('status', (v ?? 'applied') as ApplicationStatus)}
          allowClear={false}
        />
      </Field>

      <Field label="The portal you apply on.">
        <Input
          value={form.application_url}
          onChangeText={(v) => set('application_url', v)}
          placeholder="https://…"
          autoCapitalize="none"
          keyboardType="url"
        />
      </Field>

      <Field
        label="Your username there."
        hint="Keep your password in your phone's password manager — we don't store it."
      >
        <Input
          value={form.portal_username}
          onChangeText={(v) => set('portal_username', v)}
          placeholder="your login username"
          autoCapitalize="none"
        />
      </Field>

      <Field label="When did you apply?">
        <Input value={form.applied_on} onChangeText={(v) => set('applied_on', v)} placeholder="YYYY-MM-DD" />
      </Field>
      <Field label="When are results expected?">
        <Input value={form.results_on} onChangeText={(v) => set('results_on', v)} placeholder="YYYY-MM-DD" />
      </Field>
      <Field label="What did it cost?">
        <Input value={form.fee_summary} onChangeText={(v) => set('fee_summary', v)} placeholder="$ / notes" />
      </Field>
      <Field label="Points going into this draw.">
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
          placeholder="Anything worth remembering…"
          multiline
          style={{ minHeight: 80 }}
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
          <Sentence tone="dim">Delete this application.</Sentence>
        </Pressable>
      ) : null}
    </Screen>
  );
}
