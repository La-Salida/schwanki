import { Platform } from 'react-native';
import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import { findAppStoreCreditPack, isPlusProduct } from '@schwanki/mnemonic';
import { requireAccount, supabase } from './backend';

// Public SDK key for Schwanki's App Store app. Never put a secret API key here.
const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? 'appl_VaPpYRYhOFiGBcNUydeippsvxFD';
let configured = false;
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
    await Purchases.getCustomerInfo();
  } else if (userId) {
    // A failed network response can still have changed the SDK's cached identity.
    if (await Purchases.getAppUserID() !== userId) await Purchases.logIn(userId);
  } else if (!await Purchases.isAnonymous()) {
    await Purchases.logOut();
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

/** The RevenueCat entitlement the Plus subscriptions unlock. Mirrors the dashboard, not the store. */
export const PLUS_ENTITLEMENT = 'plus';

export function plusActive(info: CustomerInfo | null | undefined): boolean {
  return Boolean(info?.entitlements.active[PLUS_ENTITLEMENT]);
}

export type PlusPurchaseOutcome = 'purchased' | 'cancelled' | 'failed';

/** Buys a Plus subscription for the Superwall paywall. Fulfillment stays with the RevenueCat webhook. */
export function buyPlus(userId: string, productId: string): Promise<PlusPurchaseOutcome> {
  return serial(async () => {
    if (!isPlusProduct(productId)) throw new Error('Unknown Plus plan.');
    await requireAccount(userId);
    const purchases = await identify(userId);
    if (!purchases || await purchases.getAppUserID() !== userId) throw new Error('Sign in again to start Plus.');
    const [product] = await purchases.getProducts([productId]);
    if (!product) throw new Error('This plan is not available in the App Store yet.');
    try {
      await purchases.purchaseStoreProduct(product);
      return 'purchased';
    } catch (error) {
      if (error && typeof error === 'object' && 'userCancelled' in error && error.userCancelled) return 'cancelled';
      throw error;
    }
  });
}

/** Restores App Store purchases and reports whether Plus is active afterwards. */
export function restorePlus(userId: string): Promise<boolean> {
  return serial(async () => {
    const purchases = await identify(userId);
    if (!purchases) return false;
    return plusActive(await purchases.restorePurchases());
  });
}

/** Calls back with every customer-info change for this user; resolves to the unsubscribe. */
export function watchPlus(userId: string | null, listener: (active: boolean) => void): Promise<() => void> {
  return serial(async () => {
    const purchases = await identify(userId);
    if (!purchases) { listener(false); return () => undefined; }
    const handle = (info: CustomerInfo) => listener(plusActive(info));
    purchases.addCustomerInfoUpdateListener(handle);
    listener(plusActive(await purchases.getCustomerInfo().catch(() => null)));
    return () => { purchases.removeCustomerInfoUpdateListener(handle); };
  });
}
