import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { AppText, Card, Screen } from '@/components/ui';
import { useActiveStates } from '@/features/reference/queries';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { radius, spacing, theme } from '@/theme';

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

  return (
    <Screen scroll contentStyle={{ paddingBottom: spacing.xxl }}>
      <Stack.Screen options={{ headerShown: true, title: 'Residency' }} />
      <View style={{ gap: spacing.xs }}>
        <AppText variant="h1">Home state</AppText>
        <AppText variant="body" color={theme.color.textSecondary}>
          Pick the state you're a resident of. Everywhere else, the app labels tags and deadlines as
          nonresident — a reminder that dates and fees often differ.
        </AppText>
      </View>

      <Pressable onPress={() => choose(null)}>
        <Card variant="flat" style={styles.rowCard}>
          <AppText variant="body" color={theme.color.textSecondary}>
            None / not listed
          </AppText>
          {selected === null ? <Ionicons name="checkmark" size={20} color={theme.color.accent} /> : null}
        </Card>
      </Pressable>

      {isLoading ? (
        <ActivityIndicator color={theme.color.accent} style={{ marginTop: spacing.lg }} />
      ) : (
        states.map((s) => {
          const on = selected === s.id;
          return (
            <Pressable key={s.id} onPress={() => choose(s.id)}>
              <Card variant={on ? 'gradient' : 'flat'} style={styles.rowCard}>
                <AppText variant="body">{s.name}</AppText>
                {saving === s.id ? (
                  <ActivityIndicator color={theme.color.accent} />
                ) : on ? (
                  <Ionicons name="checkmark" size={20} color={theme.color.accent} />
                ) : null}
              </Card>
            </Pressable>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowCard: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.md,
  },
});
