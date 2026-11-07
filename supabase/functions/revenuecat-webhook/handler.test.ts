import { assertEquals } from 'jsr:@std/assert';
import { handleRevenueCatWebhook, type PurchaseEvent, type SubscriptionEvent } from './handler.ts';

const event = {
  id: 'event-1', type: 'NON_RENEWING_PURCHASE', app_id: 'app6b277aa8f4',
  environment: 'PRODUCTION', store: 'APP_STORE',
  app_user_id: '10000000-0000-0000-0000-000000000001',
  product_id: 'io.lasalida.schwanki.credits.starter', transaction_id: 'tx-1', event_timestamp_ms: 123456,
};
function request(value: unknown = { event }, token = 'Bearer test-secret') {
  return new Request('https://example.test', { method: 'POST', headers: { authorization: token }, body: JSON.stringify(value) });
}

Deno.test('authenticated consumable events map to server-owned credit quantities', async () => {
  const calls: PurchaseEvent[] = [];
  const apply = async (value: PurchaseEvent) => { calls.push(value); return null; };
  assertEquals((await handleRevenueCatWebhook(request({ event: { ...event, quantity: 2, credits: 999999 } }), 'test-secret', apply)).status, 200);
  assertEquals(calls[0]?.p_credits, 200);
  assertEquals(calls[0]?.p_transaction_id, 'app6b277aa8f4:tx-1');
  assertEquals(calls[0]?.p_user_id, event.app_user_id);
});

Deno.test('wrong authorization, sandbox, other apps/stores and unknown products never grant credits', async () => {
  let calls = 0;
  const apply = async () => { calls++; return null; };
  assertEquals((await handleRevenueCatWebhook(request(), '', apply)).status, 503);
  assertEquals((await handleRevenueCatWebhook(request({}, 'wrong'), 'test-secret', apply)).status, 401);
  for (const patch of [{ environment: 'SANDBOX' }, { app_id: 'other' }, { store: 'PLAY_STORE' }, { product_id: 'unknown' }, { type: 'TEST' }]) {
    assertEquals((await handleRevenueCatWebhook(request({ event: { ...event, ...patch } }), 'test-secret', apply)).status, 200);
  }
  assertEquals(calls, 0);
});

Deno.test('invalid identity, quantity, timestamp and malformed payloads fail closed', async () => {
  let calls = 0;
  const apply = async () => { calls++; return null; };
  for (const patch of [{ app_user_id: '$RCAnonymousID:123' }, { quantity: -1 }, { quantity: 1.5 }, { transaction_id: '' }, { event_timestamp_ms: null }]) {
    assertEquals((await handleRevenueCatWebhook(request({ event: { ...event, ...patch } }), 'test-secret', apply)).status, 400);
  }
  assertEquals((await handleRevenueCatWebhook(request(null), 'test-secret', apply)).status, 400);
  assertEquals(calls, 0);
});

Deno.test('refund and refund reversal are forwarded; temporary database failures request retry', async () => {
  for (const type of ['CANCELLATION', 'REFUND_REVERSED']) {
    let received = '';
    const response = await handleRevenueCatWebhook(request({ event: { ...event, type } }), 'test-secret', async value => { received = value.p_event_type; return null; });
    assertEquals(response.status, 200); assertEquals(received, type);
  }
  assertEquals((await handleRevenueCatWebhook(request(), 'test-secret', async () => ({ code: '08006' }))).status, 500);
  assertEquals((await handleRevenueCatWebhook(request(), 'test-secret', async () => ({ code: '23503' }))).status, 200);
});

Deno.test('sandbox grants require the server account allowlist and use a separate transaction namespace', async () => {
  const calls: PurchaseEvent[] = [];
  const apply = async (value: PurchaseEvent) => { calls.push(value); return null; };
  const sandbox = { event: { ...event, environment: 'SANDBOX' } };
  assertEquals((await handleRevenueCatWebhook(request(sandbox), 'test-secret', apply, async () => false)).status, 200);
  assertEquals(calls.length, 0);
  assertEquals((await handleRevenueCatWebhook(request(sandbox), 'test-secret', apply, async id => id === event.app_user_id)).status, 200);
  assertEquals(calls[0]?.p_transaction_id, 'app6b277aa8f4:SANDBOX:tx-1');
  assertEquals(calls[0]?.p_credits, 100);
});

Deno.test('a temporary sandbox account lookup failure requests retry without granting credits', async () => {
  let grants = 0;
  const response = await handleRevenueCatWebhook(request({ event: { ...event, environment: 'SANDBOX' } }), 'test-secret', async () => { grants++; return null; }, async () => { throw new Error('auth unavailable'); });
  assertEquals(response.status, 503);
  assertEquals(grants, 0);
});

Deno.test('Plus subscription events rewrite the expiration; refunds, sandbox and transfers follow the same gates', async () => {
  const plus = { ...event, type: 'INITIAL_PURCHASE', product_id: 'io.lasalida.schwanki.plus.annual', period_type: 'TRIAL', expiration_at_ms: 1_700_000_000_000 };
  const calls: SubscriptionEvent[] = [];
  let purchases = 0;
  const apply = async () => { purchases++; return null; };
  const applySubscription = async (value: SubscriptionEvent) => { calls.push(value); return null; };
  assertEquals((await handleRevenueCatWebhook(request({ event: plus }), 'test-secret', apply, async () => false, applySubscription)).status, 200);
  assertEquals(calls[0], {
    p_user_id: event.app_user_id, p_product_id: 'io.lasalida.schwanki.plus.annual', p_expires_at: '2023-11-14T22:13:20.000Z',
    p_status: 'INITIAL_PURCHASE', p_environment: 'PRODUCTION', p_event_at: 123456,
  });
  for (const type of ['RENEWAL', 'CANCELLATION', 'EXPIRATION', 'BILLING_ISSUE']) {
    assertEquals((await handleRevenueCatWebhook(request({ event: { ...plus, type } }), 'test-secret', apply, async () => false, applySubscription)).status, 200);
    assertEquals(calls.at(-1)?.p_status, type);
  }
  // A subscription never touches the credit ledger, and events without an expiration are rejected.
  assertEquals(purchases, 0);
  assertEquals((await handleRevenueCatWebhook(request({ event: { ...plus, expiration_at_ms: null } }), 'test-secret', apply, async () => false, applySubscription)).status, 400);
  assertEquals((await handleRevenueCatWebhook(request({ event: { ...plus, app_user_id: '$RCAnonymousID:1' } }), 'test-secret', apply, async () => false, applySubscription)).status, 400);
  const before = calls.length;
  assertEquals((await handleRevenueCatWebhook(request({ event: { ...plus, type: 'TRANSFER' } }), 'test-secret', apply, async () => false, applySubscription)).status, 200);
  assertEquals((await handleRevenueCatWebhook(request({ event: { ...plus, type: 'TEST' } }), 'test-secret', apply, async () => false, applySubscription)).status, 200);
  assertEquals((await handleRevenueCatWebhook(request({ event: { ...plus, environment: 'SANDBOX' } }), 'test-secret', apply, async () => false, applySubscription)).status, 200);
  assertEquals(calls.length, before);
  assertEquals((await handleRevenueCatWebhook(request({ event: { ...plus, environment: 'SANDBOX' } }), 'test-secret', apply, async () => true, applySubscription)).status, 200);
  assertEquals(calls.at(-1)?.p_environment, 'SANDBOX');
  assertEquals((await handleRevenueCatWebhook(request({ event: plus }), 'test-secret', apply, async () => false, async () => ({ code: '08006' }))).status, 500);
});
