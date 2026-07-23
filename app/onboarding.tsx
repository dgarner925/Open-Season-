import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '@/components/ui';
import { PageTitle, SpeciesBadge } from '@/components/midnight';
import { useActiveStates, useStateSpeciesMulti } from '@/features/reference/queries';
import { useCompleteOnboarding } from '@/features/follows/queries';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { fontFamily, radius, spacing, theme } from '@/theme';

const STEPS = 3;
const CATEGORIES: { key: string; label: string }[] = [
  { key: 'big_game', label: 'BIG GAME' },
  { key: 'turkey', label: 'TURKEY' },
  { key: 'waterfowl', label: 'WATERFOWL & MIGRATORY' },
  { key: 'upland', label: 'UPLAND BIRDS' },
  { key: 'small_game', label: 'SMALL GAME' },
  { key: 'furbearer', label: 'FURBEARERS' },
  { key: 'other', label: 'OTHER' },
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
    step === 0 ? `Continue · ${stateIds.size} selected` : step === 1 ? `Continue · ${speciesIds.size} selected` : 'Start hunting';

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.progress}>
        {Array.from({ length: STEPS }).map((_, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: i <= step ? theme.color.accent : 'rgba(255,255,255,0.12)' }]} />
        ))}
      </View>

      <View style={styles.head}>
        <AppText variant="overline" color={theme.color.textMuted}>
          STEP {step + 1} OF {STEPS}
        </AppText>
        {step === 0 ? (
          <PageTitle lead={'Where do you\n'} accent="hunt?" style={styles.title} />
        ) : step === 1 ? (
          <PageTitle lead={'What do you\n'} accent="hunt?" style={styles.title} />
        ) : (
          <PageTitle lead={'Stay\n'} accent="ahead." style={styles.title} />
        )}
        <AppText variant="body" color={theme.color.textSecondary} style={styles.intro}>
          {step === 0
            ? 'Choose the states you hunt — pick as many as you like.'
            : step === 1
              ? "Just the species you can hunt in the states you picked. Choose what to track."
              : "We'll remind you before every opener and application deadline — so you never miss a season."}
        </AppText>
      </View>

      {step === 2 ? (
        <View style={styles.confirm}>
          <View style={styles.bell}>
            <Ionicons name="notifications-outline" size={30} color={theme.color.accent} />
          </View>
          <AppText variant="h3" style={{ marginTop: spacing.lg, textAlign: 'center' }}>
            {stateIds.size} {stateIds.size === 1 ? 'state' : 'states'} · {speciesIds.size} {speciesIds.size === 1 ? 'species' : 'species'}
          </AppText>

          <View style={styles.nameBlock}>
            <AppText variant="overline" color={theme.color.textMuted}>
              WHAT SHOULD WE CALL YOU?
            </AppText>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="First name (optional)"
              placeholderTextColor={theme.color.textMuted}
              autoCapitalize="words"
              autoComplete="given-name"
              returnKeyType="done"
              style={styles.nameInput}
            />
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {step === 0 ? (
            statesLoading ? (
              <ActivityIndicator color={theme.color.accent} />
            ) : (
              states.map((s) => <SelectRow key={s.id} label={s.name} selected={stateIds.has(s.id)} onPress={() => toggle(s.id, setStateIds)} />)
            )
          ) : huntLoading ? (
            <ActivityIndicator color={theme.color.accent} />
          ) : (
            CATEGORIES.map((cat) => {
              const inCat = huntable.filter((sp) => sp.category === cat.key);
              if (inCat.length === 0) return null;
              return (
                <View key={cat.key} style={styles.catGroup}>
                  <AppText variant="overline" color={theme.color.textMuted}>
                    {cat.label}
                  </AppText>
                  {inCat.map((sp) => (
                    <SelectRow key={sp.id} label={sp.name} badge selected={speciesIds.has(sp.id)} onPress={() => toggle(sp.id, setSpeciesIds)} />
                  ))}
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {notice ? (
        <AppText variant="caption" color={theme.color.danger} style={{ paddingHorizontal: spacing.xl }}>
          {notice}
        </AppText>
      ) : null}

      <View style={styles.actions}>
        {step > 0 ? (
          <Pressable onPress={() => setStep((s) => s - 1)} hitSlop={10}>
            <AppText variant="bodyStrong" color={theme.color.textMuted}>
              Back
            </AppText>
          </Pressable>
        ) : (
          <View />
        )}
        <Pressable
          disabled={!canAdvance || saving}
          onPress={() => (step === 2 ? finish() : setStep((s) => s + 1))}
          style={[styles.primary, (!canAdvance || saving) && { opacity: 0.45 }]}
        >
          {saving ? <ActivityIndicator color={theme.color.onAccent} /> : <Text style={styles.primaryLabel}>{primaryLabel}</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function SelectRow({ label, selected, onPress, badge = false }: { label: string; selected: boolean; onPress: () => void; badge?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.row, selected ? styles.rowOn : styles.rowOff]}>
      {badge ? <SpeciesBadge name={label} size={40} muted={!selected} /> : null}
      <Text style={[styles.rowLabel, { color: selected ? theme.color.textPrimary : theme.color.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={[styles.check, selected ? styles.checkOn : styles.checkOff]}>
        {selected ? <Ionicons name="checkmark" size={13} color={theme.color.onAccent} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.background },
  progress: { flexDirection: 'row', gap: 6, paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  dot: { flex: 1, height: 3, borderRadius: 2 },

  head: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, gap: spacing.sm },
  title: { fontSize: 42, lineHeight: 48, marginTop: spacing.xs, paddingTop: 3 },
  intro: { maxWidth: 300, marginTop: spacing.xs },

  list: { paddingHorizontal: spacing.xl, paddingVertical: spacing.xl, gap: spacing.sm },
  catGroup: { gap: spacing.sm, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth },
  rowOn: { backgroundColor: theme.color.surfaceElevated, borderColor: 'rgba(217,158,127,0.35)' },
  rowOff: { backgroundColor: theme.color.surfaceFlat, borderColor: theme.color.borderFlat },
  rowLabel: { flex: 1, fontFamily: fontFamily.sansSemiBold, fontSize: 15 },
  check: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: theme.color.accent },
  checkOff: { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)' },

  confirm: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxl },
  bell: { width: 72, height: 72, borderRadius: 36, backgroundColor: theme.color.accentFill, alignItems: 'center', justifyContent: 'center' },
  nameBlock: { alignSelf: 'stretch', marginTop: spacing.xxl, gap: spacing.sm },
  nameInput: {
    backgroundColor: theme.color.surfaceElevated,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: theme.color.textPrimary,
    fontSize: 16,
    fontFamily: fontFamily.sans,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.border,
  },

  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg, paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  primary: { flex: 1, maxWidth: 260, height: 52, borderRadius: 26, backgroundColor: theme.color.accent, alignItems: 'center', justifyContent: 'center' },
  primaryLabel: { fontFamily: fontFamily.sansBold, fontSize: 15, color: theme.color.onAccent },
});
