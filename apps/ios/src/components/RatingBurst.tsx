import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import { T } from './UI';
import { Goose } from './Goose';
import { colors as c, fonts } from '../theme';
import { milestoneLine } from '../lib/feedback';

/** One beat of feedback per rating: confetti when you knew it, a red "Forgot" stamp with the goose when you didn't. */
export interface Burst { id: number; knew: boolean; run?: number }

const CONFETTI = ['#F5D90A', '#8fe39a', '#8cc8ff', '#F4C6D0', '#D6C6E8', '#FAF6EF', '#ff9378'];
function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function Piece({ seed, index, big, width, height }: { seed: number; index: number; big: boolean; width: number; height: number }) {
  const r = useMemo(() => seeded(seed * 7919 + index * 31), [seed, index]);
  const shape = useMemo(() => {
    const round = r() < 0.3; const w = round ? 8 + r() * 4 : 6 + r() * 5;
    return { round, w, h: round ? w : w * (1.6 + r()), color: CONFETTI[index % CONFETTI.length]!, x: (r() - 0.5) * width * 0.9 * (big ? 1.25 : 1), peak: -(0.18 + r() * 0.3) * height * (big ? 1.25 : 1), fall: (0.12 + r() * 0.3) * height, rot: (r() - 0.5) * 1440, dur: 900 + r() * 450, delay: r() * 60 };
  }, [r, index, big, width, height]);
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(t, { toValue: 1, duration: shape.dur, delay: shape.delay, easing: Easing.bezier(0.2, 0.7, 0.4, 1), useNativeDriver: true }).start(); }, [t, shape]);
  return <Animated.View pointerEvents="none" style={{ position: 'absolute', left: width / 2, top: height * 0.58, width: shape.w, height: shape.h, borderRadius: shape.round ? 999 : 2, backgroundColor: shape.color,
    opacity: t.interpolate({ inputRange: [0, 0.35, 1], outputRange: [1, 1, 0] }),
    transform: [{ translateX: t.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, shape.x * 0.55, shape.x] }) }, { translateY: t.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, shape.peak, shape.fall] }) }, { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${shape.rot}deg`] }) }] }} />;
}

function Stamp({ children, pop, offset = 0 }: { children: React.ReactNode; pop: Animated.Value; offset?: number }) {
  return <Animated.View pointerEvents="none" style={{ position: 'absolute', alignSelf: 'center', top: `${34 + offset}%`, opacity: pop.interpolate({ inputRange: [0, 0.14, 0.8, 1], outputRange: [0, 1, 1, 0] }),
    transform: [{ scale: pop.interpolate({ inputRange: [0, 0.14, 1], outputRange: [1.6, 1, 1] }) }, { rotate: '-6deg' }, { translateX: pop.interpolate({ inputRange: [0, 0.14, 0.22, 0.3, 0.38, 0.46, 1], outputRange: [0, 0, -10, 10, -6, 0, 0] }) }] }}>{children}</Animated.View>;
}

export function RatingBurst({ burst }: { burst: Burst | null }) {
  const { width, height } = useWindowDimensions();
  const pop = useRef(new Animated.Value(0)).current;
  const line = burst?.knew ? milestoneLine(burst.run ?? 0) : null;
  useEffect(() => {
    if (!burst) return;
    pop.setValue(0);
    Animated.timing(pop, { toValue: 1, duration: burst.knew ? 1800 : 1200, easing: Easing.bezier(0.2, 0.8, 0.3, 1), useNativeDriver: true }).start();
  }, [burst, pop]);
  if (!burst) return null;
  const count = line ? 80 : 34;
  return <View key={burst.id} pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {burst.knew && Array.from({ length: count }, (_, i) => <Piece key={i} seed={burst.id} index={i} big={Boolean(line)} width={width} height={height} />)}
    {!burst.knew && <>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderWidth: 6, borderColor: '#ff5a36', opacity: pop.interpolate({ inputRange: [0, 0.15, 0.6, 1], outputRange: [0, 1, 0, 0] }) }]} />
      <Stamp pop={pop}><View style={styles.stamp}><T style={styles.stampText}>✗ Forgot</T><T style={styles.stampSub}>It’ll come back soon</T></View></Stamp>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: -8, top: height * 0.5, flexDirection: 'row', alignItems: 'flex-start', gap: 6,
        opacity: pop.interpolate({ inputRange: [0, 0.25, 0.75, 1], outputRange: [0, 1, 1, 0] }),
        transform: [{ translateX: pop.interpolate({ inputRange: [0, 0.25, 0.75, 1], outputRange: [-80, 0, 0, -40] }) }, { rotate: pop.interpolate({ inputRange: [0, 0.25, 1], outputRange: ['-20deg', '0deg', '-10deg'] }) }] }}>
        <Goose mood="judge" size={Math.min(150, width * 0.36)} /><View style={styles.bubble}><T style={styles.bubbleText}>Hm.</T></View>
      </Animated.View>
    </>}
    {line && <Stamp pop={pop} offset={-4}><View style={styles.milestone}>
      <Goose mood="celebrate" size={78} style={{ position: 'absolute', right: -34, top: -46, transform: [{ rotate: '14deg' }] }} />
      <T style={styles.milestoneRun}>{burst.run} in a row</T><T style={styles.milestoneLine}>{line}</T>
    </View></Stamp>}
  </View>;
}

const styles = StyleSheet.create({
  stamp: { borderWidth: 3, borderColor: c.ink, borderRadius: 16, backgroundColor: '#ff9378', paddingVertical: 10, paddingHorizontal: 22, alignItems: 'center', shadowColor: c.ink, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0 },
  stampText: { fontFamily: fonts.black, fontSize: 34, color: c.ink, lineHeight: 38 },
  stampSub: { fontFamily: fonts.bold, fontSize: 14, color: c.ink, opacity: 0.8 },
  bubble: { marginTop: 10, borderWidth: 3, borderColor: c.ink, borderRadius: 999, backgroundColor: 'white', paddingVertical: 4, paddingHorizontal: 12 },
  bubbleText: { fontFamily: fonts.black, fontSize: 18, color: c.ink },
  milestone: { borderTopWidth: 5, borderTopColor: c.red, borderRadius: 8, backgroundColor: 'white', paddingVertical: 14, paddingHorizontal: 26, alignItems: 'center', shadowColor: c.ink, shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.5, shadowRadius: 20 },
  milestoneRun: { fontFamily: fonts.black, fontSize: 34, lineHeight: 38, color: c.blue },
  milestoneLine: { fontFamily: fonts.bold, fontSize: 16, color: c.ink },
});
