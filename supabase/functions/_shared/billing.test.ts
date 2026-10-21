import { assertEquals, assertRejects } from "jsr:@std/assert";
import { purchaseDocuments, purchaseHistory } from "./billing.ts";

function response(overrides: Record<string, unknown> = {}) {
  return { client_reference_id: "user-a", metadata: { user_id: "user-a" }, amount_total: 199, currency: "usd", payment_intent: { latest_charge: { receipt_url: "https://pay.stripe.com/receipts/a" } }, invoice: { hosted_invoice_url: "https://invoice.stripe.com/i/a", invoice_pdf: "https://pay.stripe.com/invoice/a/pdf" }, ...overrides };
}
Deno.test("purchase documents retrieve the owned session and expanded Stripe documents", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    assertEquals(init?.method, "GET");
    assertEquals(init?.body, undefined);
    const url = new URL(String(input));
    assertEquals(url.pathname, "/v1/checkout/sessions/cs_a");
    assertEquals(url.searchParams.get("expand[0]"), "payment_intent.latest_charge");
    return Response.json(response());
  };
  try {
    const result = await purchaseDocuments("sk_test", "cs_a", "user-a");
    assertEquals(result.amountCents, 199);
    assertEquals(result.receiptUrl, "https://pay.stripe.com/receipts/a");
    assertEquals(result.invoicePdf, "https://pay.stripe.com/invoice/a/pdf");
  } finally { globalThis.fetch = original; }
});
Deno.test("purchase documents reject another user's checkout and unsafe document URLs", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json(response({ client_reference_id: "user-b" }));
    await assertRejects(() => purchaseDocuments("sk_test", "cs_b", "user-a"), Error, "does not belong");
    globalThis.fetch = async () => Response.json(response({ invoice: { hosted_invoice_url: "javascript:alert(1)", invoice_pdf: "https://evil.example/file" } }));
    const result = await purchaseDocuments("sk_test", "cs_a", "user-a");
    assertEquals(result.invoiceUrl, null); assertEquals(result.invoicePdf, null);
  } finally { globalThis.fetch = original; }
});
Deno.test("purchase history scopes to the verified user and keeps ledger rows when documents are unavailable", async () => {
  const calls: unknown[][] = [];
  const query = {
    select(...args: unknown[]) { calls.push(["select", ...args]); return this; },
    eq(...args: unknown[]) { calls.push(["eq", ...args]); return this; },
    gt(...args: unknown[]) { calls.push(["gt", ...args]); return this; },
    not(...args: unknown[]) { calls.push(["not", ...args]); return this; },
    order() { return this; },
    range(...args: unknown[]) { calls.push(["range", ...args]); return Promise.resolve({ data: [{ id: "p1", delta: 30, created_at: "2026-10-20", stripe_session_id: "cs_a" }], error: null, count: 25 }); },
  };
  const admin = { from(table: string) { assertEquals(table, "credit_ledger"); return query; } };
  const result = await purchaseHistory(admin as never, "user-a", "", 10);
  assertEquals(calls.some(call => JSON.stringify(call) === JSON.stringify(["eq", "user_id", "user-a"])), true);
  assertEquals(calls.some(call => JSON.stringify(call) === JSON.stringify(["range", 10, 19])), true);
  assertEquals(result.purchases[0].credits, 30);
  assertEquals(result.purchases[0].documentsUnavailable, true);
  assertEquals(result.nextOffset, 11);
});
