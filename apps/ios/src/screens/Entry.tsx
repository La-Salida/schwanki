import { useState } from 'react';
import { Image, Linking, View, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Button, ErrorNotice, Header, Page, T, TextAction, s } from '../components/UI';
import { colors as c, fonts } from '../theme';
const icons = {
  docs: require('../../assets/icons/googledocs.png'), sheets: require('../../assets/icons/googlesheets.png'), pdf: require('../../assets/icons/pdf.png'),
  slides: require('../../assets/icons/powerpoint.png'), canva: require('../../assets/icons/canva.png'), image: require('../../assets/icons/screenshots.png'), italki: require('../../assets/icons/italki.png'),
};
function Inline({ kind, tint }: { kind: keyof typeof icons; tint?: string }) { return <Image accessible={false} source={icons[kind]} style={{ width: kind === 'canva' || kind === 'italki' ? 27 : 13, height: 14, resizeMode: 'contain', ...(tint ? { tintColor: tint } : {}) }} />; }
export function Entry({ signedIn, busy, error, pendingWords, onImport, onSample, onSignIn, onWeb, onSettings }: { signedIn: boolean; busy: boolean; error: string | null; pendingWords: number; onImport: () => void; onSample: () => void; onSignIn: () => void; onWeb: () => void; onSettings: () => void }) {
  const [help, setHelp] = useState(false);
  const teaserHeight = Math.min(492, useWindowDimensions().width - 48) / 1.85;
  return <Page contentStyle={{ gap: 12, paddingTop: 8 }} header={<Header signedIn={signedIn} onSignIn={onSignIn} onHelp={() => setHelp(!help)} />}>
    <T accessibilityRole="header" style={[s.headline, { fontSize: 48, lineHeight: 50 }]}>Doomscroll{ '\n' }your vocab.</T>
    <T>Messy notes. Class PDFs. Anki decks. Turn them into flashcards with pictures, sound and personality.</T>
    <Image accessible={false} source={require('../../assets/notes-to-feed.png')} style={{ width: '100%', height: teaserHeight, marginVertical: 2 }} resizeMode="contain" />
    <T style={[s.muted, { textAlign: 'right', marginTop: -6, fontSize: 12, lineHeight: 18 }]}>Your words. A much better feed.</T>
    <View style={{ gap: 6 }}>
      <Button testID="import-deck" onPress={onImport} busy={busy}>Import an Anki deck</Button>
      <T style={[s.muted, { textAlign: 'center' }]}>.apkg or .colpkg from Files</T>
      <TextAction onPress={() => setHelp(!help)}>How do I export from Anki?</TextAction>
      {help && <View style={{ gap: 12, paddingBottom: 14 }}>
        <T style={{ fontFamily: fonts.bold }}>From AnkiMobile</T>
        <T style={s.muted}>Open AnkiMobile → Add/Export → Export/Share. Include media, save the export to Files, then choose it here.</T>
        <T style={{ fontFamily: fonts.bold }}>From your computer</T>
        <T style={s.muted}>In Anki, choose File → Export → Anki Deck Package. Include scheduling information and media. Save it to iCloud Drive to open it here.</T>
        <TextAction onPress={() => { void Linking.openURL('https://docs.ankiweb.net/exporting.html'); }}>Official export instructions</TextAction>
      </View>}
      <TextAction testID="sample-feed" onPress={onSample}>Try the feed · 3 sample cards</TextAction>
    </View>
    <ErrorNotice>{error}</ErrorNotice>
    {pendingWords > 0 && <View><T>{pendingWords} new words are waiting for approval on the web.</T><TextAction onPress={onWeb}>Check my new words</TextAction></View>}
    <View style={{ borderTopWidth: 1, borderColor: c.line, paddingTop: 16, gap: 8 }}>
      <T style={s.title}>Got messy notes?</T>
      <T style={{ fontSize: 16, lineHeight: 25 }}>Bring <Inline kind="docs" tint="#4285F4" /> Docs, <Inline kind="sheets" tint="#0F9D58" /> Sheets, <Inline kind="pdf" /> PDFs or <Inline kind="image" /> screenshots to Schwanki on the web.</T>
      <T style={{ fontSize: 16 }}>Also <Inline kind="slides" /> PowerPoint and <Inline kind="canva" tint="#00AFC4" /> Canva PDFs. Create memorable cards there. Doomscroll them here.</T>
      <TextAction onPress={onWeb} label="Turn notes into cards on the web">Turn notes into cards on the web <Feather name="external-link" size={14} color={c.blue} /></TextAction>
      <T style={{ fontSize: 14, color: c.muted }}>Coming soon: <Feather name="message-square" size={13} color={c.muted} /> Preply chat · <Inline kind="italki" /> italki</T>
    </View>
    {signedIn && <TextAction onPress={onSettings}>Settings</TextAction>}
  </Page>;
}
