import { assertEquals } from "jsr:@std/assert";
import { signStripePayload } from "../_shared/stripe.ts";
import { handleStripeWebhook, type CreditGrant } from "./handler.ts";

const secret = "whsec_launch_test";
const session = { id: "cs_test_launch", payment_status: "paid", client_reference_id: "u1", metadata: { user_id: "u1", pack_id: "starter" } };

async function request(type = "checkout.session.completed", object: Record<string, unknown> = session): Promise<Request> {
  const body = JSON.stringify({ type, data: { object } });
  return new Request("https://example.test/webhook", {
    method: "POST", body,
    headers: { "stripe-signature": await signStripePayload(body, secret, Math.floor(Date.now() / 1000)) },
  });
}

Deno.test("completed and delayed payment delivery grant a session's credits only once", async () => {
  const ledger = new Map<string, CreditGrant>();
  const grant = async (row: CreditGrant) => {
    if (ledger.has(row.stripe_session_id)) return { code: "23505" };
    ledger.set(row.stripe_session_id, row);
    return null;
  };
  for (const type of ["checkout.session.completed", "checkout.session.completed", "checkout.session.async_payment_succeeded"]) {
    assertEquals((await handleStripeWebhook(await request(type), secret, grant)).status, 200);
  }
  assertEquals([...ledger.values()], [{ user_id: "u1", delta: 100, reason: "bought 100 credits", stripe_session_id: "cs_test_launch" }]);
});

Deno.test("unpaid, unrelated, mismatched-owner and unknown-pack sessions never grant credits", async () => {
  let calls = 0;
  const grant = async () => { calls++; return null; };
  for (const [type, object] of [
    ["checkout.session.completed", { ...session, payment_status: "unpaid" }],
    ["payment_intent.succeeded", session],
    ["checkout.session.completed", { ...session, client_reference_id: "someone_else" }],
    ["checkout.session.completed", { ...session, metadata: { user_id: "u1", pack_id: "invalid" } }],
  ] as const) {
    assertEquals((await handleStripeWebhook(await request(type, object), secret, grant)).status, 200);
  }
  assertEquals(calls, 0);
});

Deno.test("bad signatures fail closed and database failures ask Stripe to retry", async () => {
  let calls = 0;
  const grant = async () => { calls++; return { code: "08006", message: "temporarily unavailable" }; };
  assertEquals((await handleStripeWebhook(await request(), "wrong_secret", grant)).status, 400);
  assertEquals(calls, 0);
  assertEquals((await handleStripeWebhook(await request(), secret, grant)).status, 500);
  assertEquals(calls, 1);
});
