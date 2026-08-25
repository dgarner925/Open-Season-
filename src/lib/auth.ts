import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { supabase } from './supabase';

/**
 * Native Apple Sign-In -> Supabase. Requires:
 *   - app.json: ios.usesAppleSignIn = true (set)
 *   - Supabase dashboard: Auth > Providers > Apple enabled with your Service ID
 */
export async function signInWithApple(): Promise<void> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  if (!credential.identityToken) throw new Error('No identity token returned from Apple.');
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error) throw error;
}

export const isAppleSignInSupported = Platform.OS === 'ios';

const GOOGLE_WEB_CLIENT_ID = '82659984820-46jihvfrgo9grvsrcmn8el9p8ebg60kc.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID = '82659984820-sapcn4c71tocngfevm1pafkrqtrqv8e7.apps.googleusercontent.com';

/**
 * Native Google sign-in (account-picker sheet, like the Apple button) with the
 * browser OAuth flow as fallback. The native module only exists in builds that
 * include it (>= 1.3.5), so it's require()d lazily — earlier binaries running
 * newer JS fall back to the browser rather than crash on import.
 */
export async function signInWithGoogle(): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { GoogleSignin } = require('@react-native-google-signin/google-signin');
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, iosClientId: GOOGLE_IOS_CLIENT_ID });
    const response = await GoogleSignin.signIn();
    if (response?.type === 'cancelled') return;
    const idToken: string | undefined = response?.data?.idToken ?? response?.idToken;
    if (!idToken) throw new Error('No identity token returned from Google.');
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
    if (error) throw error;
    return;
  } catch (e) {
    const err = e as Error & { code?: string };
    // User backed out of the native sheet — not an error, not a fallback case.
    if (err.code === 'SIGN_IN_CANCELLED' || err.code === '-5') return;
    // Native module missing (older binary) — fall through to the browser flow.
    if (!/could not be found|doesn't seem to be linked|RNGoogleSignin/i.test(err.message ?? '')) throw e;
  }
  await signInWithGoogleBrowser();
}

/**
 * Google via Supabase OAuth in a system browser (works on iOS + Android).
 * Requires: Supabase dashboard: Auth > Providers > Google enabled, and this
 * app's scheme (openseason://) added to the provider's redirect allow-list.
 */
async function signInWithGoogleBrowser(): Promise<void> {
  const redirectTo = Linking.createURL('/auth-callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error('No OAuth URL returned.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success' || !result.url) return; // user cancelled

  // Exchange the returned code/tokens for a session. PKCE returns ?code=;
  // older/implicit responses return tokens in the URL fragment. Handle both so
  // a server-side flow change can never strand a signed-in user again.
  const url = new URL(result.url);
  const code = url.searchParams.get('code');
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
    return;
  }
  const fragment = new URLSearchParams(url.hash.replace(/^#/, ''));
  const access_token = fragment.get('access_token');
  const refresh_token = fragment.get('refresh_token');
  if (access_token && refresh_token) {
    const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
    if (sessionError) throw sessionError;
    return;
  }
  throw new Error('Sign-in did not return a session. Please try again.');
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
}

export async function signUpWithEmail(email: string, password: string): Promise<{ needsConfirmation: boolean }> {
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
  if (error) throw error;
  // If email confirmations are on, there's no session until the user confirms.
  return { needsConfirmation: data.session === null };
}

/**
 * Email a password-reset link that deep-links back into the app at
 * /reset-password. PKCE stores the verifier on THIS device, so the link must
 * be opened on the same phone that requested it (the email copy says so).
 * Requires openseason://reset-password in Supabase Auth's redirect allow-list.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  const redirectTo = Linking.createURL('/reset-password');
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (error) throw error;
}

/** Set a new password for the currently-authenticated (recovery) session. */
export async function updatePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}
