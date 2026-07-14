import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { AppText, Button, Screen } from '@/components/ui';
import { useActiveStates, useSpecies } from '@/features/reference/queries';
import {
  useApplication,
  useDeleteApplication,
  useSaveApplication,
  type ApplicationInput,
} from '@/features/applications/queries';
import type { ApplicationStatus } from '@/lib/database.types';
import { radius, spacing, theme } from '@/theme';

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
        <AppText color={theme.color.textMuted}>Loading…</AppText>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: true, title: editing ? 'Edit application' : 'New application' }} />

      <Field label="Title">
        <TextInput
          value={form.title}
          onChangeText={(v) => set('title', v)}
          placeholder="Colorado Elk — Primary Draw"
          placeholderTextColor={theme.color.textMuted}
          style={styles.input}
        />
      </Field>

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
        label="Status"
        options={STATUSES.map((s) => ({ value: s.value, label: s.label }))}
        value={form.status}
        onChange={(v) => set('status', (v ?? 'applied') as ApplicationStatus)}
        allowClear={false}
      />

      <Field label="Portal link">
        <TextInput
          value={form.application_url}
          onChangeText={(v) => set('application_url', v)}
          placeholder="https://…"
          placeholderTextColor={theme.color.textMuted}
          autoCapitalize="none"
          keyboardType="url"
          style={styles.input}
        />
      </Field>

      <Field label="Portal username" hint="Keep your password in your phone's password manager — we don't store it.">
        <TextInput
          value={form.portal_username}
          onChangeText={(v) => set('portal_username', v)}
          placeholder="your login username"
          placeholderTextColor={theme.color.textMuted}
          autoCapitalize="none"
          style={styles.input}
        />
      </Field>

      <View style={styles.rowTwo}>
        <Field label="Applied on" style={{ flex: 1 }}>
          <TextInput
            value={form.applied_on}
            onChangeText={(v) => set('applied_on', v)}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.color.textMuted}
            style={styles.input}
          />
        </Field>
        <Field label="Results on" style={{ flex: 1 }}>
          <TextInput
            value={form.results_on}
            onChangeText={(v) => set('results_on', v)}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.color.textMuted}
            style={styles.input}
          />
        </Field>
      </View>

      <View style={styles.rowTwo}>
        <Field label="Fee" style={{ flex: 2 }}>
          <TextInput
            value={form.fee_summary}
            onChangeText={(v) => set('fee_summary', v)}
            placeholder="$ / notes"
            placeholderTextColor={theme.color.textMuted}
            style={styles.input}
          />
        </Field>
        <Field label="Points" style={{ flex: 1 }}>
          <TextInput
            value={form.points}
            onChangeText={(v) => set('points', v.replace(/[^0-9]/g, ''))}
            placeholder="0"
            placeholderTextColor={theme.color.textMuted}
            keyboardType="number-pad"
            style={styles.input}
          />
        </Field>
      </View>

      <Field label="Notes">
        <TextInput
          value={form.notes}
          onChangeText={(v) => set('notes', v)}
          placeholder="Anything worth remembering…"
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

function Field({
  label,
  hint,
  children,
  style,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <View style={[{ gap: 6 }, style]}>
      <AppText variant="overline" color={theme.color.textMuted}>
        {label.toUpperCase()}
      </AppText>
      {children}
      {hint ? (
        <AppText variant="caption" color={theme.color.textMuted}>
          {hint}
        </AppText>
      ) : null}
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
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  rowTwo: { flexDirection: 'row', gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
