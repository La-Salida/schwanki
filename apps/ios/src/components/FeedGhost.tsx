import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, View, useWindowDimensions, type ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { T } from './UI';
import { colors as c, fonts } from '../theme';

/** A picture of the card just rated, thrown off the side it was sent to while the next card is already up. */
export interface Ghost { id: number; word: string; meaning: string; image?: ImageSourcePropType | undefined; side: 'good' | 'again'; from?: { x: number; y: number } | undefined }

export function FeedGhost({ ghost, onDone }: { ghost: Ghost; onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    t.setValue(0);
    Animated.timing(t, { toValue: 1, duration: ghost.from ? 300 : 480, easing: ghost.from ? Easing.out(Easing.quad) : Easing.bezier(0.45, 0, 0.75, 0.3), useNativeDriver: true }).start(({ finished }) => { if (finished) onDone(); });
  }, [ghost.id, t, onDone]);
  const dir = ghost.side === 'good' ? 1 : -1;
  // A swiped card keeps going the way the finger threw it, from where it was let go; a tapped rating flies to its side.
  const from = ghost.from ?? { x: 0, y: 0 };
  const len = Math.hypot(from.x, from.y);
  const reach = Math.max(width, height) * 1.3;
  const to = ghost.from && len > 1 ? { x: from.x + (from.x / len) * reach, y: from.y + (from.y / len) * reach } : { x: dir * width * 1.25, y: 40 };
  const tilt0 = (from.x / width) * 16;
  const tilt1 = ghost.from ? tilt0 + Math.sign(from.x || dir) * 8 : dir * 14;
  return <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { backgroundColor: c.ink, opacity: t.interpolate({ inputRange: [0, 1], outputRange: [1, ghost.from ? 0.9 : 0.6] }),
    transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [from.x, to.x] }) }, { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [from.y, to.y] }) }, { rotate: t.interpolate({ inputRange: [0, 1], outputRange: [`${tilt0}deg`, `${tilt1}deg`] }) }] }]}>
    {ghost.image && <Image source={ghost.image} style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]} resizeMode="cover" accessible={false} />}
    <LinearGradient colors={['#14213D33', '#14213D00', '#14213DC9', '#14213D']} locations={[0, .3, .65, 1]} style={StyleSheet.absoluteFill} />
    <View style={[StyleSheet.absoluteFill, { backgroundColor: ghost.side === 'good' ? '#3fb35a' : '#d9542e', opacity: 0.3 }]} />
    <View style={{ position: 'absolute', left: 24, right: 24, bottom: '22%' }}>
      <T style={{ color: 'white', fontFamily: fonts.black, fontSize: ghost.word.length > 18 ? 36 : 56, lineHeight: 62, letterSpacing: -1.8 }}>{ghost.word}</T>
      <T style={{ color: 'white', fontFamily: fonts.bold, fontSize: 25, lineHeight: 31, marginTop: 12 }}>{ghost.meaning}</T>
    </View>
  </Animated.View>;
}
