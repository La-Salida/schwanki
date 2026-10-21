import type { SupabaseClient } from "@supabase/supabase-js";
import { stripeRequest } from "./stripe.ts";

interface LedgerPurchase { id: string; delta: number; created_at: string; stripe_session_id: string }

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}
function documentUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["pay.stripe.com", "invoice.stripe.com"].includes(url.hostname) ? url.href : null;
  } catch { return null; }
}

export async function purchaseDocuments(stripeKey: string, sessionId: string, userId: string) {
  const session = await stripeRequest(stripeKey, `checkout/sessions/${encodeURIComponent(sessionId)}`, {
    "expand[0]": "payment_intent.latest_charge", "expand[1]": "invoice",
  }, "GET");
  if (session.client_reference_id !== userId || object(session.metadata).user_id !== userId) {
    throw new Error("Payment does not belong to this account");
  }
  const invoice = object(session.invoice);
  const charge = object(object(session.payment_intent).latest_charge);
  return {
    amountCents: typeof session.amount_total === "number" ? session.amount_total : null,
    currency: typeof session.currency === "string" ? session.currency : null,
    receiptUrl: documentUrl(charge.receipt_url),
    invoiceUrl: documentUrl(invoice.hosted_invoice_url),
    invoicePdf: documentUrl(invoice.invoice_pdf),
  };
}

/** User identity comes only from the verified JWT, never a client-supplied customer/session ID. */
export async function purchaseHistory(admin: Pick<SupabaseClient, "from">, userId: string, stripeKey: string, offset: number) {
  const pageSize = 10;
  const { data, error, count } = await admin.from("credit_ledger")
    .select("id,delta,created_at,stripe_session_id", { count: "exact" })
    .eq("user_id", userId).gt("delta", 0).not("stripe_session_id", "is", null)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + pageSize - 1);
  if (error) throw error;
  const rows = (data ?? []) as LedgerPurchase[];
  const purchases = await Promise.all(rows.map(async row => {
    const purchase = { id: row.id, credits: row.delta, createdAt: row.created_at };
    try {
      if (!stripeKey) throw new Error("Payments unavailable");
      return { ...purchase, ...await purchaseDocuments(stripeKey, row.stripe_session_id, userId), documentsUnavailable: false };
    } catch {
      return { ...purchase, amountCents: null, currency: null, receiptUrl: null, invoiceUrl: null, invoicePdf: null, documentsUnavailable: true };
    }
  }));
  return { purchases, nextOffset: offset + rows.length < (count ?? 0) ? offset + rows.length : null, billingConfigured: Boolean(stripeKey) };
}
