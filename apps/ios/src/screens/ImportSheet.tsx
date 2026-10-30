import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Button, ErrorNotice, Sheet, T, TextAction, s } from '../components/UI';
import { chooseImport, resumeImport, runImport, type OpenedImport, type ImportProgress, type ImportResult } from '../lib/importer';
import { message } from '../lib/useLibrary';
import { colors as c, fonts } from '../theme';
const languages = [['es', 'Spanish'], ['zh', 'Chinese'], ['ja', 'Japanese'], ['th', 'Thai'], ['fr', 'French'], ['de', 'German'], ['en', 'English'], ['ko', 'Korean'], ['ru', 'Russian'], ['it', 'Italian'], ['pt', 'Portuguese'], ['ar', 'Arabic'], ['vi', 'Vietnamese']] as const;
export function ImportSheet({ userId, onClose, onImported }: { userId: string; onClose: () => void; onImported: () => void }) {
  const [opened, setOpened] = useState<OpenedImport | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    void (async () => {
      try { const pending = await resumeImport(userId); if (mounted.current) { setOpened(pending); if (!pending) await choose(); } }
      catch (failure) { if (mounted.current) setError(message(failure)); }
      finally { if (mounted.current) setBusy(false); }
    })();
    return () => { mounted.current = false; };
  }, [userId]);
  async function choose() {
    setBusy(true); setError(null); setResult(null);
    try { const next = await chooseImport(userId); if (mounted.current && next) setOpened(next); }
    catch (failure) { if (mounted.current) setError(message(failure)); }
    finally { if (mounted.current) setBusy(false); }
  }
  async function start() {
    if (!opened || busy) return;
    setBusy(true); setError(null);
    try { const imported = await runImport(userId, opened, p => { if (mounted.current) setProgress(p); }); if (mounted.current) setResult(imported); onImported(); }
    catch (failure) { if (mounted.current) setError(`Import paused. Completed cards are safe. ${message(failure)}`); }
    finally { if (mounted.current) { setBusy(false); setProgress(null); } }
  }
  const total = opened?.plan.decks.filter(d => opened.job.selected.includes(d.name)).reduce((n, d) => n + d.cards.length, 0) ?? 0;
  const locked = Boolean(opened && Object.keys(opened.job.mapped).length);
  return <Sheet title={result ? 'Your deck is ready' : progress ? 'Importing' : 'Bring an Anki deck'} visible onClose={onClose} busy={busy}>
    {progress ? <View style={{ gap: 20 }}><T style={s.headline}>Moving your words in.</T><T>{progress.deck}</T><View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: progress.total, now: progress.done }} style={{ height: 6, backgroundColor: c.line, borderRadius: 3 }}><View style={{ height: 6, borderRadius: 3, backgroundColor: c.blue, width: `${progress.total ? progress.done / progress.total * 100 : 0}%` }} /></View><T>{progress.phase === 'cards' ? 'Cards' : 'Pictures and audio'}: {progress.done} of {progress.total}</T><T style={s.muted}>Keep Schwanki open. If this stops, you can resume the import without losing completed cards.</T></View>
      : result ? <View style={{ gap: 18 }}>
        <T style={s.headline}>{result.cards} cards ready.</T><T>{result.duplicates ? `${result.duplicates} words already exist in other decks and were skipped. ` : ''}Your learning progress is kept.</T>
        {result.mediaFailed > 0 && <><ErrorNotice>{result.mediaFailed} pictures or audio files could not be copied. Text cards still work.</ErrorNotice><Button secondary onPress={() => { void start(); }}>Retry missing media</Button></>}
        <Button onPress={onClose}>Go to review</Button><T style={s.muted}>If nothing is due, your cards will appear when their schedule says it is time.</T>
      </View> : opened ? <View style={{ gap: 20 }}>
        <T style={s.title}>Check your import</T><T style={s.muted}>{opened.job.name}</T>
        {opened.plan.decks.map(deck => <Pressable key={deck.name} accessibilityRole="checkbox" accessibilityState={{ checked: opened.job.selected.includes(deck.name), disabled: locked }} disabled={locked} onPress={() => setOpened({ ...opened, job: { ...opened.job, selected: opened.job.selected.includes(deck.name) ? opened.job.selected.filter(n => n !== deck.name) : [...opened.job.selected, deck.name] } })} style={s.row}>
          <T style={{ flex: 1, fontFamily: fonts.bold }}>{opened.job.selected.includes(deck.name) ? '✓ ' : ''}{deck.name}</T><T style={s.muted}>{deck.cards.length} cards</T>
        </Pressable>)}
        <T style={{ fontFamily: fonts.bold }}>Language you’re learning</T>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>{languages.map(([code, label]) => <Pressable key={code} accessibilityRole="radio" accessibilityState={{ checked: opened.job.language === code, disabled: locked }} disabled={locked} onPress={() => setOpened({ ...opened, job: { ...opened.job, language: code } })} style={{ minHeight: 44, padding: 11, borderRadius: 8, borderWidth: 1, borderColor: opened.job.language === code ? c.blue : c.line, backgroundColor: opened.job.language === code ? '#EEF2FF' : 'white' }}><T style={{ fontSize: 15 }}>{label}</T></Pressable>)}</View>
        <T style={s.muted}>{opened.plan.skipped} notes without usable text and {opened.plan.suspended} suspended cards are left out. Select one language per import; bring other languages separately.</T>
        <T style={s.muted}>A one-time transfer. Reviews sync between Schwanki on iPhone and the web, not back to Anki.</T>
        <Button disabled={!total || !opened.job.language} busy={busy} onPress={() => { void start(); }}>{locked ? 'Resume import' : `Import ${total} cards`}</Button>
        <TextAction onPress={() => { void choose(); }}>Choose another file</TextAction>
      </View> : <><T>Choose an .apkg or .colpkg export from Files. Your cards go straight into the deck.</T><Button busy={busy} onPress={() => { void choose(); }}>Choose Anki file</Button></>}
    <ErrorNotice>{error}</ErrorNotice>{busy && !progress && <ActivityIndicator color={c.blue} />}
  </Sheet>;
}
