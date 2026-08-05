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

/**
 * Google via Supabase OAuth in a system browser (works on iOS + Android).
 * Requires: Supabase dashboard: Auth > Providers > Google enabled, and this
 * app's scheme (openseason://) added to the provider's redirect allow-list.
 */
export async function signInWithGoogle(): Promise<void> {
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
