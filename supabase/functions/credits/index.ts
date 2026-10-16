import { createClient } from "@supabase/supabase-js";
import { corsJson, corsPreflight } from "../_shared/cors.ts";
import { safeReturnOrigin, stripeRequest } from "../_shared/stripe.ts";
import { CREDIT_PACKS, findCreditPack, serverCoverage, type Provider } from "@schwanki/mnemonic";
import { ourKey } from "../generate-mnemonic/lib.ts";

/** Schwanki AI credits. User-JWT only.
 *  { action: "status" }            → whether buying is switched on, which kinds Schwanki AI serves, the packs.
 *  { action: "checkout", packId }  → a Stripe Checkout URL; credits land via stripe-webhook. */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const jwt = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: { user }, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !user || jwt === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    return corsJson({ error: "unauthorized" }, 401);
  }

  const body = await req.json().catch(() => ({})) as { action?: string; packId?: string };
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  const purchasesEnabled = Boolean(stripeKey && Deno.env.get("STRIPE_WEBHOOK_SECRET"));

  if (body.action === "status") {
    const available = serverCoverage((p: Provider) => Boolean(ourKey(p)));
    return corsJson({ purchasesEnabled, available, packs: CREDIT_PACKS });
  }

  if (body.action === "checkout") {
    if (!purchasesEnabled) return corsJson({ error: "payments_not_configured" }, 503);
    const pack = findCreditPack(body.packId);
    if (!pack) return corsJson({ error: "unknown pack" }, 400);
    const origin = safeReturnOrigin(req.headers.get("origin"));
    if (!origin) return corsJson({ error: "bad origin" }, 400);
    try {
      const session = await stripeRequest(stripeKey, "checkout/sessions", {
        mode: "payment",
        client_reference_id: user.id,
        ...(user.email ? { customer_email: user.email } : {}),
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][unit_amount]": String(pack.priceCents),
        "line_items[0][price_data][product_data][name]": `Schwanki AI: ${pack.credits} credits`,
        "metadata[user_id]": user.id,
        "metadata[pack_id]": pack.id,
        success_url: `${origin}/settings?credits=success`,
        cancel_url: `${origin}/settings?credits=cancelled`,
      });
      return corsJson({ url: session.url });
    } catch (e) {
      console.error("checkout failed", e);
      return corsJson({ error: `checkout failed: ${(e as Error).message}` }, 502);
    }
  }

  return corsJson({ error: "unknown action" }, 400);
});
