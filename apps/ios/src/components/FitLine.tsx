import { Text, type TextProps } from 'react-native';

/** For a deliberately unbroken display line. Body text remains free to grow. */
export function FitLine(props: TextProps) {
  return <Text maxFontSizeMultiplier={1.5} {...props} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.25} />;
}
