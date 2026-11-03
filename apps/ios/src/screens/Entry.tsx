import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useColorScheme, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics';
import Feather from '@expo/vector-icons/Feather';
import { FitLine } from '../components/FitLine';
import { welcomeCopy as copy } from '../copy/welcome';
import { welcomeColors } from '../theme';
const sampleImage = require('../../assets/demo/siesta.png');
const sampleSize = Platform.OS === 'web' ? undefined : Image.resolveAssetSource(sampleImage);
const artworkRatio = sampleSize?.height && sampleSize?.width ? sampleSize.height / sampleSize.width : 1844 / 853;

function Action({ children, onPress, label, testID, disabled, busy, style }: { children: ReactNode; onPress: () => void; label: string; testID?: string; disabled?: boolean; busy?: boolean; style?: StyleProp<ViewStyle> }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, busy }} testID={testID} disabled={disabled} onPress={onPress}
    onPressIn={() => { if (Platform.OS !== 'web') void impactAsync(ImpactFeedbackStyle.Light).catch(() => undefined); }}
    style={({ pressed }) => [styles.action, style, pressed && { opacity: .65, transform: [{ scale: .98 }] }, disabled && { opacity: .55 }]}>{children}</Pressable>;
}

export function Entry({ signedIn, busy, error, pendingWords, onImport, onSample, onSignIn, onWeb, onInbox, onSettings }: { signedIn: boolean; busy: boolean; error: string | null; pendingWords: number; onImport: () => void; onSample: () => void; onSignIn: () => void; onWeb: () => void; onInbox: () => void; onSettings: () => void }) {
  const [help, setHelp] = useState(false);
  const [linkError, setLinkError] = useState(false);
  const dark = useColorScheme() === 'dark';
  const c = welcomeColors[dark ? 'dark' : 'light'];
  const { width, height, fontScale } = useWindowDimensions();
  const previewHeight = Math.max(160, 70 * fontScale, Math.min(230, height * .23));
  const artworkHeight = Math.min(380, width - 48) * artworkRatio;
  const body = [styles.body, { color: c.ink }];
  const muted = [styles.body, { color: c.muted }];
  return <SafeAreaView style={[styles.screen, { backgroundColor: c.paper }]}>
    <StatusBar style={dark ? 'light' : 'dark'} />
    <View style={styles.chrome}>
      <Action label={copy.help} onPress={() => { setLinkError(false); setHelp(true); }} style={styles.iconButton}><Feather name="help-circle" size={23} color={c.muted} /></Action>
      <FitLine style={[styles.appName, { color: c.ink }]}>{copy.appName}</FitLine>
      {signedIn ? <Action label={copy.settings} onPress={onSettings} style={styles.iconButton}><Feather name="settings" size={22} color={c.muted} /></Action>
        : <Action label={copy.signIn} onPress={onSignIn} disabled={busy} style={styles.signIn}><Text maxFontSizeMultiplier={1.5} style={[styles.chromeText, { color: c.accent }]}>{copy.signIn}</Text></Action>}
    </View>
    <ScrollView testID="welcome-scroll" style={{ flex: 1 }} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.content}>
        <View accessible accessibilityRole="header" accessibilityLabel={copy.headline.join(' ')} style={styles.intro}>
          {copy.headline.map((line, i) => <FitLine key={line} testID={`welcome-headline-${i}`} style={[styles.headline, { color: c.ink }]}>{line}</FitLine>)}
        </View>
        <Text style={[...muted, styles.description]}>{copy.description}</Text>
        <Action testID="sample-feed" label={copy.sampleLabel} onPress={onSample} style={[styles.preview, { backgroundColor: c.surface }]}>
          <View style={{ height: previewHeight, overflow: 'hidden' }}>
            <Image accessible={false} source={sampleImage} resizeMode="stretch" style={{ position: 'absolute', width: '100%', height: artworkHeight, top: -(artworkHeight - previewHeight) * .34 }} />
            <View style={[styles.word, { backgroundColor: c.paper }]}><FitLine style={[styles.wordText, { color: c.ink }]}>{copy.sampleWord}</FitLine><Text style={[styles.caption, { color: c.muted }]}>{copy.sampleLanguage}</Text></View>
          </View>
          <View style={styles.previewFooter}><View style={{ flex: 1, gap: 3 }}><Text style={[...body, styles.semibold]}>{copy.sample}</Text><Text style={[styles.caption, { color: c.muted }]}>{copy.sampleDetail}</Text></View><Feather name="chevron-right" size={20} color={c.muted} /></View>
        </Action>
        <Action label={copy.webLabel} onPress={onWeb} style={styles.webRow}>
          <Feather name="file-text" size={21} color={c.muted} />
          <View style={{ flex: 1, gap: 3 }}><Text style={[...body, styles.semibold]}>{copy.web}</Text><Text style={[styles.caption, { color: c.muted }]}>{copy.webDetail}</Text></View><Feather name="chevron-right" size={19} color={c.muted} />
        </Action>
        {pendingWords > 0 && <Action label={copy.pending(pendingWords)} onPress={onInbox} style={[styles.pending, { backgroundColor: c.surface }]}><View style={{ flex: 1, gap: 3 }}><Text style={[...body, styles.semibold]}>{copy.pending(pendingWords)}</Text><Text style={[styles.caption, { color: c.muted }]}>{copy.pendingDetail}</Text></View><Feather name="chevron-right" size={20} color={c.muted} /></Action>}
      </View>
    </ScrollView>
    <View testID="welcome-actions" style={[styles.dock, { backgroundColor: c.paper, borderTopColor: c.line }]}>
      <View style={styles.dockContent}>
        {error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.body, { color: c.error }]}>{error}</Text>}
        <Action testID="import-deck" label={copy.importDeck} onPress={onImport} disabled={busy} busy={busy} style={[styles.primary, { backgroundColor: c.accent }]}>
          {busy ? <ActivityIndicator color={c.onAccent} /> : <Text style={[styles.primaryText, { color: c.onAccent }]}>{copy.importDeck}</Text>}
        </Action>
        <Text style={[styles.caption, { color: c.muted, textAlign: 'center' }]}>{copy.importHint}</Text>
      </View>
    </View>
    <Modal visible={help} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setHelp(false)}>
      <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.screen, { backgroundColor: c.paper }]}>
        <View style={[styles.helpHeader, { borderBottomColor: c.line }]}><FitLine accessibilityRole="header" style={[styles.helpTitle, { color: c.ink }]}>{copy.helpTitle}</FitLine><Action label={copy.done} onPress={() => setHelp(false)}><Text maxFontSizeMultiplier={1.5} style={[styles.chromeText, { color: c.accent }]}>{copy.done}</Text></Action></View>
        <ScrollView contentContainerStyle={styles.helpContent}>
          <Text style={[...body, styles.semibold]}>{copy.mobileTitle}</Text><Text style={muted}>{copy.mobileInstructions}</Text>
          <Text style={[...body, styles.semibold, { marginTop: 12 }]}>{copy.computerTitle}</Text><Text style={muted}>{copy.computerInstructions}</Text>
          <Action label={copy.exportInstructions} onPress={() => { void Linking.openURL('https://docs.ankiweb.net/exporting.html').catch(() => setLinkError(true)); }} style={styles.webRow}><Text style={[...body, { flex: 1, color: c.accent }]}>{copy.exportInstructions}</Text><Feather name="arrow-up-right" size={18} color={c.accent} /></Action>
          {linkError && <Text accessibilityRole="alert" style={[styles.body, { color: c.error }]}>{copy.linkError}</Text>}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  action: { minHeight: 44, minWidth: 44, justifyContent: 'center' },
  chrome: { minHeight: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  appName: { fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  iconButton: { width: 64, alignItems: 'center' },
  signIn: { minWidth: 64, alignItems: 'center' },
  chromeText: { fontSize: 17, fontWeight: '600' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 20 },
  content: { width: '100%', maxWidth: 380, alignSelf: 'center', gap: 20 },
  intro: { gap: 0 },
  headline: { fontSize: 44, lineHeight: 49, fontWeight: '800', letterSpacing: -1.3, textAlign: 'center' },
  body: { fontSize: 17, lineHeight: 24 },
  description: { textAlign: 'center', paddingHorizontal: 8 },
  semibold: { fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18 },
  preview: { overflow: 'hidden', borderRadius: 20 },
  previewFooter: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  word: { position: 'absolute', bottom: 14, left: 14, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, maxWidth: '88%' },
  wordText: { fontSize: 25, lineHeight: 30, fontWeight: '700', letterSpacing: -.5 },
  webRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, paddingHorizontal: 4 },
  pending: { padding: 16, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  dock: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 10, borderTopWidth: StyleSheet.hairlineWidth },
  dockContent: { width: '100%', maxWidth: 380, alignSelf: 'center', gap: 8 },
  primary: { minHeight: 56, paddingHorizontal: 20, paddingVertical: 16, alignItems: 'center', borderRadius: 16 },
  primaryText: { fontSize: 17, lineHeight: 24, fontWeight: '600', textAlign: 'center' },
  helpHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingHorizontal: 24, paddingTop: 14, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  helpTitle: { flex: 1, fontSize: 20, fontWeight: '700' },
  helpContent: { padding: 24, gap: 12, paddingBottom: 40, maxWidth: 540, width: '100%', alignSelf: 'center' },
});
