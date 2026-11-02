import { describe, expect, it, vi } from 'vitest';
import { DEVELOPMENT_LIMITS, sha256, type Fragment, type RecordingManifest } from './manifest';
import { NoCreditsError, partsForUpload, recordedMs, uploadRecording } from './upload';

const manifest: RecordingManifest = {
  id: '10000000-0000-0000-0000-0000000000aa', createdAt: '2026-11-02T10:00:00.000Z', state: 'saved', tabId: 1,
  durationMs: 20_000, bytes: 0, nextPart: 2, gaps: [{ startMs: 10_000, endMs: 15_000 }], limits: DEVELOPMENT_LIMITS, warning: null, language: 'zh',
};

async function fragment(channel: 'tab' | 'microphone', part: number, sequence: number, startMs: number, text: string): Promise<Fragment> {
  const blob = new Blob([text]);
  return { recordingId: manifest.id, channel, part, sequence, startMs, durationMs: 5000, bytes: blob.size, checksum: await sha256(blob), mimeType: 'audio/webm;codecs=opus', blob, acknowledged: false };
}

async function fragments() {
  return [
    await fragment('tab', 0, 1, 5000, 'b'), await fragment('tab', 0, 0, 0, 'a'),
    await fragment('microphone', 0, 0, 0, 'm'), await fragment('tab', 1, 0, 15_000, 'c'),
  ];
}

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status }); }

describe('lesson upload', () => {
  it('joins fragments per part in order and charges only recorded time', async () => {
    const parts = await partsForUpload(await fragments());
    expect(parts.map((p) => `${p.channel}-${p.part}`)).toEqual(['microphone-0', 'tab-0', 'tab-1']);
    expect(await parts[1]!.blob.text()).toBe('ab');
    expect(parts[1]!.checksum).toBe(await sha256(new Blob(['ab'])));
    expect(parts[1]!.durationMs).toBe(10_000);
    expect(recordedMs(parts)).toBe(15_000);
  });

  it('creates, uploads each part, then submits', async () => {
    const calls: string[] = [];
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(url.replace('https://api', ''));
      if (url.endsWith('/lesson-recording')) {
        const body = JSON.parse(String(init?.body));
        if (body.action === 'create') {
          expect(body.durationMs).toBe(15_000);
          expect(body.parts).toHaveLength(3);
          expect(body.parts[0].blob).toBeUndefined();
          return json({ recordingId: 'r1', uploads: body.parts.map((p: { channel: string; part: number }) => ({ channel: p.channel, part: p.part, path: `u/r1/${p.channel}-${p.part}.webm` })) });
        }
        return json({ status: 'transcribing', cost: 3, free: false });
      }
      expect((init?.headers as Record<string, string>)['x-upsert']).toBe('true');
      return json({ Key: 'ok' });
    });
    const progress = vi.fn();
    const result = await uploadRecording(manifest, await fragments(), { api: 'https://api', publishableKey: 'k', accessToken: 't', fetch: fetchFn as unknown as typeof fetch }, progress);
    expect(result).toEqual({ recordingId: 'r1', status: 'transcribing', cost: 3, free: false });
    expect(calls).toEqual([
      '/functions/v1/lesson-recording',
      '/storage/v1/object/lesson-audio/u/r1/microphone-0.webm',
      '/storage/v1/object/lesson-audio/u/r1/tab-0.webm',
      '/storage/v1/object/lesson-audio/u/r1/tab-1.webm',
      '/functions/v1/lesson-recording',
    ]);
    expect(progress).toHaveBeenLastCalledWith(3, 3);
  });

  it('reports running out of credits separately', async () => {
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/lesson-recording') && JSON.parse(String(init?.body)).action === 'submit') return json({ error: 'needs 3 credits' }, 402);
      if (url.endsWith('/lesson-recording')) return json({ recordingId: 'r1', uploads: [{ channel: 'tab', part: 0, path: 'p' }] });
      return json({});
    });
    await expect(uploadRecording(manifest, await fragments(), { api: 'https://api', publishableKey: 'k', accessToken: 't', fetch: fetchFn as unknown as typeof fetch }))
      .rejects.toBeInstanceOf(NoCreditsError);
  });
});
