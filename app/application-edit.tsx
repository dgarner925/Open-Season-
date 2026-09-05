/**
 * New/edit application — redesigned 2026-09-05 (David: "show the likely, fold
 * the rest"). Your states lead the state picker with the other 45 folded;
 * species come grouped the way a hunter thinks, big game open by default;
 * the paperwork sits in a two-column tile; rare fields fold under More
 * details. Saves to the ledger.
 */
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Input, Micro, Pill, Screen, Sentence, WordChoice } from '@/components/system';
import { useActiveStates, useSpecies } from '@/features/reference/queries';
import { useFollows } from '@/features/follows/queries';
import { useAuth } from '@/providers/AuthProvider';
import {
  useApplication,
  useDeleteApplication,
  useSaveApplication,
  type ApplicationInput,
} from '@/features/applications/queries';
import type { ApplicationStatus } from '@/lib/database.types';
import { lang } from '@/theme/tokens';

const { color, space, type } = lang;

const STATUSES: { value: ApplicationStatus; label: string }[] = [
  { value: 'planned', label: 'Planned' },
  { value: 'applied', label: 'Applied' },
  { value: 'successful', label: 'Drawn' },
  { value: 'unsuccessful', label: 'Unsuccessful' },
  { value: 'purchased', label: 'Purchased' },
];

const CATEGORIES: { key: string; label: string }[] = [
  { key: 'big_game', label: 'Big game' },
  { key: 'turkey', label: 'Turkey' },
  { key: 'waterfowl', label: 'Waterfowl & migratory' },
  { key: 'upland', label: 'Upland birds' },
  { key: 'small_game', label: 'Small game' },
  { key: 'furbearer', label: 'Furbearers' },
  { key: 'other', label: 'Other' },
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
  const { data: follows = [] } = useFollows();
  const { profile } = useAuth();
  const { data: existing, isLoading } = useApplication(params.id);
  const save = useSaveApplication();
  const del = useDeleteApplication();

  const [form, setForm] = useState<Form>(EMPTY);
  const [notice, setNotice] = useState<string | null>(null);
  const [allStates, setAllStates] = useState(false);
  const [openCats, setOpenCats] = useState<Set<string>>(new Set(['big_game']));
  const [moreDetails, setMoreDetails] = useState(false);

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

  // Your states lead: follow states + resident state, in list order.
  const myStateIds = useMemo(() => {
    const ids = new Set(follows.map((f) => f.state_id));
    if (profile?.resident_state_id) ids.add(profile.resident_state_id);
    if (form.state_id) ids.add(form.state_id); // the selection always shows
    return ids;
  }, [follows, profile?.resident_state_id, form.state_id]);
  const myStates = states.filter((s) => myStateIds.has(s.id));
  const otherStates = states.filter((s) => !myStateIds.has(s.id));

  // A selected species keeps its group open.
  const selectedCat = species.find((s) => s.id === form.species_id)?.category ?? null;
  const catOpen = (key: string) => openCats.has(key) || selectedCat === key;
  const toggleCat = (key: string) =>
    setOpenCats((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

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
    Alert.alert('Delete application?', 'This removes it from your ledger.', [
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

      {!editing ? (
        <Sentence style={{ marginTop: space.x16 }}>Track any application, even one the app doesn't list.</Sentence>
      ) : null}

      <Micro style={{ marginTop: space.x16 }}>What do you call it?</Micro>
      <Input
        value={form.title}
        onChangeText={(v) => set('title', v)}
        placeholder="Colorado Elk — Primary Draw"
        style={styles.titleInput}
      />

      {/* ——— THE HUNT ——— */}
      <View style={styles.tile}>
        <Micro>The hunt</Micro>
        <Text style={styles.lead}>Your states first —</Text>
        <WordChoice
          options={myStates.map((s) => ({ value: s.id, label: s.code }))}
          value={form.state_id}
          onChange={(v) => set('state_id', v)}
        />
        <Pressable onPress={() => setAllStates((v) => !v)} accessibilityRole="button">
          <Text style={styles.fold}>{allStates ? 'Fewer states ▴' : 'All states ▾'}</Text>
        </Pressable>
        {allStates ? (
          <WordChoice
            options={otherStates.map((s) => ({ value: s.id, label: s.code }))}
            value={form.state_id}
            onChange={(v) => {
              set('state_id', v);
              if (v) setAllStates(false);
            }}
          />
        ) : null}

        <View style={styles.rule} />
        {CATEGORIES.map((cat) => {
          const inCat = species.filter((sp) => sp.category === cat.key);
          if (inCat.length === 0) return null;
          const open = catOpen(cat.key);
          return (
            <View key={cat.key}>
              <Pressable onPress={() => toggleCat(cat.key)} accessibilityRole="button">
                <Micro style={{ marginTop: space.x12, color: open ? color.muted : color.dim }}>
                  {cat.label}  {open ? '▴' : '▾'}
                </Micro>
              </Pressable>
              {open ? (
                <WordChoice
                  options={inCat.map((sp) => ({ value: sp.id, label: sp.name }))}
                  value={form.species_id}
                  onChange={(v) => set('species_id', v)}
                />
              ) : null}
            </View>
          );
        })}
      </View>

      {/* ——— THE PAPERWORK ——— */}
      <View style={styles.tile}>
        <Micro>The paperwork</Micro>
        <View style={styles.twin}>
          <View style={styles.twinCol}>
            <Micro style={styles.fieldLabel}>Applied on</Micro>
            <Input value={form.applied_on} onChangeText={(v) => set('applied_on', v)} placeholder="YYYY-MM-DD" />
          </View>
          <View style={styles.twinCol}>
            <Micro style={styles.fieldLabel}>Fee</Micro>
            <Input value={form.fee_summary} onChangeText={(v) => set('fee_summary', v)} placeholder="$" />
          </View>
        </View>
        <View style={styles.twin}>
          <View style={styles.twinCol}>
            <Micro style={styles.fieldLabel}>Points going in</Micro>
            <Input
              value={form.points}
              onChangeText={(v) => set('points', v.replace(/[^0-9]/g, ''))}
              placeholder="0"
              keyboardType="number-pad"
            />
          </View>
          <View style={styles.twinCol}>
            <Micro style={styles.fieldLabel}>Results expected</Micro>
            <Input value={form.results_on} onChangeText={(v) => set('results_on', v)} placeholder="YYYY-MM-DD" />
          </View>
        </View>
        <Micro style={styles.fieldLabel}>The state's application site</Micro>
        <Input
          value={form.application_url}
          onChangeText={(v) => set('application_url', v)}
          placeholder="https://…"
          autoCapitalize="none"
          keyboardType="url"
        />
      </View>

      {/* ——— the fold ——— */}
      <Pressable onPress={() => setMoreDetails((v) => !v)} accessibilityRole="button">
        <Sentence style={{ marginTop: space.x16 }}>
          More details {moreDetails ? '▴' : '▾'}{' '}
          {!moreDetails ? <Text style={{ color: color.dim }}>— status, portal login, notes.</Text> : null}
        </Sentence>
      </Pressable>
      {moreDetails ? (
        <View style={styles.tile}>
          <Micro>Where does it stand?</Micro>
          <WordChoice
            options={STATUSES.map((s) => ({ value: s.value, label: s.label }))}
            value={form.status}
            onChange={(v) => set('status', (v ?? 'applied') as ApplicationStatus)}
            allowClear={false}
          />
          <Micro style={styles.fieldLabel}>Your username on the portal</Micro>
          <Input
            value={form.portal_username}
            onChangeText={(v) => set('portal_username', v)}
            placeholder="your login username"
            autoCapitalize="none"
          />
          <Sentence tone="dim" style={{ marginTop: space.x4, fontSize: 12 }}>
            Keep your password in your phone's password manager — we don't store it.
          </Sentence>
          <Micro style={styles.fieldLabel}>Anything worth remembering?</Micro>
          <Input
            value={form.notes}
            onChangeText={(v) => set('notes', v)}
            placeholder="Anything worth remembering…"
            multiline
            style={{ minHeight: 80 }}
          />
        </View>
      ) : null}

      {notice ? (
        <Sentence tone="bone" style={{ marginTop: space.section, color: '#c96f5a' }}>
          {notice}
        </Sentence>
      ) : null}

      <Pill
        label={save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Save to the ledger'}
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

const styles = StyleSheet.create({
  titleInput: { fontFamily: type.display, fontSize: 22, marginTop: space.x4 },
  tile: {
    marginTop: space.x16,
    padding: space.gutter,
    paddingTop: space.x16,
    borderRadius: lang.radius.card,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hair,
  },
  lead: { fontFamily: type.ui, fontSize: 13.5, color: color.muted, marginTop: space.x12 },
  fold: { fontFamily: type.uiMedium, fontSize: 13.5, color: color.dim, marginTop: space.x8 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: color.hair, marginTop: space.x16 },
  twin: { flexDirection: 'row', gap: space.x16, marginTop: space.x4 },
  twinCol: { flex: 1 },
  fieldLabel: { marginTop: space.x16 },
});
