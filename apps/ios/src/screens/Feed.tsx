import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, PanResponder, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type ImageSourcePropType } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import * as Speech from 'expo-speech';
import type { DueCard, ReviewRating } from '@schwanki/core';
import { T } from '../components/UI';
import { colors as c, fonts } from '../theme';
import { gestureAction } from '../lib/sync';
import type { CachedMedia } from '../lib/storage';

interface Props {
  item: DueCard; deckLabel?: string; media: CachedMedia; demoImage?: ImageSourcePropType; demoAudio?: number | null;
  sample?: { index: number; total: number }; progress: number; muted: boolean; offline: boolean; pending: number; active: boolean;
  onRate: (rating: ReviewRating, elapsed: number) => Promise<boolean>; onMute: () => void; onDecks: () => void; onSettings: () => void; onExitSample: () => void;
}
function Highlight({ text, word }: { text: string; word: string }) {
  if (!word.trim()) return <T style={styles.sentence}>{text}</T>;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return <T style={styles.sentence}>{text.split(new RegExp(`(${escaped})`, 'giu')).map((part, i) => part.toLocaleLowerCase() === word.toLocaleLowerCase()
    ? <T key={i} style={{ backgroundColor: c.yellow, color: c.ink, fontFamily: fonts.bold, fontSize: 20 }}>{part}</T> : part)}</T>;
}
export function Feed(p: Props) {
  const { card } = p.item;
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState<ReviewRating | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const contentHeight = useRef(0); const viewportHeight = useRef(0);
  const updateOverflow = () => setScrolling(contentHeight.current > viewportHeight.current + 2);
  const shown = useRef(Date.now());
  const savingRef = useRef(false);
  const current = useRef({ revealed, active: p.active, rate: doRate });
  current.current = { revealed, active: p.active, rate: doRate };
  const { fontScale } = useWindowDimensions();
  const player = useAudioPlayer(p.demoAudio ?? p.media.audio ?? null);
  const audioStatus = useAudioPlayerStatus(player);
  const sentence = p.media.sentence || card.exampleSentence;
  const spokenDemo = Boolean(p.sample && !p.demoAudio && sentence);
  const autoplayed = useRef(false);
  useEffect(() => { void setAudioModeAsync({ playsInSilentMode: false, shouldPlayInBackground: false }).catch(() => undefined); }, []);
  useEffect(() => { player.muted = p.muted; if (p.muted || !p.active) { player.pause(); void Speech.stop(); } }, [p.muted, p.active, player]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => { if (state !== 'active') { player.pause(); void Speech.stop(); } });
    return () => { sub.remove(); void Speech.stop(); };
  }, [player]);
  useEffect(() => {
    if (!revealed || p.muted || !p.active || autoplayed.current) return;
    if (audioStatus.isLoaded || spokenDemo) { autoplayed.current = true; void play(false); }
  }, [revealed, p.muted, p.active, audioStatus.isLoaded, spokenDemo]);
  async function play(manual = true) {
    setAudioError(false);
    try {
      // An explicit play tap should work even when automatic playback is muted.
      if (manual) player.muted = false;
      if (spokenDemo && sentence) { await Speech.stop(); Speech.speak(sentence, { language: card.language, onError: () => setAudioError(true) }); }
      else { await player.seekTo(0); player.play(); }
    } catch { setAudioError(true); }
  }
  async function doRate(rating: ReviewRating) {
    if (!revealed || savingRef.current || !p.active) return;
    savingRef.current = true; setSaving(true); setError(null);
    try {
      player.pause(); void Speech.stop();
      const saved = await p.onRate(rating, Math.max(0, Math.min(2_147_483_647, Date.now() - shown.current)));
      if (!saved) setError('Your card is still here. Try that rating again.');
    } catch { setRetry(rating); setError("Couldn't save that rating. Your card is still here."); }
    finally { savingRef.current = false; setSaving(false); }
  }
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => current.current.active && !savingRef.current && (Math.abs(g.dx) > 18 || (!scrolling && fontScale < 1.3 && g.dy < -18)),
    onPanResponderMove: (_, g) => {
      const action = gestureAction(g.dx, g.dy, current.current.revealed);
      setHint(action === 'reveal' ? 'Show meaning' : action === 'good' ? 'Good' : action === 'again' ? 'Again' : action === 'easy' ? 'Easy' : null);
    },
    onPanResponderRelease: (_, g) => {
      const action = gestureAction(g.dx, g.dy, current.current.revealed); setHint(null);
      if (!current.current.active) return;
      if (action === 'reveal') setRevealed(true);
      else if (action) void current.current.rate(action);
    },
    onPanResponderTerminate: () => setHint(null),
  }), [fontScale, scrolling]);
  const image = p.demoImage ?? (p.media.image ? { uri: p.media.image } : undefined);
  return <View style={styles.root}>
    {image && !imageFailed && <Image source={image} style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]} resizeMode="cover" onError={() => setImageFailed(true)} accessible={false} />}
    <LinearGradient pointerEvents="none" colors={['#14213D33', '#14213D00', '#14213DC9', '#14213D']} locations={[0, .3, .65, 1]} style={StyleSheet.absoluteFill} />
    <SafeAreaView style={{ flex: 1 }}>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel={p.sample ? 'Exit sample feed' : 'Choose a deck'} onPress={p.sample ? p.onExitSample : p.onDecks} style={styles.topPill}>
          <T style={styles.control}>{p.sample ? `Sample · ${p.sample.index + 1} of ${p.sample.total}` : p.deckLabel ?? 'All decks'}</T><Feather name={p.sample ? 'x' : 'chevron-down'} color="white" size={19} />
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={p.muted ? 'Turn sound on' : 'Mute sound'} onPress={p.onMute} style={styles.icon}><Feather name={p.muted ? 'volume-x' : 'volume-2'} size={23} color="white" /></Pressable>
          {!p.sample && <Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={p.onSettings} style={styles.icon}><Feather name="settings" size={23} color="white" /></Pressable>}
        </View>
      </View>
      <View style={styles.progress} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(p.progress * 100) }}><View style={{ height: 3, width: `${Math.min(100, p.progress * 100)}%`, backgroundColor: 'white' }} /></View>
      {p.offline && <View style={styles.notice}><T style={styles.noticeText}>Offline · {p.pending ? `${p.pending} ratings saved on this iPhone` : 'Reviewing saved cards'}</T></View>}
      <View style={{ flex: 1, justifyContent: 'flex-end' }} {...pan.panHandlers}>
        {hint && <View pointerEvents="none" style={styles.hint}><T style={{ fontFamily: fonts.bold, color: 'white', fontSize: 28 }}>{hint}</T></View>}
        <ScrollView onLayout={event => { viewportHeight.current = event.nativeEvent.layout.height; updateOverflow(); }} onContentSizeChange={(_width, height) => { contentHeight.current = height; updateOverflow(); }} style={{ flexGrow: 0, maxHeight: '76%' }} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 12 }}>
          <Pressable accessibilityRole={!revealed ? 'button' : undefined} accessibilityLabel={!revealed ? `${card.front}. Show meaning` : undefined} onPress={() => { if (p.active) setRevealed(true); }}>
            <T style={[styles.word, { fontSize: card.front.length > 18 ? 36 : 56 }]}>{card.front}</T>
            {card.reading && <T style={styles.reading}>{card.reading}</T>}
            {revealed && <View style={{ gap: 12, marginTop: 12 }}>
              <T style={styles.meaning}>{card.back}</T>
              {sentence && <Highlight text={sentence} word={card.front} />}
              {p.media.translation && <T style={styles.translation}>{p.media.translation}</T>}
            </View>}
          </Pressable>
        </ScrollView>
        <View style={{ paddingHorizontal: 24, gap: 10 }}>
          {!revealed ? <Pressable accessibilityRole="button" testID="reveal-card" onPress={() => setRevealed(true)} style={styles.reveal}><T style={{ fontFamily: fonts.bold, textAlign: 'center' }}>Tap to show meaning</T></Pressable>
            : (p.media.audio || p.demoAudio || spokenDemo) ? <Pressable accessibilityRole="button" accessibilityLabel="Play audio" onPress={() => { void play(); }} style={styles.play}><Feather name="volume-2" color="white" size={22} /><T style={styles.control}>{audioError ? 'Try audio again' : 'Play audio'}</T></Pressable> : null}
          {error && <View accessibilityLiveRegion="polite" style={styles.notice}><T style={styles.noticeText}>{error}</T>{retry && <Pressable accessibilityRole="button" onPress={() => { void doRate(retry); }} style={{ minHeight: 44, justifyContent: 'center' }}><T style={{ color: 'white', fontFamily: fonts.bold }}>Retry {retry}</T></Pressable>}</View>}
        </View>
      </View>
      <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12, gap: 10 }}>
        <T style={styles.gesture}>{!revealed ? 'Reveal before rating' : scrolling || fontScale >= 1.3 ? 'Scroll to read · use the ratings below' : '↑ Good    ← Again    → Easy'}</T>
        <View style={styles.ratings}>{(['again', 'hard', 'good', 'easy'] as const).map(rating => <Pressable key={rating} testID={`rate-${rating}`} accessibilityRole="button" accessibilityState={{ disabled: !revealed || saving }} disabled={!revealed || saving || !p.active} onPress={() => { void doRate(rating); }} style={[styles.rating, rating === 'good' && { backgroundColor: c.blue, borderColor: c.blue }, (!revealed || saving) && { opacity: .45 }]}>
          {saving && retry === rating ? <ActivityIndicator color="white" /> : <T style={styles.rateLabel}>{rating[0]!.toUpperCase() + rating.slice(1)}</T>}
        </Pressable>)}</View>
      </View>
    </SafeAreaView>
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.ink },
  top: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  topPill: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#14213DCC', borderWidth: 1, borderColor: '#FFFFFF55' },
  control: { color: 'white', fontFamily: fonts.bold, fontSize: 16 },
  icon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#14213DCC', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FFFFFF55' },
  progress: { height: 3, marginHorizontal: 24, backgroundColor: '#FFFFFF44', borderRadius: 2, overflow: 'hidden' },
  word: { color: 'white', fontFamily: fonts.black, lineHeight: 62, letterSpacing: -1.8 },
  reading: { color: '#D5DEEE', fontSize: 18, marginTop: 6 },
  meaning: { color: 'white', fontFamily: fonts.bold, fontSize: 25, lineHeight: 31 },
  sentence: { color: 'white', fontSize: 20, lineHeight: 30 },
  translation: { color: '#C9D4EC', fontSize: 16, lineHeight: 23 },
  reveal: { backgroundColor: 'white', minHeight: 52, justifyContent: 'center', borderRadius: 10, padding: 12 },
  play: { minHeight: 48, borderWidth: 1, borderColor: '#FFFFFFAA', borderRadius: 10, flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#14213D77' },
  gesture: { color: '#C9D4EC', fontSize: 13, textAlign: 'center', lineHeight: 19 },
  ratings: { flexDirection: 'row', gap: 8 },
  rating: { minHeight: 52, flex: 1, backgroundColor: '#14213DCC', borderWidth: 1, borderColor: '#FFFFFFAA', borderRadius: 11, paddingHorizontal: 2, justifyContent: 'center', alignItems: 'center' },
  rateLabel: { color: 'white', fontFamily: fonts.bold, fontSize: 15 },
  notice: { padding: 10, marginHorizontal: 8, marginTop: 8, backgroundColor: '#14213DDD', borderRadius: 8 },
  noticeText: { color: 'white', fontSize: 14, lineHeight: 21 },
  hint: { position: 'absolute', alignSelf: 'center', top: '25%', borderRadius: 12, padding: 18, backgroundColor: '#14213DDD' },
});
