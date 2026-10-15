import { createClient } from "@supabase/supabase-js";
import { verifyStripeSignature } from "../_shared/stripe.ts";
import { findCreditPack } from "@schwanki/mnemonic";

/** Stripe → Schwanki. Called by Stripe only (verify_jwt = false; the Stripe
 *  signature is the auth). Grants a pack's credits once per Checkout Session. */
Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  const raw = await req.text();
  const ok = await verifyStripeSignature(raw, req.headers.get("stripe-signature"), Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "");
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

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { error } = await admin.from("credit_ledger").insert({
    user_id: userId, delta: pack.credits, reason: `bought ${pack.credits} credits`, stripe_session_id: session.id as string,
  });
  // 23505: Stripe re-delivered an event we already credited.
  if (error && error.code !== "23505") {
    console.error("credit grant failed", error);
    return new Response("grant failed", { status: 500 }); // Stripe retries
  }
  return Response.json({ credited: pack.credits });
});
