import { useEffect, useRef } from 'react';
import { Animated, Easing, type ImageStyle, type StyleProp } from 'react-native';

/** The Chaos Goose in one of its moods, each its own drawing, with a little motion on top. Decoration only. */
export type GooseMood = 'celebrate' | 'judge' | 'sleep';
const ART: Record<GooseMood, number> = {
  celebrate: require('../../assets/goose-celebrate.png'),
  judge: require('../../assets/goose-judge.png'),
  sleep: require('../../assets/goose-sleep.png'),
};

export function Goose({ mood, size = 96, style }: { mood: GooseMood; size?: number; style?: StyleProp<ImageStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    v.setValue(0);
    const loop = mood === 'celebrate'
      ? Animated.sequence([Animated.delay(500), Animated.loop(Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: 320, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]), { iterations: 2 })])
      : Animated.loop(Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: mood === 'sleep' ? 1600 : 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: mood === 'sleep' ? 1600 : 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]));
    loop.start();
    return () => loop.stop();
  }, [mood, v]);
  const transform = mood === 'celebrate'
    ? [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.12] }) }, { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-7deg'] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }]
    : mood === 'judge'
      ? [{ rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-6deg'] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) }]
      : [{ scaleX: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) }, { scaleY: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.98] }) }];
  return <Animated.Image accessible={false} source={ART[mood]} resizeMode="contain" style={[{ width: size, height: size, transform }, style]} />;
}
