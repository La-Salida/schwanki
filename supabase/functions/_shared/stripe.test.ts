import { assertEquals } from "jsr:@std/assert";
import { safeReturnOrigin, signStripePayload, verifyStripeSignature } from "./stripe.ts";

const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });

Deno.test("verifyStripeSignature accepts a fresh, correctly signed body", async () => {
  const header = await signStripePayload(body, "whsec_test", 1_000);
  assertEquals(await verifyStripeSignature(body, header, "whsec_test", 1_010), true);
});

Deno.test("verifyStripeSignature rejects wrong secret, tampered body, stale or missing header", async () => {
  const header = await signStripePayload(body, "whsec_test", 1_000);
  assertEquals(await verifyStripeSignature(body, header, "whsec_other", 1_010), false);
  assertEquals(await verifyStripeSignature(body + " ", header, "whsec_test", 1_010), false);
  assertEquals(await verifyStripeSignature(body, header, "whsec_test", 2_000), false);
  assertEquals(await verifyStripeSignature(body, null, "whsec_test", 1_010), false);
  assertEquals(await verifyStripeSignature(body, "garbage", "whsec_test", 1_010), false);
});

Deno.test("safeReturnOrigin only allows https or localhost", () => {
  assertEquals(safeReturnOrigin("https://schwanki-staging.yj-3e3.workers.dev"), "https://schwanki-staging.yj-3e3.workers.dev");
  assertEquals(safeReturnOrigin("http://localhost:5173"), "http://localhost:5173");
  assertEquals(safeReturnOrigin("http://evil.example"), null);
  assertEquals(safeReturnOrigin("javascript:alert(1)"), null);
  assertEquals(safeReturnOrigin(null), null);
});
