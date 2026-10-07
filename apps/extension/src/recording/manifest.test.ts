import { describe, expect, it } from 'vitest';
import { fragmentKey, orderedParts, sha256, type Fragment } from './manifest';

const fragment = (channel: Fragment['channel'], part: number, sequence: number): Fragment => ({
  recordingId: 'class-a', channel, part, sequence, startMs: 0, durationMs: 5000,
  bytes: 1, checksum: '', mimeType: 'audio/webm', blob: new Blob(['a']), acknowledged: false,
});

describe('capture media identity', () => {
  it('orders fragments within their channel and container part', () => {
    const groups = orderedParts([fragment('tab', 0, 1), fragment('microphone', 0, 0),
      fragment('tab', 1, 0), fragment('tab', 0, 0)]);
    expect(groups.map(group => group.map(chunk => chunk.sequence))).toEqual([[0, 1], [0], [0]]);
    expect(fragmentKey({ recordingId: 'class-a', channel: 'tab', part: 1, sequence: 0 }))
      .not.toBe(fragmentKey({ recordingId: 'class-b', channel: 'tab', part: 1, sequence: 0 }));
  });
  it('rejects missing container headers, skipped fragments and mixed codecs', () => {
    expect(() => orderedParts([fragment('tab', 0, 1)])).toThrow('Missing fragment');
    expect(() => orderedParts([fragment('tab', 0, 0), fragment('tab', 0, 2)])).toThrow('Missing fragment');
    expect(() => orderedParts([fragment('tab', 0, 0),
      { ...fragment('tab', 0, 1), mimeType: 'audio/webm;codecs=opus' }])).toThrow('Container changed');
  });
  it('computes a stable SHA-256 identity for persisted media', async () => {
    expect(await sha256(new Blob(['abc'])))
      .toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
