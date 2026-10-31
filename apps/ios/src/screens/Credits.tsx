import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { findAppStoreCreditPack } from '@schwanki/mnemonic';
import { Button, ErrorNotice, Sheet, T, TextAction, s } from '../components/UI';
import { api, requireAccount } from '../lib/backend';
import { buyCreditPackage, creditPackages } from '../lib/purchases';
import { message } from '../lib/useLibrary';

export function Credits({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [balance, setBalance] = useState<number | null>(null);
  const [packs, setPacks] = useState<PurchasesPackage[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchased, setPurchased] = useState(false);
  async function refresh() {
    await requireAccount(userId);
    setBalance(await api.creditBalance());
  }
  useEffect(() => {
    let live = true;
    async function load() {
      try {
        await requireAccount(userId);
        const value = await api.creditBalance();
        if (live) setBalance(value);
        const available = await creditPackages(userId);
        if (!available.length) throw new Error('The App Store could not load credit packs. Try again shortly.');
        if (live) setPacks(available);
      } catch (failure) { if (live) setError(message(failure)); }
      finally { if (live) setLoading(false); }
    }
    void load();
    // Purchased consumables live in the account ledger, rather than restorable entitlements.
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') void refresh().catch(() => undefined);
    });
    return () => { live = false; listener.remove(); };
  }, [userId]);
  async function buy(pack: PurchasesPackage) {
    setBusy(true); setError(null); setPurchased(false);
    try {
      if (await buyCreditPackage(userId, pack)) {
        setPurchased(true);
        await refresh();
      }
    } catch (failure) { setError(message(failure)); }
    finally { setBusy(false); }
  }
  return <Sheet title="AI credits" visible busy={busy} onClose={onClose}>
    <T style={s.headline}>{balance === null ? 'Your credits' : `${balance} credits`}</T>
    <T>Use credits on Schwanki’s website to create pictures and audio for your cards. Your balance is shared across iPhone and web.</T>
    <T style={s.muted}>One-time packs. No subscription. Credits do not expire.</T>
    {loading && <T>Loading credit packs…</T>}
    {packs.map(pack => {
      const credits = findAppStoreCreditPack(pack.product.identifier)!.credits;
      return <View key={pack.identifier}><Button secondary busy={busy} onPress={() => { void buy(pack); }}>{credits} credits · {pack.product.priceString}</Button></View>;
    })}
    {purchased && <T>Your purchase was received. Credits appear after payment is verified. If the balance has not changed yet, refresh shortly; do not buy again to retry.</T>}
    <TextAction onPress={() => { setError(null); void refresh().catch(failure => setError(message(failure))); }}>Refresh balance</TextAction>
    <ErrorNotice>{error}</ErrorNotice>
  </Sheet>;
}
