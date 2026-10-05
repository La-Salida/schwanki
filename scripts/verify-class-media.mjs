import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function validateExport(input) {
  if (input?.version !== 1 || !input.recording?.id || !Array.isArray(input.recording.parts) || !Array.isArray(input.chunks)) throw new Error('Invalid capture export.');
  if (['recording', 'paused', 'prepared'].includes(input.recording.state)) throw new Error('Stop capture before verification.');
  const groups = new Map(); const keys = new Set(); const parts = new Map();
  for (const part of input.recording.parts) {
    if (!['tab', 'microphone'].includes(part.channel) || !Number.isSafeInteger(part.part) || part.part < 0 || !Number.isFinite(part.startMs) || part.startMs < 0) throw new Error('Invalid media part.');
    const key = `${part.channel}/${part.part}`;
    if (parts.has(key)) throw new Error('Duplicate media part.');
    parts.set(key, part);
  }
  let bytes = 0;
  for (const chunk of input.chunks) {
    const key = `${chunk.channel}/${chunk.part}/${chunk.sequence}`;
    if (chunk.recordingId !== input.recording.id || !Number.isSafeInteger(chunk.sequence) || chunk.sequence < 0 || keys.has(key)) throw new Error('Invalid or duplicate fragment identity.');
    keys.add(key);
    const partKey = `${chunk.channel}/${chunk.part}`;
    const part = parts.get(partKey);
    if (!part || chunk.mimeType !== part.mimeType || !/^audio\/webm(?:;codecs=opus)?$/.test(chunk.mimeType)) throw new Error('Unsupported or conflicting media format.');
    if (typeof chunk.data !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(chunk.data) || !Number.isFinite(chunk.startMs) || chunk.startMs < part.startMs || !Number.isFinite(chunk.durationMs) || chunk.durationMs < 0) throw new Error('Invalid fragment metadata.');
    const data = Buffer.from(chunk.data, 'base64');
    if (data.length !== chunk.bytes || createHash('sha256').update(data).digest('hex') !== chunk.checksum) throw new Error(`Checksum/size mismatch: ${key}`);
    bytes += data.length;
    const group = groups.get(partKey) ?? [];
    group.push({ ...chunk, data }); groups.set(partKey, group);
  }
  if (!bytes || bytes !== input.recording.bytes) throw new Error('Empty export or byte count mismatch.');
  for (const [key, part] of parts) {
    const fragments = groups.get(key);
    if (!fragments?.length) throw new Error(`Missing media part: ${key}`);
    fragments.sort((a, b) => a.sequence - b.sequence);
    if (fragments.some((fragment, i) => fragment.sequence !== i)) throw new Error(`Missing fragment/header: ${key}`);
    if (part.complete && (!Number.isFinite(part.endMs) || part.endMs < part.startMs)) throw new Error(`Invalid complete part timing: ${key}`);
    if (!parts.has(`${part.channel === 'tab' ? 'microphone' : 'tab'}/${part.part}`)) throw new Error(`Missing channel: ${key}`);
  }
  return { groups, parts, bytes };
}
function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(`${command} failed: ${result.error?.message ?? result.stderr.slice(-1000)}`);
  return result.stdout;
}
export async function verifyMedia(exportPath) {
  const input = JSON.parse(await readFile(exportPath, 'utf8'));
  const { groups, parts, bytes } = validateExport(input);
  const destination = `${path.resolve(exportPath)}.decoded`;
  await mkdir(destination, { recursive: true });
  const report = { recordingId: input.recording.id, state: input.recording.state, bytes, gaps: input.recording.gaps, parts: [], checkedAt: new Date().toISOString(), ffmpeg: run('ffmpeg', ['-version']).split('\n')[0] };
  const started = performance.now();
  for (const [key, fragments] of groups) {
    const part = parts.get(key);
    const file = path.join(destination, `${part.channel}-${part.part}.webm`);
    // Each part has its own header. Timeslice fragments must not be decoded alone.
    await writeFile(file, Buffer.concat(fragments.map(f => f.data)));
    const remux = file.replace(/\.webm$/, '.mka');
    run('ffmpeg', ['-v', 'error', '-y', '-i', file, '-map', '0:a:0', '-c:a', 'copy', remux]);
    run('ffmpeg', ['-v', 'error', '-xerror', '-i', remux, '-f', 'null', '-']);
    const wav = file.replace(/\.webm$/, '.wav');
    run('ffmpeg', ['-v', 'error', '-y', '-i', remux, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wav]);
    const media = JSON.parse(run('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', remux]));
    report.parts.push({ channel: part.channel, part: part.part, startMs: part.startMs, complete: part.complete, fragmentCount: fragments.length, file: path.basename(wav), durationSeconds: Number(media.format.duration), codec: media.streams[0]?.codec_name });
  }
  report.processingMs = performance.now() - started;
  await writeFile(path.join(destination, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (!process.argv[2]) throw new Error('Usage: node scripts/verify-class-media.mjs <capture-export.json>');
  await verifyMedia(process.argv[2]);
}
