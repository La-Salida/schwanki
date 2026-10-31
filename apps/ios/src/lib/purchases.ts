import { Platform } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { findAppStoreCreditPack } from '@schwanki/mnemonic';
import { requireAccount, supabase } from './backend';

// Public SDK key for Schwanki's App Store app. Never put a secret API key here.
const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? 'appl_VaPpYRYhOFiGBcNUydeippsvxFD';
let configured = false;
let identity: string | null = null;
let queue: Promise<unknown> = Promise.resolve();

function serial<T>(work: () => Promise<T>): Promise<T> {
  const result = queue.then(work);
  queue = result.catch(() => undefined);
  return result;
}

async function identify(userId: string | null) {
  if (Platform.OS !== 'ios') return null;
  if (!apiKey.startsWith('appl_')) throw new Error('This build has an invalid App Store billing key.');
  const { default: Purchases, LOG_LEVEL } = await import('react-native-purchases');
  if (!configured) {
    await Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
    Purchases.configure({ apiKey, ...(userId ? { appUserID: userId } : {}) });
    configured = true;
    identity = userId;
    await Purchases.getCustomerInfo();
  } else if (identity !== userId) {
    if (userId) await Purchases.logIn(userId);
    else if (!await Purchases.isAnonymous()) await Purchases.logOut();
    identity = userId;
  }
  return Purchases;
}

/** Serialize auth changes with purchases so a transaction keeps its original owner. */
export function syncPurchaseIdentity(userId: string | null): Promise<void> {
  return serial(async () => { await identify(userId); });
}

export function creditPackages(userId: string): Promise<PurchasesPackage[]> {
  return serial(async () => {
    await requirePurchasesEnabled(userId);
    const purchases = await identify(userId);
    if (!purchases) return [];
    const offering = (await purchases.getOfferings()).all.credits;
    return (offering?.availablePackages ?? []).filter(pack => findAppStoreCreditPack(pack.product.identifier));
  });
}

export function buyCreditPackage(userId: string, pack: PurchasesPackage): Promise<boolean> {
  return serial(async () => {
    await requirePurchasesEnabled(userId);
    if (!findAppStoreCreditPack(pack.product.identifier)) throw new Error('Unknown credit pack.');
    const purchases = await identify(userId);
    if (!purchases || await purchases.getAppUserID() !== userId) throw new Error('Sign in again to buy credits.');
    try {
      await purchases.purchasePackage(pack);
      // Credit fulfillment belongs exclusively to the authenticated server webhook.
      return true;
    } catch (error) {
      if (error && typeof error === 'object' && 'userCancelled' in error && error.userCancelled) return false;
      throw error;
    }
  });
}

async function requirePurchasesEnabled(userId: string) {
  await requireAccount(userId);
  const { data, error } = await supabase.functions.invoke('credits', { body: { action: 'native-status' } });
  if (error || data?.purchasesEnabled !== true) throw new Error('App Store credit packs are not available yet. Your existing credits still work.');
}
