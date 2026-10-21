import { createClient } from "@supabase/supabase-js";
import { handleStripeWebhook } from "./handler.ts";

/** Stripe signatures authenticate this endpoint (verify_jwt = false). */
Deno.serve((req) => handleStripeWebhook(req, Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "", async (grant) => {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { error } = await admin.from("credit_ledger").insert(grant);
  return error;
}));
