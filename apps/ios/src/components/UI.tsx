import type { ReactNode } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, type TextProps, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { colors as c, fonts } from '../theme';

export function T({ style, ...props }: TextProps) { return <Text {...props} style={[s.body, style]} />; }
export function Button({ children, onPress, secondary = false, busy = false, disabled = false, testID, style }: { children: ReactNode; onPress: () => void; secondary?: boolean; busy?: boolean; disabled?: boolean; testID?: string; style?: ViewStyle }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || busy, busy }} testID={testID} disabled={disabled || busy} onPress={onPress} style={({ pressed }) => [s.button, secondary && s.secondary, (disabled || busy) && { opacity: .55 }, pressed && { opacity: .8 }, style]}>
    {busy ? <ActivityIndicator color={secondary ? c.blue : 'white'} /> : <T style={{ color: secondary ? c.ink : 'white', fontFamily: fonts.bold, textAlign: 'center' }}>{children}</T>}
  </Pressable>;
}
export function TextAction({ children, onPress, testID, danger = false, label }: { children: ReactNode; onPress: () => void; testID?: string; danger?: boolean; label?: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} testID={testID} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}><T style={{ color: danger ? c.red : c.blue, fontFamily: fonts.bold, textDecorationLine: 'underline' }}>{children}</T></Pressable>;
}
export function ErrorNotice({ children }: { children?: ReactNode }) { return children ? <View accessibilityLiveRegion="polite" style={s.error}><T style={{ color: c.red, fontSize: 15 }}>{children}</T></View> : null; }
export function Page({ children, header, contentStyle }: { children: ReactNode; header?: ReactNode; contentStyle?: ViewStyle }) {
  return <SafeAreaView style={{ flex: 1, backgroundColor: c.paper }}>
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>{Array.from({ length: 80 }, (_, i) => <View key={i} style={{ position: 'absolute', left: 0, right: 0, top: i * 32, borderBottomWidth: 1, borderBottomColor: c.ruled }} />)}</View>
    {header}<ScrollView contentContainerStyle={[s.page, contentStyle]} keyboardShouldPersistTaps="handled">{children}</ScrollView>
  </SafeAreaView>;
}
export function Header({ onHelp, onSignIn, signedIn }: { onHelp: () => void; onSignIn: () => void; signedIn: boolean }) {
  return <View style={s.header}>
    <Image accessibilityLabel="Schwanki" source={require('../../assets/lockup.png')} style={{ width: 180, height: 38 }} resizeMode="contain" />
    <Pressable accessibilityRole="button" onPress={signedIn ? onHelp : onSignIn} hitSlop={8} style={{ minHeight: 44, justifyContent: 'center' }}><T style={{ color: c.blue }}>{signedIn ? 'Help' : 'Sign in'}</T></Pressable>
  </View>;
}
export function Sheet({ title, visible, onClose, children, busy = false }: { title: string; visible: boolean; onClose: () => void; children: ReactNode; busy?: boolean }) {
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={busy ? undefined : onClose}>
    <SafeAreaView style={{ flex: 1, backgroundColor: c.paper }} edges={['bottom', 'left', 'right']}>
      <View style={s.sheetHeader}><T accessibilityRole="header" style={s.sheetTitle}>{title}</T><Pressable accessibilityRole="button" accessibilityLabel="Close sheet" disabled={busy} onPress={onClose} hitSlop={10} style={{ padding: 10, opacity: busy ? .3 : 1 }}><Feather name="x" size={24} color={c.ink} /></Pressable></View>
      <ScrollView contentContainerStyle={s.sheetBody} keyboardShouldPersistTaps="handled">{children}</ScrollView>
    </SafeAreaView>
  </Modal>;
}
export const s = StyleSheet.create({
  body: { fontFamily: fonts.body, fontSize: 17, lineHeight: 25, color: c.ink },
  headline: { fontFamily: fonts.black, fontSize: 42, lineHeight: 45, letterSpacing: -1.8, color: c.ink },
  title: { fontFamily: fonts.black, fontSize: 26, lineHeight: 30, letterSpacing: -.6, color: c.ink },
  muted: { color: c.muted, fontSize: 15, lineHeight: 22 },
  page: { padding: 24, gap: 20, paddingBottom: 40, maxWidth: 540, width: '100%', alignSelf: 'center' },
  button: { minHeight: 54, borderRadius: 11, backgroundColor: c.blue, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  secondary: { backgroundColor: 'white', borderWidth: 1, borderColor: c.line },
  header: { borderTopColor: c.red, borderTopWidth: 2, paddingHorizontal: 24, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  error: { padding: 14, borderLeftColor: c.red, borderLeftWidth: 2, backgroundColor: '#FFF5F4', borderRadius: 6 },
  row: { minHeight: 58, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: c.line, gap: 16 },
  sheetHeader: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12, flexDirection: 'row', gap: 12, alignItems: 'center', borderBottomWidth: 1, borderColor: c.line },
  sheetTitle: { fontFamily: fonts.bold, fontSize: 20, flex: 1 },
  sheetBody: { padding: 24, gap: 20, paddingBottom: 48, maxWidth: 560, width: '100%', alignSelf: 'center' },
  input: { borderWidth: 1, borderColor: c.line, borderRadius: 10, minHeight: 50, padding: 12, fontFamily: fonts.body, fontSize: 17, color: c.ink, backgroundColor: 'white' },
});
