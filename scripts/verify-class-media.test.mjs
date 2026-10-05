import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { validateExport, verifyMedia } from './verify-class-media.mjs';

function exported(data) {
  const recording = { id: 'synthetic-media-only', state: 'saved', bytes: data.length * 2, gaps: [], parts: ['tab', 'microphone'].map(channel => ({ channel, part: 0, startMs: 0, endMs: 1000, complete: true, mimeType: 'audio/webm;codecs=opus' })) };
  const chunks = [];
  for (const channel of ['tab', 'microphone']) {
    // Arbitrary byte splits exercise assembly, not the real Chrome recorder.
    const slices = [data.subarray(0, Math.floor(data.length / 2)), data.subarray(Math.floor(data.length / 2))];
    slices.forEach((slice, sequence) => chunks.push({ recordingId: recording.id, channel, part: 0, sequence, startMs: sequence * 500, durationMs: 500, bytes: slice.length, checksum: createHash('sha256').update(slice).digest('hex'), mimeType: 'audio/webm;codecs=opus', data: slice.toString('base64') }));
  }
  return { version: 1, recording, chunks };
}
test('manifest verification rejects corrupt, missing, conflicting and cross-session fragments', () => {
  const good = exported(Buffer.from('test-media'));
  assert.equal(validateExport(good).bytes, 20);
  for (const mutate of [
    v => { v.chunks[0].data = 'YmFk'; }, v => { v.chunks.splice(0, 1); v.recording.bytes -= 5; },
    v => { v.chunks[0].recordingId = 'other-class'; }, v => { v.chunks.push(v.chunks[0]); },
    v => { v.recording.parts.splice(1, 1); }, v => { v.recording.state = 'recording'; },
  ]) { const value = structuredClone(good); mutate(value); assert.throws(() => validateExport(value)); }
});
test('real ffmpeg assembly, remux and full decode of synthetic media (NOT Chrome capture validation)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'schwanki-media-'));
  try {
    const webm = path.join(dir, 'input.webm');
    const result = spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-c:a', 'libopus', '-b:a', '48k', webm]);
    assert.equal(result.status, 0, result.stderr?.toString());
    const file = path.join(dir, 'export.json');
    await writeFile(file, JSON.stringify(exported(await readFile(webm))));
    const report = await verifyMedia(file);
    assert.equal(report.parts.length, 2);
    assert.ok(report.parts.every(part => part.codec === 'opus' && part.durationSeconds >= 1 && part.fragmentCount === 2));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
