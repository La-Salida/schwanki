import { findAppStoreCreditPack, isPlusProduct } from '@schwanki/mnemonic';

export interface PurchaseEvent {
  p_transaction_id: string; p_user_id: string; p_product_id: string;
  p_credits: number; p_event_id: string; p_event_at: number; p_event_type: string;
}
type ApplyPurchase = (event: PurchaseEvent) => Promise<{ code?: string } | null>;
export interface SubscriptionEvent {
  p_user_id: string; p_product_id: string; p_expires_at: string; p_status: string;
  p_environment: 'PRODUCTION' | 'SANDBOX'; p_event_at: number;
}
type ApplySubscription = (event: SubscriptionEvent) => Promise<{ code?: string } | null>;
/** RevenueCat subscription lifecycle events; each carries the subscription's current expiration. */
const SUBSCRIPTION_EVENTS = ['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'CANCELLATION', 'UNCANCELLATION',
  'EXPIRATION', 'BILLING_ISSUE', 'SUBSCRIPTION_EXTENDED', 'SUBSCRIPTION_PAUSED', 'TRANSFER'];
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const appId = 'app6b277aa8f4';

async function authorized(actual: string, expected: string) {
  const digest = async (value: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  const [a, b] = await Promise.all([digest(actual), digest(expected)]);
  return a.reduce((difference, byte, i) => difference | (byte ^ b[i]!), 0) === 0;
}

export async function handleRevenueCatWebhook(req: Request, secret: string, apply: ApplyPurchase,
  allowSandbox: (userId: string) => Promise<boolean> = async () => false,
  applySubscription: ApplySubscription = async () => null): Promise<Response> {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  if (!secret) return new Response('webhook unavailable', { status: 503 });
  if (!await authorized(req.headers.get('authorization') ?? '', `Bearer ${secret}`)) return new Response('unauthorized', { status: 401 });
  const raw = await req.text();
  if (raw.length > 64_000) return new Response('payload too large', { status: 413 });
  let event: Record<string, unknown>;
  try {
    const body = JSON.parse(raw);
    if (!body?.event || typeof body.event !== 'object' || Array.isArray(body.event)) throw new Error();
    event = body.event;
  } catch { return new Response('invalid payload', { status: 400 }); }
  if (event.app_id !== appId || !['PRODUCTION', 'SANDBOX'].includes(String(event.environment)) || event.store !== 'APP_STORE') {
    return Response.json({ ignored: true });
  }
  if (isPlusProduct(event.product_id)) return handleSubscription(event, applySubscription, allowSandbox);
  if (!['NON_RENEWING_PURCHASE', 'CANCELLATION', 'REFUND_REVERSED'].includes(String(event.type))) return Response.json({ ignored: true });
  const pack = findAppStoreCreditPack(event.product_id);
  if (!pack) return Response.json({ ignored: true });
  const userId = event.app_user_id;
  const quantity = event.quantity ?? 1;
  if (typeof userId !== 'string' || !uuid.test(userId)
    || typeof event.transaction_id !== 'string' || !event.transaction_id || event.transaction_id.length > 200
    || typeof event.id !== 'string' || !event.id || event.id.length > 200
    || !Number.isSafeInteger(event.event_timestamp_ms) || Number(event.event_timestamp_ms) <= 0
    || !Number.isSafeInteger(quantity) || Number(quantity) < 1 || Number(quantity) > 100) {
    return new Response('invalid purchase', { status: 400 });
  }
  const sandbox = event.environment === 'SANDBOX';
  if (sandbox) {
    try { if (!await allowSandbox(userId)) return Response.json({ ignored: true }); }
    catch { return new Response('account lookup unavailable', { status: 503 }); }
  }
  const error = await apply({
    p_transaction_id: `${appId}:${sandbox ? 'SANDBOX:' : ''}${event.transaction_id}`, p_user_id: userId,
    p_product_id: String(event.product_id), p_credits: pack.credits * Number(quantity),
    p_event_id: event.id, p_event_at: Number(event.event_timestamp_ms), p_event_type: String(event.type),
  });
  // Deleted accounts cannot receive credits; acknowledge their delayed notifications.
  if (error?.code === '23503') return Response.json({ ignored: true });
  if (error) return new Response('fulfillment failed', { status: 500 });
  return Response.json({ received: true });
}

/** Plus is a state, not a ledger: every event rewrites the user's expiration, newest event wins.
 *  Refunds arrive as CANCELLATION with the expiration moved to the refund time, so one rule covers them. */
async function handleSubscription(event: Record<string, unknown>, apply: ApplySubscription,
  allowSandbox: (userId: string) => Promise<boolean>): Promise<Response> {
  if (!SUBSCRIPTION_EVENTS.includes(String(event.type))) return Response.json({ ignored: true });
  // TRANSFER moves a subscription between RevenueCat users without a product or expiration; the receiving
  // user's next RENEWAL (or a restore) carries the state. Nothing safe can be written from it here.
  if (event.type === 'TRANSFER') return Response.json({ ignored: true });
  const userId = event.app_user_id;
  if (typeof userId !== 'string' || !uuid.test(userId)
    || !Number.isSafeInteger(event.event_timestamp_ms) || Number(event.event_timestamp_ms) <= 0
    || !Number.isSafeInteger(event.expiration_at_ms) || Number(event.expiration_at_ms) <= 0) {
    return new Response('invalid subscription', { status: 400 });
  }
  const sandbox = event.environment === 'SANDBOX';
  if (sandbox) {
    try { if (!await allowSandbox(userId)) return Response.json({ ignored: true }); }
    catch { return new Response('account lookup unavailable', { status: 503 }); }
  }
  const error = await apply({
    p_user_id: userId, p_product_id: String(event.product_id),
    p_expires_at: new Date(Number(event.expiration_at_ms)).toISOString(), p_status: String(event.type),
    p_environment: sandbox ? 'SANDBOX' : 'PRODUCTION', p_event_at: Number(event.event_timestamp_ms),
  });
  if (error?.code === '23503') return Response.json({ ignored: true });
  if (error) return new Response('subscription update failed', { status: 500 });
  return Response.json({ received: true });
}
