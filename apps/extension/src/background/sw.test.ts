import { afterEach, beforeEach, expect, it, vi } from 'vitest';

let listener: (message: unknown, sender: unknown, respond: (value: unknown) => void) => boolean | undefined;
const sendMessage = vi.fn();
const event = () => ({ addListener: vi.fn() });
const extensionUrl = (path: string) => `chrome-extension://test-extension/${path}`;

beforeEach(async () => {
  vi.resetModules();
  sendMessage.mockReset();
  vi.stubGlobal('chrome', {
    action: { onClicked: event() },
    tabs: { onRemoved: event() },
    runtime: {
      id: 'test-extension', getURL: extensionUrl, sendMessage,
      onInstalled: event(), onStartup: event(), onMessageExternal: event(),
      onMessage: { addListener: (callback: typeof listener) => { listener = callback; } },
    },
  });
  await import('./sw');
});
afterEach(() => vi.unstubAllGlobals());

function command(action: string): Promise<unknown> {
  return new Promise(resolve => listener(
    { target: 'background', action },
    { id: 'test-extension', url: extensionUrl('panel.html') },
    resolve,
  ));
}

it.each(['pause', 'resume', 'stop'])('reports an offscreen %s failure to the panel', async action => {
  sendMessage.mockResolvedValue({ error: 'Device storage failed' });
  expect(await command(action)).toEqual({ error: 'Device storage failed' });
});

it('returns successful offscreen control responses', async () => {
  sendMessage.mockResolvedValue({ ok: true });
  expect(await command('stop')).toEqual({ result: { ok: true } });
});
