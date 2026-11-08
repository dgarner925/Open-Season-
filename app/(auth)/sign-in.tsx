import { useState } from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Pill, Rule, Screen, Sentence, Serif } from '@/components/system';
import {
  isAppleSignInSupported,
  sendPasswordReset,
  signInWithApple,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from '@/lib/auth';
import { lang } from '@/theme/tokens';

const { color, space, type } = lang;

type Mode = 'sign-in' | 'sign-up';

export default function SignIn() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('sign-in');
  // The email form starts closed. Most people sign in with Apple or Google;
  // two text fields and a password were the first thing a brand-new user met,
  // and the overwhelming majority of them never needed to type anything.
  const [showEmail, setShowEmail] = useState(false);
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
        {/* The wordmark — the one sanctioned italic-copper serif (it's the brand mark). */}
        <View style={styles.hero}>
          <Serif size={54} style={{ lineHeight: 60 }}>
            Open{'\n'}
            <Serif italic copper size={54}>
              season.
            </Serif>
          </Serif>
          <Sentence style={{ marginTop: space.x16 }}>
            Never miss an opener or a tag deadline — season dates and draw deadlines for every state you hunt.
          </Sentence>
        </View>

        {/* Providers first, and Apple's button exactly as the OS draws it --
            official artwork and styling are required by App Review
            (Guideline 4), so nothing here is themed. */}
        <View style={{ gap: space.x12, marginTop: space.x8 }}>
          {isAppleSignInSupported && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={16}
              style={styles.appleButton}
              onPress={() => {
                if (busy) return;
                handleProvider('apple');
              }}
            />
          )}
          {/* Google matches Apple's geometry so the providers read as one OS block. */}
          <Pressable
            onPress={() => handleProvider('google')}
            disabled={busy !== null}
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            style={({ pressed }) => [styles.googleButton, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.googleLabel}>{busy === 'google' ? 'One moment…' : 'Continue with Google'}</Text>
          </Pressable>
        </View>

        {notice && !showEmail ? (
          <Sentence tone="bone" style={[{ marginTop: space.x16 }, notice.tone === 'error' && { color: '#c96f5a' }]}>
            {notice.text}
          </Sentence>
        ) : null}

        <Rule />

        {showEmail ? (
          <>
            <TextInput
              placeholder="Email"
              placeholderTextColor={color.dim}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
              style={styles.input}
            />
            <TextInput
              placeholder="Password"
              placeholderTextColor={color.dim}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              style={styles.input}
            />

            {notice ? (
              <Sentence tone="bone" style={[{ marginTop: space.x16 }, notice.tone === 'error' && { color: '#c96f5a' }]}>
                {notice.text}
              </Sentence>
            ) : null}

            <Pill
              label={busy === 'email' ? 'One moment…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
              onPress={handleEmail}
              disabled={busy !== null}
              style={{ marginTop: space.section }}
            />

            <View style={styles.linkRow}>
              <Pressable
                onPress={() => {
                  setNotice(null);
                  setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
                }}
                hitSlop={8}
              >
                <Sentence tone="muted">
                  {mode === 'sign-in' ? 'New here? Create an account.' : 'Have an account? Sign in.'}
                </Sentence>
              </Pressable>
              {mode === 'sign-in' ? (
                <Pressable onPress={handleForgotPassword} hitSlop={8}>
                  <Sentence tone="dim">Forgot password?</Sentence>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : (
          <Pressable onPress={() => setShowEmail(true)} hitSlop={8} accessibilityRole="button">
            <Sentence tone="muted">Use email instead</Sentence>
          </Pressable>
        )}

        {/* The escape hatch. This screen is the first thing a new install sees
            (David, 2026-11-08), but it is not a wall: every date in the app is
            readable without an account, and the only honest thing to do is say
            so and let people past. It goes to the picker, not the tabs -- a
            guest with no state to browse gets redirected back here. */}
        <Pressable
          onPress={() => router.replace('/pick-state')}
          hitSlop={10}
          accessibilityRole="button"
          style={styles.lookAround}
        >
          <Sentence tone="dim">Look around first — no account needed</Sentence>
        </Pressable>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: space.x38, marginBottom: space.x16 },
  input: {
    fontFamily: type.ui,
    fontSize: 16,
    color: color.bone,
    paddingVertical: space.x12,
    marginTop: space.x16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.hair,
  },
  linkRow: { gap: space.x12, marginTop: space.x16 },
  lookAround: { marginTop: space.section, alignItems: 'center', paddingVertical: space.x12 },
  appleButton: { height: 54, width: '100%' },
  googleButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleLabel: { fontFamily: type.uiSemiBold, fontSize: 17, color: '#1a1a1a' },
});
