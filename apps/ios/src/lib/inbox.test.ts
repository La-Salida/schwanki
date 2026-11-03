import { beforeEach, expect, it, vi } from 'vitest';
import type { CandidateCardRow, Source } from '@schwanki/core';
const backend = vi.hoisted(() => ({ api: { updateCandidate: vi.fn(), approveCandidate: vi.fn() }, requireAccount: vi.fn() }));
vi.mock('./backend', () => backend);
import { approveWords, sourceActivity } from './inbox';
const row = (id: string) => ({ id, sourceId: 'source', front: 'hola', back: 'hello', status: 'pending' } as CandidateCardRow);
beforeEach(() => { vi.resetAllMocks(); backend.requireAccount.mockResolvedValue(undefined); });
it('preserves the current edits and reports completed words when a later approval fails', async () => {
  backend.api.approveCandidate.mockResolvedValueOnce('created').mockRejectedValueOnce(new Error('offline'));
  const edits = { front: '你好', back: 'hello', reading: 'nǐ hǎo', exampleSentence: '' };
  const result = await approveWords('owner', [row('1'), row('2'), row('3')], edits);
  expect(backend.api.approveCandidate).toHaveBeenNthCalledWith(1, expect.objectContaining(edits));
  expect(result).toEqual({ created: 1, duplicates: 0, completed: ['1'], error: 'offline' });
  expect(backend.api.approveCandidate).toHaveBeenCalledTimes(2);
});
it('stops before any write if the account changes', async () => {
  backend.requireAccount.mockRejectedValue(new Error('different account'));
  expect((await approveWords('owner', [row('1')])).completed).toEqual([]);
  expect(backend.api.approveCandidate).not.toHaveBeenCalled();
});
it('counts duplicates separately without resetting existing cards', async () => {
  backend.api.approveCandidate.mockResolvedValueOnce('duplicate').mockResolvedValueOnce('created');
  expect(await approveWords('owner', [row('1'), row('2')])).toMatchObject({ created: 1, duplicates: 1, completed: ['1', '2'], error: null });
});
it('finishes empty and failed parses instead of showing an endless loader', () => {
  const source = { id: 'source', status: 'active' } as Source;
  expect(sourceActivity(source, { sourceId: source.id, syncing: false, parseStatus: 'done', wordsFound: 0 })).toMatchObject({ working: false, detail: expect.stringContaining('No new words') });
  expect(sourceActivity(source, { sourceId: source.id, syncing: false, parseStatus: 'failed' }).working).toBe(false);
  expect(sourceActivity({ ...source, status: 'error', errorDetail: 'No credits' }).detail).toBe('No credits');
  expect(sourceActivity(source, { sourceId: source.id, syncing: false, parseStatus: 'pending' }).working).toBe(true);
});
