import { describe, expect, it } from 'vitest';
import { assertPrepared, chunkKey, mimeType, orderedPart, SPIKE_LIMITS, type Chunk, type Recording } from './manifest';

export const prepared = (id = crypto.randomUUID()): Recording => ({
  id, tabId: 1, tutor: 'Test tutor', targetLanguage: 'zh', explanationLanguage: 'en', state: 'prepared',
  consentAcknowledgedAt: '2026-10-05T00:00:00Z', preparedUntil: Date.now() + 60_000,
  limits: SPIKE_LIMITS, bytes: 0, parts: [], gaps: [],
});
describe('capture preparation and media identity', () => {
  it('rejects missing consent, expired preparation, active captures and exhausted limits', () => {
    for (const recording of [
      { ...prepared(), consentAcknowledgedAt: '' }, { ...prepared(), preparedUntil: 0 },
      { ...prepared(), state: 'recording' as const }, { ...prepared(), bytes: SPIKE_LIMITS.maxBytes },
      { ...prepared(), startedAt: Date.now() - SPIKE_LIMITS.maxDurationMs - 1 },
    ]) expect(() => assertPrepared(recording)).toThrow();
    expect(() => assertPrepared(prepared())).not.toThrow();
    expect(() => assertPrepared({ ...prepared(), state: 'interrupted' })).not.toThrow();
  });
  it('fails closed if no supported codec exists', () => {
    expect(mimeType(mime => mime === 'audio/webm')).toBe('audio/webm');
    expect(() => mimeType(() => false)).toThrow();
  });
  it('orders fragments within their own container part and detects missing headers/fragments', () => {
    const fragment = (channel: 'tab' | 'microphone', part: number, sequence: number) => ({ channel, part, sequence } as Chunk);
    const chunks = [fragment('tab', 0, 1), fragment('microphone', 0, 0), fragment('tab', 1, 0), fragment('tab', 0, 0)];
    expect(orderedPart(chunks, 'tab', 0).map(c => c.sequence)).toEqual([0, 1]);
    expect(() => orderedPart(chunks.slice(0, 3), 'tab', 0)).toThrow();
    expect(chunkKey({ recordingId: 'class-a', channel: 'tab', part: 1, sequence: 0 })).not.toBe(chunkKey({ recordingId: 'class-b', channel: 'tab', part: 1, sequence: 0 }));
  });
});
