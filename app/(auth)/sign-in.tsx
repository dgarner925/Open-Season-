import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { AppText, Button, Screen } from '@/components/ui';
import { PageTitle } from '@/components/midnight';
import {
  isAppleSignInSupported,
  sendPasswordReset,
  signInWithApple,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from '@/lib/auth';
import { radius, spacing, theme } from '@/theme';

type Mode = 'sign-in' | 'sign-up';

export default function SignIn() {
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<null | 'email' | 'apple' | 'google'>(null);
  // Inline feedback — Alert.alert is a no-op on web, so surface it on screen.
  const [notice, setNotice] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

  async function handleEmail() {
    setNotice(null);
    if (!email || !password) {
      setNotice({ tone: 'error', text: 'Enter your email and a password.' });
      return;
    }
    setBusy('email');
    try {
      if (mode === 'sign-in') {
        await signInWithEmail(email, password);
      } else {
        const { needsConfirmation } = await signUpWithEmail(email, password);
        if (needsConfirmation) {
          setNotice({ tone: 'info', text: 'Check your email to confirm your address, then sign in.' });
        }
      }
    } catch (e) {
      setNotice({ tone: 'error', text: e instanceof Error ? e.message : 'Something went wrong. Please try again.' });
    } finally {
      setBusy(null);
    }
  }

  async function handleForgotPassword() {
    setNotice(null);
    if (!email.trim()) {
      setNotice({ tone: 'error', text: 'Type your email above first, then tap "Forgot password?" again.' });
      return;
    }
    try {
      await sendPasswordReset(email);
      setNotice({ tone: 'info', text: 'Reset link sent — open the email on this phone and tap the link.' });
    } catch (e) {
      setNotice({ tone: 'error', text: e instanceof Error ? e.message : 'Could not send the reset email. Try again.' });
    }
  }

  async function handleProvider(provider: 'apple' | 'google') {
    setNotice(null);
    setBusy(provider);
    try {
      await (provider === 'apple' ? signInWithApple() : signInWithGoogle());
    } catch (e) {
      if (e instanceof Error && !/canceled|cancelled/i.test(e.message)) {
        setNotice({ tone: 'error', text: e.message });
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen scroll>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.hero}>
          <PageTitle lead={'Open\n'} accent="season." style={styles.wordmark} />
          <AppText variant="body" color={theme.color.textSecondary} style={{ marginTop: spacing.md }}>
            Never miss an opener or a tag deadline — season dates and draw deadlines for every state you hunt.
          </AppText>
        </View>

        <View style={styles.form}>
          <TextInput
            placeholder="Email"
            placeholderTextColor={theme.color.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
          />
          <TextInput
            placeholder="Password"
            placeholderTextColor={theme.color.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={styles.input}
          />
          {notice ? (
            <AppText
              variant="bodyStrong"
              color={notice.tone === 'error' ? theme.color.danger : theme.color.accentStrong}
            >
              {notice.text}
            </AppText>
          ) : null}
          <Button
            title={mode === 'sign-in' ? 'Sign in' : 'Create account'}
            onPress={handleEmail}
            loading={busy === 'email'}
          />
          <Button
            variant="ghost"
            title={mode === 'sign-in' ? "New here? Create an account" : 'Have an account? Sign in'}
            onPress={() => {
              setNotice(null);
              setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
            }}
          />
          {mode === 'sign-in' ? (
            <Button variant="ghost" title="Forgot password?" onPress={handleForgotPassword} />
          ) : null}
        </View>

        <View style={styles.dividerRow}>
          <View style={styles.line} />
          <AppText variant="caption" color={theme.color.textMuted}>
            or
          </AppText>
          <View style={styles.line} />
        </View>

        <View style={styles.providers}>
          {isAppleSignInSupported && (
            <Button
              variant="secondary"
              title="Continue with Apple"
              onPress={() => handleProvider('apple')}
              loading={busy === 'apple'}
            />
          )}
          <Button
            variant="secondary"
            title="Continue with Google"
            onPress={() => handleProvider('google')}
            loading={busy === 'google'}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: spacing.xxl, marginBottom: spacing.xl },
  wordmark: { fontSize: 56, lineHeight: 60, paddingTop: 4 },
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
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.xl },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: theme.color.border },
  providers: { gap: spacing.md },
});
