export type Channel = 'tab' | 'microphone';
export type RecordingState = 'recording' | 'paused' | 'saved' | 'interrupted';
export interface Limits { maxDurationMs: number; maxBytes: number; fragmentMs: number; partMs: number }
// Two channels at 32 kbps make about 30 MB an hour. A new part starts every 10 minutes so each
// uploaded file is small and transcribes quickly.
export const DEVELOPMENT_LIMITS: Limits = { maxDurationMs: 2 * 60 * 60_000, maxBytes: 128 * 1024 * 1024, fragmentMs: 5000, partMs: 10 * 60_000 };
export type UploadState = 'waiting' | 'uploading' | 'processing' | 'done' | 'failed' | 'no_credits' | 'signed_out';
export interface UploadStatus { state: UploadState; recordingId?: string; error?: string | null; cost?: number; free?: boolean }
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
  /** The language the student is learning, as an ISO 639-1 code. */
  language?: string;
  upload?: UploadStatus;
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
