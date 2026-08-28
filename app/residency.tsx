import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Row, Rule, Screen, Sentence } from '@/components/system';
import { useActiveStates } from '@/features/reference/queries';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { lang } from '@/theme/tokens';

const { color, space } = lang;

/**
 * The user's home state. Everything else is treated as nonresident — the app
 * uses this to label deadlines and fees with the right context. A single pick
 * (most hunters are a resident of exactly one state); "None" clears it.
 */
export default function Residency() {
  const { user, profile, refreshProfile } = useAuth();
  const { data: states = [], isLoading } = useActiveStates();
  const [saving, setSaving] = useState<string | null>(null);

  const selected = profile?.resident_state_id ?? null;

  async function choose(stateId: string | null) {
    if (!user) return;
    setSaving(stateId ?? 'none');
    await supabase.from('profiles').update({ resident_state_id: stateId }).eq('id', user.id);
    await refreshProfile();
    setSaving(null);
  }

  const mark = (on: boolean, savingThis: boolean) =>
    savingThis ? (
      <ActivityIndicator size="small" color={color.dim} />
    ) : on ? (
      <Ionicons name="checkmark" size={18} color={color.copper} />
    ) : undefined;

  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: true, title: 'Residency' }} />
      <Sentence style={{ marginTop: space.x16 }}>
        Pick the state you're a resident of. Everywhere else, the app labels tags and deadlines as
        nonresident — a reminder that dates and fees often differ.
      </Sentence>

      <Rule />

      <Row
        title="I'm not a resident of any state listed."
        onPress={() => choose(null)}
        right={mark(selected === null, saving === 'none')}
      />

      {isLoading ? (
        <ActivityIndicator color={color.copper} style={{ marginTop: space.section }} />
      ) : (
        states.map((s, i) => (
          <Row
            key={s.id}
            title={s.name}
            onPress={() => choose(s.id)}
            right={mark(selected === s.id, saving === s.id)}
            last={i === states.length - 1}
          />
        ))
      )}
      <View style={{ height: space.x32 }} />
    </Screen>
  );
}
