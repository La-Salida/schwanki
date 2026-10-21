import { verifyStripeSignature } from "../_shared/stripe.ts";
import { findCreditPack } from "@schwanki/mnemonic";

export interface CreditGrant { user_id: string; delta: number; reason: string; stripe_session_id: string }
type GrantCredits = (grant: CreditGrant) => Promise<{ code?: string; message?: string } | null>;

/** Database insertion uses the unique Stripe session ID as the idempotency key. */
export async function handleStripeWebhook(req: Request, webhookSecret: string, grantCredits: GrantCredits): Promise<Response> {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  const raw = await req.text();
  const ok = await verifyStripeSignature(raw, req.headers.get("stripe-signature"), webhookSecret);
  if (!ok) return new Response("bad signature", { status: 400 });

  const event = JSON.parse(raw) as { type: string; data: { object: Record<string, unknown> } };
  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
    return Response.json({ ignored: event.type });
  }
  const session = event.data.object;
  if (session.payment_status !== "paid") return Response.json({ pending: true });

  const meta = (session.metadata ?? {}) as Record<string, string>;
  const pack = findCreditPack(meta.pack_id);
  const userId = meta.user_id;
  if (!pack || !userId || userId !== session.client_reference_id) {
    console.error("checkout session missing pack or user", session.id);
    return Response.json({ error: "unrecognised session" }); // 200: retrying won't fix it
  }

  const error = await grantCredits({
    user_id: userId, delta: pack.credits, reason: `bought ${pack.credits} credits`, stripe_session_id: session.id as string,
  });
  // 23505: Stripe re-delivered an event we already credited.
  if (error && error.code !== "23505") {
    console.error("credit grant failed", error);
    return new Response("grant failed", { status: 500 }); // Stripe retries
  }
  return Response.json({ credited: pack.credits });
}
