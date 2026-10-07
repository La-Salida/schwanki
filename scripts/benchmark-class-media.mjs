// Native media-runtime measurement only. This cannot certify Chrome capture.
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { verifyMedia } from './verify-class-media.mjs';

const dir = await mkdtemp(path.join(tmpdir(), 'schwanki-hour-media-'));
const started = performance.now();
try {
  const recording = { id: 'native-hour-synthetic', state: 'saved', bytes: 0, gaps: [], parts: [] };
  const chunks = [];
  for (let part = 0; part < 12; part++) for (const channel of ['tab', 'microphone']) {
    const file = path.join(dir, `${channel}-${part}.webm`);
    const result = spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', `sine=frequency=${channel === 'tab' ? 440 : 880}:duration=300:sample_rate=48000`, '-c:a', 'libopus', '-b:a', '48k', file]);
    if (result.status !== 0) throw new Error('Synthetic encoding failed.');
    const bytes = await readFile(file);
    recording.bytes += bytes.length;
    recording.parts.push({ channel, part, startMs: part * 300000, endMs: (part + 1) * 300000, complete: true, mimeType: 'audio/webm;codecs=opus' });
    // Byte splits test ordered assembly. They are not Chrome timeslice output.
    for (let sequence = 0; sequence < 60; sequence++) {
      const slice = bytes.subarray(Math.floor(sequence * bytes.length / 60), Math.floor((sequence + 1) * bytes.length / 60));
      chunks.push({ recordingId: recording.id, channel, part, sequence, startMs: part * 300000 + sequence * 5000, durationMs: 5000, bytes: slice.length, checksum: createHash('sha256').update(slice).digest('hex'), mimeType: 'audio/webm;codecs=opus', data: slice.toString('base64') });
    }
  }
  const file = path.join(dir, 'export.json');
  await writeFile(file, JSON.stringify({ version: 1, recording, chunks }));
  const decoded = await verifyMedia(file);
  const report = { source: 'Native ffmpeg synthetic stress fixture; NOT Chrome capture', channels: 2, durationPerChannelSeconds: 3600,
    targetBitratePerChannel: 48000, bytes: recording.bytes, effectiveBitsPerSecondPerChannel: recording.bytes * 8 / 3600 / 2,
    partCount: decoded.parts.length, fragmentCount: chunks.length, fullDecodePassed: true,
    generationAndVerificationMs: performance.now() - started, remuxAndDecodeMs: decoded.processingMs,
    nodeMaxRssKiB: process.resourceUsage().maxRSS, node: process.version, ffmpeg: decoded.ffmpeg,
    browserMemoryMeasured: false, childProcessMemoryMeasured: false, checkedAt: new Date().toISOString() };
  await mkdir(new URL('../docs/spike-evidence/', import.meta.url), { recursive: true });
  await writeFile(new URL('../docs/spike-evidence/native-media-benchmark.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally { await rm(dir, { recursive: true, force: true }); }
