import { useEffect, useRef, type PropsWithChildren } from 'react';
import { Platform } from 'react-native';
import { CustomPurchaseControllerProvider, SuperwallProvider, usePlacement, useUser } from 'expo-superwall';
import { buyPlus, PLUS_ENTITLEMENT, restorePlus, watchPlus } from './purchases';
import { getStore } from './nativeStore';

// Public Superwall key for the iOS app (dashboard app 41353). Never a secret key.
const apiKey = process.env.EXPO_PUBLIC_SUPERWALL_IOS_KEY ?? 'pk_SoK1AJiKlXr5Voou8cXEE';

/** The placement the onboarding campaign listens on. Half of new accounts get flow B, half the native entry. */
export const ONBOARDING_PLACEMENT = 'onboarding';

let signedInUser: string | null = null;

/** Superwall paywalls buy through RevenueCat, so one webhook keeps the server's view of Plus. */
const controller = {
  async onPurchase({ productId }: { productId: string }) {
    if (!signedInUser) return { type: 'failed' as const, error: 'Sign in to start Plus.' };
    try {
      const outcome = await buyPlus(signedInUser, productId);
      return { type: outcome };
    } catch (error) {
      return { type: 'failed' as const, error: error instanceof Error ? error.message : 'Purchase failed.' };
    }
  },
  async onPurchaseRestore() {
    if (!signedInUser) return { type: 'failed' as const, error: 'Sign in to restore Plus.' };
    try {
      return { type: (await restorePlus(signedInUser)) ? 'restored' as const : 'failed' as const };
    } catch (error) {
      return { type: 'failed' as const, error: error instanceof Error ? error.message : 'Restore failed.' };
    }
  },
};

export function PaywallProvider({ children }: PropsWithChildren) {
  if (Platform.OS !== 'ios') return <>{children}</>;
  return <SuperwallProvider apiKeys={{ ios: apiKey }} onConfigurationError={error => console.warn('Superwall could not configure.', error)}>
    <CustomPurchaseControllerProvider controller={controller}>{children}</CustomPurchaseControllerProvider>
  </SuperwallProvider>;
}

/** Keeps Superwall's idea of who the user is, and whether they have Plus, in step with Supabase and RevenueCat. */
export function PaywallIdentity({ userId }: { userId: string | null }) {
  const { identify, signOut, setSubscriptionStatus } = useUser();
  useEffect(() => {
    signedInUser = userId;
    let alive = true;
    let unsubscribe: (() => void) | undefined;
    void (async () => {
      try {
        if (userId) await identify(userId); else await signOut();
        unsubscribe = await watchPlus(userId, active => {
          if (!alive) return;
          void setSubscriptionStatus(active
            ? { status: 'ACTIVE', entitlements: [{ id: PLUS_ENTITLEMENT, type: 'SERVICE_LEVEL' }] }
            : { status: 'INACTIVE' }).catch(() => undefined);
        });
        if (!alive) unsubscribe();
      } catch {
        // Billing being unreachable never blocks studying; the paywall simply won't present.
      }
    })();
    return () => { alive = false; unsubscribe?.(); };
  }, [userId, identify, signOut, setSubscriptionStatus]);
  return null;
}

/** Fires the onboarding placement once per account, the first time their library is ready. */
export function OnboardingPlacement({ userId, ready }: { userId: string | null; ready: boolean }) {
  const { registerPlacement } = usePlacement({ onError: error => console.warn('Onboarding placement failed.', error) });
  const fired = useRef<string | null>(null);
  useEffect(() => {
    if (!userId || !ready || fired.current === userId) return;
    fired.current = userId;
    void (async () => {
      const store = await getStore();
      if (await store.get<boolean>(userId, 'onboardingShown')) return;
      await store.set(userId, 'onboardingShown', true);
      await registerPlacement({ placement: ONBOARDING_PLACEMENT });
    })().catch(() => undefined);
  }, [userId, ready, registerPlacement]);
  return null;
}
