import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Pill, Screen, Sentence } from '@/components/system';
import { updatePassword } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { lang } from '@/theme/tokens';

const { color, space, type } = lang;

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
      <Stack.Screen options={{ headerShown: true, title: 'New password' }} />

      {ready === 'checking' ? null : ready === 'invalid' ? (
        <>
          <Sentence tone="bone" style={{ marginTop: space.section }}>
            This reset link is invalid or has expired.
          </Sentence>
          <Sentence style={{ marginTop: space.x8 }}>
            Request a new one from the sign-in screen — and open it on this phone.
          </Sentence>
          <Pill
            label="Back to sign in"
            onPress={() => router.replace('/(auth)/sign-in')}
            style={{ marginTop: space.section }}
          />
        </>
      ) : (
        <>
          <Sentence style={{ marginTop: space.section }}>
            Pick a new password — at least eight characters.
          </Sentence>
          <TextInput
            placeholder="New password"
            placeholderTextColor={color.dim}
            secureTextEntry
            autoComplete="new-password"
            value={password}
            onChangeText={setPassword}
            style={styles.input}
          />
          <TextInput
            placeholder="Confirm new password"
            placeholderTextColor={color.dim}
            secureTextEntry
            autoComplete="new-password"
            value={confirm}
            onChangeText={setConfirm}
            style={styles.input}
          />
          {notice ? (
            <Sentence tone="bone" style={[{ marginTop: space.x16 }, notice.tone === 'error' && { color: '#c96f5a' }]}>
              {notice.text}
            </Sentence>
          ) : null}
          <Pill
            label={saving ? 'Saving…' : 'Save new password'}
            onPress={save}
            disabled={saving}
            style={{ marginTop: space.section }}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    fontFamily: type.ui,
    fontSize: 16,
    color: color.bone,
    paddingVertical: space.x12,
    marginTop: space.x16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.hair,
  },
});
