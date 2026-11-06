import * as WebBrowser from 'expo-web-browser';
import { api, requireAccount, supabase } from './backend';
import { syncMaterial } from './creation';

// Canva Connect runs through the canva-connect function, which keeps the client secret and tokens.
const RETURN = 'schwanki://canva/connected';
export interface CanvaDesign { id: string; title: string; thumbnail: string | null; updatedAt: string | null }
export interface CanvaPage { connected: boolean; designs: CanvaDesign[]; continuation: string | null }

async function call<T>(route: string, body: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke(`canva-connect/${route}`, { body });
  if (error) {
    // The function answers errors as { error } with a readable message.
    const context = (error as { context?: Response }).context;
    const detail = await context?.json?.().then((b: { error?: string }) => b.error).catch(() => undefined);
    throw new Error(detail ?? 'Canva didn’t respond. Try again.');
  }
  return data as T;
}

export async function canvaDesigns(userId: string, continuation?: string | null): Promise<CanvaPage> {
  await requireAccount(userId);
  return call<CanvaPage>('designs', continuation ? { continuation } : {});
}

/** Sign in to Canva in an auth sheet. False when the person backs out. */
export async function connectCanva(userId: string): Promise<boolean> {
  await requireAccount(userId);
  const { url } = await call<{ url: string }>('start');
  const result = await WebBrowser.openAuthSessionAsync(url, RETURN);
  if (result.type !== 'success') return false;
  const failure = new URL(result.url).searchParams.get('error');
  if (failure) throw new Error(failure);
  return true;
}

/** Export the design to PDF on the server, then start reading it. Returns the source id to track. */
export async function importCanvaDesign(userId: string, design: CanvaDesign, language: string, label?: string): Promise<string> {
  await requireAccount(userId);
  const { sourceId } = await call<{ sourceId: string }>('import', { designId: design.id, language, label: label?.trim() || design.title });
  const source = (await api.listSources()).find(s => s.id === sourceId);
  if (!source) throw new Error('The design was saved but isn’t showing yet. Open Check new words.');
  await syncMaterial(userId, source);
  return sourceId;
}
