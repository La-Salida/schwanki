// Explicit, private, server-side comparison harness. Never run inside the extension.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const [provider, manifestPath, outputDir, ...flags] = process.argv.slice(2);
if (!['openai', 'elevenlabs'].includes(provider) || !manifestPath || !outputDir || !flags.includes('--consented')) {
  throw new Error('Usage: node scripts/benchmark-class-transcription.mjs <openai|elevenlabs> <private-sample.json> <private-output-directory> --consented [--zero-retention|--allow-provider-retention]');
}
if (provider === 'elevenlabs' && !flags.includes('--zero-retention') && !flags.includes('--allow-provider-retention')) {
  throw new Error('ElevenLabs zero retention requires enterprise eligibility. Select --zero-retention or explicitly acknowledge provider retention with --allow-provider-retention.');
}
const key = process.env[provider === 'openai' ? 'OPENAI_API_KEY' : 'ELEVENLABS_API_KEY'];
if (!key) throw new Error(`Missing ${provider} transcription credential. No provider request was made.`);
const sample = JSON.parse(await readFile(manifestPath, 'utf8'));
if (!/^[a-z0-9-]{1,80}$/.test(sample.id) || sample.consented !== true || !['zh-en', 'th-en'].includes(sample.languages) || !['tab', 'microphone'].includes(sample.channel) || !Number.isFinite(sample.offsetMs) || sample.offsetMs < 0) {
  throw new Error('Sample must be anonymized, consented, identify channel/offset and use a zh-en or th-en language pair.');
}
const file = path.resolve(path.dirname(manifestPath), sample.file);
if (path.extname(file).toLowerCase() !== '.wav') throw new Error('Use the verified 16kHz mono WAV export.');
const media = spawnSync('ffprobe', ['-v', 'error', '-show_format', '-of', 'json', file], { encoding: 'utf8', maxBuffer: 128 * 1024 });
if (media.status !== 0) throw new Error('Sample must decode before submission.');
const durationSeconds = Number(JSON.parse(media.stdout).format.duration);
if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 301) throw new Error('Each paid comparison request is limited to a five-minute media part.');
const bytes = await readFile(file);
if (bytes.length > 20 * 1024 * 1024) throw new Error('Sample exceeds the comparison upload limit.');
const form = new FormData(); form.set('file', new Blob([bytes], { type: 'audio/wav' }), 'sample.wav');
const model = provider === 'openai' ? 'whisper-1' : 'scribe_v2';
let url, headers;
if (provider === 'openai') {
  url = 'https://api.openai.com/v1/audio/transcriptions'; headers = { Authorization: `Bearer ${key}` };
  form.set('model', model); form.set('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'segment'); form.append('timestamp_granularities[]', 'word');
} else {
  url = `https://api.elevenlabs.io/v1/speech-to-text?enable_logging=${!flags.includes('--zero-retention')}`;
  headers = { 'xi-api-key': key }; form.set('model_id', model); form.set('timestamps_granularity', 'word'); form.set('diarize', 'true'); form.set('tag_audio_events', 'false');
}
// No language forcing or translation endpoint: benchmark code-switching verbatim.
await mkdir(outputDir, { recursive: true });
const output = path.join(outputDir, `${sample.id}-${provider}`);
const receipt = { sampleId: sample.id, languages: sample.languages, channel: sample.channel, provider, model, durationSeconds, inputBytes: bytes.length,
  checksum: createHash('sha256').update(bytes).digest('hex'), attemptedAt: new Date().toISOString(), autoRetry: false };
// Refuse accidental replays, including timeouts whose billing outcome is unknown.
await writeFile(`${output}.attempt.json`, JSON.stringify(receipt, null, 2), { flag: 'wx' });
const started = performance.now();
const response = await fetch(url, { method: 'POST', headers, body: form, signal: AbortSignal.timeout(180_000) });
await writeFile(`${output}.status.json`, JSON.stringify({ status: response.status, elapsedMs: performance.now() - started }, null, 2));
if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}. No automatic retry, key fallback, or transcript/error-body logging.`);
const raw = await response.json();
const units = provider === 'openai' ? raw.segments : raw.words?.filter(word => word.type === 'word');
if (!Array.isArray(units) || !units.length) throw new Error('Provider returned an empty or malformed timestamped transcript.');
const segments = units.map((unit, sequence) => {
  if (!Number.isFinite(unit.start) || !Number.isFinite(unit.end) || unit.start < 0 || unit.end < unit.start || unit.end > durationSeconds + 2 || typeof unit.text !== 'string' || !unit.text.trim()) throw new Error('Provider returned invalid transcript evidence.');
  return { id: `${provider}:${sample.id}:${sequence}`, channel: sample.channel, startMs: sample.offsetMs + Math.round(unit.start * 1000), endMs: sample.offsetMs + Math.round(unit.end * 1000),
    text: unit.text, speakerLabel: unit.speaker_id ?? null,
    uncertainty: { ...(typeof unit.avg_logprob === 'number' ? { avgLogprob: unit.avg_logprob } : {}), ...(typeof unit.no_speech_prob === 'number' ? { noSpeechProbability: unit.no_speech_prob } : {}), ...(typeof unit.logprob === 'number' ? { logprob: unit.logprob } : {}) } };
});
await writeFile(`${output}.transcript.json`, JSON.stringify({ ...receipt, elapsedMs: performance.now() - started, reportedUsage: raw.usage ?? null, segments,
  humanEvaluationRequired: ['target speech preserved', 'English explanations preserved', 'timestamp error', 'speaker attribution', 'grammar and corrections', 'unclear names', 'provider bill and retention'] }, null, 2));
console.log(`Stored ${segments.length} timestamped segments in the private output directory. No provider decision has been made.`);
