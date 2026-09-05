import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input, Pill, Sentence, Serif } from '@/components/system';
import { SpeciesBadge } from '@/components/midnight';
import { useActiveStates, useStateSpeciesMulti } from '@/features/reference/queries';
import { useCompleteOnboarding } from '@/features/follows/queries';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { lang } from '@/theme/tokens';

const { color, space, type } = lang;

const CATEGORIES: { key: string; label: string }[] = [
  { key: 'big_game', label: 'Big game' },
  { key: 'turkey', label: 'Turkey' },
  { key: 'waterfowl', label: 'Waterfowl & migratory' },
  { key: 'upland', label: 'Upland birds' },
  { key: 'small_game', label: 'Small game' },
  { key: 'furbearer', label: 'Furbearers' },
  { key: 'other', label: 'Other' },
];

export default function Onboarding() {
  const router = useRouter();
  const { user, profile, isOnboarded } = useAuth();
  useEffect(() => {
    if (isOnboarded) router.replace('/');
  }, [isOnboarded, router]);

  const { data: states = [], isLoading: statesLoading } = useActiveStates();
  const completeOnboarding = useCompleteOnboarding();

  const [step, setStep] = useState(0); // 0 states · 1 species · 2 confirm
  const [stateIds, setStateIds] = useState<Set<string>>(new Set());
  const [speciesIds, setSpeciesIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // First name for the Home greeting. Apple/Google sign-ins prefill it via the
  // profile trigger; email signups get to type it here (optional).
  const [name, setName] = useState('');
  useEffect(() => {
    if (profile?.display_name && !name) setName(profile.display_name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.display_name]);

  // Only the species huntable in the states they picked.
  const { data: huntable = [], isLoading: huntLoading } = useStateSpeciesMulti([...stateIds]);

  function toggle(id: string, setter: React.Dispatch<React.SetStateAction<Set<string>>>) {
    setter((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function finish() {
    if (!user) return;
    setSaving(true);
    setNotice(null);
    try {
      // Follow only (state, species) pairs that are actually huntable.
      const { data: pairs, error: pairErr } = await supabase
        .from('state_species')
        .select('state_id, species_id')
        .in('state_id', [...stateIds])
        .in('species_id', [...speciesIds]);
      if (pairErr) throw pairErr;
      const rows = (pairs ?? []).map((p) => ({ user_id: user.id, state_id: p.state_id, species_id: p.species_id }));
      if (rows.length > 0) {
        const { error } = await supabase.from('follows').upsert(rows, { onConflict: 'user_id,state_id,species_id', ignoreDuplicates: true });
        if (error) throw error;
      }
      const trimmed = name.trim();
      if (trimmed && trimmed !== profile?.display_name) {
        await supabase.from('profiles').update({ display_name: trimmed }).eq('id', user.id);
      }
      await completeOnboarding.mutateAsync();
      router.replace('/');
    } catch (e) {
      setNotice(`Could not save: ${e instanceof Error ? e.message : 'try again'}`);
    } finally {
      setSaving(false);
    }
  }

  const canAdvance = step === 0 ? stateIds.size > 0 : step === 1 ? speciesIds.size > 0 : true;
  const primaryLabel =
    step === 0
      ? stateIds.size === 0
        ? 'Continue'
        : `Continue with ${stateIds.size} ${stateIds.size === 1 ? 'state' : 'states'}`
      : step === 1
        ? speciesIds.size === 0
          ? 'Continue'
          : `Continue with ${speciesIds.size} species`
        : 'Start hunting';

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
      {/* Three steps narrate themselves — no progress dots, no step counter. */}
      <View style={styles.head}>
        <Serif size={40} style={{ lineHeight: 46 }}>
          {step === 0 ? 'Where do you hunt?' : step === 1 ? 'What do you hunt?' : 'Stay ahead.'}
        </Serif>
        <Sentence style={{ marginTop: space.x8, maxWidth: 310 }}>
          {step === 0
            ? 'Pick the states you hunt.'
            : step === 1
              ? 'Only what's legal in your states. Pick what you follow.'
              : "We'll remind you before every opener and application deadline — so you never miss a season."}
        </Sentence>
      </View>

      {step === 2 ? (
        <View style={styles.confirm}>
          <Serif size={44}>
            {stateIds.size} {stateIds.size === 1 ? 'state' : 'states'} · {speciesIds.size} species
          </Serif>
          <View style={{ alignSelf: 'stretch', marginTop: space.x38 }}>
            <Sentence>What should we call you?</Sentence>
            <Input
              value={name}
              onChangeText={setName}
              placeholder="First name (optional)"
              autoCapitalize="words"
              autoComplete="given-name"
              returnKeyType="done"
            />
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {step === 0 ? (
            statesLoading ? (
              <ActivityIndicator color={color.copper} />
            ) : (
              states.map((s, i) => (
                <SelectRow
                  key={s.id}
                  label={s.name}
                  selected={stateIds.has(s.id)}
                  last={i === states.length - 1}
                  onPress={() => toggle(s.id, setStateIds)}
                />
              ))
            )
          ) : huntLoading ? (
            <ActivityIndicator color={color.copper} />
          ) : (
            CATEGORIES.map((cat) => {
              const inCat = huntable.filter((sp) => sp.category === cat.key);
              if (inCat.length === 0) return null;
              return (
                <View key={cat.key} style={{ marginBottom: space.x16 }}>
                  <Sentence tone="dim" style={{ fontSize: 13, marginBottom: space.x4 }}>
                    {cat.label}
                  </Sentence>
                  {inCat.map((sp, i) => (
                    <SelectRow
                      key={sp.id}
                      label={sp.name}
                      badge
                      selected={speciesIds.has(sp.id)}
                      last={i === inCat.length - 1}
                      onPress={() => toggle(sp.id, setSpeciesIds)}
                    />
                  ))}
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {notice ? (
        <Sentence tone="bone" style={{ paddingHorizontal: space.gutter, color: '#c96f5a', fontSize: 13 }}>
          {notice}
        </Sentence>
      ) : null}

      <View style={styles.actions}>
        {step > 0 ? (
          <Pressable onPress={() => setStep((s) => s - 1)} hitSlop={10} accessibilityRole="button">
            <Sentence tone="muted">Back</Sentence>
          </Pressable>
        ) : (
          <View />
        )}
        <Pill
          label={saving ? 'Saving…' : primaryLabel}
          onPress={() => (step === 2 ? finish() : setStep((s) => s + 1))}
          disabled={!canAdvance || saving}
          style={{ flex: 1, maxWidth: 280 }}
        />
      </View>
    </SafeAreaView>
  );
}

function SelectRow({
  label,
  selected,
  last,
  onPress,
  badge = false,
}: {
  label: string;
  selected: boolean;
  last: boolean;
  onPress: () => void;
  badge?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}>
      {badge ? <SpeciesBadge name={label} size={38} muted={!selected} /> : null}
      <Text style={[styles.rowLabel, { color: selected ? color.bone : color.muted }]} numberOfLines={1}>
        {label}
      </Text>
      {selected ? <Ionicons name="checkmark" size={18} color={color.copper} /> : null}
      {!last ? <View style={styles.rowRule} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  head: { paddingHorizontal: space.gutter, paddingTop: space.x32 },
  list: { paddingHorizontal: space.gutter, paddingVertical: space.section },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.x12, paddingVertical: space.x12, minHeight: 44 },
  rowRule: {
    position: 'absolute',
    left: 0,
    right: -space.gutter,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.hair,
  },
  rowLabel: { flex: 1, fontFamily: type.ui, fontSize: type.size.body + 0.5 },
  confirm: { flex: 1, paddingHorizontal: space.gutter, paddingTop: space.x38 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.x16,
    paddingHorizontal: space.gutter,
    paddingVertical: space.x16,
  },
});
