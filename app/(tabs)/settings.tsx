import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, TextInput, View } from 'react-native';
import { AppText, Button, Card, Screen } from '@/components/ui';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { radius, spacing, theme } from '@/theme';

export default function Settings() {
  const router = useRouter();
  const { user, profile, isAdmin, signOut, refreshProfile } = useAuth();

  const [name, setName] = useState(profile?.display_name ?? '');
  const [savingName, setSavingName] = useState(false);
  useEffect(() => setName(profile?.display_name ?? ''), [profile?.display_name]);

  const trimmed = name.trim();
  const nameChanged = trimmed !== (profile?.display_name ?? '');

  async function saveName() {
    if (!user) return;
    setSavingName(true);
    await supabase.from('profiles').update({ display_name: trimmed || null }).eq('id', user.id);
    await refreshProfile();
    setSavingName(false);
  }

  return (
    <Screen scroll>
      <AppText variant="h1">Settings</AppText>

      <Card>
        <AppText variant="overline" color={theme.color.textMuted}>
          ACCOUNT
        </AppText>
        <AppText variant="body">{user?.email ?? 'Signed in'}</AppText>
        {isAdmin && (
          <AppText variant="caption" color={theme.color.accent}>
            Admin
          </AppText>
        )}
      </Card>

      <Card>
        <AppText variant="overline" color={theme.color.textMuted}>
          YOUR NAME
        </AppText>
        <AppText variant="body" color={theme.color.textSecondary}>
          Used to greet you on the home screen.
        </AppText>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="First name"
          placeholderTextColor={theme.color.textMuted}
          style={styles.input}
        />
        <Button
          title={savingName ? 'Saving…' : 'Save name'}
          onPress={saveName}
          loading={savingName}
          disabled={!nameChanged}
        />
      </Card>

      <Card onPress={() => router.push('/follows')}>
        <AppText variant="h3">What you follow</AppText>
        <AppText variant="body" color={theme.color.textSecondary}>
          Add or remove states and species.
        </AppText>
      </Card>

      <Card onPress={() => router.push('/tracker')}>
        <AppText variant="h3">My Applications</AppText>
        <AppText variant="body" color={theme.color.textSecondary}>
          Track what you've applied for — link, username, dates, and results.
        </AppText>
      </Card>

      <Card onPress={() => router.push('/alerts')}>
        <AppText variant="h3">Alerts</AppText>
        <AppText variant="body" color={theme.color.textSecondary}>
          Choose when to be notified before openers and deadlines.
        </AppText>
      </Card>

      <View style={{ marginTop: spacing.lg }}>
        <Button variant="ghost" title="Sign out" onPress={signOut} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: theme.color.surfaceElevated,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: theme.color.textPrimary,
    fontSize: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.border,
  },
});
