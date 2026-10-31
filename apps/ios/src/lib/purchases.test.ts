import { beforeEach, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  configure: vi.fn(), setLogLevel: vi.fn(), getCustomerInfo: vi.fn(), logIn: vi.fn(), logOut: vi.fn(),
  isAnonymous: vi.fn(), getAppUserID: vi.fn(), getOfferings: vi.fn(), purchasePackage: vi.fn(),
}));
const account = vi.hoisted(() => ({ requireAccount: vi.fn(), supabase: { functions: { invoke: vi.fn() } } }));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('react-native-purchases', () => ({ default: sdk, LOG_LEVEL: { DEBUG: 'debug', WARN: 'warn' } }));
vi.mock('./backend', () => account);
const pack = { identifier: 'mini', product: { identifier: 'io.lasalida.schwanki.credits.mini' } };

beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks(); vi.stubGlobal('__DEV__', true);
  account.requireAccount.mockResolvedValue(undefined);
  account.supabase.functions.invoke.mockResolvedValue({ data: { purchasesEnabled: true }, error: null });
  sdk.getCustomerInfo.mockResolvedValue({}); sdk.logIn.mockResolvedValue({});
  sdk.logOut.mockResolvedValue({}); sdk.getAppUserID.mockResolvedValue('user-a');
  sdk.getOfferings.mockResolvedValue({ all: { credits: { availablePackages: [pack, { product: { identifier: 'unrelated' } }] } } });
});

it('configures once despite concurrent startup and auth callbacks, using the Supabase identity', async () => {
  const { syncPurchaseIdentity, creditPackages } = await import('./purchases');
  await Promise.all([syncPurchaseIdentity('user-a'), syncPurchaseIdentity('user-a')]);
  expect(sdk.configure).toHaveBeenCalledTimes(1);
  expect(sdk.configure.mock.calls[0]?.[0]).toMatchObject({ appUserID: 'user-a' });
  expect(await creditPackages('user-a')).toEqual([pack]);
});

it('serializes account changes and recovers after a failed login', async () => {
  const { syncPurchaseIdentity } = await import('./purchases');
  await syncPurchaseIdentity('user-a');
  sdk.logIn.mockRejectedValueOnce(new Error('offline'));
  await expect(syncPurchaseIdentity('user-b')).rejects.toThrow('offline');
  await syncPurchaseIdentity('user-b');
  await syncPurchaseIdentity(null);
  expect(sdk.logIn).toHaveBeenCalledTimes(2);
  expect(sdk.logOut).toHaveBeenCalledTimes(1);
});

it('refuses purchases for a stale signed-in account or a mismatched RevenueCat user', async () => {
  const { buyCreditPackage } = await import('./purchases');
  account.requireAccount.mockRejectedValueOnce(new Error('expired'));
  await expect(buyCreditPackage('user-a', pack as never)).rejects.toThrow('expired');
  sdk.getAppUserID.mockResolvedValue('user-b');
  await expect(buyCreditPackage('user-a', pack as never)).rejects.toThrow('Sign in again');
  expect(sdk.purchasePackage).not.toHaveBeenCalled();
});

it('treats cancellation as no purchase and never suppresses other store failures', async () => {
  const { buyCreditPackage } = await import('./purchases');
  sdk.purchasePackage.mockRejectedValueOnce({ userCancelled: true }).mockRejectedValueOnce(new Error('store unavailable')).mockResolvedValueOnce({});
  expect(await buyCreditPackage('user-a', pack as never)).toBe(false);
  await expect(buyCreditPackage('user-a', pack as never)).rejects.toThrow('store unavailable');
  expect(await buyCreditPackage('user-a', pack as never)).toBe(true);
});

it('does not open the payment sheet while server fulfillment is disabled', async () => {
  const { buyCreditPackage } = await import('./purchases');
  account.supabase.functions.invoke.mockResolvedValue({ data: { purchasesEnabled: false }, error: null });
  await expect(buyCreditPackage('user-a', pack as never)).rejects.toThrow('not available');
  expect(sdk.purchasePackage).not.toHaveBeenCalled();
});
