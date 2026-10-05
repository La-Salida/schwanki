import {describe,expect,it,vi} from 'vitest';
import {SchwankiApi} from './api.ts';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {CandidateCardRow} from './types.ts';
const candidate:CandidateCardRow={id:'candidate',sourceId:'source',recordingId:'recording',learningItemId:'item',kind:'grammar',front:'Complete the phrase',back:'Answer',rawContext:'evidence',status:'pending',confidence:.9,createdAt:'2026-10-05T00:00:00Z'};
describe('class candidates use the shared transactional approval',()=>{
 it('persists learner edits before approving and links duplicates instead of discarding them',async()=>{
  const rpc=vi.fn().mockResolvedValueOnce({error:null}).mockResolvedValueOnce({data:{cardId:'existing',created:false,batchId:'batch'},error:null});
  const api=new SchwankiApi({rpc} as unknown as SupabaseClient);
  expect(await api.approveCandidate(candidate)).toBe('duplicate');
  expect(rpc.mock.calls).toEqual([['edit_class_candidate',{p_candidate_id:'candidate',p_front:'Complete the phrase',p_back:'Answer',p_reading:null}],['approve_class_candidate',{p_candidate_id:'candidate'}]]);
 });
 it('does not approve when saving the learner edit fails',async()=>{
  const rpc=vi.fn().mockResolvedValue({error:new Error('save failed')});const api=new SchwankiApi({rpc} as unknown as SupabaseClient);
  await expect(api.approveCandidate(candidate)).rejects.toThrow('save failed');expect(rpc).toHaveBeenCalledTimes(1);
 });
});
