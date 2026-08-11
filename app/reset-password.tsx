import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { AppText, Button, Screen } from '@/components/ui';
import { PageTitle } from '@/components/midnight';
import { updatePassword } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { radius, spacing, theme } from '@/theme';

/**
 * Landing screen for the password-reset email link (openseason://reset-password
 * ?code=...). Exchanges the recovery code for a session, then lets the user set
 * a new password. Also works for a signed-in user who navigates here directly
 * (doubles as "change password").
 */
export default function ResetPassword() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [ready, setReady] = useState<'checking' | 'ok' | 'invalid'>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Arriving from the email link: trade the recovery code for a session.
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        setReady(error ? 'invalid' : 'ok');
        return;
      }
      // No code: only useful if already signed in (change-password use).
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setReady(data.session ? 'ok' : 'invalid');
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  async function save() {
    setNotice(null);
    if (password.length < 8) {
      setNotice({ tone: 'error', text: 'Password must be at least 8 characters.' });
      return;
    }
    if (password !== confirm) {
      setNotice({ tone: 'error', text: 'Passwords do not match.' });
      return;
    }
    setSaving(true);
    try {
      await updatePassword(password);
      setNotice({ tone: 'info', text: 'Password updated — taking you to your hunts…' });
      setTimeout(() => router.replace('/'), 900);
    } catch (e) {
      setNotice({ tone: 'error', text: e instanceof Error ? e.message : 'Could not update password. Try again.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: true, title: '' }} />
      <View style={styles.hero}>
        <PageTitle lead={'New\n'} accent="password." style={styles.title} />
        <AppText variant="body" color={theme.color.textSecondary} style={{ marginTop: spacing.md }}>
          {ready === 'invalid'
            ? 'This reset link is invalid or has expired. Request a new one from the sign-in screen — and open it on this phone.'
            : 'Pick a new password for your account.'}
        </AppText>
      </View>

      {ready === 'ok' ? (
        <View style={styles.form}>
          <TextInput
            placeholder="New password"
            placeholderTextColor={theme.color.textMuted}
            secureTextEntry
            autoComplete="new-password"
            value={password}
            onChangeText={setPassword}
            style={styles.input}
          />
          <TextInput
            placeholder="Confirm new password"
            placeholderTextColor={theme.color.textMuted}
            secureTextEntry
            autoComplete="new-password"
            value={confirm}
            onChangeText={setConfirm}
            style={styles.input}
          />
          {notice ? (
            <AppText variant="bodyStrong" color={notice.tone === 'error' ? theme.color.danger : theme.color.accentStrong}>
              {notice.text}
            </AppText>
          ) : null}
          <Button title={saving ? 'Saving…' : 'Save new password'} onPress={save} loading={saving} />
        </View>
      ) : ready === 'invalid' ? (
        <Button title="Back to sign in" onPress={() => router.replace('/(auth)/sign-in')} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: spacing.xl, marginBottom: spacing.xl },
  title: { fontSize: 44, lineHeight: 50, paddingTop: 4 },
  form: { gap: spacing.md },
  input: {
    backgroundColor: theme.color.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: theme.color.textPrimary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
});
