import { assertPrepared, SPIKE_LIMITS, type Recording } from '../recording/manifest';
import { chunksFor, deleteRecording, getRecording, updateRecording } from '../recording/store';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
let prepared: Recording | undefined;
let micChecked = false;
let busy = false;
let activeId: string | null = null;
let listSignature = '';
async function send(type: string, data: object = {}): Promise<any> {
  const result = await chrome.runtime.sendMessage({ target: 'background', type, ...data });
  if (!result?.ok) throw new Error(result?.error ?? 'Recorder unavailable. Reopen Schwanki on your classroom tab.');
  return result;
}
function recordEnabled(): boolean {
  if (!prepared || !micChecked || busy || activeId || !$<HTMLInputElement>('consent').checked) return false;
  try { assertPrepared(prepared); return true; } catch { return false; }
}
function bind(id: string, action: () => Promise<void>): void {
  $<HTMLButtonElement>(id).onclick = async () => {
    busy = true;
    $<HTMLButtonElement>('record').disabled = true;
    try { await action(); $('status').textContent = ''; }
    catch (error) { $('status').textContent = error instanceof Error ? error.message : 'Action failed.'; }
    finally { busy = false; await refresh(); }
  };
}
bind('permission', async () => { await chrome.tabs.create({ url: chrome.runtime.getURL('permission.html') }); });
bind('check', async () => { await send('preflight'); micChecked = true; });
bind('prepare', async () => {
  if (!$<HTMLInputElement>('consent').checked) throw new Error('Tell your tutor and acknowledge recording first.');
  if (!micChecked) throw new Error('Check your microphone first.');
  const { classroomTabId } = await chrome.storage.local.get('classroomTabId');
  if (!Number.isInteger(classroomTabId)) throw new Error('Click the Schwanki toolbar action on the classroom tab.');
  const recording: Recording = {
    id: crypto.randomUUID(), tabId: classroomTabId, tutor: $<HTMLInputElement>('tutor').value.trim() || 'Test tutor',
    targetLanguage: $<HTMLSelectElement>('language').value, explanationLanguage: $<HTMLSelectElement>('explanation').value,
    state: 'prepared', consentAcknowledgedAt: new Date().toISOString(), preparedUntil: Date.now() + 10 * 60 * 1000,
    limits: SPIKE_LIMITS, bytes: 0, parts: [], gaps: [],
  };
  await send('prepare', { recording });
  prepared = recording;
  $('quote').textContent = 'Local test only: $0 / 0 credits. Up to 60 minutes and 96 MiB with a safety reserve. Provisional limits; no processing quote. Preparation expires in 10 minutes.';
});
bind('record', async () => {
  if (!prepared || !micChecked || !$<HTMLInputElement>('consent').checked) throw new Error('Prepare and acknowledge recording first.');
  await send('start', { id: prepared.id }); prepared = undefined;
});
for (const type of ['pause', 'resume', 'stop']) bind(type, async () => { await send(type); });

async function exportRecording(id: string): Promise<void> {
  const recording = await getRecording(id);
  if (['recording', 'paused'].includes(recording.state)) throw new Error('Stop recording before exporting.');
  // Spike-only export. Reading all media is explicit and happens AFTER recording.
  const chunks = await chunksFor(id);
  const exported = [];
  for (const { blob, ...metadata } of chunks) {
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]!); reader.onerror = reject; reader.readAsDataURL(blob);
    });
    exported.push({ ...metadata, data });
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, recording, chunks: exported })], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `schwanki-${id}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
async function renderSaved(): Promise<void> {
  const { recordings } = await send('list');
  const signature = JSON.stringify(recordings.map((r: Recording) => [r.id, r.state, r.bytes, r.reason]));
  if (signature === listSignature) return;
  listSignature = signature;
  $('saved').replaceChildren();
  for (const recording of (recordings as Recording[]).sort((a, b) => (b.startedAt ?? b.preparedUntil) - (a.startedAt ?? a.preparedUntil))) {
    const article = document.createElement('article');
    const summary = document.createElement('p');
    summary.textContent = `${recording.tutor} · ${recording.state} · ${(recording.bytes / 1024 / 1024).toFixed(2)} MiB saved locally · ${recording.id.slice(0, 8)}${recording.reason ? ` — ${recording.reason}` : ''}`;
    article.append(summary);
    for (const [label, action] of [
      ['Export saved portion', () => exportRecording(recording.id)],
      ['Prepare explicit recovery', async () => {
        if (recording.state !== 'interrupted') throw new Error('Only interrupted sessions can resume with new streams.');
        if (!$<HTMLInputElement>('consent').checked || !micChecked) throw new Error('Acknowledge recording and check the microphone again.');
        const { classroomTabId } = await chrome.storage.local.get('classroomTabId');
        if (!Number.isInteger(classroomTabId)) throw new Error('Reopen Schwanki on the classroom tab.');
        prepared = await updateRecording(recording.id, { preparedUntil: Date.now() + 10 * 60 * 1000, tabId: classroomTabId, consentAcknowledgedAt: new Date().toISOString() });
        await send('prepare', { recording: prepared });
        $('quote').textContent = 'Recovery prepared: same local class, new media part. $0; original limits still apply. Press Record class explicitly.';
      }],
      ['Delete local test recording', async () => {
        if (activeId) throw new Error('Stop the active recording first.');
        if (confirm('Delete this test recording and its local audio? Export it first if you need it.')) await deleteRecording(recording.id);
      }],
    ] as const) {
      const button = document.createElement('button'); button.textContent = label;
      button.disabled = ['recording', 'paused'].includes(recording.state) || (label === 'Prepare explicit recovery' && recording.state !== 'interrupted');
      button.onclick = async () => { try { await action(); await refresh(); } catch (e) { $('status').textContent = e instanceof Error ? e.message : 'Action failed.'; } };
      article.append(button);
    }
    $('saved').append(article);
  }
}
async function refresh(): Promise<void> {
  try {
    const status = await send('status');
    activeId = status.activeId;
    $<HTMLMeterElement>('mic').value = status.micLevel;
    $<HTMLMeterElement>('tab').value = status.tabLevel;
    $('tab-hint').textContent = activeId ? 'Captured tab audio' : 'Checked when recording starts';
    $('warning').textContent = status.warning;
    $<HTMLButtonElement>('pause').disabled = busy || status.state !== 'recording';
    $<HTMLButtonElement>('resume').disabled = busy || status.state !== 'paused';
    $<HTMLButtonElement>('stop').disabled = busy || !activeId;
    $<HTMLButtonElement>('record').disabled = !recordEnabled();
    if (activeId) $('status').textContent = `${status.state === 'paused' ? 'Paused' : 'Recording'} · pending device writes: ${status.pendingBytes} bytes · peak pending: ${status.peakPendingBytes} bytes`;
    await renderSaved();
  } catch (e) { $('status').textContent = e instanceof Error ? e.message : 'Recorder unavailable.'; }
}
$('consent').onchange = () => { $<HTMLButtonElement>('record').disabled = !recordEnabled(); };
void refresh();
setInterval(() => { if (!busy) void refresh(); }, 1000);
