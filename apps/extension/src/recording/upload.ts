import { orderedParts, sha256, type Channel, type Fragment, type RecordingManifest } from './manifest';

export interface UploadPart { channel: Channel; part: number; startMs: number; durationMs: number; bytes: number; checksum: string; mimeType: string; blob: Blob }
export interface UploadDeps { api: string; publishableKey: string; accessToken: string; fetch: typeof fetch }
export interface UploadResult { recordingId: string; status: string; cost?: number; free?: boolean }

export class NoCreditsError extends Error {}

/** Joins each part's saved fragments into one WebM file. Fragments only decode as a whole part. */
export async function partsForUpload(fragments: Fragment[]): Promise<UploadPart[]> {
  const parts: UploadPart[] = [];
  for (const group of orderedParts(fragments)) {
    const first = group[0]!;
    const blob = new Blob(group.map((f) => f.blob), { type: 'audio/webm' });
    const last = group[group.length - 1]!;
    parts.push({
      channel: first.channel, part: first.part, startMs: Math.round(first.startMs),
      durationMs: Math.round(last.startMs + last.durationMs - first.startMs),
      bytes: blob.size, checksum: await sha256(blob), mimeType: first.mimeType.startsWith('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm', blob,
    });
  }
  return parts.sort((a, b) => a.part - b.part || a.channel.localeCompare(b.channel));
}

/** Time actually recorded, without pauses: what the lesson is charged for. */
export function recordedMs(parts: UploadPart[]): number {
  return parts.filter((p) => p.channel === 'tab').reduce((total, p) => total + p.durationMs, 0);
}

async function call(deps: UploadDeps, body: unknown): Promise<Record<string, unknown>> {
  const response = await deps.fetch(`${deps.api}/functions/v1/lesson-recording`, {
    method: 'POST',
    headers: { authorization: `Bearer ${deps.accessToken}`, apikey: deps.publishableKey, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({})) as Record<string, unknown>;
  const message = typeof result.error === 'string' ? result.error : `Schwanki didn't respond (${response.status}). Try again.`;
  if (response.status === 402) throw new NoCreditsError(message);
  if (!response.ok) throw new Error(message);
  return result;
}

/** Creates the recording, uploads every part, then submits it for transcription. Safe to repeat:
 *  the server finds the recording by its id and an upload overwrites the same file. */
export async function uploadRecording(manifest: RecordingManifest, fragments: Fragment[], deps: UploadDeps, onProgress: (done: number, total: number) => void = () => {}): Promise<UploadResult> {
  if (!manifest.language) throw new Error('Pick the language you are learning first.');
  const parts = await partsForUpload(fragments);
  if (!parts.some((p) => p.channel === 'tab')) throw new Error('No lesson audio was saved.');
  const created = await call(deps, {
    action: 'create', clientKey: manifest.id, language: manifest.language, startedAt: manifest.createdAt,
    durationMs: Math.max(1000, recordedMs(parts)),
    parts: parts.map(({ blob: _blob, ...meta }) => meta),
  });
  const recordingId = created.recordingId as string;
  const uploads = (created.uploads ?? []) as Array<{ channel: Channel; part: number; path: string }>;
  let done = 0;
  onProgress(done, uploads.length);
  for (const target of uploads) {
    const part = parts.find((p) => p.channel === target.channel && p.part === target.part);
    if (!part) throw new Error('The saved audio no longer matches this recording.');
    const response = await deps.fetch(`${deps.api}/storage/v1/object/lesson-audio/${target.path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${deps.accessToken}`, apikey: deps.publishableKey, 'content-type': 'audio/webm', 'x-upsert': 'true' },
      body: part.blob,
    });
    if (!response.ok) throw new Error(`Upload failed (${response.status}). Check your connection and try again.`);
    onProgress(++done, uploads.length);
  }
  if (uploads.length === 0) return { recordingId, status: String(created.status ?? 'transcribing') };
  const submitted = await call(deps, { action: 'submit', recordingId });
  return {
    recordingId, status: String(submitted.status ?? 'transcribing'),
    ...(typeof submitted.cost === 'number' ? { cost: submitted.cost } : {}),
    ...(typeof submitted.free === 'boolean' ? { free: submitted.free } : {}),
  };
}

export async function recordingStatuses(ids: string[], deps: UploadDeps): Promise<Array<{ id: string; status: string; error_detail: string | null }>> {
  const result = await call(deps, { action: 'status', recordingIds: ids });
  return (result.recordings ?? []) as Array<{ id: string; status: string; error_detail: string | null }>;
}
