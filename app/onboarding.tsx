import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input, Monogram, Pill, Sentence, Serif } from '@/components/system';
import { HowItWorksList } from '@/components/HowItWorksList';

import { SpeciesBadge } from '@/components/midnight';
import { useActiveStates, useStateSpeciesMulti } from '@/features/reference/queries';
import { useCompleteOnboarding } from '@/features/follows/queries';
import { supabase } from '@/lib/supabase';
import { markOnboardingSeen } from '@/lib/onboardingSeen';
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

  // Showing it counts, and it counts for this account only. Whatever happens
  // next -- finished, skipped, or the app killed mid-way -- the tabs must not
  // send this user back here.
  useEffect(() => {
    markOnboardingSeen(user?.id);
  }, [user?.id]);

  const { data: states = [], isLoading: statesLoading } = useActiveStates();
  const completeOnboarding = useCompleteOnboarding();

  // 0 welcome · 1 how it works · 2 states · 3 species · 4 confirm.
  //
  // It is written as one sentence told across five screens, not a form with
  // an explainer bolted to the front (David, 2026-11-08: "It needs to flow
  // logically. Not just have a plate of information"). The welcome says what
  // this is, the three beats say what it will do, and then — having earned
  // it — the app asks its two questions and confirms what it heard.
  const [step, setStep] = useState(0);
  const [stateIds, setStateIds] = useState<Set<string>>(new Set());
  const [speciesIds, setSpeciesIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Home state. It decides which state's shooting-hours rule we apply to the
  // ground under your feet, and whether a tag reads resident or nonresident —
  // so the app has to ask rather than guess at the first state you followed
  // (David, 2026-10-15). One state picked = no question worth asking.
  const [homeStateId, setHomeStateId] = useState<string | null>(null);
  useEffect(() => {
    if (stateIds.size === 1) setHomeStateId([...stateIds][0]);
    else if (homeStateId && !stateIds.has(homeStateId)) setHomeStateId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateIds]);

  // First name for the Home greeting. Apple/Google sign-ins prefill it via the
  // profile trigger; email signups get to type it here (optional).
  const [name, setName] = useState('');
  useEffect(() => {
    if (profile?.display_name && !name) setName(profile.display_name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.display_name]);

  // Only the species huntable in the states they picked.
  const { data: huntable = [], isLoading: huntLoading } = useStateSpeciesMulti([...stateIds]);
  const pickedStates = states.filter((s) => stateIds.has(s.id));

  function toggle(id: string, setter: React.Dispatch<React.SetStateAction<Set<string>>>) {
    setter((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function finish() {
    // finish() writes follows and a profile patch, both of which need a user.
    // Previously a guest here hit `return` and the button simply did nothing.
    if (!user) {
      router.replace('/(auth)/sign-in');
      return;
    }
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
      const patch: { display_name?: string; resident_state_id?: string } = {};
      const trimmed = name.trim();
      if (trimmed && trimmed !== profile?.display_name) patch.display_name = trimmed;
      if (homeStateId) patch.resident_state_id = homeStateId;
      if (Object.keys(patch).length > 0) {
        await supabase.from('profiles').update(patch).eq('id', user.id);
      }
      await completeOnboarding.mutateAsync();
      router.replace('/');
    } catch (e) {
      setNotice(`Could not save: ${e instanceof Error ? e.message : 'try again'}`);
    } finally {
      setSaving(false);
    }
  }

  // Species used to be mandatory to advance, which meant a user who knew where
  // they hunt but not yet what they want to track could not finish setup at
  // all. States alone already give the app a usable picture -- the browse
  // feeds work off state, and species can be added any time from /follows.
  const canAdvance = step === 2 ? stateIds.size > 0 : true;
  // Each button says what the next screen does, so the flow reads forward.
  const primaryLabel =
    step === 0
      ? 'Show me how it works'
      : step === 1
        ? 'Set it up'
        : step === 2
          ? stateIds.size === 0
            ? 'Continue'
            : `Continue with ${stateIds.size} ${stateIds.size === 1 ? 'state' : 'states'}`
          : step === 3
            ? speciesIds.size === 0
              ? 'Continue'
              : `Continue with ${speciesIds.size} species`
            : 'Start hunting';

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
      {/* The steps narrate themselves — no progress dots, no step counter. */}
      <View style={styles.head}>
        <Serif size={step === 0 ? 44 : 40} style={{ lineHeight: step === 0 ? 50 : 46 }}>
          {step === 0
            ? 'Welcome to\nOpen Season.'
            : step === 1
              ? 'How it works.'
              : step === 2
                ? 'Where do you hunt?'
                : step === 3
                  ? 'What do you hunt?'
                  : 'Stay ahead.'}
        </Serif>
        <Sentence style={{ marginTop: space.x12, maxWidth: 320 }}>
          {step === 0
            ? 'Season dates and draw deadlines for every state you hunt, and a nudge before each one.'
            : step === 1
              ? 'Three things, in this order.'
              : step === 2
                ? 'Pick the states you hunt.'
                : step === 3
                  ? "Only what's legal in your states. Pick what you follow."
                  : "We'll remind you before every opener and application deadline — so you never miss a season."}
        </Sentence>
      </View>

      {step === 0 ? (
        /* The welcome asks nothing. Its whole job is to say where you are
           before anything is wanted from you, so it holds only the mark. */
        <View style={styles.welcome}>
          <Monogram size={46} />
        </View>
      ) : step === 1 ? (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          <HowItWorksList />
        </ScrollView>
      ) : step === 4 ? (
        <ScrollView contentContainerStyle={styles.confirm} showsVerticalScrollIndicator={false}>
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

          {/* Which of those states is home — asked only when it's a real
              question. Drives resident rules and legal shooting light. */}
          {pickedStates.length > 1 ? (
            <View style={{ alignSelf: 'stretch', marginTop: space.x32 }}>
              <Sentence>Which one do you live in?</Sentence>
              <Sentence tone="dim" style={{ fontSize: 13, marginTop: space.x4 }}>
                It sets your resident rules and your legal shooting light.
              </Sentence>
              <View style={{ marginTop: space.x8 }}>
                {pickedStates.map((s, i) => (
                  <SelectRow
                    key={s.id}
                    label={s.name}
                    selected={homeStateId === s.id}
                    last={false}
                    onPress={() => setHomeStateId(s.id)}
                  />
                ))}
                <SelectRow
                  label="None of these"
                  selected={homeStateId === null}
                  last
                  onPress={() => setHomeStateId(null)}
                />
              </View>
            </View>
          ) : null}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {step === 2 ? (
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

      {/* Nothing redirects anyone here any more, so there has to be a way
          back out of it that isn't the home button. */}
      {step > 0 && step < 4 ? (
        <Pressable
          onPress={() => router.replace('/(tabs)')}
          hitSlop={10}
          accessibilityRole="button"
          style={styles.skip}
        >
          <Sentence tone="dim">Skip for now</Sentence>
        </Pressable>
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
          onPress={() => (step === 4 ? finish() : setStep((s) => s + 1))}
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
  welcome: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  confirm: { paddingHorizontal: space.gutter, paddingTop: space.x38, paddingBottom: space.x32 },
  skip: { alignItems: 'center', paddingVertical: space.x8 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.x16,
    paddingHorizontal: space.gutter,
    paddingVertical: space.x16,
  },
});
