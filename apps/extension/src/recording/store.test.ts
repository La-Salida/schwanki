import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { checksum, SPIKE_LIMITS, type Chunk, type Recording } from './manifest';
import { chunksFor, deleteRecording, getRecording, recoverInterrupted, saveChunk, saveRecording, updateRecording } from './store';

const recording = (): Recording => ({
  id: crypto.randomUUID(), tabId: 1, tutor: 'Tutor', targetLanguage: 'th', explanationLanguage: 'en', state: 'recording',
  consentAcknowledgedAt: new Date().toISOString(), preparedUntil: Date.now() + 60_000,
  limits: SPIKE_LIMITS, bytes: 0, parts: [], gaps: [],
});
async function fragment(id: string, sequence = 0, text = 'media'): Promise<Chunk> {
  const blob = new Blob([text], { type: 'audio/webm' });
  return { recordingId: id, channel: 'tab', part: 0, sequence, startMs: 0, durationMs: 5000, bytes: blob.size, checksum: await checksum(blob), mimeType: blob.type, blob };
}
describe('durable device chunks (not browser capture certification)', () => {
  it('persists data and counters together and makes matching retries idempotent', async () => {
    const rec = recording(); await saveRecording(rec);
    const chunk = await fragment(rec.id);
    await Promise.all([saveChunk(chunk), saveChunk(chunk), saveChunk(chunk)]);
    expect((await getRecording(rec.id)).bytes).toBe(chunk.bytes);
    expect((await chunksFor(rec.id))).toHaveLength(1);
    await expect(saveChunk(await fragment(rec.id, 0, 'conflict'))).rejects.toThrow('Conflicting');
    expect((await getRecording(rec.id)).bytes).toBe(chunk.bytes);
  });
  it('metadata changes preserve byte counters under concurrent writes', async () => {
    const rec = recording(); await saveRecording(rec);
    await Promise.all([saveChunk(await fragment(rec.id)), updateRecording(rec.id, { state: 'paused' })]);
    expect((await getRecording(rec.id)).bytes).toBe(5);
    expect((await getRecording(rec.id)).state).toBe('paused');
  });
  it('recovers browser interruption without deleting completed chunks or pretending streams survived', async () => {
    const rec = recording(); await saveRecording(rec); await saveChunk(await fragment(rec.id));
    await recoverInterrupted();
    expect((await getRecording(rec.id)).state).toBe('interrupted');
    expect((await chunksFor(rec.id))).toHaveLength(1);
  });
  it('isolates two same-day classes and deletion cannot resurrect a recording through delayed writes', async () => {
    const one = recording(); const two = recording(); await saveRecording(one); await saveRecording(two);
    await saveChunk(await fragment(one.id)); await saveChunk(await fragment(two.id));
    await deleteRecording(one.id);
    await expect(saveChunk(await fragment(one.id, 1))).rejects.toThrow('no longer accepts');
    await expect(updateRecording(one.id, { state: 'recording' })).rejects.toThrow('deleted');
    expect(await chunksFor(one.id)).toHaveLength(0);
    expect(await chunksFor(two.id)).toHaveLength(1);
  });
});
