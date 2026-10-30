import { createClient, processLock } from '@supabase/supabase-js';
import { SchwankiApi } from '@schwanki/core';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';

// Shared API methods generate media event ids. Expo provides secure native UUIDs.
if (!globalThis.crypto?.randomUUID) Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { randomUUID: Crypto.randomUUID, getRandomValues: Crypto.getRandomValues } });
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const configured = Boolean(url && key && !url.includes('YOUR_PROJECT'));
// Chunking avoids the native keychain value-size limit as Supabase sessions grow.
const storage = {
  async getItem(name: string) {
    if (Platform.OS === 'web') return window.localStorage.getItem(name);
    const count = Number(await SecureStore.getItemAsync(`${name}.count`));
    if (!count) return null;
    const chunks = await Promise.all(Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(`${name}.${i}`)));
    return chunks.some(c => c === null) ? null : chunks.join('');
  },
  async setItem(name: string, value: string) {
    if (Platform.OS === 'web') { window.localStorage.setItem(name, value); return; }
    const oldCount = Number(await SecureStore.getItemAsync(`${name}.count`));
    const points = Array.from(value);
    const chunks = Array.from({ length: Math.ceil(points.length / 450) }, (_, i) => points.slice(i * 450, (i + 1) * 450).join(''));
    for (let i = 0; i < chunks.length; i++) await SecureStore.setItemAsync(`${name}.${i}`, chunks[i]!);
    await SecureStore.setItemAsync(`${name}.count`, String(chunks.length));
    for (let i = chunks.length; i < oldCount; i++) await SecureStore.deleteItemAsync(`${name}.${i}`);
  },
  async removeItem(name: string) {
    if (Platform.OS === 'web') { window.localStorage.removeItem(name); return; }
    const count = Number(await SecureStore.getItemAsync(`${name}.count`));
    await SecureStore.deleteItemAsync(`${name}.count`);
    for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(`${name}.${i}`);
  },
};
export const supabase = createClient(url || 'https://not-configured.supabase.co', key || 'not-configured', {
  global: { fetch: async (input, init) => {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    if (init?.signal?.aborted) cancel();
    init?.signal?.addEventListener('abort', cancel, { once: true });
    const timeout = setTimeout(cancel, 20_000);
    try { return await fetch(input, { ...init, signal: controller.signal }); }
    finally { clearTimeout(timeout); init?.signal?.removeEventListener('abort', cancel); }
  } },
  auth: { storage, lock: processLock, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false, flowType: 'pkce' },
});
export const api = new SchwankiApi(supabase);
export async function requireAccount(userId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user.id !== userId) throw new Error('Sign in to the original account to sync these reviews.');
}

export interface OfflineAccount { id: string; email?: string }
// This local identity only unlocks its own offline cache. It never authorizes an API request.
export async function offlineAccount(): Promise<OfflineAccount | null> {
  const raw = await storage.getItem('schwanki.offline-account');
  if (!raw) return null;
  try { const account = JSON.parse(raw); return typeof account.id === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(account.id) ? account : null; } catch { return null; }
}
export async function rememberAccount(account: OfflineAccount) {
  await storage.setItem('schwanki.offline-account', JSON.stringify({ id: account.id, email: account.email }));
}
export async function signOutLocal() {
  const remembered = await offlineAccount();
  await storage.removeItem('schwanki.offline-account');
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) { if (remembered) await rememberAccount(remembered); throw error; }
}
