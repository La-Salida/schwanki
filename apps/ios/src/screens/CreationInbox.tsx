import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, TextInput, View } from 'react-native';
import type { CandidateCardRow, CardEdits, Source, SourceSyncProgress } from '@schwanki/core';
import { Button, ErrorNotice, T, TextAction, s } from '../components/UI';
import { api, requireAccount } from '../lib/backend';
import { pendingMaterial, resumeMaterial, discardMaterial, syncMaterial, type MaterialDraft } from '../lib/creation';
import { approveWords, inboxSources, keepActiveCandidate, sourceActivity } from '../lib/inbox';
import { message } from '../lib/useLibrary';
import { colors as c } from '../theme';

export function CreationInbox({ userId, sourceId, onReview, onBusy, onCredits, locked = false }: {
  userId: string; sourceId?: string; locked?: boolean; onReview: (sourceId: string | null) => Promise<void>; onBusy: (busy: boolean) => void; onCredits: () => void;
}) {
  const [rows, setRows] = useState<CandidateCardRow[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [progress, setProgress] = useState<Record<string, SourceSyncProgress>>({});
  const [draft, setDraft] = useState<MaterialDraft | null>(null);
  const [edits, setEdits] = useState<CardEdits>({ front: '', back: '', reading: '', exampleSentence: '' });
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null), [notice, setNotice] = useState<string | null>(null);
  const alive = useRef(true), writing = useRef(false), reading = useRef(false);
  const externallyBusy = useRef(locked); externallyBusy.current = locked;
  const current = rows[0];
  const load = useCallback(async () => {
    if (reading.current || writing.current || externallyBusy.current) return;
    reading.current = true;
    try {
      await requireAccount(userId);
      const [candidates, list, live, saved] = await Promise.all([api.listPendingCandidates(), api.listSources(), api.listSyncProgress(), pendingMaterial(userId)]);
      if (!alive.current || writing.current) return;
      setRows(prev => keepActiveCandidate(sourceId ? candidates.filter(c => c.sourceId === sourceId) : candidates, prev[0]?.id));
      setSources(list); setProgress(live); setDraft(saved); setLoadError(null);
    } catch (failure) { if (alive.current) setLoadError(message(failure)); }
    finally { reading.current = false; if (alive.current) setLoading(false); }
  }, [userId, sourceId]);
  useEffect(() => {
    alive.current = true; void load();
    const timer = setInterval(() => { if (AppState.currentState === 'active') void load(); }, 5000);
    const app = AppState.addEventListener('change', state => { if (state === 'active') void load(); });
    return () => { alive.current = false; clearInterval(timer); app.remove(); };
  }, [load]);
  useEffect(() => { setEdits({ front: current?.front ?? '', back: current?.back ?? '', reading: current?.reading ?? '', exampleSentence: current?.exampleSentence ?? '' }); }, [current?.id]);
  async function perform(action: () => Promise<void>) {
    if (writing.current || locked) return;
    writing.current = true; setBusy(true); onBusy(true); setError(null);
    try { await action(); }
    catch (failure) { if (alive.current) setError(message(failure)); }
    finally { writing.current = false; if (alive.current) { setBusy(false); onBusy(false); } }
  }
  async function approve(all = false) {
    const chosen = rows.slice(0, all ? 25 : 1);
    await perform(async () => {
      const result = await approveWords(userId, chosen, edits);
      if (!alive.current) return;
      setRows(prev => prev.filter(r => !result.completed.includes(r.id)));
      setNotice(`${result.created} ${result.created === 1 ? 'word' : 'words'} added.${result.duplicates ? ` ${result.duplicates} already in your library.` : ''}`);
      if (result.error) setError(`Saved words are safe. ${result.error}`);
    });
  }
  const visibleSources = inboxSources(sources, progress, sourceId);
  return <View style={{ gap: 18 }}>
    <T style={s.title}>{loading ? 'Checking your words…' : rows.length ? `${rows.length} ${rows.length === 1 ? 'word' : 'words'} to check` : 'Your new words'}</T>
    <T style={s.muted}>Check the word and meaning before adding it to your feed. Your iPhone and the web share this inbox.</T>
    {loading && <ActivityIndicator color={c.blue} />}
    {draft && <View style={{ gap: 8 }}><T>Saved upload: {draft.source.label}</T><Button busy={busy || locked} onPress={() => { void perform(async () => { await resumeMaterial(userId, draft); setDraft(null); setNotice('Upload sent. New words will appear here.'); }); }}>Resume saved upload</Button><TextAction onPress={() => { void perform(async () => { await discardMaterial(userId, draft); setDraft(null); }); }}>Remove saved upload</TextAction></View>}
    {visibleSources.map(source => {
      const state = sourceActivity(source, progress[source.id]);
      return <View key={source.id} style={{ padding: 14, borderRadius: 12, backgroundColor: 'white', gap: 6 }}><T>{source.label}</T><T style={s.muted}>{state.detail}</T>
        {!state.working && ['pdf_upload', 'google_doc', 'google_sheet'].includes(source.type) && <TextAction onPress={() => { void perform(async () => { await syncMaterial(userId, source); setNotice('Reader started. Check back here for new words.'); }); }}>Retry reading</TextAction>}
      </View>;
    })}
    {notice && <T accessibilityLiveRegion="polite">{notice}</T>}
    {current ? <View style={{ gap: 12 }}>
      <T style={s.muted}>{sources.find(s => s.id === current.sourceId)?.label}</T>
      {(['front', 'back', 'reading', 'exampleSentence'] as const).map(field => {
        const label = { front: 'Word or phrase', back: 'Meaning', reading: 'Reading (optional)', exampleSentence: 'Example (optional)' }[field];
        return <View key={field} style={{ gap: 5 }}><T style={s.muted}>{label}</T><TextInput accessibilityLabel={label} editable={!busy && !locked} value={edits[field]} onChangeText={text => setEdits(e => ({ ...e, [field]: text }))} multiline autoCapitalize="none" style={s.input} /></View>;
      })}
      <Button busy={busy || locked} disabled={!edits.front.trim() || !edits.back.trim()} onPress={() => { void approve(); }}>Add this word</Button>
      {rows.length > 1 && <Button secondary busy={busy || locked} disabled={!edits.front.trim() || !edits.back.trim()} onPress={() => { void approve(true); }}>Add all {Math.min(rows.length, 25)} words</Button>}
      <TextAction onPress={() => { void perform(async () => { await requireAccount(userId); await api.setCandidateStatus(current.id, 'discarded'); setRows(prev => prev.filter(r => r.id !== current.id)); }); }}>Skip this word</TextAction>
    </View> : !loading && <T>{visibleSources.some(s => sourceActivity(s, progress[s.id]).working) ? 'Reading continues in the background. Start a starter set while you wait, or come back here.' : 'No words waiting for approval. Add a starter set, paste some notes, or choose your class material.'}</T>}
    <ErrorNotice>{error || loadError}</ErrorNotice>
    {(error || loadError) && <TextAction onPress={() => { void load(); }}>Check again</TextAction>}
    {(error && /credit|allowance|free.*import|balance/i.test(error) || visibleSources.some(s => /credit|allowance|free.*import|balance/i.test(s.errorDetail ?? ''))) && <TextAction onPress={() => { if (!busy && !locked) onCredits(); }}>Get credits</TextAction>}
    <TextAction onPress={() => { void perform(() => onReview(sourceId ?? null)); }}>Go to review</TextAction>
  </View>;
}
