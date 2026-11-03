import type { CandidateCardRow, CardEdits, Source, SourceSyncProgress } from '@schwanki/core';
import { api, requireAccount } from './backend';

/** A higher-confidence parse must not replace the word under someone's cursor. */
export function keepActiveCandidate(next: CandidateCardRow[], activeId?: string): CandidateCardRow[] {
  const active = next.find(row => row.id === activeId);
  return active ? [active, ...next.filter(row => row.id !== activeId)] : next;
}
export function inboxSources(sources: Source[], progress: Record<string, SourceSyncProgress>, sourceId?: string): Source[] {
  return sources.filter(source => {
    if (sourceId) return source.id === sourceId;
    const live = progress[source.id];
    const recentEmpty = live?.parseStatus === 'done' && live.wordsFound === 0 &&
      (!live.parseFinishedAt || Date.parse(live.parseFinishedAt) >= Date.now() - 86_400_000);
    return source.status !== 'active' || live?.syncing || recentEmpty || ['pending', 'running', 'failed'].includes(live?.parseStatus ?? '');
  });
}

export function sourceActivity(source: Source, progress?: SourceSyncProgress) {
  if (source.status !== 'active') return { working: false, detail: source.errorDetail || 'This material needs reconnecting.' };
  if (progress?.syncing) return { working: true, detail: 'Reading your material…' };
  if (progress?.parseStatus === 'pending' || progress?.parseStatus === 'running') return { working: true, detail: 'Finding new words… You can leave this screen.' };
  if (progress?.parseStatus === 'failed') return { working: false, detail: 'The reader stopped. Retry this material.' };
  if (progress?.parseStatus === 'done' && !progress.wordsFound) return { working: false, detail: 'No new words. They may already be in your library, or this material has no vocabulary to add.' };
  return { working: false, detail: 'Up to date. Check the words below or add more material.' };
}
export async function approveWords(userId: string, rows: CandidateCardRow[], firstEdits?: CardEdits) {
  let created = 0, duplicates = 0;
  const completed: string[] = [];
  for (const [index, original] of rows.entries()) {
    try {
      await requireAccount(userId);
      if (index === 0 && firstEdits) await api.updateCandidate(original.id, firstEdits, original.recordingId);
      const row = index === 0 && firstEdits ? { ...original, ...firstEdits } : original;
      const result = await api.approveCandidate(row);
      if (result === 'created') created++; else duplicates++;
      completed.push(row.id);
    } catch (error) { return { created, duplicates, completed, error: error instanceof Error ? error.message : 'Could not save this word. Try again.' }; }
  }
  return { created, duplicates, completed, error: null };
}
