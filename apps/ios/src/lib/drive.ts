import type { Source } from '@schwanki/core';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { api, requireAccount, supabase } from './backend';
import { syncMaterial } from './creation';

// Google's file chooser only exists on the web, so it runs alone on this page in an auth
// sheet. drive.file means Schwanki only ever sees files picked there: no restricted scope.
const PICKER_PAGE = 'https://schwankiapp.com/drive-picker';
const PICKED = 'schwanki://drive/picked';
export type DriveType = 'google_doc' | 'google_sheet';
export interface PickedDriveFile { url: string; name: string; type: DriveType }

export const driveFileId = (ref: string) => /\/d\/([^/?#]+)/.exec(ref)?.[1];
const isDrive = (s: Source) => s.type === 'google_doc' || s.type === 'google_sheet';

export function parsePicked(returned: string): PickedDriveFile | null {
  const url = new URL(returned);
  if (`${url.protocol}//${url.host}${url.pathname}` !== PICKED || url.searchParams.has('cancelled')) return null;
  const file = url.searchParams.get('url') ?? '', name = url.searchParams.get('name') ?? '', type = url.searchParams.get('type');
  if (!driveFileId(file) || !/^https:\/\/docs\.google\.com\//.test(file) || (type !== 'google_doc' && type !== 'google_sheet')) throw new Error('Google returned a file Schwanki can’t read. Choose a Doc or Sheet.');
  return { url: file, name: name || 'Google file', type };
}

/** Grant drive.file and keep the refresh token for server sync; returns a short-lived access token for the chooser. */
async function driveAccess(userId: string): Promise<string> {
  const { data: { session: before } } = await supabase.auth.getSession();
  if (!before || before.user.id !== userId) throw new Error('Sign in again, then choose your file.');
  const redirectTo = makeRedirectUri({ scheme: 'schwanki', path: 'drive/callback' });
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: {
    scopes: 'openid email profile https://www.googleapis.com/auth/drive.file', redirectTo, skipBrowserRedirect: true,
    queryParams: { access_type: 'offline', prompt: 'consent', ...(before.user.email ? { login_hint: before.user.email } : {}) },
  } });
  if (error) throw error;
  const result = await WebBrowser.openAuthSessionAsync(data.url!, redirectTo);
  if (result.type !== 'success') throw new Cancelled();
  const returned = new URL(result.url);
  const failure = returned.searchParams.get('error_description');
  if (failure) throw new Error(failure);
  const code = returned.searchParams.get('code');
  if (!code) throw new Error('Google did not finish connecting. Try again.');
  const { data: exchanged, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
  if (exchanged.session.user.id !== userId) {
    // A different Google account would sign into a different Schwanki account: put the original back.
    await supabase.auth.setSession({ access_token: before.access_token, refresh_token: before.refresh_token });
    throw new Error(`Choose ${before.user.email ?? 'the Google account you sign in with'} to use its Drive.`);
  }
  const { provider_token: token, provider_refresh_token: refresh } = exchanged.session;
  if (!token) throw new Error('Google did not grant Drive access. Try again and allow it.');
  if (refresh) { const { error: storeError } = await supabase.rpc('store_google_refresh_token', { token: refresh }); if (storeError) throw storeError; }
  return token;
}
class Cancelled extends Error { constructor() { super('cancelled'); } }

/** Connect Drive, open Google's chooser, and start reading the chosen file. Null when the person backs out. */
export async function addFromDrive(userId: string, language: string): Promise<Source | null> {
  await requireAccount(userId);
  let file: PickedDriveFile | null;
  try {
    const token = await driveAccess(userId);
    const sheet = await WebBrowser.openAuthSessionAsync(`${PICKER_PAGE}#${new URLSearchParams({ token })}`, PICKED);
    if (sheet.type !== 'success') return null;
    file = parsePicked(sheet.url);
  } catch (failure) { if (failure instanceof Cancelled) return null; throw failure; }
  if (!file) return null;
  const id = driveFileId(file.url);
  const source = (await api.listSources()).find(s => isDrive(s) && driveFileId(s.externalRef) === id)
    ?? await api.addSource({ type: file.type, externalRef: file.url, label: file.name, language });
  await syncMaterial(userId, source);
  return source;
}

export async function driveSources(userId: string): Promise<Source[]> {
  await requireAccount(userId);
  return (await api.listSources()).filter(isDrive);
}
