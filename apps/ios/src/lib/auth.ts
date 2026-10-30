import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from './backend';
WebBrowser.maybeCompleteAuthSession();
export async function signIn() {
  const redirectTo = makeRedirectUri({ scheme: 'schwanki', path: 'auth/callback' });
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: {
    scopes: 'openid email profile', redirectTo, skipBrowserRedirect: true,
  } });
  if (error) throw error;
  if (!data.url) throw new Error('The sign-in link is not available. Try again.');
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return false;
  const returned = new URL(result.url);
  const expected = new URL(redirectTo);
  if (returned.protocol !== expected.protocol || returned.host !== expected.host || returned.pathname !== expected.pathname) throw new Error('The sign-in callback did not match this app. Try again.');
  const failure = returned.searchParams.get('error_description');
  if (failure) throw new Error(failure);
  const code = returned.searchParams.get('code');
  if (!code) throw new Error('Sign-in did not return a code. Try again.');
  const exchanged = await supabase.auth.exchangeCodeForSession(code);
  if (exchanged.error) throw exchanged.error;
  return true;
}
