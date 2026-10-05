import { assertPrepared } from './recording/manifest';
import { getRecording, recordings, recoverInterrupted, saveRecording } from './recording/store';

let creating: Promise<void> | undefined;
async function ensureRecorder(): Promise<void> {
  const contexts = await chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT] });
  if (contexts.length) return;
  if (!creating) {
    creating = chrome.offscreen.createDocument({
      url: 'offscreen.html', reasons: [chrome.offscreen.Reason.USER_MEDIA],
      justification: 'Own explicitly requested classroom and microphone audio independent of panel lifetime.',
    }).finally(() => { creating = undefined; });
  }
  await creating;
}
chrome.action.onClicked.addListener(tab => {
  if (tab.id === undefined) return;
  // Open from the action gesture, before awaiting metadata or any network.
  void chrome.sidePanel.open({ tabId: tab.id });
  void chrome.storage.local.set({ classroomTabId: tab.id });
});
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || sender.tab || message?.target !== 'background') return;
  const run = async () => {
    switch (message.type) {
      case 'prepare': {
        await ensureRecorder();
        if ((await chrome.runtime.sendMessage({ target: 'offscreen', type: 'status' })).activeId) throw new Error('Stop the active recording first.');
        await recoverInterrupted();
        await saveRecording(message.recording);
        return { ok: true };
      }
      case 'preflight':
        await ensureRecorder();
        return chrome.runtime.sendMessage({ target: 'offscreen', type: 'preflight' });
      case 'start': {
        // The Record button sends this message. No network acknowledgements here.
        // Offscreen creation is completed during Prepare, not during this gesture.
        const recording = await getRecording(message.id);
        assertPrepared(recording);
        const streamId = await new Promise<string>((resolve, reject) => {
          chrome.tabCapture.getMediaStreamId({ targetTabId: recording.tabId }, id => {
            if (chrome.runtime.lastError || !id) reject(new Error('Tab capture was not granted.'));
            else resolve(id);
          });
        });
        return chrome.runtime.sendMessage({ target: 'offscreen', type: 'start', id: recording.id, streamId });
      }
      case 'status': {
        const contexts = await chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT] });
        if (contexts.length) return chrome.runtime.sendMessage({ target: 'offscreen', type: 'status' });
        await recoverInterrupted();
        return { ok: true, activeId: null, micLevel: 0, tabLevel: 0 };
      }
      case 'pause': case 'resume': case 'stop':
        return chrome.runtime.sendMessage({ target: 'offscreen', type: message.type });
      case 'list': return { ok: true, recordings: await recordings() };
      default: throw new Error('Unknown recording command.');
    }
  };
  void run().then(respond, () => respond({ ok: false, error: 'Capture action failed. Check microphone permission, reopen Schwanki on the classroom tab, or prepare a fresh session.' }));
  return true;
});
