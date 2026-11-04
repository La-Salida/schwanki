import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, View, useWindowDimensions, type ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { T } from './UI';
import { colors as c, fonts } from '../theme';

/** A picture of the card just rated, thrown off the side it was sent to while the next card is already up. */
export interface Ghost { id: number; word: string; meaning: string; image?: ImageSourcePropType | undefined; side: 'good' | 'again' }

export function FeedGhost({ ghost, onDone }: { ghost: Ghost; onDone: () => void }) {
  const { width } = useWindowDimensions();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    t.setValue(0);
    Animated.timing(t, { toValue: 1, duration: 480, easing: Easing.bezier(0.45, 0, 0.75, 0.3), useNativeDriver: true }).start(({ finished }) => { if (finished) onDone(); });
  }, [ghost.id, t, onDone]);
  const dir = ghost.side === 'good' ? 1 : -1;
  return <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { backgroundColor: c.ink, opacity: t.interpolate({ inputRange: [0, 1], outputRange: [1, 0.6] }),
    transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, dir * width * 1.25] }) }, { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, 40] }) }, { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${dir * 14}deg`] }) }] }]}>
    {ghost.image && <Image source={ghost.image} style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]} resizeMode="cover" accessible={false} />}
    <LinearGradient colors={['#14213D33', '#14213D00', '#14213DC9', '#14213D']} locations={[0, .3, .65, 1]} style={StyleSheet.absoluteFill} />
    <View style={[StyleSheet.absoluteFill, { backgroundColor: ghost.side === 'good' ? '#3fb35a' : '#d9542e', opacity: 0.3 }]} />
    <View style={{ position: 'absolute', left: 24, right: 24, bottom: '22%' }}>
      <T style={{ color: 'white', fontFamily: fonts.black, fontSize: ghost.word.length > 18 ? 36 : 56, lineHeight: 62, letterSpacing: -1.8 }}>{ghost.word}</T>
      <T style={{ color: 'white', fontFamily: fonts.bold, fontSize: 25, lineHeight: 31, marginTop: 12 }}>{ghost.meaning}</T>
    </View>
  </Animated.View>;
}
