import { assertEquals } from 'jsr:@std/assert';
import { handleRevenueCatWebhook, type PurchaseEvent } from './handler.ts';

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
