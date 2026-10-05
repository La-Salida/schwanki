import { describe, it, expect, vi } from 'vitest';
import { SchwankiApi } from './api.ts';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CandidateCardRow } from './types.ts';

const candidate: CandidateCardRow = { id: 'candidate', sourceId: 'source', recordingId: 'class', kind: 'grammar', front: 'prompt', back: 'answer', rawContext: 'evidence', status: 'pending', confidence: 0.9, createdAt: '2026-10-05T00:00:00Z' };
describe('class approval API boundary', () => {
  it('loads the authoritative class start and label through the owner relationship', async () => {
    const row = { id: 'candidate', source_id: 'source', front: 'prompt', back: 'answer', raw_context: 'said',
      status: 'pending', confidence: 0.9, created_at: '2026-10-06T12:00:00Z', kind: 'grammar', recording_id: 'class', learning_item_id: 'item',
      class_recordings: { started_at: '2026-10-05T20:30:00Z', label: 'Evening class' } };
    const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn() };
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query);
    query.order.mockReturnValueOnce(query).mockResolvedValueOnce({ data: [row], error: null });
    const api = new SchwankiApi({ from: vi.fn().mockReturnValue(query) } as unknown as SupabaseClient);
    const [loaded] = await api.listPendingCandidates();
    expect(query.select).toHaveBeenCalledWith('*, class_recordings!candidate_recording_owner_fk(label, started_at)');
    expect(loaded).toMatchObject({ recordingId: 'class', recordingStartedAt: '2026-10-05T20:30:00Z', recordingLabel: 'Evening class', kind: 'grammar', learningItemId: 'item' });
  });
  it('uses one atomic RPC for class candidates and sends reviewed edits', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { cardId: 'card', created: false, batchId: 'class-batch' }, error: null });
    const from = vi.fn();
    const api = new SchwankiApi({ rpc, from } as unknown as SupabaseClient);
    expect(await api.approveCandidate({ ...candidate, back: 'edited answer' })).toBe('duplicate');
    expect(from).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('approve_class_candidate', { p_candidate_id: candidate.id, p_patch: { front: 'prompt', back: 'edited answer', reading: null, exampleSentence: null } });
  });
  it('propagates transactional errors and rejects malformed approval responses', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: new Error('class deleted'), data: null });
    const api = new SchwankiApi({ rpc } as unknown as SupabaseClient);
    await expect(api.approveClassCandidate(candidate)).rejects.toThrow('class deleted');
    rpc.mockResolvedValue({ error: null, data: { cardId: 'card' } });
    await expect(api.approveClassCandidate(candidate)).rejects.toThrow('Invalid class approval');
  });
});
