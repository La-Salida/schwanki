import { assertPrepared, checksum, mimeType, type Channel, type Recording } from '../recording/manifest';
import { getRecording, recoverInterrupted, saveChunk, updateRecording } from '../recording/store';

let mic: MediaStream | undefined;
let tab: MediaStream | undefined;
let audio: AudioContext | undefined;
let micMeter: AnalyserNode | undefined;
let tabMeter: AnalyserNode | undefined;
let session: Recording | undefined;
let recorders: { recorder: MediaRecorder; stopped: Promise<void> }[] = [];
let part = 0;
let writes: Promise<void> = Promise.resolve();
let controls: Promise<unknown> = Promise.resolve();
let maintenance: ReturnType<typeof setInterval> | undefined;
let preflightExpiry: ReturnType<typeof setTimeout> | undefined;
let pendingBytes = 0;
let writeError = false;
let peakPendingBytes = 0;
let micAudibleAt = Date.now();
let tabAudibleAt = Date.now();
let warning = '';
// A newly created recording document cannot inherit streams from an old one.
// Recovery runs once here, never on a service-worker restart with a live document.
const ready = recoverInterrupted();

function level(meter?: AnalyserNode): number {
  if (!meter) return 0;
  const values = new Uint8Array(meter.fftSize);
  meter.getByteTimeDomainData(values);
  return Math.sqrt(values.reduce((sum, v) => sum + ((v - 128) / 128) ** 2, 0) / values.length);
}
function meter(stream: MediaStream): AnalyserNode {
  const node = audio!.createAnalyser();
  node.fftSize = 256;
  audio!.createMediaStreamSource(stream).connect(node);
  return node;
}
async function microphone(): Promise<void> {
  if (mic?.getAudioTracks().every(t => t.readyState === 'live')) return;
  mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
  audio ??= new AudioContext();
  await audio.resume();
  micMeter = meter(mic);
}
async function release(): Promise<void> {
  clearInterval(maintenance);
  clearTimeout(preflightExpiry);
  tab?.getTracks().forEach(track => track.stop());
  mic?.getTracks().forEach(track => track.stop());
  await audio?.close();
  tab = mic = undefined;
  audio = undefined;
  micMeter = tabMeter = undefined;
}
function elapsed(): number { return Math.max(0, Date.now() - session!.startedAt!); }
function scheduleStop(reason: string): void {
  controls = controls.then(() => stop(true, reason)).catch(() => { warning = 'Local storage failed. Export the completed saved fragments.'; });
}
async function beginPart(): Promise<void> {
  const type = mimeType(MediaRecorder.isTypeSupported.bind(MediaRecorder));
  const startMs = elapsed();
  const thisPart = part++;
  session!.parts.push(...(['tab', 'microphone'] as const).map(channel => ({ channel, part: thisPart, startMs, complete: false, mimeType: type })));
  session = await updateRecording(session!.id, { state: 'recording', parts: session!.parts });
  for (const channel of ['tab', 'microphone'] as const) {
    const stream = channel === 'tab' ? tab! : mic!;
    const recorder = new MediaRecorder(stream, { mimeType: type, audioBitsPerSecond: session!.limits.bitratePerChannel });
    let sequence = 0;
    let lastMs = startMs;
    const recordingId = session!.id;
    recorder.ondataavailable = event => {
      if (!event.data.size) return;
      const blob = event.data;
      const durationMs = Math.max(0, elapsed() - lastMs);
      const fragment = { recordingId, channel, part: thisPart, sequence: sequence++, startMs: lastMs, durationMs, bytes: blob.size, mimeType: recorder.mimeType, blob };
      lastMs += durationMs;
      pendingBytes += blob.size;
      peakPendingBytes = Math.max(peakPendingBytes, pendingBytes);
      writes = writes.then(async () => {
        try {
          await saveChunk({ ...fragment, checksum: await checksum(blob) });
        } finally { pendingBytes -= blob.size; }
      }).catch(() => {
        // Keep prior durable fragments; do not claim the failed fragment was saved.
        writeError = true;
        scheduleStop('Could not save an audio fragment. The saved portion may have a gap. Export it for recovery.');
      });
      if (pendingBytes > 4 * 1024 * 1024) scheduleStop('Device storage cannot keep up. Recording stopped to preserve completed fragments.');
    };
    recorder.onerror = () => scheduleStop(`${channel} recorder failed; saved portion retained.`);
    // Register BEFORE start: track loss may make state inactive before we handle
    // the final dataavailable/stop tasks. Await the actual stop event, not state.
    const stopped = new Promise<void>(resolve => recorder.addEventListener('stop', () => resolve(), { once: true }));
    recorder.start(session!.limits.timesliceMs);
    recorders.push({ recorder, stopped });
  }
}
async function finishPart(): Promise<void> {
  const current = recorders;
  recorders = [];
  for (const { recorder } of current) if (recorder.state !== 'inactive') recorder.stop();
  await Promise.all(current.map(entry => entry.stopped));
  await writes;
  const endMs = elapsed();
  session!.parts.filter(p => p.part === part - 1).forEach(p => { p.endMs = endMs; p.complete = !writeError; });
  session = await updateRecording(session!.id, { parts: session!.parts });
}
async function stop(interrupted = false, reason = ''): Promise<void> {
  if (!session) { await release(); return; }
  try {
    clearInterval(maintenance);
    await finishPart();
    await updateRecording(session.id, { state: interrupted || writeError ? 'interrupted' : 'saved', endedAt: Date.now(), reason });
  } finally {
    session = undefined;
    await release();
  }
}
async function start(id: string, streamId: string): Promise<void> {
  if (session) throw new Error('A recording is already active.');
  const prepared = await getRecording(id);
  assertPrepared(prepared);
  clearTimeout(preflightExpiry);
  try {
    // Acquire both streams before any recording-time network operation.
    const constraints = { audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } }, video: false };
    tab = await navigator.mediaDevices.getUserMedia(constraints as unknown as MediaStreamConstraints);
    await microphone();
    // Tab capture suppresses normal playback. Route ONLY tab audio to speakers.
    audio!.createMediaStreamSource(tab).connect(audio!.destination);
    tabMeter = meter(tab);
    const storage = await navigator.storage.estimate();
    if (storage.quota !== undefined && storage.quota - (storage.usage ?? 0) < prepared.limits.maxBytes - prepared.bytes + 8 * 1024 * 1024) {
      throw new Error('Insufficient local storage for this session.');
    }
    session = prepared;
    const now = Date.now();
    part = Math.max(-1, ...session.parts.map(p => p.part)) + 1;
    if (session.startedAt) {
      const lastEnd = Math.max(0, ...session.parts.map(p => p.endMs ?? p.startMs));
      session.gaps.push({ startMs: lastEnd, endMs: now - session.startedAt, reason: 'Interrupted; explicitly resumed with new streams.' });
    }
    session = await updateRecording(id, { state: 'recording', startedAt: session.startedAt ?? now, gaps: session.gaps });
    warning = ''; writeError = false; peakPendingBytes = 0; micAudibleAt = tabAudibleAt = now;
    for (const stream of [tab, mic!]) for (const track of stream.getAudioTracks()) {
      track.addEventListener('ended', () => scheduleStop('Classroom tab or microphone was closed or disconnected. Saved fragments retained.'), { once: true });
    }
    await beginPart();
    maintenance = setInterval(() => {
      controls = controls.then(async () => {
        if (!session) return;
        const persisted = await getRecording(session.id);
        if (elapsed() >= session.limits.maxDurationMs || persisted.bytes + pendingBytes >= session.limits.maxBytes - 4 * 1024 * 1024) {
          await stop(true, 'Provisional duration or storage ceiling reached. Saved portion retained.'); return;
        }
        if (level(micMeter) > 0.005) micAudibleAt = Date.now();
        if (level(tabMeter) > 0.005) tabAudibleAt = Date.now();
        warning = session.state === 'paused' ? '' :
          Date.now() - micAudibleAt > 30_000 ? 'Your microphone has been silent for 30 seconds. Check its meter and permission if you have been speaking.' :
          Date.now() - tabAudibleAt > 30_000 ? 'Class audio has been silent for 30 seconds. Check the selected tab and its playback if your tutor has been speaking.' : '';
        if (session.state === 'recording' && elapsed() - session.parts.at(-1)!.startMs >= session.limits.partDurationMs) {
          const startMs = elapsed();
          await finishPart();
          session.gaps.push({ startMs, endMs: elapsed(), reason: 'Media part rotation' });
          await updateRecording(session.id, { gaps: session.gaps });
          await beginPart();
        }
      }).catch(() => scheduleStop('Recorder maintenance failed. Saved portion retained.'));
    }, 1000);
  } catch (error) {
    if (session) await stop(true, 'Stream acquisition or recorder start failed.');
    else await release();
    throw error;
  }
}
async function command(message: { type: string; id?: string; streamId?: string }): Promise<unknown> {
  await ready;
  switch (message.type) {
    case 'preflight':
      if (session) throw new Error('A recording is active.');
      await microphone();
      clearTimeout(preflightExpiry);
      preflightExpiry = setTimeout(() => { if (!session) void release(); }, 120_000);
      return { ok: true };
    case 'start': await start(message.id!, message.streamId!); break;
    case 'stop': await stop(); break;
    case 'pause':
      if (session?.state !== 'recording') throw new Error('Nothing to pause.');
      await finishPart();
      session = await updateRecording(session.id, { state: 'paused' });
      break;
    case 'resume': {
      if (session?.state !== 'paused') throw new Error('Nothing to resume.');
      session.gaps.push({ startMs: session.parts.at(-1)!.endMs!, endMs: elapsed(), reason: 'Learner paused recording' });
      await updateRecording(session.id, { gaps: session.gaps });
      await beginPart(); break;
    }
    default: throw new Error('Unknown recorder command.');
  }
  return { ok: true };
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || sender.tab || message?.target !== 'offscreen') return;
  if (message.type === 'status') {
    void ready.then(() => respond({ ok: true, activeId: session?.id ?? null, state: session?.state, micLevel: level(micMeter), tabLevel: level(tabMeter), warning, pendingBytes, peakPendingBytes }), () => respond({ ok: false, error: 'Device recovery failed.' }));
    return true;
  }
  controls = controls.then(() => command(message));
  void controls.then(respond, () => respond({ ok: false, error: 'Recorder could not complete this action. Check microphone permission and local storage.' }));
  controls = controls.catch(() => {});
  return true;
});
