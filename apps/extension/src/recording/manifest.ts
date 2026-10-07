export type Channel = 'tab' | 'microphone';
export type CaptureState = 'prepared' | 'recording' | 'paused' | 'saved' | 'interrupted';
export interface Limits {
  maxDurationMs: number;
  maxBytes: number;
  bitratePerChannel: number;
  timesliceMs: number;
  partDurationMs: number;
}
// Provisional safety ceilings for the spike, NOT measured production limits.
export const SPIKE_LIMITS: Limits = {
  maxDurationMs: 60 * 60 * 1000, maxBytes: 96 * 1024 * 1024,
  bitratePerChannel: 48_000, timesliceMs: 5000, partDurationMs: 5 * 60 * 1000,
};
export interface Part {
  channel: Channel; part: number; startMs: number; endMs?: number; complete: boolean; mimeType: string;
}
export interface Recording {
  id: string; tabId: number; tutor: string; targetLanguage: string; explanationLanguage: string;
  state: CaptureState; consentAcknowledgedAt: string; preparedUntil: number; limits: Limits;
  startedAt?: number; endedAt?: number; reason?: string; bytes: number;
  parts: Part[]; gaps: { startMs: number; endMs: number; reason: string }[];
}
export interface Chunk {
  recordingId: string; channel: Channel; part: number; sequence: number;
  startMs: number; durationMs: number; bytes: number; checksum: string; mimeType: string; blob: Blob;
}
export function chunkKey(chunk: Pick<Chunk, 'recordingId' | 'channel' | 'part' | 'sequence'>): string {
  return `${chunk.recordingId}/${chunk.channel}/${chunk.part}/${chunk.sequence}`;
}
export function assertPrepared(recording: Recording, now = Date.now()): void {
  if (!recording.consentAcknowledgedAt || recording.preparedUntil <= now) throw new Error('Prepare a fresh session and acknowledge recording first.');
  if (!['prepared', 'interrupted'].includes(recording.state)) throw new Error('This session cannot start a new part.');
  if (recording.bytes >= recording.limits.maxBytes || (recording.startedAt && now - recording.startedAt >= recording.limits.maxDurationMs)) {
    throw new Error('This session has reached its limit. Export the saved portion.');
  }
}
export function mimeType(supported: (mime: string) => boolean): string {
  const type = ['audio/webm;codecs=opus', 'audio/webm'].find(supported);
  if (!type) throw new Error('This browser cannot record supported WebM audio.');
  return type;
}
export async function checksum(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function orderedPart(chunks: Chunk[], channel: Channel, part: number): Chunk[] {
  const ordered = chunks.filter(c => c.channel === channel && c.part === part).sort((a, b) => a.sequence - b.sequence);
  if (!ordered.length || ordered.some((chunk, index) => chunk.sequence !== index)) throw new Error('Missing media fragment; keep the saved data for recovery.');
  return ordered;
}
