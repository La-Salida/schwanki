import { useEffect, useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { Button, ErrorNotice, s } from '../components/UI';
import { creationLanguages, explicitPairs, starterWords, type CreationLanguage } from '../lib/creationData';
import { chooseMaterial, pendingMaterial, resumeMaterial, savePastedWords, saveWords, stageMaterial, textMaterial, type Material } from '../lib/creation';
import { message } from '../lib/useLibrary';
import { colors as c } from '../theme';
import { CreationInbox } from './CreationInbox';
import { Credits } from './Credits';
import { ImportSheet } from './ImportSheet';

type Method = 'menu' | 'starter' | 'paste' | 'photo' | 'file' | 'canva' | 'google' | 'inbox' | 'credits' | 'anki';
function Tap({ children, onPress, label, disabled = false, style }: { children: ReactNode; onPress: () => void; label: string; disabled?: boolean; style?: object }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} accessibilityState={{ disabled }} onPress={onPress}
    onPressIn={() => { if (Platform.OS !== 'web') void impactAsync(ImpactFeedbackStyle.Light).catch(() => undefined); }}
    style={({ pressed }) => [{ minHeight: 44, minWidth: 44, justifyContent: 'center' }, style, pressed && { opacity: .6 }, disabled && { opacity: .4 }]}>{children}</Pressable>;
}
export function CreateSheet({ userId, authenticating, authError, initialInbox = false, onSignIn, onClose, onReview }: {
  userId: string | null; authenticating: boolean; authError: string | null; initialInbox?: boolean;
  onSignIn: () => void; onClose: () => void; onReview: (sourceId: string | null) => Promise<void>;
}) {
  const [method, setMethod] = useState<Method>(initialInbox ? 'inbox' : 'menu');
  const [language, setLanguage] = useState<CreationLanguage>('es');
  const [text, setText] = useState(''), [label, setLabel] = useState(''), [canvaUrl, setCanvaUrl] = useState('');
  const [material, setMaterial] = useState<Material | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [tracking, setTracking] = useState<string | undefined>();
  const [saved, setSaved] = useState<{ created: number; duplicates: number; sourceId: string | null } | null>(null);
  const alive = useRef(true), working = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  // Keep the selected method through sign-in. Never launch Files or Photos on mount.
  function navigate(next: Method) { setError(null); setSaved(null); setMaterial(null); setTracking(undefined); setMethod(next); }
  async function perform(action: () => Promise<void>) {
    if (working.current) return;
    working.current = true; setBusy(true); setError(null);
    try { await action(); }
    catch (failure) { if (alive.current) setError(message(failure)); }
    finally { working.current = false; if (alive.current) setBusy(false); }
  }
  async function pick() {
    await perform(async () => { const picked = await chooseMaterial(method === 'photo'); if (picked && alive.current) { setMaterial(picked); setLabel(picked.name.replace(/\.[^.]+$/, '')); } });
  }
  async function start() {
    if (!userId) { onSignIn(); return; }
    await perform(async () => {
      if (method === 'starter') {
        const name = creationLanguages.find(([code]) => code === language)![1];
        setSaved(await saveWords(userId, language, `${name} · First words`, `starter:first-words:v1:${language}`, starterWords(language)));
      } else if (method === 'paste' && pairs) {
        setSaved(await savePastedWords(userId, language, label.trim() || 'My words', pairs));
      } else if (method === 'google') {
        const url = 'https://schwankiapp.com/sources?drive=pick';
        if (Platform.OS === 'web') await Linking.openURL(url); else await WebBrowser.openBrowserAsync(url);
        if (alive.current) { setTracking(undefined); setMethod('inbox'); }
      } else {
        if (method === 'canva' && !validCanva) throw new Error('Paste a Canva design link, then choose its exported PDF.');
        const file = method === 'paste' ? textMaterial('Pasted notes.txt', text) : material;
        if (!file) throw new Error('Choose your material first.');
        if (method === 'canva' && file.contentType !== 'application/pdf') throw new Error('Choose the PDF exported from Canva.');
        if (await pendingMaterial(userId)) throw new Error('You have a saved upload. Open Check new words to resume it first.');
        const draft = await stageMaterial(userId, language, label.trim() || file.name, file, method === 'canva' ? canvaUrl.trim() : undefined);
        // Show the resumable inbox even when upload or sync fails.
        setTracking(draft.source.id); setMethod('inbox');
        await resumeMaterial(userId, draft);
      }
    });
  }
  const pairs = explicitPairs(text);
  const words = starterWords(language);
  let validCanva = false;
  try { const url = new URL(canvaUrl.trim()); validCanva = url.protocol === 'https:' && /^(www\.)?canva\.com$/i.test(url.hostname) && url.pathname.startsWith('/design/'); } catch { /* incomplete field */ }
  const titles: Record<Method, string> = { menu: 'Add your words', starter: 'Start with a few words', paste: 'Paste words or notes', photo: 'Photos & screenshots', file: 'Class files', canva: 'Canva notes', google: 'Google Docs & Sheets', inbox: 'Check new words', credits: 'Credits', anki: 'Bring an Anki deck' };
  const choices: Array<[Method | 'anki', string, string, keyof typeof Feather.glyphMap]> = [
    ['starter', 'Try a starter set', '10 useful words · free', 'sunrise'],
    ['paste', 'Paste words or notes', 'A word list, class notes or copied text', 'clipboard'],
    ['photo', 'Photos & screenshots', 'Your notebook, slides or class screen', 'image'],
    ['file', 'PDF or PowerPoint', 'Choose from Files · .pdf or .pptx', 'file-text'],
    ['google', 'Google Docs & Sheets', 'Choose securely with Google', 'file'],
    ['canva', 'Canva notes', 'Bring an exported PDF from Canva', 'layout'],
    ['anki', 'Import an Anki deck', 'Keep your cards, media and progress', 'download'],
  ];
  const disabled = method === 'paste' ? !text.trim() : ['photo', 'file', 'canva'].includes(method) ? !material || method === 'canva' && !validCanva : false;
  const action = saved ? 'Start review' : !userId ? 'Continue with Google' : method === 'starter' ? 'Add 10 words' : method === 'paste' && pairs ? `Add ${pairs.length} ${pairs.length === 1 ? 'word' : 'words'}` : method === 'google' ? 'Choose with Google' : 'Find my words';
  return <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={busy || authenticating ? undefined : onClose}>
    <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: c.paper }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          {method !== 'menu' && <Tap label="Back to ways to add words" disabled={busy || authenticating} onPress={() => navigate(method === 'credits' ? 'inbox' : 'menu')}><Feather name="chevron-left" size={24} color={c.blue} /></Tap>}
          <Text accessibilityRole="header" style={styles.title}>{titles[method]}</Text>
          <Tap label="Close add words" disabled={busy || authenticating} onPress={onClose}><Feather name="x" size={23} color={c.muted} /></Tap>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={styles.body}>
          {method === 'menu' ? <>
            <Text style={styles.intro}>Start small.{ '\n' }Make it yours.</Text><Text style={styles.detail}>Try a ready-made set, or turn something you’re learning into your next session.</Text>
            {choices.map(([value, title, subtitle, icon], index) => <Tap key={value} label={title} disabled={busy || authenticating} onPress={() => { if (value === 'anki') { navigate('anki'); } else navigate(value); }} style={[styles.row, index === 0 && styles.starter]}>
              <Feather name={icon} size={24} color={c.blue} /><View style={{ flex: 1, gap: 3 }}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.caption}>{subtitle}</Text></View><Feather name="chevron-right" size={20} color={c.muted} />
            </Tap>)}
            <Tap label="Check new words" onPress={() => navigate('inbox')} style={styles.row}><Text style={[styles.rowTitle, { color: c.blue }]}>Check new words</Text><Feather name="chevron-right" size={20} color={c.blue} /></Tap>
          </> : method === 'inbox' ? userId ? <CreationInbox key={tracking ?? 'all'} userId={userId} sourceId={tracking} locked={busy} onReview={onReview} onBusy={setBusy} onCredits={() => setMethod('credits')} /> : <><Text style={styles.detail}>Sign in to check words from your materials. They stay in this inbox until you add or skip them.</Text><Button busy={authenticating} onPress={onSignIn}>Continue with Google</Button></>
          : method === 'credits' && userId ? <Credits embedded userId={userId} onBusy={setBusy} onClose={() => setMethod('inbox')} />
          : method === 'anki' ? userId ? <ImportSheet embedded userId={userId} onBusy={setBusy} onImported={() => undefined} onClose={() => { void onReview(null); }} /> : <><Text style={styles.detail}>Bring an .apkg or .colpkg export with its pictures, sound and learning progress.</Text><Button busy={authenticating} onPress={onSignIn}>Continue with Google</Button></>
          : saved ? <><Text style={styles.intro}>{saved.created ? `${saved.created} ${saved.created === 1 ? 'word' : 'words'} ready.` : 'Already in your library.'}</Text><Text style={styles.detail}>{saved.duplicates ? `${saved.duplicates} words were already in your library and kept their learning progress. ` : ''}Your cards are saved to your account. Start your session below.</Text></>
          : <>
            {method !== 'google' && <><Text style={styles.rowTitle}>Language you’re learning</Text><View style={styles.languages}>{creationLanguages.map(([code, name]) => <Tap key={code} label={name} disabled={busy || authenticating} onPress={() => setLanguage(code)} style={[styles.language, language === code && { backgroundColor: '#EEF2FF', borderColor: c.blue }]}><Text style={styles.languageText}>{language === code ? '✓ ' : ''}{name}</Text></Tap>)}</View></>}
            {method === 'starter' ? <><Text style={styles.detail}>First words for everyday life. Free to add, with English meanings{language === 'en' ? ' and definitions' : ''}. Pictures and audio are optional.</Text>{words.map(w => <View key={w.front} style={styles.word}><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{w.front}</Text>{w.reading && <Text style={styles.caption}>{w.reading}</Text>}</View><Text style={[styles.detail, { flex: 1 }]}>{w.back}</Text></View>)}</>
              : method === 'google' ? <><Text style={styles.detail}>Google’s secure chooser opens in your browser. Use the same Schwanki account, choose a Doc or Sheet, and save it there.</Text><Text style={styles.detail}>Return here to check the new words and start reviewing. Only files you choose are shared with Schwanki.</Text><Text style={styles.caption}>Prefer to stay here? Copy text from your document and use Paste words or notes.</Text></>
              : <>
                <Text style={styles.rowTitle}>Deck name (optional)</Text><TextInput accessibilityLabel="Deck name" editable={!busy} value={label} onChangeText={setLabel} placeholder="e.g. Tuesday’s class" style={s.input} maxLength={150} />
                {method === 'paste' ? <><Text style={styles.detail}>Paste pairs like “hola — hello”, one per line. Or paste class notes and check the words we find.</Text><TextInput accessibilityLabel="Words or notes" editable={!busy} multiline textAlignVertical="top" autoCapitalize="none" value={text} onChangeText={setText} placeholder={'hola — hello\ngracias — thank you'} style={[s.input, { minHeight: 180 }]} maxLength={100_000} />
                  <Text style={styles.caption}>{pairs ? `${pairs.length} word–meaning pairs ready. Free to add.` : 'Notes use your daily free import allowance, then credits. You check extracted words before they enter your feed.'}</Text></>
                  : <><Text style={styles.detail}>{method === 'photo' ? 'Choose a notebook photo, class screenshot or slide. We’ll find the words for you to check.' : method === 'canva' ? 'In Canva, share your design as a PDF and save it to Files. Paste its link below, then choose that PDF.' : 'Bring a PDF or PowerPoint from class. Slide text is read on your phone before upload.'}</Text>
                    {method === 'canva' && <TextInput accessibilityLabel="Canva design link" editable={!busy} value={canvaUrl} onChangeText={setCanvaUrl} autoCapitalize="none" keyboardType="url" placeholder="https://www.canva.com/design/…" style={s.input} />}
                    <Button secondary busy={busy} onPress={() => { void pick(); }}>{material ? 'Choose a different file' : method === 'photo' ? 'Choose photos or screenshots' : method === 'canva' ? 'Choose exported Canva PDF' : 'Choose class file'}</Button>
                    {material && <Text style={styles.rowTitle}>{material.name}</Text>}<Text style={styles.caption}>{method === 'photo' || material?.contentType === 'image/jpeg' ? 'Reading a picture uses 1 credit. ' : ''}Text imports use your daily free allowance, then credits. You approve the words before studying.</Text>
                  </>}
              </>}
          </>}
          <ErrorNotice>{error || authError}</ErrorNotice>
          {error && /saved upload|upload|reader|respond/i.test(error) && <Button secondary onPress={() => navigate('inbox')}>Check new words</Button>}
        </ScrollView>
        {method !== 'menu' && method !== 'inbox' && method !== 'anki' && method !== 'credits' && <View style={styles.dock}><Button busy={busy || authenticating} disabled={!saved && disabled} onPress={() => { void (saved ? perform(() => onReview(saved.sourceId)) : start()); }}>{action}</Button></View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}
const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line },
  title: { flex: 1, fontSize: 20, fontWeight: '600', color: c.ink },
  body: { padding: 24, gap: 18, paddingBottom: 32, maxWidth: 560, width: '100%', alignSelf: 'center' },
  intro: { fontSize: 32, lineHeight: 36, fontWeight: '700', letterSpacing: -.8, color: c.ink },
  detail: { fontSize: 17, lineHeight: 24, color: c.muted },
  caption: { fontSize: 14, lineHeight: 20, color: c.muted },
  rowTitle: { fontSize: 17, lineHeight: 24, fontWeight: '600', color: c.ink },
  row: { flexDirection: 'row', gap: 14, alignItems: 'center', paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.line },
  starter: { padding: 16, backgroundColor: '#EEF2FF', borderRadius: 16, borderBottomWidth: 0 },
  languages: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  language: { paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderRadius: 12, borderColor: c.line },
  languageText: { fontSize: 16, color: c.ink },
  word: { flexDirection: 'row', gap: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line },
  dock: { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 10, backgroundColor: c.paper, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
});
