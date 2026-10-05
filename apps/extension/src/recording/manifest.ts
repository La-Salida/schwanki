export type Channel = 'tab' | 'microphone';
export type RecordingState = 'recording' | 'paused' | 'saved' | 'interrupted';
export interface Limits { maxDurationMs: number; maxBytes: number; fragmentMs: number }
// Conservative development ceilings; measured production limits remain a spike gate.
export const DEVELOPMENT_LIMITS: Limits = { maxDurationMs: 60 * 60_000, maxBytes: 128 * 1024 * 1024, fragmentMs: 5000 };
export interface Fragment {
  recordingId: string; channel: Channel; part: number; sequence: number;
  startMs: number; durationMs: number; bytes: number; checksum: string; mimeType: string;
  blob: Blob; acknowledged: boolean;
}
export interface RecordingManifest {
  id: string; createdAt: string; state: RecordingState; tabId: number;
  durationMs: number; bytes: number; nextPart: number;
  gaps: Array<{ startMs: number; endMs: number }>;
  limits: Limits; warning: string | null;
}
export function fragmentKey(f: Pick<Fragment,'recordingId'|'channel'|'part'|'sequence'>): string {
  return `${f.recordingId}/${f.channel}/${f.part}/${f.sequence}`;
}
export async function sha256(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,'0')).join('');
}
export function orderedParts(fragments: Fragment[]): Fragment[][] {
  const groups = new Map<string, Fragment[]>();
  for (const fragment of fragments) {
    const key = `${fragment.channel}/${fragment.part}`;
    const group = groups.get(key) ?? []; group.push(fragment); groups.set(key, group);
  }
  return [...groups.values()].map(group => {
    group.sort((a,b) => a.sequence-b.sequence);
    group.forEach((f,i) => { if(f.sequence !== i) throw new Error('Missing fragment: upload or recover the saved portion'); });
    if (group.some(f => f.mimeType !== group[0]!.mimeType)) throw new Error('Container changed within a part');
    return group;
  });
}
