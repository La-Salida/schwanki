import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Share, StyleSheet, View } from 'react-native';
import { Button, Page, T } from '../components/UI';
import { Goose } from '../components/Goose';
import { RatingBurst, type Burst } from '../components/RatingBurst';
import { colors as c, fonts } from '../theme';
import { supabase } from '../lib/backend';
import { gooseLine, sessionTime, streakFacts, type SessionStats, type StreakFacts, type WeekDay } from '../lib/feedback';
import { hapticFor, playSfx } from '../lib/sfx';

/** Counts from 0 to `target` once, easing out. */
function useCountUp(target: number, ms = 900): number {
  const [value, setValue] = useState(0);
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const sub = v.addListener(({ value: x }) => setValue(Math.round(x)));
    Animated.timing(v, { toValue: target, duration: ms, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => v.removeListener(sub);
  }, [target, ms, v]);
  return value;
}

export function WeekDots({ week, holdToday, dark = false }: { week: WeekDay[]; holdToday: boolean; dark?: boolean }) {
  return <View accessibilityLabel="This week" style={{ flexDirection: 'row', gap: 6, maxWidth: 340 }}>
    {week.map((d, i) => {
      const done = d.done && !(d.today && holdToday);
      const bg = done ? (d.today ? c.yellow : dark ? 'white' : c.blue) : dark ? 'transparent' : 'white';
      const border = d.today ? (dark ? 'white' : c.ink) : done ? (dark ? 'white' : c.blue) : dark ? '#FFFFFF40' : c.line;
      const color = done ? (d.today ? c.ink : dark ? c.ink : 'white') : dark ? '#FFFFFFA6' : c.ink;
      return <View key={i} accessibilityLabel={`${d.today ? 'Today' : d.label}: ${d.done ? 'reviewed' : 'no reviews'}`} style={{ flex: 1, aspectRatio: 1, borderRadius: 999, borderWidth: 2, borderColor: border, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', transform: [{ scale: done && d.today ? 1.12 : 1 }] }}>
        <T style={{ fontFamily: fonts.black, fontSize: 13, color, lineHeight: 16 }}>{d.label}</T>
      </View>;
    })}
  </View>;
}

/** The session's receipt: an index card worth a screenshot, with the streak ticking up when today extends it. */
export function Finish({ stats, userId, online, muted, children }: { stats: SessionStats; userId: string | null; online: boolean; muted: boolean; children?: ReactNode }) {
  const [facts, setFacts] = useState<StreakFacts | null>(null);
  const [tick, setTick] = useState(false);
  const [burst, setBurst] = useState<Burst | null>({ id: 1, knew: true });
  const knownPct = stats.reviewed ? Math.round((stats.knew / stats.reviewed) * 100) : 0;
  const count = useCountUp(stats.reviewed);
  const pct = useCountUp(knownPct);
  const [time] = useState(() => sessionTime(Date.now() - stats.startedAt));
  const [date] = useState(() => new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }));
  useEffect(() => { playSfx('finish', muted); }, [muted]);
  useEffect(() => {
    let live = true;
    if (!online || !userId) return;
    void supabase.from('review_events').select('reviewed_at').eq('user_id', userId).order('reviewed_at', { ascending: false }).limit(500)
      .then(({ data, error }) => { if (live && !error) setFacts(streakFacts((data ?? []).map(r => r.reviewed_at as string), stats.startedAt)); });
    return () => { live = false; };
  }, [userId, online, stats.startedAt]);
  useEffect(() => {
    if (!facts) return;
    if (!facts.extendedToday) { setTick(true); return; }
    const t = setTimeout(() => { setTick(true); setBurst({ id: 2, knew: true }); playSfx('streak', muted); hapticFor('streak'); }, 1100);
    return () => clearTimeout(t);
  }, [facts, muted]);
  const streak = facts ? (tick || !facts.extendedToday ? facts.streak : facts.streak - 1) : null;
  const line = gooseLine(knownPct, facts?.streak ?? null);
  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(slide, { toValue: 1, duration: 600, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }).start(); }, [slide]);
  async function share() {
    const text = `${stats.reviewed} cards on Schwanki today, ${knownPct}% known${facts ? `, ${facts.streak}-day streak` : ''}. schwankiapp.com`;
    await Share.share({ message: text }).catch(() => undefined);
  }
  return <Page contentStyle={{ gap: 16 }}>
    <Animated.View accessibilityLabel={`Queue cleared. ${stats.reviewed} cards reviewed, ${knownPct} percent known${streak !== null ? `, ${streak}-day streak` : ''}.`} style={[styles.card, { opacity: slide, transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }, { rotate: slide.interpolate({ inputRange: [0, 1], outputRange: ['2deg', '-1deg'] }) }] }]}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden', top: 56 }]}>{Array.from({ length: 24 }, (_, i) => <View key={i} style={{ position: 'absolute', left: 0, right: 0, top: i * 32, borderBottomWidth: 1, borderBottomColor: c.ruled }} />)}</View>
      <Goose mood="celebrate" size={104} style={{ position: 'absolute', right: 6, top: 2, transform: [{ rotate: '8deg' }] }} />
      <T style={styles.date}>{date}</T>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 20 }}>
        <T style={styles.count}>{count}</T><T style={styles.countLabel}>cards{'\n'}reviewed</T>
      </View>
      <View style={{ flexDirection: 'row', marginTop: 24 }}>
        {([['Known', `${pct}%`], ['Best run', String(stats.bestRun)], ['Time', time]] as const).map(([k, v]) => <View key={k} style={{ flex: 1 }}><T style={styles.statKey}>{k}</T><T style={styles.statValue}>{v}</T></View>)}
      </View>
      {facts && streak !== null && <View style={{ marginTop: 24, gap: 10 }}>
        <T style={styles.streak}>{streak}-day streak</T>
        <WeekDots week={facts.week} holdToday={!tick} />
      </View>}
      <T style={styles.line}>{line}</T>
      <RatingBurst burst={burst} />
    </Animated.View>
    <Button onPress={() => { void share(); }}>Share this card</Button>
    {children}
  </Page>;
}

const styles = StyleSheet.create({
  card: { borderTopWidth: 5, borderTopColor: c.red, borderRadius: 12, backgroundColor: 'white', paddingTop: 18, paddingHorizontal: 22, paddingBottom: 22, overflow: 'hidden', shadowColor: c.ink, shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.15, shadowRadius: 30 },
  date: { fontFamily: fonts.bold, fontSize: 14, color: c.muted },
  count: { fontFamily: fonts.black, fontSize: 92, lineHeight: 84, letterSpacing: -4, color: c.ink, fontVariant: ['tabular-nums'] },
  countLabel: { fontFamily: fonts.black, fontSize: 20, lineHeight: 22, color: c.ink, paddingBottom: 6 },
  statKey: { fontFamily: fonts.bold, fontSize: 13, color: c.muted },
  statValue: { fontFamily: fonts.black, fontSize: 30, lineHeight: 34, color: c.ink, fontVariant: ['tabular-nums'] },
  streak: { fontFamily: fonts.black, fontSize: 30, lineHeight: 34, color: c.blue },
  line: { marginTop: 24, fontFamily: fonts.bold, fontSize: 17, lineHeight: 24, color: c.ink },
});
