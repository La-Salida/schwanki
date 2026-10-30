import { useEffect, useState } from 'react';
import { Alert, Linking, Switch, TextInput, View } from 'react-native';
import { Button, ErrorNotice, Sheet, T, TextAction, s } from '../components/UI';
import { colors as c, fonts } from '../theme';
import { getStore } from '../lib/nativeStore';
import { cancelReminder, setReminder, type Reminder } from '../lib/reminders';
import { signIn } from '../lib/auth';
import { requireAccount, supabase, signOutLocal } from '../lib/backend';
import { clearMedia } from '../lib/media';
import { message } from '../lib/useLibrary';
export function Settings({ userId, email, pending, syncError, muted, onMute, onClose, onSync, onWeb, onSettingsChange }: {
  userId: string; email: string; pending: number; syncError: string | null; muted: boolean; onMute: () => void; onClose: () => void; onSync: () => Promise<void>; onWeb: () => void; onSettingsChange: () => void;
}) {
  const [limit, setLimit] = useState('20');
  const [hour, setHour] = useState('19'); const [minute, setMinute] = useState('00');
  const [reminder, setReminderState] = useState<Reminder | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false); const [typed, setTyped] = useState('');
  useEffect(() => { let live = true; void (async () => {
    const store = await getStore(); const [n, r] = await Promise.all([store.get<number>(userId, 'newLimit'), store.get<Reminder>(userId, 'reminder')]);
    if (live) { setLimit(String(n ?? 20)); setReminderState(r); if (r) { setHour(String(r.hour)); setMinute(String(r.minute).padStart(2, '0')); } }
  })().catch(f => { if (live) setError(message(f)); }); return () => { live = false; }; }, [userId]);
  async function run(fn: () => Promise<void>) { setBusy(true); setError(null); try { await fn(); } catch (f) { setError(message(f)); } finally { setBusy(false); } }
  async function logout() {
    await onSync(); const store = await getStore();
    if (await store.count(userId)) throw new Error('Your offline reviews need to sync before signing out. Connect and try again.');
    await cancelReminder(userId);
    await signOutLocal();
    await store.clearAccount(userId); await clearMedia(userId); onClose();
  }
  async function deleteAccount() {
    if (typed.trim().toLowerCase() !== 'delete') return;
    await requireAccount(userId);
    const { data, error } = await supabase.functions.invoke('delete-account', { body: { confirm: true } });
    if (error || !data?.deleted) throw error ?? new Error('Could not delete this account. Try again.');
    await cancelReminder(userId); await (await getStore()).clearAccount(userId, true); await clearMedia(userId);
    await signOutLocal(); onClose();
  }
  return <Sheet title="Settings" visible onClose={onClose} busy={busy}>
    <T style={s.muted}>On this iPhone</T>
    <View style={s.row}><T>Sound</T><Switch accessibilityLabel="Sound" value={!muted} onValueChange={onMute} trackColor={{ true: c.blue }} /></View>
    <View style={{ gap: 10 }}><T style={{ fontFamily: fonts.bold }}>New cards per day</T><TextInput accessibilityLabel="New cards per day" keyboardType="number-pad" value={limit} onChangeText={setLimit} style={s.input} />
      <Button secondary busy={busy} onPress={() => { void run(async () => {
        const n = Number(limit); if (!Number.isInteger(n) || n < 0 || n > 9999 || !limit.trim()) throw new Error('Choose a whole number from 0 to 9999.');
        await (await getStore()).set(userId, 'newLimit', n); onSettingsChange();
      }); }}>Save daily limit</Button><T style={s.muted}>This setting stays on this device. Study days turn over at 4 a.m. local time.</T>
    </View>
    <View style={{ gap: 12 }}><T style={s.title}>Daily reminder</T><T style={s.muted}>{reminder ? 'On' : 'Off'} · Optional, once a day.</T>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><TextInput accessibilityLabel="Reminder hour, 0 to 23" keyboardType="number-pad" maxLength={2} value={hour} onChangeText={setHour} style={[s.input, { width: 80 }]} /><T>:</T><TextInput accessibilityLabel="Reminder minute" keyboardType="number-pad" maxLength={2} value={minute} onChangeText={setMinute} style={[s.input, { width: 80 }]} /></View>
      <Button secondary busy={busy} onPress={() => { void run(async () => { await setReminder(userId, Number(hour), Number(minute)); setReminderState(await (await getStore()).get(userId, 'reminder')); }); }}>{reminder ? 'Update reminder' : 'Enable reminder'}</Button>
      {reminder && <TextAction onPress={() => { void run(async () => { await cancelReminder(userId); setReminderState(null); }); }}>Turn reminder off</TextAction>}
    </View>
    <T style={s.title}>Sync</T><T>{pending ? `${pending} ratings saved on this iPhone` : 'All reviews synced'}</T><ErrorNotice>{syncError}</ErrorNotice>
    <Button secondary busy={busy} onPress={() => { void run(onSync); }}>Sync now</Button>
    {syncError && <TextAction onPress={() => { void run(async () => { await signIn(); await onSync(); }); }}>Sign in again to sync</TextAction>}
    <TextAction onPress={onWeb}>Schwanki on the web</TextAction>
    <T style={{ fontFamily: fonts.bold }}>Your account</T><T>{email}</T>
    <TextAction onPress={() => { void run(logout); }}>Sign out</TextAction>
    <TextAction onPress={() => { void Linking.openURL('https://schwankiapp.com/privacy'); }}>Privacy</TextAction><TextAction onPress={() => { void Linking.openURL('https://schwankiapp.com/terms'); }}>Terms</TextAction>
    <TextAction onPress={() => { void Linking.openURL('mailto:hello@schwankiapp.com'); }}>Get help</TextAction>
    {!deleting ? <TextAction danger onPress={() => setDeleting(true)}>Delete account…</TextAction> : <View style={{ gap: 12 }}>
      <T style={{ fontFamily: fonts.bold, color: c.red }}>Permanently delete your account</T><T>This deletes your cards, decks, reviews, files, generated media, keys and remaining credits. It cannot be undone.</T>
      <TextInput accessibilityLabel="Type delete to confirm account deletion" autoCapitalize="none" autoCorrect={false} placeholder="Type delete" value={typed} onChangeText={setTyped} style={s.input} />
      <Button disabled={typed.trim().toLowerCase() !== 'delete'} busy={busy} onPress={() => { Alert.alert('Delete everything?', 'This permanently deletes your Schwanki account and data.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { void run(deleteAccount); } }]); }}>Delete everything</Button>
      <TextAction onPress={() => { setDeleting(false); setTyped(''); }}>Cancel</TextAction>
    </View>}
    <ErrorNotice>{error}</ErrorNotice>
  </Sheet>;
}
