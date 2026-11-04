import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, Linking, Platform, Pressable, TextInput, View, type ImageSourcePropType } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Archivo_500Medium } from '@expo-google-fonts/archivo/500Medium';
import { Archivo_700Bold } from '@expo-google-fonts/archivo/700Bold';
import { Archivo_900Black } from '@expo-google-fonts/archivo/900Black';
import { Entry } from './screens/Entry';
import { Feed } from './screens/Feed';
import { CreateSheet } from './screens/CreateSheet';
import { Settings } from './screens/Settings';
import { Finish } from './screens/Finish';
import { Goose } from './components/Goose';
import { RatingBurst, type Burst } from './components/RatingBurst';
import { FeedGhost, type Ghost } from './components/FeedGhost';
import { afterRating, freshStats, isMilestone, knewIt } from './lib/feedback';
import { hapticFor, playSfx } from './lib/sfx';
import { Button, ErrorNotice, Page, Sheet, T, TextAction, s } from './components/UI';
import { configured, api, supabase, offlineAccount, rememberAccount, type OfflineAccount } from './lib/backend';
import { signIn } from './lib/auth';
import { useLibrary, message } from './lib/useLibrary';
import { getStore } from './lib/nativeStore';
import { loadMedia } from './lib/media';
import { DEMO_CARDS, demoDue } from './lib/demo';
import { setReminder } from './lib/reminders';
import { syncPurchaseIdentity } from './lib/purchases';
import type { CachedMedia } from './lib/storage';
import type { ReviewRating } from '@schwanki/core';
import { colors as c, fonts } from './theme';

export default function App() {
  return <SafeAreaProvider><Schwanki /></SafeAreaProvider>;
}
function Schwanki() {
  const [fontsReady, fontError] = useFonts({ Archivo_500Medium, Archivo_700Bold, Archivo_900Black });
  const [user, setUser] = useState<OfflineAccount | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'decks' | 'settings' | 'web' | 'create' | 'inbox' | 'reminder' | null>(null);
  const afterDismiss = useRef<'create' | 'inbox' | null>(null);
  const [muted, setMuted] = useState(false);
  const [demoIndex, setDemoIndex] = useState<number | null>(null);
  const [media, setMedia] = useState<CachedMedia>({});
  const [pendingWords, setPendingWords] = useState(0);
  const [reviewed, setReviewed] = useState(0);
  const [stats, setStats] = useState(freshStats);
  const [burst, setBurst] = useState<Burst | null>(null);
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [reminderOffer, setReminderOffer] = useState(false);
  const [reminderHour, setReminderHour] = useState('19');
  const [reminderMinute, setReminderMinute] = useState('00');
  const intent = useRef<'create' | 'review'>('review');
  const library = useLibrary(user?.id ?? null);
  const current = library.queue[0];
  // One beat of feedback per rating: the card flies off, confetti or the stamp, a chime and a tap.
  function feedback(rating: ReviewRating, card: { front: string; back: string }, image: ImageSourcePropType | undefined) {
    const knew = knewIt(rating);
    const next = afterRating(stats, rating);
    setStats(next);
    setBurst(b => ({ id: (b?.id ?? 0) + 1, knew, run: next.run }));
    setGhost(g => ({ id: (g?.id ?? 0) + 1, word: card.front, meaning: card.back, image, side: knew ? 'good' : 'again' }));
    const milestone = knew && isMilestone(next.run);
    playSfx(knew ? (milestone ? 'milestone' : 'knew') : 'forgot', muted);
    hapticFor(knew ? (milestone ? 'milestone' : 'knew') : 'forgot');
  }
  useEffect(() => {
    if (authReady) void syncPurchaseIdentity(user?.id ?? null).catch(() => {
      console.warn('Billing could not connect. Studying remains available.');
    });
  }, [authReady, user?.id]);
  useEffect(() => {
    let alive = true;
    let version = 0;
    let identityWrites: Promise<void> = Promise.resolve();
    const accept = (account: OfflineAccount | null, at: number) => {
      const next = identityWrites.then(async () => {
        if (!alive || version !== at) return;
        if (account) await rememberAccount(account);
        const fallback = account ?? await offlineAccount();
        if (alive && version === at) { setUser(fallback); setAuthReady(true); }
      });
      identityWrites = next.catch(() => undefined);
      return next;
    };
    const startVersion = version;
    void supabase.auth.getSession().then(({ data }) => accept(data.session?.user ?? null, startVersion)).catch(async () => {
      const cached = await offlineAccount().catch(() => null);
      if (alive && version === startVersion) { setUser(cached); setAuthReady(true); }
    });
    const listener = supabase.auth.onAuthStateChange((_event, session) => {
      const at = ++version;
      // Do not await Supabase work inside its auth callback lock.
      void accept(session?.user ?? null, at).catch(f => { if (alive) { setError(message(f)); setAuthReady(true); } });
    });
    const app = AppState.addEventListener('change', state => { if (state === 'active') supabase.auth.startAutoRefresh(); else supabase.auth.stopAutoRefresh(); });
    supabase.auth.startAutoRefresh();
    return () => { alive = false; listener.data.subscription.unsubscribe(); app.remove(); supabase.auth.stopAutoRefresh(); };
  }, []);
  useEffect(() => {
    let live = true;
    setReviewed(0); setStats(freshStats()); setPendingWords(0); setMuted(false);
    if (!user) { setSheet(null); return; }
    if (intent.current === 'create') { intent.current = 'review'; setSheet(current => current === 'inbox' ? 'inbox' : 'create'); }
    void getStore().then(async store => { const value = await store.get<boolean>(user.id, 'muted'); if (live) setMuted(value ?? false); }).catch(f => { if (live) setError(message(f)); });
    return () => { live = false; };
  }, [user?.id]);
  useEffect(() => {
    if (!user) return;
    let live = true;
    const refresh = () => { void api.listPendingCandidates().then(rows => { if (live) setPendingWords(rows.length); }).catch(() => undefined); };
    refresh();
    const app = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { live = false; app.remove(); };
  }, [user?.id, sheet]);
  useEffect(() => {
    let live = true; setMedia({});
    if (user && current) void loadMedia(user.id, current.card.id, library.online, library.queue.map(d => d.card.id)).then(m => { if (live) setMedia(m); }).catch(() => undefined);
    return () => { live = false; };
  }, [user?.id, current?.card.id, library.online]);
  async function authenticate(next: 'create' | 'review') {
    intent.current = next; setBusy(true); setError(null);
    try { if (!configured) throw new Error('Sign-in is not available in this build. Try the sample feed while it is being connected.'); const signedIn = await signIn(); if (!signedIn) intent.current = 'review'; }
    catch (failure) { setError(message(failure)); intent.current = 'review'; }
    finally { setBusy(false); }
  }
  function openCreation(next: 'create' | 'inbox') {
    setDemoIndex(null);
    if (sheet === 'decks' && Platform.OS !== 'web') { afterDismiss.current = next; setSheet(null); }
    else setSheet(next);
  }
  function openImport() { openCreation('create'); }
  function openInbox() { openCreation('inbox'); }
  async function reviewCreated(sourceId: string | null) { await library.selectDeck(sourceId); setSheet(null); }
  async function toggleMute() {
    const next = !muted;
    setMuted(next);
    if (user) await (await getStore()).set(user.id, 'muted', next);
  }
  function openWeb() { setSheet('web'); }
  const demo = demoIndex !== null ? DEMO_CARDS[demoIndex] : null;
  const demoFinished = demoIndex !== null && !demo;
  if ((!fontsReady && !fontError) || !authReady) return <View style={{ flex: 1, backgroundColor: c.paper, justifyContent: 'center' }}><ActivityIndicator color={c.blue} accessibilityLabel="Loading Schwanki" /></View>;
  if (fontError) return <Page><T style={s.title}>Could not load the app fonts.</T><T>Close and reopen Schwanki to try again.</T></Page>;
  const feeding = Boolean(demo || (current && demoIndex === null));
  return <>
    <StatusBar style={feeding ? 'light' : 'dark'} />
    {demo ? <View style={{ flex: 1 }}><Feed key={demo.id} item={demoDue[demoIndex!]!} demoImage={demo.image} demoAudio={demo.audio} sample={{ index: demoIndex!, total: DEMO_CARDS.length }} media={{ translation: demo.translation }} progress={demoIndex! / DEMO_CARDS.length} muted={muted} offline={false} pending={0} active={!sheet} run={stats.run} onMute={() => { void toggleMute().catch(f => setError(message(f))); }} onRate={async rating => { feedback(rating, demoDue[demoIndex!]!.card, demo.image); setDemoIndex(n => (n ?? 0) + 1); return true; }} onExitSample={() => setDemoIndex(null)} onDecks={() => undefined} onSettings={() => undefined} />
        {ghost && <FeedGhost key={ghost.id} ghost={ghost} onDone={() => setGhost(g => (g?.id === ghost.id ? null : g))} />}
        <RatingBurst burst={burst} />
      </View>
      : demoFinished ? <Finish stats={stats} userId={null} online={false} muted={muted}><T>Three sample cards. Your words can feel like this too.</T><Button onPress={openImport}>Add my words</Button><TextAction onPress={openWeb}>More tools on the web</TextAction><TextAction onPress={() => { setDemoIndex(null); setStats(freshStats()); }}>Back</TextAction></Finish>
      : user && !library.loaded ? <Page><ActivityIndicator color={c.blue} /><T>Loading your words…</T><ErrorNotice>{library.error}</ErrorNotice></Page>
      : current ? <View style={{ flex: 1 }}><Feed key={`${current.card.id}:${library.appearance}`} item={current} run={stats.run} deckLabel={library.sources.find(s => s.id === library.filter)?.label} media={media} progress={reviewed / Math.max(1, reviewed + library.queue.length)} muted={muted} offline={!library.online} pending={library.pending} active={!sheet} onMute={() => { void toggleMute().catch(f => setError(message(f))); }} onRate={async (rating, elapsed) => {
        const saved = await library.rate(rating, elapsed);
        if (saved) {
          feedback(rating, current.card, media.image ? { uri: media.image } : undefined);
          setReviewed(n => n + 1);
          if (user && !(await (await getStore()).get(user.id, 'reminderOffered'))) setReminderOffer(true);
        }
        return saved;
      }} onDecks={() => setSheet('decks')} onSettings={() => setSheet('settings')} onExitSample={() => undefined} />
        {ghost && <FeedGhost key={ghost.id} ghost={ghost} onDone={() => setGhost(g => (g?.id === ghost.id ? null : g))} />}
        <RatingBurst burst={burst} />
      </View>
      : user && reviewed > 0 && library.caughtUp && !library.refreshing ? <Finish stats={stats} userId={user.id} online={library.online} muted={muted}>
        {reminderOffer && <><Button secondary onPress={() => setSheet('reminder')}>Remind me tomorrow</Button><TextAction onPress={() => { setReminderOffer(false); void getStore().then(store => store.set(user.id, 'reminderOffered', true)); }}>Not now</TextAction></>}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><TextAction onPress={() => setSheet('decks')}>Choose deck</TextAction><TextAction onPress={openImport}>Add more words</TextAction></View>
        <ErrorNotice>{library.error}</ErrorNotice>
        {library.pending > 0 && <T style={s.muted}>{library.pending} ratings saved on this iPhone.</T>}
      </Finish>
      : user && (library.cards.length > 0 || library.sources.length > 0) ? <Page>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><TextAction onPress={() => setSheet('decks')}>Choose deck</TextAction><TextAction onPress={() => setSheet('settings')}>Settings</TextAction></View>
        {library.caughtUp ? <Goose mood="sleep" size={130} style={{ alignSelf: 'center' }} /> : <Image accessible={false} source={require('../assets/goose.png')} style={{ width: 130, height: 130, alignSelf: 'center' }} resizeMode="contain" />}
        <T style={s.headline}>{library.refreshing ? 'Checking your words…' : library.caughtUp ? 'Nothing due right now.' : library.online ? 'That’s this session.' : 'That’s everything saved here.'}</T>
        <T>{library.caughtUp ? reviewed ? 'That’s the feed. You out-scrolled your due cards.' : 'Your words will appear when they’re due.' : 'Connect and refresh to check for more due cards. Your saved ratings stay on this iPhone until they sync.'}</T>
        <ErrorNotice>{library.error}</ErrorNotice>
        {library.pending > 0 && <T style={s.muted}>{library.pending} ratings saved on this iPhone.</T>}
        <Button busy={library.refreshing} onPress={() => { void library.refresh(true); }}>{library.online ? 'Check for more cards' : 'Try connection again'}</Button>
        {reminderOffer && user && <><Button secondary onPress={() => setSheet('reminder')}>Remind me tomorrow</Button><TextAction onPress={() => { setReminderOffer(false); void getStore().then(store => store.set(user.id, 'reminderOffered', true)); }}>Not now</TextAction></>}
        <TextAction onPress={openImport}>Add more words</TextAction><TextAction onPress={openInbox}>Check new words</TextAction>
      </Page> : <Entry signedIn={Boolean(user)} busy={busy} error={error || library.error} pendingWords={pendingWords} onImport={openImport} onSignIn={() => { void authenticate('review'); }} onSample={() => { setSheet(null); setStats(freshStats()); setDemoIndex(0); }} onWeb={openImport} onInbox={openInbox} onSettings={() => setSheet('settings')} />}
    {(sheet === 'create' || sheet === 'inbox') && <CreateSheet userId={user?.id ?? null} authenticating={busy} authError={error} initialInbox={sheet === 'inbox'} onSignIn={() => { void authenticate('create'); }} onClose={() => { setSheet(null); void library.refresh(true); }} onReview={reviewCreated} />}
    {sheet === 'settings' && user && <Settings userId={user.id} email={user.email ?? 'Your Schwanki account'} pending={library.pending} syncError={library.syncError} muted={muted} onMute={() => { void toggleMute().catch(f => setError(message(f))); }} onClose={() => setSheet(null)} onSync={library.flush} onWeb={openWeb} onSettingsChange={() => { void library.refresh(true); }} />}
    <Sheet title="Choose a deck" visible={sheet === 'decks'} onClose={() => setSheet(null)} onDismiss={() => { const next = afterDismiss.current; afterDismiss.current = null; if (next) setSheet(next); }}>
      <Pressable accessibilityRole="button" onPress={() => { void library.selectDeck(null); setSheet(null); }} style={s.row}><T style={{ fontFamily: fonts.bold }}>{library.filter === null ? '✓ ' : ''}All decks</T></Pressable>
      {library.sources.map(source => <Pressable key={source.id} accessibilityRole="button" onPress={() => { void library.selectDeck(source.id); setSheet(null); }} style={s.row}><View style={{ flex: 1 }}><T style={{ fontFamily: fonts.bold }}>{source.id === library.filter ? '✓ ' : ''}{source.label}</T><T style={s.muted}>{source.language}</T></View><T style={s.muted}>{library.cards.filter(card => card.card.sourceId === source.id && (!card.state || card.state.dueAt <= new Date().toISOString())).length} saved due</T></Pressable>)}
      <TextAction onPress={openInbox}>{pendingWords ? `Check ${pendingWords} new words` : 'Check new words'}</TextAction><T style={s.muted}>Counts are for cards saved on this iPhone.</T><Button secondary onPress={openImport}>Add your words</Button>
    </Sheet>
    <Sheet title="Schwanki on the web" visible={sheet === 'web'} onClose={() => setSheet(null)}>
      <T style={s.headline}>Same words.{ '\n' }More tools.</T><T>Bring class notes, Docs, Sheets, PDFs and screenshots. Check your new words, edit cards and create memorable images, audio and examples.</T>
      <T style={s.muted}>{user?.email ? `Use ${user.email} in your browser too. You may need to sign in there separately.` : 'Create or sign in to one Schwanki account on the web, then use the same account here.'}</T>
      <Button onPress={() => { void Linking.openURL('https://schwankiapp.com/sources').catch(f => setError(message(f))); }}>Open schwankiapp.com</Button><T style={s.muted}>Create there. Review here. Your cards and reviews sync when you’re online.</T>
    </Sheet>
    <Sheet title="Daily reminder" visible={sheet === 'reminder'} onClose={() => setSheet(null)}>
      <T style={s.headline}>A little nudge?</T><T>Pick a time. The goose will remind you once a day.</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><TextInput accessibilityLabel="Reminder hour, 0 to 23" value={reminderHour} onChangeText={setReminderHour} keyboardType="number-pad" maxLength={2} style={[s.input, { width: 80 }]} /><T>:</T><TextInput accessibilityLabel="Reminder minute" value={reminderMinute} onChangeText={setReminderMinute} keyboardType="number-pad" maxLength={2} style={[s.input, { width: 80 }]} /></View>
      <Button busy={busy} onPress={() => { if (!user) return; setBusy(true); setError(null); void (async () => {
        await setReminder(user.id, Number(reminderHour), Number(reminderMinute)); await (await getStore()).set(user.id, 'reminderOffered', true); setReminderOffer(false); setSheet(null);
      })().catch(f => setError(message(f))).finally(() => setBusy(false)); }}>Enable reminder</Button>
      <TextAction onPress={() => { if (user) void getStore().then(store => store.set(user.id, 'reminderOffered', true)); setReminderOffer(false); setSheet(null); }}>Not now</TextAction><ErrorNotice>{error}</ErrorNotice>
    </Sheet>
  </>;
}
