import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { AppText, Button, Card, Screen } from '@/components/ui';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { radius, spacing, theme } from '@/theme';

export default function Settings() {
  const router = useRouter();
  const { user, profile, isAdmin, signOut, refreshProfile } = useAuth();

  const [name, setName] = useState(profile?.display_name ?? '');
  const [savingName, setSavingName] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  function confirmDeleteAccount() {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account and all your data — your follows, alert settings, and tracked applications. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: deleteAccount },
      ],
    );
  }

  async function deleteAccount() {
    setDeleting(true);
    const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
    if (error) {
      setDeleting(false);
      Alert.alert('Could not delete account', 'Please try again in a moment.');
      return;
    }
    // Account is gone; clear the local session (redirects to sign-in).
    await signOut();
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

      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        <Button variant="ghost" title="Sign out" onPress={signOut} />
        <Pressable
          onPress={confirmDeleteAccount}
          disabled={deleting}
          style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.7 }]}
        >
          <AppText variant="bodyStrong" color={theme.color.danger}>
            {deleting ? 'Deleting…' : 'Delete account'}
          </AppText>
        </Pressable>
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
  deleteBtn: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
